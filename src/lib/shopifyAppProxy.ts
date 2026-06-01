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

function buildAppProxySignatureMessage(searchParams: URLSearchParams) {
  const params = new Map<string, string[]>();

  for (const [key, value] of searchParams.entries()) {
    if (key === "signature") {
      continue;
    }

    const values = params.get(key) || [];
    values.push(value);
    params.set(key, values);
  }

  return Array.from(params.entries())
    .map(([key, values]) => `${key}=${values.join(",")}`)
    .sort()
    .join("");
}

export function verifyShopifyAppProxySignature(searchParams: URLSearchParams) {
  const signature = searchParams.get("signature") || "";
  const secret = process.env.SHOPIFY_API_SECRET || "";

  const keys = Array.from(new Set(Array.from(searchParams.keys()))).sort();

  if (!signature || !secret) {
    console.warn("App Proxy signature missing", {
      hasSignature: Boolean(signature),
      hasSecret: Boolean(secret),
      keys,
    });

    return false;
  }

  const message = buildAppProxySignatureMessage(searchParams);

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  const valid = timingSafeEqualString(digest, signature);

  if (!valid) {
    console.warn("App Proxy signature mismatch", {
      keys,
      messageLength: message.length,
      signaturePrefix: signature.slice(0, 8),
      digestPrefix: digest.slice(0, 8),
    });
  }

  return valid;
}
