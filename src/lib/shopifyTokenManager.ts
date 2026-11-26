import { randomUUID } from "node:crypto";
import type { Firestore, Transaction, DocumentReference } from "firebase-admin/firestore";
import { ShopifyTokenError } from "./shopifyTokenErrors";
import { classifyStoredToken, tokenDate, type TokenClassification } from "./shopifyTokenClassification";
import { consumeOfficialRecoveryApproval, type OfficialRecoveryExpectation } from "./shopifyTokenRecovery";
import { consumeLocalRecoveryApproval } from "./shopifyTokenRecovery";

export interface TokenOperation {
  id: string;
  kind: "refresh" | "oauth" | "redact" | "migration";
  phase: "in_flight" | "recovery_required" | "recovering";
  recovery?: {
    projectId: string; databaseId: string; clientId: string; firstAttemptAt: number;
    refreshExpiresAt?: number; attempts: number; usedApprovalIds: string[];
    attemptId?: string; approvalId?: string; operator?: string; claimExpiresAt?: number;
  };
  startedAt: number;
  expiresAt: number;
  generation: number;
  revision: number;
}
export interface StoredShopToken {
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  tokenType?: string | null;
  scope?: string;
  tokenClassification?: TokenClassification;
  tokenLastCompletedOperation?: { id: string; kind: string; generation: number; revision: number; completedAt: string; recoveryAttemptId?: string; approvalId?: string; operator?: string };
  installedAt?: string | { toMillis(): number };
  uninstalledAt?: string | null;
  redactedAt?: string | null;
  tokenRevision?: number;
  authGeneration?: number;
  authState?: "active" | "uninstalled" | "redacting" | "reauth_required" | "recovery_required";
  tokenOperation?: TokenOperation | null;
  tokenLastErrorCode?: string | null;
  tokenRetryAfter?: number | null;
}
interface Options {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  waitMs?: number;
  timeoutMs?: number;
}
const BUFFER = 5 * 60 * 1000;
export function canonicalTokenShop(value: string) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(value)) {
    throw new ShopifyTokenError("INVALID_SHOP", 400);
  }
  return value;
}
const number = (v: unknown) => {
  if (v === undefined) return 0;
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw new ShopifyTokenError("TOKEN_DATA_INVALID");
  return Number(v);
};
const nonempty = (v: unknown): v is string => typeof v === "string" && v.length > 0;
function expiry(v: unknown) {
  return typeof v === "string" && Number.isFinite(Date.parse(v)) ? Date.parse(v) : NaN;
}
function installationTime(value: StoredShopToken["installedAt"]) {
  if (typeof value === "string") return expiry(value);
  try { return value && typeof value.toMillis === "function" ? value.toMillis() : NaN; }
  catch { return NaN; }
}
export function tokenNeedsRefresh(data: StoredShopToken, now: number, context?: { shop: string; clientId: string }) {
  const kind = classifyStoredToken(data, context);
  return kind === "expiring_offline" && tokenDate(data.accessTokenExpiresAt) <= now + BUFFER;
}

export class ShopifyTokenManager {
  // Runtime-private memory only: never serialized into errors/logs or returned.
  // After process exit there is deliberately no evidence to guess/replay from.
  #knownResults = new Map<string, { op: TokenOperation; pair: Record<string, unknown> }>();
  #running = new Set<string>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly db: Firestore, private readonly options: Options) {
    this.now = options.now || Date.now;
    this.sleep = options.sleep || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
  }
  private ref(shop: string) { return this.db.collection("shops").doc(canonicalTokenShop(shop)); }
  private async read(ref: DocumentReference) {
    try { return await ref.get(); } catch { throw new ShopifyTokenError("SAVE_FAILED"); }
  }
  private async tx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    try { return await this.db.runTransaction(fn); }
    catch (e) { if (e instanceof ShopifyTokenError) throw e; throw new ShopifyTokenError("SAVE_FAILED"); }
  }
  private checkActive(d: StoredShopToken) {
    if (d.authState === "recovery_required") throw new ShopifyTokenError("RECOVERY_REQUIRED");
    if (d.authState === "reauth_required") throw new ShopifyTokenError("REAUTH_REQUIRED", 401);
    if ((d.authState && d.authState !== "active") || d.uninstalledAt || d.redactedAt) {
      throw new ShopifyTokenError("AUTH_INACTIVE", 401);
    }
  }
  private async acquire(shop: string, kind: "refresh" | "oauth") {
    const ref = this.ref(shop);
    const deadline = Date.now() + (this.options.waitMs ?? 5000);
    do {
      const result = await this.tx(async tx => {
        const snap = await tx.get(ref);
        const data = (snap.data() || {}) as StoredShopToken;
        if (!snap.exists && kind === "refresh") throw new ShopifyTokenError("SHOP_NOT_FOUND", 404);
        // Never steal an expired operation: a remote request may have succeeded.
        if (data.tokenOperation) {
          // A live recovery claim supersedes the original operation lease. A
          // normal request must neither restart it nor cancel it via that lease.
          if (data.tokenOperation.phase === "recovering" &&
              Number.isFinite(data.tokenOperation.recovery?.claimExpiresAt) &&
              data.tokenOperation.recovery!.claimExpiresAt! > this.now()) return { busy: true } as const;
          if (data.tokenOperation.phase === "recovery_required" || data.tokenOperation.expiresAt <= this.now()) {
            const state = ["reauth_required", "uninstalled", "redacting"].includes(data.authState || "") ? data.authState : "recovery_required";
            tx.set(ref, { authState: state, tokenLastErrorCode: "RECOVERY_REQUIRED",
              tokenOperation: { ...data.tokenOperation, phase: "recovery_required" } }, { merge: true });
            return { error: true } as const;
          }
          return { busy: true } as const;
        }
        if (kind === "refresh") {
          this.checkActive(data);
          if (!nonempty(data.accessToken)) throw new ShopifyTokenError("TOKEN_MISSING", 401);
          if (!tokenNeedsRefresh(data, this.now(), { shop, clientId: this.options.clientId() || "" })) return { token: data.accessToken } as const;
          if (!nonempty(data.refreshToken)) throw new ShopifyTokenError("REAUTH_REQUIRED", 401);
          if (!Number.isFinite(expiry(data.refreshTokenExpiresAt))) throw new ShopifyTokenError("TOKEN_DATA_INVALID");
          if (expiry(data.refreshTokenExpiresAt) <= this.now()) throw new ShopifyTokenError("REFRESH_EXPIRED", 401);
          if (data.tokenRetryAfter && data.tokenRetryAfter > this.now()) throw new ShopifyTokenError("TOKEN_BUSY");
        } else if (data.authState === "recovery_required") {
          throw new ShopifyTokenError("RECOVERY_REQUIRED");
        }
        const operation: TokenOperation = { id: randomUUID(), kind, phase: "in_flight", startedAt: this.now(),
          expiresAt: this.now() + 60000, generation: number(data.authGeneration), revision: number(data.tokenRevision) };
        const target = this.db as unknown as { projectId: string; databaseId: string };
        if (kind === "refresh" && (!nonempty(target.projectId) || !nonempty(target.databaseId))) throw new ShopifyTokenError("TOKEN_DATA_INVALID");
        if (kind === "refresh") operation.recovery = {
          projectId: target.projectId, databaseId: target.databaseId,
          clientId: this.options.clientId() || "", firstAttemptAt: operation.startedAt,
          refreshExpiresAt: expiry(data.refreshTokenExpiresAt), attempts: 0, usedApprovalIds: []
        };
        tx.set(ref, { tokenOperation: operation }, { merge: true });
        return { operation, data } as const;
      });
      if ("error" in result) throw new ShopifyTokenError("RECOVERY_REQUIRED");
      if (!("busy" in result)) return result;
      if (Date.now() >= deadline) break;
      await this.sleep(50);
    } while (true);
    throw new ShopifyTokenError("TOKEN_BUSY");
  }
  private same(data: StoredShopToken, op: TokenOperation) {
    return !data.uninstalledAt && !data.redactedAt && data.tokenOperation?.id === op.id && number(data.authGeneration) === op.generation &&
      number(data.tokenRevision) === op.revision && data.tokenOperation?.recovery?.attemptId === op.recovery?.attemptId;
  }
  private async fail(shop: string, op: TokenOperation, error: ShopifyTokenError, uncertain: boolean) {
    try {
      await this.tx(async tx => {
        const ref = this.ref(shop), data = (await tx.get(ref)).data() as StoredShopToken;
        if (!data || !this.same(data, op)) return;
        const reauth = error.code === "REAUTH_REQUIRED" || error.code === "REFRESH_EXPIRED";
        // OAuth has already consumed its one-use code when its outcome is unknown.
        tx.set(ref, { tokenLastErrorCode: error.code,
          authState: uncertain ? "recovery_required" : reauth ? "reauth_required" : data.authState || "active",
          tokenOperation: uncertain ? { ...op, phase: "recovery_required" } : null,
          tokenRetryAfter: uncertain ? null : this.now() + 30000 }, { merge: true });
      });
    } catch { /* Existing in-flight marker still blocks automatic replay, even if this write fails. */ }
  }
  private async exchange(shop: string, op: TokenOperation, grant: Record<string, unknown>) {
    let response: Response;
    const client_id = this.options.clientId(), client_secret = this.options.clientSecret();
    if (!client_id || !client_secret) throw new ShopifyTokenError("CLIENT_CONFIGURATION");
    try {
      response = await (this.options.fetch || fetch)(`https://${shop}/admin/oauth/access_token`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs ?? 10000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id, client_secret, ...grant }),
      });
    } catch { throw new ShopifyTokenError("RECOVERY_REQUIRED"); }
    let body: any;
    try { body = await response.json(); } catch { throw new ShopifyTokenError("RECOVERY_REQUIRED"); }
    if (!response.ok) {
      if (response.status === 429) throw new ShopifyTokenError("UPSTREAM_THROTTLED", 429);
      if (response.status >= 500) throw new ShopifyTokenError("RECOVERY_REQUIRED");
      if (body?.error === "invalid_client") throw new ShopifyTokenError("CLIENT_CONFIGURATION");
      // Only the documented terminal response at the refresh endpoint proves expiry/revocation.
      // Admin API 401s and unknown token-endpoint responses must not expire shop authentication.
      if (op.kind === "refresh" && response.status === 401 && body?.error === "invalid_request") {
        throw new ShopifyTokenError("REAUTH_REQUIRED", 401);
      }
      if (op.kind === "refresh" && (response.status === 400 || response.status === 401) && body?.error === "invalid_grant") throw new ShopifyTokenError("REAUTH_REQUIRED", 401);
      if (response.status === 401) throw new ShopifyTokenError("UPSTREAM_UNAUTHORIZED", 401);
      if (response.status === 403) throw new ShopifyTokenError("UPSTREAM_FORBIDDEN", 403);
      throw new ShopifyTokenError("UPSTREAM_REJECTED", 502);
    }
    if (!nonempty(body?.access_token) || !nonempty(body?.refresh_token) ||
        !Number.isFinite(body?.expires_in) || body.expires_in <= 0 ||
        !Number.isFinite(body?.refresh_token_expires_in) || body.refresh_token_expires_in <= 0) {
      throw new ShopifyTokenError("RECOVERY_REQUIRED");
    }
    // Measure from request start, conservatively, rather than response receipt.
    const access = op.startedAt + body.expires_in * 1000;
    const refresh = op.startedAt + body.refresh_token_expires_in * 1000;
    if (!Number.isFinite(access) || !Number.isFinite(refresh) || access <= this.now() || refresh <= this.now() || access > refresh) {
      throw new ShopifyTokenError("RECOVERY_REQUIRED");
    }
    try { return { accessToken: body.access_token, refreshToken: body.refresh_token,
      accessTokenExpiresAt: new Date(access).toISOString(), refreshTokenExpiresAt: new Date(refresh).toISOString(),
      tokenType: "expiring_offline", scope: typeof body.scope === "string" ? body.scope : undefined }; }
    catch { throw new ShopifyTokenError("RECOVERY_REQUIRED"); }
  }
  private savedResultMatches(d: StoredShopToken | undefined, op: TokenOperation, pair: Record<string, unknown>) {
    const generation = op.generation + (op.kind === "oauth" ? 1 : 0);
    const completed = d?.tokenLastCompletedOperation;
    return !!d && d.authState === "active" && !d.tokenOperation && !d.uninstalledAt && !d.redactedAt &&
      d.tokenRevision === op.revision + 1 && d.authGeneration === generation &&
      completed?.id === op.id && completed.kind === op.kind &&
      completed.generation === generation && completed.revision === op.revision + 1 &&
      d.accessToken === pair.accessToken && d.refreshToken === pair.refreshToken &&
      d.accessTokenExpiresAt === pair.accessTokenExpiresAt && d.refreshTokenExpiresAt === pair.refreshTokenExpiresAt;
  }
  private async persist(shop: string, op: TokenOperation, pair: Record<string, unknown>) {
    const expectedRevision = op.revision + 1;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.tx(async tx => {
          const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken;
          // A previous commit and its readback can both lose their responses.
          // Reconcile that exact operation before considering another CAS write.
          if (this.savedResultMatches(d, op, pair)) return;
          if (!d || !this.same(d, op) || d.tokenOperation?.phase !== "in_flight" ||
              (op.kind === "refresh" && d.authState !== undefined && d.authState !== "active")) {
            throw new ShopifyTokenError("STALE_OPERATION");
          }
          tx.set(ref, { ...pair, tokenRevision: expectedRevision,
            authGeneration: op.kind === "oauth" ? op.generation + 1 : op.generation,
            authState: "active", tokenOperation: null, tokenLastErrorCode: null, tokenRetryAfter: null,
            tokenLastCompletedOperation: { id: op.id, kind: op.kind, generation: op.generation + (op.kind === "oauth" ? 1 : 0), revision: expectedRevision, completedAt: new Date(this.now()).toISOString() },
            tokenClassification: { kind: "expiring_response", shop, clientId: this.options.clientId() || "", generation: op.generation + (op.kind === "oauth" ? 1 : 0), revision: expectedRevision, verifiedAt: new Date(this.now()).toISOString() },
            ...(op.kind === "oauth" ? { installedAt: new Date(op.startedAt).toISOString(), uninstalledAt: null, redactedAt: null } : {}),
            tokenRefreshedAt: new Date(this.now()).toISOString() }, { merge: true });
        });
        return;
      } catch (e) {
        if (e instanceof ShopifyTokenError && e.code === "STALE_OPERATION") throw e;
        // A commit response can be lost. Verify the entire pair and generation without logging it.
        let d: StoredShopToken;
        try { d = (await this.read(this.ref(shop))).data() as StoredShopToken; }
        catch {
          // Read unavailability does not prove commit failure. Retry only this
          // bounded persistence/reconciliation, never the Shopify exchange.
          continue;
        }
        if (this.savedResultMatches(d, op, pair)) return;
        if (!d || !this.same(d, op)) throw new ShopifyTokenError("STALE_OPERATION");
      }
    }
    throw new ShopifyTokenError("SAVE_FAILED");
  }
  private async run(shop: string, op: TokenOperation, data: StoredShopToken, grant: Record<string, unknown>) {
    let issued = false;
    this.#running.add(shop);
    try {
      const pair = await this.exchange(shop, op, grant); issued = true;
      const savedPair = { ...pair, scope: pair.scope ?? data.scope ?? "" };
      this.#knownResults.set(shop, { op: { ...op }, pair: savedPair });
      await this.persist(shop, op, savedPair);
      this.#knownResults.delete(shop);
      return pair.accessToken;
    } catch (e) {
      const error = e instanceof ShopifyTokenError ? e : new ShopifyTokenError("RECOVERY_REQUIRED");
      await this.fail(shop, op, error, issued || error.code === "RECOVERY_REQUIRED");
      throw error;
    } finally {
      this.#running.delete(shop);
    }
  }
  assertLocalRecoveryTarget(database: Firestore = this.db) {
    const target = database as unknown as { projectId?: string; databaseId?: string; _settings?: { servicePath?: string; port?: number; ssl?: boolean } };
    if (database !== this.db || target.projectId !== "demo-pointman-step4b" || target.databaseId !== "(default)" ||
        target._settings?.servicePath !== "127.0.0.1" || target._settings.port !== 8787 || target._settings.ssl !== false ||
        process.env.POINTMAN_LOCAL_TEST_MODE !== "1" ||
        process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787" ||
        process.env.FIREBASE_PROJECT_ID !== target.projectId ||
        process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_CLIENT_EMAIL ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error("LOCAL_RECOVERY_ONLY");
    }
  }
  assertLocalMigrationTarget(database: Firestore, clientId: string) {
    this.assertLocalRecoveryTarget(database);
    if (!clientId || clientId !== this.options.clientId()) throw new Error("MIGRATION_CLIENT_MISMATCH");
  }
  async inspectTokenRecovery(shop: string) {
    this.assertLocalRecoveryTarget();
    const d = (await this.read(this.ref(shop))).data() as StoredShopToken;
    const known = this.#knownResults.get(shop);
    return { state: ["active", "uninstalled", "redacting", "reauth_required", "recovery_required"].includes(d?.authState) ? d.authState : "unknown", hasKnownResult: !!known,
      running: this.#running.has(shop),
      expected: known ? { operationId: known.op.id, generation: known.op.generation,
        revision: known.op.revision } : null };
  }
  async recoverKnownTokenResult(shop: string, approval: object): Promise<{ code: string }> {
    this.assertLocalRecoveryTarget();
    canonicalTokenShop(shop);
    const expected = consumeLocalRecoveryApproval(this, shop, approval);
    if (this.#running.has(shop)) return { code: "BUSY" };
    this.#running.add(shop);
    try {
      const ref = this.ref(shop), known = this.#knownResults.get(shop);
      const result = await this.tx(async tx => {
        const d = (await tx.get(ref)).data() as StoredShopToken;
        if (!d) return { code: "STOP_UNKNOWN_RESULT" };
        if (d.authState === "redacting" || d.tokenOperation?.kind === "redact") return { code: "STOP_REDACTION" };
        if (d.authState === "uninstalled" || d.uninstalledAt || d.redactedAt) return { code: "STOP_INACTIVE" };
        if (d.authState === "reauth_required") return { code: "STOP_REAUTH_REQUIRED" };
        if (!known) {
          return { code: Number.isFinite(expiry(d.refreshTokenExpiresAt)) && expiry(d.refreshTokenExpiresAt) <= this.now()
            ? "STOP_REAUTH_REQUIRED" : "STOP_UNKNOWN_RESULT" };
        }
        // This path saves an already issued, privately retained pair; it never
        // reuses the old refresh token. Validate the new pair below instead.

        const { op, pair } = known;
        if (expected.operationId !== op.id || expected.generation !== op.generation ||
            expected.revision !== op.revision || op.kind !== "refresh") return { code: "STALE_OPERATION" };
        if (this.savedResultMatches(d, op, pair)) return { code: "ALREADY_SAVED" };
        if (!this.same(d, op) || d.authState !== "recovery_required" ||
            d.tokenOperation?.phase !== "recovery_required" || d.tokenOperation.kind !== "refresh") {
          return { code: "STALE_OPERATION" };
        }
        if (expiry(pair.accessTokenExpiresAt) <= this.now() ||
            expiry(pair.refreshTokenExpiresAt) <= this.now()) return { code: "STOP_RESULT_EXPIRED" };
        tx.set(ref, { ...pair, tokenRevision: op.revision + 1, authGeneration: op.generation,
          authState: "active", tokenOperation: null, tokenLastErrorCode: null, tokenRetryAfter: null,
          tokenRefreshedAt: new Date(this.now()).toISOString(),
          tokenLastCompletedOperation: { id: op.id, kind: op.kind, generation: op.generation, revision: op.revision + 1, completedAt: new Date(this.now()).toISOString() },
          tokenClassification: { kind: "expiring_response", shop, clientId: this.options.clientId() || "", generation: op.generation, revision: op.revision + 1, verifiedAt: new Date(this.now()).toISOString() }
        }, { merge: true });
        return { code: "RECOVERED" };
      });
      // A shared manager outlives this operation. Retain uncertain outcomes for
      // another explicit approval, but not confirmed saved or unusable results.
      if (["RECOVERED", "ALREADY_SAVED", "STOP_INACTIVE", "STOP_REDACTION", "STOP_REAUTH_REQUIRED", "STOP_RESULT_EXPIRED"].includes(result.code) &&
          this.#knownResults.get(shop) === known) this.#knownResults.delete(shop);
      return result;
    } catch (error) {
      // Keep private evidence for a separately approved retry after save/ack failure.
      return { code: error instanceof ShopifyTokenError && error.code === "TOKEN_DATA_INVALID" ? "STOP_INVALID_STATE" : "SAVE_FAILED" };
    } finally { this.#running.delete(shop); }
  }
  private completed(d: StoredShopToken, expected: OfficialRecoveryExpectation) {
    const c = d.tokenLastCompletedOperation;
    return d.authState === "active" && !d.tokenOperation && c?.kind === "refresh" && c.id === expected.operationId &&
      c.generation === expected.generation && c.revision === expected.revision + 1 &&
      d.authGeneration === c.generation && d.tokenRevision === c.revision &&
      classifyStoredToken(d, { shop: expected.shop, clientId: this.options.clientId() || "" }) === "expiring_offline";
  }
  private officialEligibility(d: StoredShopToken | undefined, expected?: OfficialRecoveryExpectation, shop?: string): string {
    if (!d) return "STOP_UNKNOWN_RESULT";
    if (d.authState === "redacting" || d.tokenOperation?.kind === "redact") return "STOP_REDACTION";
    if (d.authState === "uninstalled" || d.uninstalledAt || d.redactedAt) return "STOP_INACTIVE";
    if (expected && this.completed(d, expected)) return "ALREADY_SAVED";
    if (d.authState === "reauth_required") return "STOP_REAUTH_REQUIRED";
    const op = d.tokenOperation;
    if (!op || (expected && (op.id !== expected.operationId || number(d.authGeneration) !== expected.generation || number(d.tokenRevision) !== expected.revision)) || !this.same(d, op)) return "STALE_OPERATION";
    if (op.kind !== "refresh") return "STOP_REAUTH_REQUIRED";
    if (d.authState !== "recovery_required" || op.phase !== "recovery_required") return "BUSY";
    if (classifyStoredToken(d, { shop: expected?.shop || shop || "", clientId: this.options.clientId() || "" }) !== "expiring_offline") return "STOP_INVALID_STATE";
    const r = op.recovery;
    // A STEP14/legacy marker lacks these anchors and cannot establish eligibility.
    if (!r || r.projectId !== "demo-pointman-step4b" || r.databaseId !== "(default)" ||
        r.clientId !== this.options.clientId() || !r.clientId || r.firstAttemptAt !== op.startedAt ||
        !Number.isSafeInteger(r.firstAttemptAt) || r.firstAttemptAt > this.now() ||
        typeof r.refreshExpiresAt !== "number" || !Number.isFinite(r.refreshExpiresAt) || r.refreshExpiresAt !== expiry(d.refreshTokenExpiresAt) ||
        !Number.isSafeInteger(r.attempts) || r.attempts < 0 || !Array.isArray(r.usedApprovalIds) ||
        r.usedApprovalIds.length !== r.attempts || r.usedApprovalIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) || new Set(r.usedApprovalIds).size !== r.usedApprovalIds.length) return "STOP_NO_DURABLE_EVIDENCE";
    if (r.refreshExpiresAt <= this.now() || this.now() >= r.firstAttemptAt + 30 * 86400000) return "STOP_REAUTH_REQUIRED";
    if (r.attempts >= 3) return "STOP_ATTEMPT_LIMIT";
    return "ELIGIBLE";
  }
  async inspectOfficialRecovery(shop: string) {
    this.assertLocalRecoveryTarget(); canonicalTokenShop(shop);
    const d = (await this.read(this.ref(shop))).data() as StoredShopToken;
    try {
      const code = this.officialEligibility(d, undefined, shop);
      const op = d?.tokenOperation;
      return { code, expected: op && /^[a-zA-Z0-9_-]{1,128}$/.test(op.id) ? {
        projectId: "demo-pointman-step4b" as const, databaseId: "(default)" as const, shop,
        operationId: op.id, generation: number(d.authGeneration), revision: number(d.tokenRevision)
      } : null };
    } catch { return { code: "STOP_INVALID_STATE", expected: null }; }
  }
  async recoverOfficialTokenResult(shop: string, capability: object): Promise<{ code: string }> {
    this.assertLocalRecoveryTarget(); canonicalTokenShop(shop);
    // Injected transport is mandatory. Production/global fetch is never used here.
    if (!this.options.fetch) throw new Error("SYNTHETIC_TRANSPORT_REQUIRED");
    const approval = consumeOfficialRecoveryApproval(this, shop, capability);
    if (this.#running.has(shop)) return { code: "BUSY" };
    this.#running.add(shop);
    const attemptId = randomUUID(); let claimed: StoredShopToken | undefined;
    try {
      const claim = await this.tx(async tx => {
        const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken;
        if (approval.expiresAt <= Date.now()) return "APPROVAL_EXPIRED";
        if (d?.tokenLastCompletedOperation?.approvalId === approval.approvalId) return "APPROVAL_REUSED";
        const code = this.officialEligibility(d, approval);
        if (code !== "ELIGIBLE") return code;
        const op = d.tokenOperation!, r = op.recovery!;
        if (r.usedApprovalIds.includes(approval.approvalId)) return "APPROVAL_REUSED";
        const next: TokenOperation = { ...op, phase: "recovering", recovery: { ...r,
          attemptId, approvalId: approval.approvalId, operator: approval.operator,
          claimExpiresAt: this.now() + 60000, attempts: r.attempts + 1,
          usedApprovalIds: [...r.usedApprovalIds, approval.approvalId] } };
        tx.set(ref, { tokenOperation: next }, { merge: true });
        return { ...d, tokenOperation: next };
      });
      if (typeof claim === "string") return { code: claim };
      claimed = claim;
      const op = claimed.tokenOperation!;
      const requestStart = this.now();
      // Keep original firstAttemptAt for the recovery boundary; use this request's
      // start only to compute the TTL of the returned pair.
      const pair = await this.exchange(shop, { ...op, startedAt: requestStart }, { grant_type: "refresh_token", refresh_token: claimed.refreshToken });
      await this.tx(async tx => {
        const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken;
        if (!d || d.authState !== "recovery_required" || d.uninstalledAt || d.redactedAt ||
            !this.same(d, op) || d.tokenOperation?.phase !== "recovering" ||
            d.tokenOperation.recovery?.attemptId !== attemptId) throw new ShopifyTokenError("STALE_OPERATION");
        tx.set(ref, { ...pair, scope: pair.scope ?? d.scope ?? "", authState: "active",
          authGeneration: op.generation, tokenRevision: op.revision + 1, tokenOperation: null,
          tokenLastErrorCode: null, tokenRetryAfter: null, tokenRefreshedAt: new Date(this.now()).toISOString(),
          tokenLastCompletedOperation: { id: op.id, kind: "refresh", generation: op.generation,
            revision: op.revision + 1, completedAt: new Date(this.now()).toISOString(), recoveryAttemptId: attemptId, approvalId: approval.approvalId, operator: approval.operator },
          tokenClassification: { kind: "expiring_response", shop, clientId: this.options.clientId()!,
            generation: op.generation, revision: op.revision + 1, verifiedAt: new Date(this.now()).toISOString() }
        }, { merge: true });
      });
      return { code: "RECOVERED" };
    } catch (e) {
      // Read-only completion check handles commit success with lost acknowledgement.
      try { const d = (await this.read(this.ref(shop))).data() as StoredShopToken;
        if (d && this.completed(d, approval)) return { code: "ALREADY_SAVED" };
      } catch { /* Ambiguity remains frozen. */ }
      if (claimed) {
        try { await this.tx(async tx => {
          const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken, op = claimed!.tokenOperation!;
          if (!d || !this.same(d, op) || d.tokenOperation?.recovery?.attemptId !== attemptId ||
              d.authState !== "recovery_required") return;
          const terminal = e instanceof ShopifyTokenError && e.code === "REAUTH_REQUIRED";
          tx.set(ref, { authState: terminal ? "reauth_required" : "recovery_required",
            tokenLastErrorCode: e instanceof ShopifyTokenError ? e.code : "SAVE_FAILED",
            tokenOperation: { ...d.tokenOperation, phase: "recovery_required" } }, { merge: true });
        }); } catch { /* Never clear a claim merely because it expired. */ }
      }
      return { code: e instanceof ShopifyTokenError ? e.code : "SAVE_FAILED" };
    } finally { this.#running.delete(shop); }
  }

  async prepareOfficialReauthentication(shop: string, capability: object): Promise<{ code: string }> {
    this.assertLocalRecoveryTarget(); canonicalTokenShop(shop);
    const a = consumeOfficialRecoveryApproval(this, shop, capability);
    if (this.#running.has(shop)) return { code: "BUSY" };
    return this.tx(async tx => {
      const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken;
      const code = this.officialEligibility(d, a);
      if (!["STOP_REAUTH_REQUIRED", "STOP_NO_DURABLE_EVIDENCE"].includes(code) || !d?.tokenOperation ||
          !this.same(d, d.tokenOperation) || d.tokenOperation.kind === "migration" || d.tokenOperation.id !== a.operationId ||
          number(d.authGeneration) !== a.generation || number(d.tokenRevision) !== a.revision ||
          d.tokenOperation.phase !== "recovery_required") return { code };
      tx.set(ref, { authState: "reauth_required", authGeneration: a.generation + 1,
        tokenOperation: null, tokenLastErrorCode: "REAUTH_REQUIRED", tokenRetryAfter: null }, { merge: true });
      return { code: "REAUTH_PREPARED" };
    });
  }
  async getAccessToken(shop: string) {
    const result = await this.acquire(shop, "refresh");
    if ("token" in result) return result.token;
    return this.run(shop, result.operation, result.data, { grant_type: "refresh_token", refresh_token: result.data.refreshToken });
  }
  async exchangeOAuth(shop: string, code: string) {
    canonicalTokenShop(shop);
    if (!nonempty(code)) throw new ShopifyTokenError("UPSTREAM_REJECTED", 400);
    const result = await this.acquire(shop, "oauth");
    if (!("operation" in result)) throw new ShopifyTokenError("TOKEN_BUSY");
    await this.run(shop, result.operation, result.data, { code, expiring: 1 });
  }
  // Caller MUST verify webhook HMAC before using this. Event time is ordering evidence,
  // not authentication. Missing/ambiguous order never permits destructive processing.
  async invalidate(shop: string, kind: "uninstalled" | "redact", triggeredAt: string | null) {
    const ref = this.ref(shop), eventAt = triggeredAt ? Date.parse(triggeredAt) : NaN;
    return this.tx(async tx => {
      const d = ((await tx.get(ref)).data() || {}) as StoredShopToken;
      const installedAt = installationTime(d.installedAt);
      if (Number.isFinite(installedAt)) {
        if (!Number.isFinite(eventAt) || eventAt > this.now() + 60000) throw new ShopifyTokenError("RECOVERY_REQUIRED");
        if (eventAt < installedAt) return false;
      }
      if (d.authState === "redacting") {
        // Redaction is destructive and cannot be automatically taken over after a crash.
        throw new ShopifyTokenError("RECOVERY_REQUIRED");
      }
      const generation = number(d.authGeneration) + 1;
      tx.set(ref, { accessToken: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null,
        tokenType: null, authGeneration: generation, tokenRevision: number(d.tokenRevision) + 1,
        authState: kind === "redact" ? "redacting" : "uninstalled", tokenLastErrorCode: null, tokenRetryAfter: null,
        tokenOperation: kind === "redact" ? { id: randomUUID(), kind: "redact", phase: "in_flight",
          startedAt: this.now(), expiresAt: this.now() + 60000, generation, revision: number(d.tokenRevision) + 1 } : null,
        ...(kind === "redact" ? { redactedAt: new Date(this.now()).toISOString() } : { uninstalledAt: new Date(this.now()).toISOString() })
      }, { merge: true });
      return true;
    });
  }
  async finishRedaction(shop: string) {
    await this.tx(async tx => {
      const ref = this.ref(shop), d = (await tx.get(ref)).data() as StoredShopToken;
      if (d?.authState !== "redacting" || d.tokenOperation?.kind !== "redact") throw new ShopifyTokenError("STALE_OPERATION");
      tx.set(ref, { authState: "uninstalled", tokenOperation: null }, { merge: true });
    });
  }
}
