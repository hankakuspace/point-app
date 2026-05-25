// src/lib/pointFormToken.ts
import crypto from "crypto";

function getSecret() {
  return process.env.SHOPIFY_API_SECRET || "";
}

function buildMessage({
  shop,
  customerId,
  cartProductIds,
  expiresAt,
}: {
  shop: string;
  customerId: string;
  cartProductIds: string;
  expiresAt: string;
}) {
  return [
    `shop=${shop}`,
    `customerId=${customerId}`,
    `cartProductIds=${cartProductIds}`,
    `expiresAt=${expiresAt}`,
  ].join("&");
}

function timingSafeEqualString(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createPointFormToken({
  shop,
  customerId,
  cartProductIds,
  expiresAt,
}: {
  shop: string;
  customerId: string;
  cartProductIds: string;
  expiresAt: string;
}) {
  const secret = getSecret();

  if (!secret) {
    return "";
  }

  return crypto
    .createHmac("sha256", secret)
    .update(
      buildMessage({
        shop,
        customerId,
        cartProductIds,
        expiresAt,
      })
    )
    .digest("hex");
}

export function verifyPointFormToken({
  shop,
  customerId,
  cartProductIds,
  expiresAt,
  token,
}: {
  shop: string;
  customerId: string;
  cartProductIds: string;
  expiresAt: string;
  token: string;
}) {
  const expiresAtMs = Number(expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return false;
  }

  if (!shop || !customerId || !token) {
    return false;
  }

  const expected = createPointFormToken({
    shop,
    customerId,
    cartProductIds,
    expiresAt,
  });

  if (!expected) {
    return false;
  }

  return timingSafeEqualString(expected, token);
}
