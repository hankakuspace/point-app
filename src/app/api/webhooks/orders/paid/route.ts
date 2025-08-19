import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rawBody = Buffer.from(await req.arrayBuffer());

    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
    const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    // 🔍 デバッグ用ログを強化
    console.log("📩 HMAC from Shopify:", hmacHeader);
    console.log("🧮 Calculated digest:", digest);
    console.log("📦 Raw body string:", rawBody.toString("utf-8"));

    const hmacBuffer = Buffer.from(hmacHeader, "base64");
    const digestBuffer = Buffer.from(digest, "base64");

    const valid =
      hmacBuffer.length === digestBuffer.length &&
      crypto.timingSafeEqual(hmacBuffer, digestBuffer);

    if (!valid) {
      console.error("❌ Invalid HMAC signature");
      return new NextResponse("Invalid HMAC signature", { status: 401 });
    }

    console.log("✅ HMAC verified");
    const body = JSON.parse(rawBody.toString("utf-8"));
    console.log("📦 Webhook payload:", body);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
