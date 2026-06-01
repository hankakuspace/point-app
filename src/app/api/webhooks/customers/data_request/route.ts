// src/app/api/webhooks/customers/data_request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  getShopifyWebhookMeta,
  verifyShopifyWebhook,
} from "@/lib/shopifyWebhook";

export const runtime = "nodejs";

function toPlainData(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

function matchesCustomerId(
  data: FirebaseFirestore.DocumentData,
  customerId: string
) {
  return (
    String(data.customerId ?? "") === customerId ||
    String(data.customerDocId ?? "") === customerId
  );
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
  const shop = payload.shop_domain || meta.shop;
  const customerId =
    payload.customer?.id !== undefined && payload.customer?.id !== null
      ? String(payload.customer.id)
      : "";

  if (!shop || !customerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing shop or customer id",
      },
      { status: 400 }
    );
  }

  const customerSnap = await db.collection("customers").doc(customerId).get();
  const pointLogsSnap = await db
    .collection("point_logs")
    .where("shop", "==", shop)
    .get();
  const pointRedemptionsSnap = await db
    .collection("point_redemptions")
    .where("shop", "==", shop)
    .get();

  const customer =
    customerSnap.exists && customerSnap.data()?.shop === shop
      ? {
          id: customerSnap.id,
          ...customerSnap.data(),
        }
      : null;

  const pointLogs = pointLogsSnap.docs
    .filter((doc) => matchesCustomerId(doc.data(), customerId))
    .map(toPlainData);

  const pointRedemptions = pointRedemptionsSnap.docs
    .filter((doc) => matchesCustomerId(doc.data(), customerId))
    .map(toPlainData);

  console.log("customers/data_request webhook processed", {
    ...meta,
    shop,
    customerId,
    pointLogsCount: pointLogs.length,
    pointRedemptionsCount: pointRedemptions.length,
  });

  return NextResponse.json({
    ok: true,
    shop,
    customerId,
    data: {
      customer,
      pointLogs,
      pointRedemptions,
    },
  });
}
