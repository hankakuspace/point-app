// src/app/api/check-scopes/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") || "";
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";

  if (!shop) {
    return NextResponse.json(
      { ok: false, error: "Missing shop" },
      { status: 400 }
    );
  }

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

    return NextResponse.json({ ok: true, shop, scopes: data });
  } catch (err: any) {
    console.error("❌ Error checking access scopes:", err);

    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
