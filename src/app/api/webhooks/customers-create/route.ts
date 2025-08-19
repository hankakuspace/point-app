import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
  const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

  // HMAC検証
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  if (digest !== hmacHeader) {
    console.error("❌ HMAC verification failed");
    return NextResponse.json(
      { ok: false, error: "HMAC verification failed" },
      { status: 401 }
    );
  }

  const data = JSON.parse(rawBody.toString());
  console.log("📩 Customer webhook received:", data);

  // ✅ 必要なら Firestoreに保存する処理を追加
  // await db.collection("webhook_logs").add({
  //   type: "customers/create",
  //   data,
  //   timestamp: new Date(),
  // });

  return NextResponse.json({ ok: true });
}
