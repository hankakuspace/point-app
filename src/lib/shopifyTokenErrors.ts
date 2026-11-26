export type TokenErrorCode =
  | "INVALID_SHOP" | "SHOP_NOT_FOUND" | "TOKEN_MISSING" | "TOKEN_DATA_INVALID"
  | "AUTH_INACTIVE" | "TOKEN_BUSY" | "RECOVERY_REQUIRED" | "SAVE_FAILED"
  | "STALE_OPERATION" | "REFRESH_EXPIRED" | "REAUTH_REQUIRED"
  | "NETWORK_ERROR" | "UPSTREAM_UNAUTHORIZED" | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_THROTTLED" | "UPSTREAM_UNAVAILABLE" | "UPSTREAM_REJECTED"
  | "UPSTREAM_GRAPHQL" | "CLIENT_CONFIGURATION"
  | "LEGACY_TOKEN_REJECTED" | "UPSTREAM_SCOPE_REQUIRED";

// Never attach upstream bodies, request headers, tokens, or raw exception causes.
export class ShopifyTokenError extends Error {
  constructor(public readonly code: TokenErrorCode, public readonly status = 503) {
    super(code);
    this.name = "ShopifyTokenError";
  }
}
export function safeTokenError(error: unknown) {
  return error instanceof ShopifyTokenError ? error : new ShopifyTokenError("UPSTREAM_UNAVAILABLE");
}
export function logTokenError(operation: string, error: unknown) {
  const safe = safeTokenError(error);
  console.error("Shopify operation failed", { operation, code: safe.code, status: safe.status });
}

// Parse only safe discriminators in memory. Never retain upstream messages in errors.
export function classifyAdminPermission(body: unknown): TokenErrorCode {
  const data = body as { errors?: unknown; error?: unknown } | null;
  const errors = Array.isArray(data?.errors) ? data.errors : [data?.errors, data?.error];
  const messages = errors.map((e: any) => typeof e === "string" ? e : typeof e?.message === "string" ? e.message : "");
  if (messages.some(m => m.includes("Non-expiring access tokens are no longer accepted for the Admin API"))) {
    return "LEGACY_TOKEN_REJECTED";
  }
  if (errors.some((e: any) => e?.extensions?.code === "ACCESS_DENIED") ||
      messages.some(m => /required access:|requires? (?:the )?[a-z_]+ scope|missing (?:required )?(?:access )?scope|not approved to access|not approved for|not requested (?:the appropriate|access) scope/i.test(m))) {
    return "UPSTREAM_SCOPE_REQUIRED";
  }
  return "UPSTREAM_FORBIDDEN";
}
