// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { registerOrderPaidWebhook } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");
    const host = searchParams.get("host");

    if (!shop || !code) {
      return new NextResponse("Missing shop or code", { status: 400 });
    }

    // ✅ ① アクセストークン取得
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
        expiring: 1,
      }),
    });

    if (!tokenRes.ok) {
      const rawText = await tokenRes.text();
      console.error("❌ Token exchange failed:", tokenRes.status, rawText);
      return new NextResponse(
        `Failed to exchange token: ${tokenRes.status}`,
        { status: 500 }
      );
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
    console.log("✅ Access token retrieved for", shop);

    // ✅ ② Firestore 保存（try/catch 保護付き）
    try {
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
      console.log(`✅ Firestore updated for ${shop}`);
    } catch (e) {
      console.error("❌ Firestore update failed:", e);
    }

    // ✅ ③ Webhook登録を失敗しても無視
    try {
      await registerOrderPaidWebhook(shop, accessToken);
      console.log("✅ Webhook registered");
    } catch (e) {
      console.warn("⚠️ Webhook registration failed:", e);
    }

    // ✅ ④ リダイレクト
    return NextResponse.redirect(
      `${process.env.SHOPIFY_APP_URL}/admin/customers?host=${host}&shop=${shop}`
    );
  } catch (err) {
    console.error("❌ Auth callback error:", err);
    return new NextResponse("Auth callback failed", { status: 500 });
  }
}
