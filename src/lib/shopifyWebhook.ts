// src/lib/shopifyWebhook.ts
import crypto from "crypto";

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_API_SECRET || "";

  if (!secret || !hmacHeader) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const digestBuffer = Buffer.from(digest, "utf8");
  const hmacBuffer = Buffer.from(hmacHeader, "utf8");

  if (digestBuffer.length !== hmacBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

export function getShopifyWebhookMeta(headers: Headers) {
  return {
    shop: headers.get("x-shopify-shop-domain") || "",
    topic: headers.get("x-shopify-topic") || "",
    webhookId: headers.get("x-shopify-webhook-id") || "",
    apiVersion: headers.get("x-shopify-api-version") || "",
  };
}
