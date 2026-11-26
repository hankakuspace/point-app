import { shopify, validateShopDomain } from "@/lib/shopify";

type CustomerIdentity = { shop: string; customerId: string };
export type CustomerTokenReason =
  | "verified" | "bearer_invalid" | "client_id_missing" | "secret_missing"
  | "jwt_structure_invalid" | "algorithm_rejected" | "signature_invalid"
  | "audience_mismatch" | "expired" | "not_yet_valid" | "sdk_verification_failed"
  | "dest_invalid" | "sub_missing" | "sub_invalid" | "issuer_unsupported"
  | "time_claim_invalid" | "issued_in_future" | "time_order_invalid";

// Never return or log JWTs, claims, signatures, exception messages or identifiers as diagnostics.
export async function inspectCustomerAccountToken(authorization: string | null): Promise<{
  identity: CustomerIdentity | null; reason: CustomerTokenReason;
}> {
  const deny = (reason: CustomerTokenReason) => ({ identity: null, reason });
  const match = /^Bearer ([^\s]+)$/i.exec(authorization || "");
  if (!match) return deny("bearer_invalid");
  if (!process.env.SHOPIFY_API_KEY) return deny("client_id_missing");
  if (!process.env.SHOPIFY_API_SECRET) return deny("secret_missing");
  const parts = match[1].split(".");
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return deny("jwt_structure_invalid");
  // This header preflight never authorizes a request; the SDK still verifies HS256 below.
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (header.alg !== "HS256") return deny("algorithm_rejected");
  } catch {
    return deny("jwt_structure_invalid");
  }
  let payload;
  try {
    payload = await shopify.session.decodeSessionToken(match[1]);
  } catch (error) {
    // Shopify SDK wraps JOSE errors in messages containing the token. Inspect only
    // known constant suffixes in memory; never forward or log the message itself.
    const message = error instanceof Error ? error.message : "";
    if (message === "Session token had invalid API key") return deny("audience_mismatch");
    if (message.endsWith('signature verification failed')) return deny("signature_invalid");
    if (message.endsWith('"exp" claim timestamp check failed')) return deny("expired");
    if (message.endsWith('"nbf" claim timestamp check failed')) return deny("not_yet_valid");
    return deny("sdk_verification_failed");
  }
  const now = Math.floor(Date.now() / 1000);
  const shop = typeof payload.dest === "string" ? validateShopDomain(payload.dest) : "";
  if (!shop || payload.dest !== shop) return deny("dest_invalid");
  if (payload.sub === undefined || payload.sub === null || payload.sub === "") return deny("sub_missing");
  const customer = typeof payload.sub === "string" ? /^gid:\/\/shopify\/Customer\/([1-9][0-9]*)$/.exec(payload.sub) : null;
  if (!customer) return deny("sub_invalid");
  // Customer Account claims may include the checkout issuer. Reject Admin and
  // cross-shop issuers; an omitted optional issuer remains supported.
  if (payload.iss !== undefined && payload.iss !== `https://${shop}/checkouts`) {
    return deny("issuer_unsupported");
  }
  if (payload.aud !== process.env.SHOPIFY_API_KEY) return deny("audience_mismatch");
  if (![payload.exp, payload.nbf, payload.iat].every(Number.isSafeInteger)) return deny("time_claim_invalid");
  if (payload.exp <= now) return deny("expired");
  if (payload.nbf > now) return deny("not_yet_valid");
  if (payload.iat > now) return deny("issued_in_future");
  if (payload.exp <= payload.iat || payload.nbf > payload.exp) return deny("time_order_invalid");
  return { identity: { shop, customerId: customer[1] }, reason: "verified" };
}

export async function verifyCustomerAccountToken(authorization: string | null) {
  return (await inspectCustomerAccountToken(authorization)).identity;
}
