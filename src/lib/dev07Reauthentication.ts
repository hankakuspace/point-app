import type { Firestore } from "firebase-admin/firestore";

// No client, credentials, HTTP route or automatic invocation is provided here.
export const DEV07_REAUTH_EXPECTED = Object.freeze({
  projectId: "point-app-1bb1d", databaseId: "(default)",
  shop: "pointman-dev-07-plus.myshopify.com",
  operationId: "51c875e6-72a1-416f-8eb8-ec62932c7b83",
  generation: 0, revision: 0,
  startedAt: Date.parse("2026-11-18T07:54:29.122Z"),
  expiresAt: Date.parse("2026-11-18T07:55:29.122Z"),
  installedAt: "2026-06-24T04:51:19.764Z",
  tokenRefreshedAt: "2026-06-12T02:02:57.559Z",
  accessExpiry: "2026-06-24T05:51:18.763Z",
  refreshExpiry: "2026-09-22T04:51:18.763Z",
});
export const DEV07_REAUTH_READ_MASK = Object.freeze([
  "authState", "authGeneration", "tokenRevision", "tokenLastErrorCode", "tokenRetryAfter",
  "tokenOperation", "tokenLastCompletedOperation.id", "tokenLastCompletedOperation.kind", "tokenLastCompletedOperation.generation",
  "tokenLastCompletedOperation.revision", "tokenLastCompletedOperation.completedAt", "installedAt", "tokenRefreshedAt",
  "accessTokenExpiresAt", "refreshTokenExpiresAt", "uninstalledAt", "redactedAt",
]);
const codes = new Set([
  "REAUTH_TARGET_MISMATCH", "REAUTH_APPROVAL_MISMATCH", "REAUTH_DOCUMENT_MISSING",
  "REAUTH_LIFECYCLE_MISMATCH", "REAUTH_OPERATION_MISMATCH", "REAUTH_GENERATION_MISMATCH",
  "REAUTH_SAVED_STATE_CHANGED", "REAUTH_PREPARE_CONFLICT", "REAUTH_PREPARE_RESULT_UNKNOWN",
  "REAUTH_READBACK_UNKNOWN",
]);
class PreparationError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const requireState = (ok: unknown, code: string) => { if (!ok) throw new PreparationError(code); };

// Mirrors v3 prepareOfficialReauthentication's state transition, but is a separately
// reviewed fixed-target entry. The v3 Emulator-only recovery guard remains untouched.
export async function prepareDev07Reauthentication(
  db: Firestore,
  approval: { shop: string; operationId: string; generation: number; revision: number },
) {
  const e = DEV07_REAUTH_EXPECTED;
  const target = db as unknown as { projectId?: string; databaseId?: string };
  requireState(target.projectId === e.projectId && target.databaseId === e.databaseId, "REAUTH_TARGET_MISMATCH");
  requireState(approval?.shop === e.shop && approval.operationId === e.operationId &&
    approval.generation === e.generation && approval.revision === e.revision, "REAUTH_APPROVAL_MISMATCH");
  const ref = db.collection("shops").doc(e.shop);
  try {
    await db.runTransaction(async tx => {
      const [snap] = await tx.getAll(ref, { fieldMask: [...DEV07_REAUTH_READ_MASK] });
      requireState(snap?.exists, "REAUTH_DOCUMENT_MISSING");
      const d = snap.data()!;
      requireState(d.uninstalledAt == null && d.redactedAt == null &&
        d.installedAt === e.installedAt, "REAUTH_LIFECYCLE_MISMATCH");
      const op = d.tokenOperation;
      requireState(d.authState === "recovery_required" && d.tokenLastErrorCode === "RECOVERY_REQUIRED" &&
        d.tokenRetryAfter == null && op?.id === e.operationId && op.kind === "oauth" &&
        op.phase === "recovery_required" && op.startedAt === e.startedAt && op.expiresAt === e.expiresAt &&
        op.recovery == null && Object.keys(op).length === 7, "REAUTH_OPERATION_MISMATCH");
      // The observed top-level fields are absent. Do not silently normalize a later edit.
      requireState(d.authGeneration === undefined && d.tokenRevision === undefined &&
        op.generation === 0 && op.revision === 0, "REAUTH_GENERATION_MISMATCH");
      requireState(d.tokenLastCompletedOperation == null && d.tokenRefreshedAt === e.tokenRefreshedAt &&
        d.accessTokenExpiresAt === e.accessExpiry && d.refreshTokenExpiresAt === e.refreshExpiry,
      "REAUTH_SAVED_STATE_CHANGED");
      // No token/expiry/revision/customer fields are read or written. This is NOT OAuth success.
      tx.set(ref, { authState: "reauth_required", authGeneration: 1, tokenOperation: null,
        tokenLastErrorCode: "REAUTH_REQUIRED", tokenRetryAfter: null }, { merge: true });
    }, { maxAttempts: 1 });
  } catch (error) {
    if (error instanceof PreparationError && codes.has(error.code)) throw error;
    throw new PreparationError((error as { code?: unknown })?.code === 10
      ? "REAUTH_PREPARE_CONFLICT" : "REAUTH_PREPARE_RESULT_UNKNOWN");
  }
  try {
    const [snap] = await db.getAll(ref, { fieldMask: [...DEV07_REAUTH_READ_MASK] });
    const d = snap?.data();
    requireState(snap?.exists && d?.authState === "reauth_required" && d.authGeneration === 1 &&
      d.tokenRevision === undefined && d.tokenOperation === null && d.tokenLastErrorCode === "REAUTH_REQUIRED" &&
      d.tokenRetryAfter === null && d.uninstalledAt == null && d.redactedAt == null &&
      d.installedAt === e.installedAt && d.accessTokenExpiresAt === e.accessExpiry &&
      d.refreshTokenExpiresAt === e.refreshExpiry && d.tokenRefreshedAt === e.tokenRefreshedAt &&
      d.tokenLastCompletedOperation == null, "REAUTH_READBACK_UNKNOWN");
  } catch { throw new PreparationError("REAUTH_READBACK_UNKNOWN"); }
  return { code: "REAUTH_PREPARED" as const, generation: 1, revision: 0,
    previousExchangeOutcome: "UNKNOWN" as const, oauthCompleted: false as const };
}
