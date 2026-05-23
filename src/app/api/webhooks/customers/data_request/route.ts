// src/app/api/webhooks/customers/data_request/route.ts
import { NextRequest, NextResponse } from "next/server";
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

  console.log("customers/data_request webhook received", {
    ...meta,
    customer: payload.customer,
    shopDomain: payload.shop_domain,
    ordersRequested: payload.orders_requested,
  });

  return NextResponse.json({ ok: true });
}
