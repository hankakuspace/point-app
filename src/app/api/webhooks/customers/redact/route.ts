// src/app/api/webhooks/customers/redact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  getShopifyWebhookMeta,
  verifyShopifyWebhook,
} from "@/lib/shopifyWebhook";

export const runtime = "nodejs";

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
  const shop = payload.shop_domain || meta.shop;
  const customerId =
    payload.customer?.id !== undefined && payload.customer?.id !== null
      ? String(payload.customer.id)
      : "";

  if (shop && customerId) {
    await db.collection("customers").doc(customerId).set(
      {
        shop,
        name: null,
        email: null,
        redactedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  console.log("customers/redact webhook received", {
    ...meta,
    shop,
    customerId,
  });

  return NextResponse.json({ ok: true });
}
