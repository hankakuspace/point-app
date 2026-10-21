// src/app/api/auth/route.ts
import { NextRequest, NextResponse } from "next/server";

import { validateShopDomain, createOAuthState, OAUTH_COOKIE_NAME, OAUTH_COOKIE_OPTIONS } from "@/lib/shopify";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL!;

// 🔑 アプリで使用するShopify OAuthスコープ
const SCOPES = [
  "read_customers",
  "read_discounts",
  "read_orders",
  "read_products",
  "write_discounts",
  "customer_read_customers",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = validateShopDomain(searchParams.get("shop") || "");

    if (!shop) {
      return NextResponse.json(
        { error: "Invalid or missing shop parameter" },
        { status: 400 }
      );
    }

    const { state, cookie } = createOAuthState(shop);
    const redirectUri = `${SHOPIFY_APP_URL}/api/auth/callback`;
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES.join(
      ","
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_COOKIE_NAME, cookie, OAUTH_COOKIE_OPTIONS);
    return response;
  } catch {
    console.error("Auth error");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
