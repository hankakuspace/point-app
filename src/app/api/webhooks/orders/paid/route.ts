import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 生ボディを取得
    const rawBody = Buffer.from(await req.arrayBuffer());

    // Shopify 署名ヘッダー
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
    const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

    // 計算
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    console.log("📩 HMAC from Shopify:", hmacHeader);
    console.log("🧮 Calculated digest:", digest);
    console.log("📦 Raw body string:", rawBody.toString("utf-8")); // デバッグ用

    // バッファ比較
    const hmacBuffer = Buffer.from(hmacHeader, "base64");
    const digestBuffer = Buffer.from(digest, "base64");

    if (
      hmacBuffer.length === digestBuffer.length &&
      crypto.timingSafeEqual(hmacBuffer, digestBuffer)
    ) {
      console.log("✅ HMAC verified");
      return new NextResponse("Webhook verified ✅", { status: 200 });
    } else {
      console.error("❌ Invalid HMAC signature");
      return new NextResponse("Invalid HMAC signature", { status: 401 });
    }
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
