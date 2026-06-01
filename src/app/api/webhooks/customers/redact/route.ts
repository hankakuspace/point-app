// src/app/api/webhooks/customers/redact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  getShopifyWebhookMeta,
  verifyShopifyWebhook,
} from "@/lib/shopifyWebhook";

export const runtime = "nodejs";

async function commitBatch(
  refs: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>[],
  data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
) {
  const chunkSize = 450;

  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = db.batch();
    const chunk = refs.slice(index, index + chunkSize);

    for (const ref of chunk) {
      batch.set(ref, data, { merge: true });
    }

    await batch.commit();
  }
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

  const now = new Date().toISOString();
  const customerRef = db.collection("customers").doc(customerId);
  const customerSnap = await customerRef.get();

  if (customerSnap.exists) {
    await customerRef.set(
      {
        name: null,
        email: null,
        redactedAt: now,
      },
      { merge: true }
    );
  }

  const pointLogsSnap = await db
    .collection("point_logs")
    .where("shop", "==", shop)
    .get();

  const pointLogRefs = pointLogsSnap.docs
    .filter((doc) => matchesCustomerId(doc.data(), customerId))
    .map((doc) => doc.ref);

  await commitBatch(pointLogRefs, {
    email: null,
    name: null,
    customerEmail: null,
    customerName: null,
    redactedAt: now,
  });

  const pointRedemptionsSnap = await db
    .collection("point_redemptions")
    .where("shop", "==", shop)
    .get();

  const pointRedemptionRefs = pointRedemptionsSnap.docs
    .filter((doc) => matchesCustomerId(doc.data(), customerId))
    .map((doc) => doc.ref);

  await commitBatch(pointRedemptionRefs, {
    email: null,
    name: null,
    customerEmail: null,
    customerName: null,
    redactedAt: now,
  });

  console.log("customers/redact webhook processed", {
    ...meta,
    shop,
    customerId,
    pointLogsCount: pointLogRefs.length,
    pointRedemptionsCount: pointRedemptionRefs.length,
  });

  return NextResponse.json({
    ok: true,
    shop,
    customerId,
    redacted: {
      customer: customerSnap.exists,
      pointLogs: pointLogRefs.length,
      pointRedemptions: pointRedemptionRefs.length,
    },
  });
}
