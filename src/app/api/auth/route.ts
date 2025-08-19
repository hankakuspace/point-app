import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL!;
const SCOPES = [
  "read_products",
  "write_products",
  "read_customers",
  "write_customers",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );
    }

    const redirectUri = `${SHOPIFY_APP_URL}/api/auth/callback`;
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES.join(
      ","
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("Auth error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
