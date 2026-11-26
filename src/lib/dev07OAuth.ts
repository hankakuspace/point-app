import type { Firestore } from "firebase-admin/firestore";
import { ShopifyTokenManager } from "./shopifyTokenManager";
import { ShopifyTokenError } from "./shopifyTokenErrors";

export const DEV07_OAUTH_SHOP = "pointman-dev-07-plus.myshopify.com";
export const DEV07_REQUIRED_SCOPES = [
  "read_customers", "read_discounts", "read_orders", "read_products",
  "write_discounts", "customer_read_customers",
] as const;

export async function getDev07OAuthGeneration(db: Firestore): Promise<number> {
  const ref = db.collection("shops").doc(DEV07_OAUTH_SHOP);
  const [snap] = await db.getAll(ref, { fieldMask: ["authState", "authGeneration", "tokenRevision",
    "tokenOperation", "uninstalledAt", "redactedAt"] });
  const d = snap?.data();
  if (!snap?.exists || !d || d.uninstalledAt || d.redactedAt || d.tokenOperation != null ||
      !["active", "reauth_required"].includes(d.authState) ||
      !Number.isSafeInteger(d.authGeneration) || d.authGeneration < 1 ||
      (d.tokenRevision !== undefined && (!Number.isSafeInteger(d.tokenRevision) || d.tokenRevision < 0))) {
    console.error("DEV07_OAUTH_DIAGNOSTIC", { code: "OAUTH_ENTRY_STATE_REJECTED" });
    throw new ShopifyTokenError("RECOVERY_REQUIRED");
  }
  return d.authGeneration;
}

// This adapter is only for the fixed shop's OAuth callback. Legacy refresh stays blocked.
// Reuse the frozen v3 operation acquisition, external exchange, CAS and failure handling.
export async function exchangeDev07OAuth(db: Firestore, shop: string, code: string, boundGeneration: number) {
  if (shop !== DEV07_OAUTH_SHOP) throw new ShopifyTokenError("INVALID_SHOP", 400);
  if (!Number.isSafeInteger(boundGeneration) || boundGeneration < 1) throw new ShopifyTokenError("STALE_OPERATION");
  const clientId = process.env.SHOPIFY_API_KEY || "";
  const ref = db.collection("shops").doc(DEV07_OAUTH_SHOP);
  let expected: { generation: number; revision: number } | undefined;
  let pair: { access: string; refresh: string } | undefined;
  let operationStartedAt: number | undefined;
  let diagnostic: string | undefined;
  let httpStatus: number | undefined;
  let stage: "acquire" | "exchange" | "persist" | "readback" = "acquire";
  const rejectExchange = (code: string): never => {
    diagnostic = code;
    throw new ShopifyTokenError("RECOVERY_REQUIRED");
  };
  const counter = (v: unknown) => v === undefined ? 0 : v;
  const active = (d: Record<string, any>) => {
    // Legacy lifecycle handlers do not increment generation. Do not resurrect their tombstones.
    if (d.uninstalledAt || d.redactedAt ||
        (d.authState && !["active", "reauth_required"].includes(d.authState))) {
      throw new ShopifyTokenError("AUTH_INACTIVE", 401);
    }
  };
  const targetDb = {
    collection(name: string) {
      if (name !== "shops") throw new ShopifyTokenError("INVALID_SHOP", 400);
      return { doc(id: string) {
        if (id !== DEV07_OAUTH_SHOP) throw new ShopifyTokenError("INVALID_SHOP", 400);
        return ref;
      } };
    },
    runTransaction: <T>(fn: (tx: any) => Promise<T>) => db.runTransaction(async tx => fn({
      get: async (r: typeof ref) => {
        if (r !== ref) throw new ShopifyTokenError("INVALID_SHOP", 400);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ShopifyTokenError("SHOP_NOT_FOUND", 404);
        const d = snap.data()!;
        active(d);
        if (!expected) {
          const generation = counter(d.authGeneration), revision = counter(d.tokenRevision);
          if (!Number.isSafeInteger(generation) || Number(generation) < 0 ||
              !Number.isSafeInteger(revision) || Number(revision) < 0) {
            throw new ShopifyTokenError("TOKEN_DATA_INVALID");
          }
          if (generation !== boundGeneration) throw new ShopifyTokenError("STALE_OPERATION");
          expected = { generation: Number(generation), revision: Number(revision) };
        }
        return snap;
      },
      set: (r: typeof ref, data: any, options: any) => {
        if (r !== ref) throw new ShopifyTokenError("INVALID_SHOP", 400);
        if (data.tokenOperation?.kind === "oauth" && data.tokenOperation.phase === "in_flight") {
          operationStartedAt = data.tokenOperation.startedAt;
        }
        tx.set(ref, data, options);
      },
    })),
  } as unknown as Firestore;
  const manager = new ShopifyTokenManager(targetDb, {
    clientId: () => clientId, clientSecret: () => process.env.SHOPIFY_API_SECRET,
    waitMs: 0,
    fetch: async (url, options) => {
      if (String(url) !== `https://${DEV07_OAUTH_SHOP}/admin/oauth/access_token` || options?.method !== "POST") {
        throw new ShopifyTokenError("INVALID_SHOP", 400);
      }
      stage = "exchange";
      let response: Response;
      try { response = await fetch(url, options); }
      catch { return rejectExchange(options?.signal?.aborted ? "TOKEN_REQUEST_TIMEOUT" : "TOKEN_TRANSPORT_FAILED"); }
      httpStatus = response.status;
      return { ok: response.ok, status: response.status, json: async () => {
        let body: any;
        try { body = await response.json(); }
        catch { return rejectExchange("TOKEN_RESPONSE_JSON_INVALID"); }
        if (!response.ok) {
          diagnostic = response.status === 401 ? "TOKEN_HTTP_401" : response.status === 403 ? "TOKEN_HTTP_403" :
            response.status === 429 ? "TOKEN_HTTP_429" : response.status >= 500 ? "TOKEN_HTTP_5XX" : "TOKEN_HTTP_OTHER";
        }
        if (response.ok) {
          const scopes = typeof body?.scope === "string" ? body.scope.split(",").map((s: string) => s.trim()) : [];
          // Shopify write_discounts includes read_discounts and may omit the latter
          // from the returned scope list. Preserve all six effective permissions.
          const hasRequiredScope = (required: typeof DEV07_REQUIRED_SCOPES[number]) =>
            scopes.includes(required) || (required === "read_discounts" && scopes.includes("write_discounts"));
          if (!DEV07_REQUIRED_SCOPES.every(hasRequiredScope)) {
            // The one-use code may already be consumed. Keep the v3 uncertain-operation marker.
            return rejectExchange("TOKEN_REQUIRED_SCOPE_MISSING");
          }
          if (typeof body?.access_token !== "string" || !body.access_token ||
              typeof body.refresh_token !== "string" || !body.refresh_token ||
              !Number.isFinite(body.expires_in) || body.expires_in <= 0 ||
              !Number.isFinite(body.refresh_token_expires_in) || body.refresh_token_expires_in <= 0) {
            return rejectExchange("TOKEN_PAIR_INVALID");
          }
          const access = Number(operationStartedAt) + body.expires_in * 1000;
          const refresh = Number(operationStartedAt) + body.refresh_token_expires_in * 1000;
          if (!Number.isFinite(access) || !Number.isFinite(refresh) || access <= Date.now() ||
              refresh <= Date.now() || access > refresh) return rejectExchange("TOKEN_EXPIRY_INVALID");
          pair = { access: body.access_token, refresh: body.refresh_token };
          stage = "persist";
        }
        return body;
      } } as Response;
    },
  });
  try {
    await manager.exchangeOAuth(shop, code);
    stage = "readback";
    const d = (await ref.get()).data();
    if (!d || !pair || !expected) throw new ShopifyTokenError("SAVE_FAILED");
    active(d);
    const generation = expected.generation + 1, revision = expected.revision + 1;
    if (d.accessToken !== pair.access || d.refreshToken !== pair.refresh ||
        !pair.access || !pair.refresh || d.authState !== "active" || d.tokenOperation != null ||
        d.authGeneration !== generation || d.tokenRevision !== revision ||
        d.tokenLastCompletedOperation?.kind !== "oauth" ||
        d.tokenLastCompletedOperation?.generation !== generation || d.tokenLastCompletedOperation?.revision !== revision ||
        d.tokenClassification?.kind !== "expiring_response" || d.tokenClassification?.shop !== shop ||
        d.tokenClassification?.clientId !== clientId || d.tokenClassification?.generation !== generation ||
        d.tokenClassification?.revision !== revision ||
        !(Date.parse(d.accessTokenExpiresAt) > Date.now()) ||
        !(Date.parse(d.refreshTokenExpiresAt) >= Date.parse(d.accessTokenExpiresAt))) {
      throw new ShopifyTokenError("SAVE_FAILED");
    }
  } catch (error) {
    if (!diagnostic) {
      const failedStage = String(stage);
      diagnostic = failedStage === "readback" ? "TOKEN_READBACK_FAILED" :
        failedStage === "persist" ? (error instanceof ShopifyTokenError && error.code === "STALE_OPERATION"
          ? "TOKEN_CAS_MISMATCH" : error instanceof ShopifyTokenError && error.code === "SAVE_FAILED"
            ? "TOKEN_SAVE_FAILED" : "TOKEN_MANAGER_AFTER_VALIDATION_REJECTED") :
        failedStage === "acquire" ? "TOKEN_ACQUIRE_REJECTED" : "TOKEN_EXCHANGE_UNCLASSIFIED";
    }
    // Only fixed codes and an HTTP status. No body, URL, headers, exception or token values.
    console.error("DEV07_OAUTH_DIAGNOSTIC", { code: diagnostic,
      ...(Number.isInteger(httpStatus) ? { httpStatus } : {}) });
    throw error;
  } finally {
    pair = undefined;
  }
}
