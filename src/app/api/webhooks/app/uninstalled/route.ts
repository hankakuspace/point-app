// src/app/api/webhooks/app/uninstalled/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  getShopifyWebhookMeta,
  verifyShopifyWebhook,
} from "@/lib/shopifyWebhook";

export const runtime = "nodejs";

function normalizeShop(value: unknown) {
  return String(value || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return NextResponse.json(
      { ok: false, error: "Invalid HMAC" },
      { status: 401 }
    );
  }

  const payload = rawBody ? JSON.parse(rawBody) : {};
  const meta = getShopifyWebhookMeta(req.headers);
  const shop = normalizeShop(
    payload.shop_domain ||
      payload.myshopify_domain ||
      payload.shop ||
      meta.shop
  );

  if (!shop) {
    return NextResponse.json(
      { ok: false, error: "Missing shop" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  await db.collection("shops").doc(shop).set(
    {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: null,
      uninstalledAt: now,
    },
    { merge: true }
  );

  console.log("app/uninstalled webhook processed", {
    ...meta,
    shop,
  });

  return NextResponse.json({
    ok: true,
    shop,
  });
}
