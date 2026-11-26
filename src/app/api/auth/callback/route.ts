import { DEV07_OAUTH_SHOP, exchangeDev07OAuth, getDev07OAuthGeneration } from "@/lib/dev07OAuth";
import { assertLegacyTokenWriteAllowed, LegacyTokenWriteBlocked } from "@/lib/legacyTokenWriteGuard";
// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

import { verifyShopifyOAuthHmac, validateShopDomain, verifyOAuthState, OAUTH_COOKIE_NAME, OAUTH_COOKIE_OPTIONS } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clearState = (response: NextResponse) => {
    response.cookies.set(OAUTH_COOKIE_NAME, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  };
  try {
    const { searchParams } = new URL(req.url);
    const shop = validateShopDomain(searchParams.get("shop") || "");
    const code = searchParams.get("code");
    const host = searchParams.get("host");

    const state = searchParams.get("state") || "";
    // Reject ambiguous parameters rather than signing one value and using another.
    const duplicate = [...searchParams.keys()].some((key) => searchParams.getAll(key).length !== 1);
    let validHmac = false;
    if (shop && code && !duplicate &&
        verifyOAuthState(req.cookies.get(OAUTH_COOKIE_NAME)?.value || "", state, shop)) {
      try {
        validHmac = verifyShopifyOAuthHmac(searchParams);
      } catch {
        validHmac = false;
      }
    }
    if (!validHmac) {
      return clearState(new NextResponse("Invalid OAuth callback", { status: 400 }));
    }

    assertLegacyTokenWriteAllowed(shop);

    if (shop === DEV07_OAUTH_SHOP) {
      const generation = await getDev07OAuthGeneration(db);
      if (!verifyOAuthState(req.cookies.get(OAUTH_COOKIE_NAME)?.value || "", state, shop, generation)) {
        return clearState(new NextResponse("Invalid OAuth callback", { status: 400 }));
      }
      await exchangeDev07OAuth(db, shop, code!, generation);
    } else {
    // ✅ ① アクセストークン取得
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
        expiring: 1,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenRes.status);
      return clearState(new NextResponse(
        `Failed to exchange token: ${tokenRes.status}`,
        { status: 500 }
      ));
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;
    const refreshToken =
      typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : "";
    const expiresIn =
      typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : null;
    const refreshTokenExpiresIn =
      typeof tokenJson.refresh_token_expires_in === "number"
        ? tokenJson.refresh_token_expires_in
        : null;
    const issuedAt = Date.now();
    const accessTokenExpiresAt = expiresIn
      ? new Date(issuedAt + expiresIn * 1000).toISOString()
      : null;
    const refreshTokenExpiresAt = refreshTokenExpiresIn
      ? new Date(issuedAt + refreshTokenExpiresIn * 1000).toISOString()
      : null;
    const scope = typeof tokenJson.scope === "string" ? tokenJson.scope : "";

    // ✅ ② Firestore 保存（try/catch 保護付き）
    try {
      assertLegacyTokenWriteAllowed(shop);
      await db.collection("shops").doc(shop).set(
        {
          accessToken,
          refreshToken,
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
          tokenType: "expiring_offline",
          scope,
          installedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      console.error("Firestore update failed");
      // The authorization code has already been exchanged: restart OAuth rather
      // than redirecting as if persistence succeeded or replaying the same code.
      return clearState(new NextResponse(
        "Failed to save Shopify authentication. Reopen the app from Shopify to restart authentication.",
        { status: 500 }
      ));
    }

    }

    // ✅ ③ orders/paid Webhook は shopify.app.toml の app-specific subscription で管理
    // ✅ ④ リダイレクト
    const returnUrl = new URL("/admin/customers", process.env.SHOPIFY_APP_URL!);
    returnUrl.searchParams.set("host", host || "");
    returnUrl.searchParams.set("shop", shop);
    return clearState(NextResponse.redirect(returnUrl));
  } catch (error) {
    if (error instanceof LegacyTokenWriteBlocked) {
      return clearState(new NextResponse("Temporarily unavailable", { status: 503 }));
    }
    console.error("Auth callback error");
    return clearState(new NextResponse("Auth callback failed", { status: 500 }));
  }
}
