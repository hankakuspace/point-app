// src/lib/shopifyAppProxy.ts
import crypto from "crypto";

type AppProxyVerificationInput = URL | URLSearchParams;

function timingSafeEqualString(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function getSearchParams(input: AppProxyVerificationInput) {
  return input instanceof URL ? input.searchParams : input;
}

function getRawSearch(input: AppProxyVerificationInput) {
  if (!(input instanceof URL)) {
    return "";
  }

  return input.search.startsWith("?") ? input.search.slice(1) : input.search;
}

function buildDecodedGroupedMessage(searchParams: URLSearchParams) {
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

function buildRawPairMessage(rawSearch: string) {
  if (!rawSearch) {
    return "";
  }

  return rawSearch
    .split("&")
    .filter((pair) => pair && !pair.startsWith("signature="))
    .sort()
    .join("");
}

function buildDecodedPairMessage(rawSearch: string) {
  if (!rawSearch) {
    return "";
  }

  return rawSearch
    .split("&")
    .filter((pair) => pair && !pair.startsWith("signature="))
    .map((pair) => decodeURIComponent(pair))
    .sort()
    .join("");
}

function buildDecodedPairAmpersandMessage(rawSearch: string) {
  if (!rawSearch) {
    return "";
  }

  return rawSearch
    .split("&")
    .filter((pair) => pair && !pair.startsWith("signature="))
    .map((pair) => decodeURIComponent(pair))
    .sort()
    .join("&");
}

function buildRawPairAmpersandMessage(rawSearch: string) {
  if (!rawSearch) {
    return "";
  }

  return rawSearch
    .split("&")
    .filter((pair) => pair && !pair.startsWith("signature="))
    .sort()
    .join("&");
}


function buildRawGroupedMessage(rawSearch: string) {
  if (!rawSearch) {
    return "";
  }

  const params = new Map<string, string[]>();

  for (const pair of rawSearch.split("&")) {
    if (!pair || pair.startsWith("signature=")) {
      continue;
    }

    const equalIndex = pair.indexOf("=");
    const key = equalIndex >= 0 ? pair.slice(0, equalIndex) : pair;
    const value = equalIndex >= 0 ? pair.slice(equalIndex + 1) : "";

    const values = params.get(key) || [];
    values.push(value);
    params.set(key, values);
  }

  return Array.from(params.entries())
    .map(([key, values]) => `${key}=${values.join(",")}`)
    .sort()
    .join("");
}

function createDigest(message: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
}

export function verifyShopifyAppProxySignature(input: AppProxyVerificationInput) {
  const searchParams = getSearchParams(input);
  const rawSearch = getRawSearch(input);
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

  const candidateMessages = Array.from(
    new Set(
      [
        buildDecodedGroupedMessage(searchParams),
        buildDecodedPairMessage(rawSearch),
        buildDecodedPairAmpersandMessage(rawSearch),
        buildRawGroupedMessage(rawSearch),
        buildRawPairMessage(rawSearch),
        buildRawPairAmpersandMessage(rawSearch),
      ].filter(Boolean)
    )
  );

  for (const message of candidateMessages) {
    const digest = createDigest(message, secret);

    if (timingSafeEqualString(digest, signature)) {
      return true;
    }
  }

  const firstDigest = candidateMessages[0]
    ? createDigest(candidateMessages[0], secret)
    : "";

  console.warn("App Proxy signature mismatch", {
    keys,
    messageLengths: candidateMessages.map((message) => message.length),
    signaturePrefix: signature.slice(0, 8),
    digestPrefix: firstDigest.slice(0, 8),
  });

  return false;
}
