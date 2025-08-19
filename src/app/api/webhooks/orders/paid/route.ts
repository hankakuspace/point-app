import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 🔑 生の文字列ボディを取得
    const rawBody = await req.text();

    // Shopify HMAC ヘッダー
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
    const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

    // HMAC 計算
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf-8")
      .digest("base64");

    console.log("📩 HMAC from Shopify:", hmacHeader);
    console.log("🧮 Calculated digest:", digest);

    if (
      hmacHeader &&
      crypto.timingSafeEqual(
        Buffer.from(hmacHeader, "base64"),
        Buffer.from(digest, "base64")
      )
    ) {
      console.log("✅ HMAC verified");

      // JSON にパース
      const body = JSON.parse(rawBody);
      console.log("📦 Webhook payload:", body);

      return NextResponse.json({ ok: true });
    } else {
      console.error("❌ Invalid HMAC signature");
      return new NextResponse("Invalid HMAC signature", { status: 401 });
    }
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
