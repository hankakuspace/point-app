import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 生ボディ取得（文字列）
    const rawBody = await req.text();

    // Shopifyからの署名
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";

    // シークレットキー
    const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

    // 計算した署名
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf-8")
      .digest("base64");

    // デバッグ出力
    console.log("📩 HMAC from Shopify:", hmacHeader);
    console.log("🧮 Calculated digest:", digest);
    console.log("🔑 Secret length:", secret.length);
    console.log("📦 Raw body (first 200 chars):", rawBody.substring(0, 200));

    // バイト列比較もログ
    console.log("📩 Shopify bytes:", Buffer.from(hmacHeader, "base64").toString("hex"));
    console.log("🧮 Local bytes:", Buffer.from(digest, "base64").toString("hex"));

    // 比較
    const valid =
      hmacHeader &&
      crypto.timingSafeEqual(
        Buffer.from(hmacHeader, "base64"),
        Buffer.from(digest, "base64")
      );

    if (!valid) {
      console.error("❌ Invalid HMAC signature");
      return NextResponse.json(
        {
          ok: false,
          reason: "Invalid HMAC signature",
          fromShopify: hmacHeader,
          calculated: digest,
          secretLength: secret.length,
        },
        { status: 401 }
      );
    }

    console.log("✅ HMAC verified");

    // JSON parse
    const body = JSON.parse(rawBody);
    console.log("📦 Webhook payload:", body);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
