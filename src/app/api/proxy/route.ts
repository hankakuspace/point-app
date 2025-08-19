import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET!;

// 署名検証
function verifySignature(params: URLSearchParams): boolean {
  const signature = params.get("signature");
  if (!signature) return false;

  const message = [...params.entries()]
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("");

  const digest = crypto
    .createHmac("sha256", SHOPIFY_SECRET)
    .update(message)
    .digest("hex");

  return digest === signature;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  if (!verifySignature(params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // ✅ /apps/points/page.tsx をSSRして返すのが理想
  // まずはテスト用に静的HTMLを返す
  return new NextResponse(
    `
      <!DOCTYPE html>
      <html>
        <head><title>Shopify Points App</title></head>
        <body style="padding:2rem; text-align:center;">
          <h1>Shopify Points App</h1>
          <p>ここにポイント管理UIを表示していきます。</p>
        </body>
      </html>
    `,
    { headers: { "Content-Type": "text/html" } }
  );
}
