// src/app/api/proxy/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifySignature(params: URLSearchParams) {
  const signature = params.get("signature");
  if (!signature) return false;

  const secret = process.env.SHOPIFY_API_SECRET!;
  const payload = [...params.entries()]
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return digest === signature;
}

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const url = new URL(req.url);

  if (!verifySignature(url.searchParams)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // 署名OK → HTML返却
  if (params.slug?.[0] === "points") {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><title>Points</title></head>
        <body style="font-family: sans-serif; padding: 2rem; text-align:center;">
          <h1>🎉 Points App</h1>
          <p>署名検証OK → HTML返却成功</p>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  }

  return NextResponse.json({ ok: true, slug: params.slug });
}
