import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const shop = "pointman-dev.myshopify.com"; // 開発ストア
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || ""; 
  // ↑ 最新のアクセストークンを Firestore に保存しているなら、そこから取得するように修正してもOK

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Missing SHOPIFY_ACCESS_TOKEN" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://${shop}/admin/oauth/access_scopes.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Shopify API error:", error);
      return NextResponse.json(
        { ok: false, error },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ Current access scopes:", data);

    return NextResponse.json({ ok: true, scopes: data });
  } catch (err: any) {
    console.error("❌ Error checking access scopes:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
