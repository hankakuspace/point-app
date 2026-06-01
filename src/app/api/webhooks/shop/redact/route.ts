// src/app/api/webhooks/shop/redact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  getShopifyWebhookMeta,
  verifyShopifyWebhook,
} from "@/lib/shopifyWebhook";

export const runtime = "nodejs";

async function deleteQuerySnapshot(
  snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
) {
  const chunkSize = 450;
  let deletedCount = 0;

  for (let index = 0; index < snapshot.docs.length; index += chunkSize) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(index, index + chunkSize);

    for (const doc of chunk) {
      batch.delete(doc.ref);
    }

    await batch.commit();
    deletedCount += chunk.length;
  }

  return deletedCount;
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

  if (!shop) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing shop",
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const customersSnap = await db
    .collection("customers")
    .where("shop", "==", shop)
    .get();
  const pointLogsSnap = await db
    .collection("point_logs")
    .where("shop", "==", shop)
    .get();
  const pointRedemptionsSnap = await db
    .collection("point_redemptions")
    .where("shop", "==", shop)
    .get();

  const deletedCustomers = await deleteQuerySnapshot(customersSnap);
  const deletedPointLogs = await deleteQuerySnapshot(pointLogsSnap);
  const deletedPointRedemptions = await deleteQuerySnapshot(pointRedemptionsSnap);

  await db.collection("settings").doc(shop).delete().catch(() => undefined);

  await db.collection("shops").doc(shop).set(
    {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: null,
      redactedAt: now,
    },
    { merge: true }
  );

  console.log("shop/redact webhook processed", {
    ...meta,
    shop,
    deletedCustomers,
    deletedPointLogs,
    deletedPointRedemptions,
  });

  return NextResponse.json({
    ok: true,
    shop,
    deleted: {
      customers: deletedCustomers,
      pointLogs: deletedPointLogs,
      pointRedemptions: deletedPointRedemptions,
      settings: shop,
    },
  });
}
