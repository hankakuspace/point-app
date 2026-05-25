// src/lib/shopifyAppProxy.ts
import crypto from "crypto";

function timingSafeEqualString(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyShopifyAppProxySignature(searchParams: URLSearchParams) {
  const signature = searchParams.get("signature") || "";
  const secret = process.env.SHOPIFY_API_SECRET || "";

  if (!signature || !secret) {
    return false;
  }

  const message = Array.from(searchParams.entries())
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return timingSafeEqualString(digest, signature);
}
