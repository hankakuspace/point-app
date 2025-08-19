import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// 生のリクエストボディを stream から読む
async function getRawBody(req: Request): Promise<Buffer> {
  const reader = (req as any).body?.getReader?.();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let result;
    while (!(result = await reader.read()).done) {
      chunks.push(result.value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
  return Buffer.from(await req.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await getRawBody(req);

    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";
    const secret = (process.env.SHOPIFY_API_SECRET || "").trim();

    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    console.log("📩 HMAC from Shopify:", hmacHeader);
    console.log("🧮 Calculated digest:", digest);
    console.log("🔑 Secret length:", secret.length);
    console.log("📦 Raw body (first 200 chars):", rawBody.toString("utf-8").substring(0, 200));

    const valid =
      hmacHeader &&
      crypto.timingSafeEqual(
        Buffer.from(hmacHeader, "base64"),
        Buffer.from(digest, "base64")
      );

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
