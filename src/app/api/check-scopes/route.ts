import { isManagedTokenShop, getManagedShopifyAccessToken } from "@/lib/shopify";
// src/app/api/check-scopes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export async function GET(req: NextRequest) {
  const requestedShop = req.nextUrl.searchParams.get("shop") || "";

  if (!requestedShop) {
    return NextResponse.json(
      { ok: false, error: "Missing shop" },
      { status: 400 }
    );
  }

  const session = await requireShopifySessionToken(req, requestedShop);

  if (!session.ok) {
    return session.response;
  }

  const shop = session.shop;
  const managed = isManagedTokenShop(shop);
  try {
    const shopDoc = await db.collection("shops").doc(shop).get();
    const shopData = shopDoc.exists ? shopDoc.data() : null;
    const accessToken =
      managed ? await getManagedShopifyAccessToken(shop) :
      typeof shopData?.accessToken === "string" ? shopData.accessToken : "";

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing shop accessToken", shop },
        { status: 400 }
      );
    }

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
      if (managed) {
        return NextResponse.json({ ok: false, error: "Shopify API request failed", shop }, { status: response.status });
      }
      const error = await response.text();
      console.error("❌ Shopify API error:", error);

      return NextResponse.json(
        { ok: false, error, shop },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ ok: true, shop, scopes: data });
  } catch (err: any) {
    if (managed) {
      return NextResponse.json({ ok: false, error: "Shopify authentication unavailable", shop }, { status: 503 });
    }
    console.error("❌ Error checking access scopes:", err);

    return NextResponse.json(
      { ok: false, error: err.message, shop },
      { status: 500 }
    );
  }
}
