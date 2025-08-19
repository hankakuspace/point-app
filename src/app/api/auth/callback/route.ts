import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebase";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");

    if (!shop || !code) {
      return NextResponse.json({ error: "Missing shop or code" }, { status: 400 });
    }

    // アクセストークンを Shopify から取得
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    // レスポンスが JSON でなければエラー
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Shopify token exchange failed:", text);
      return NextResponse.json({ error: "Failed to fetch token", detail: text }, { status: 500 });
    }

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Shopify token response missing access_token:", tokenData);
      return NextResponse.json({ error: "No access_token returned" }, { status: 500 });
    }

    // Firestore に保存
    await db.collection("shops").doc(shop).set({
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Access token stored for shop: ${shop}`);

    // 認証成功したら success ページにリダイレクト
    return NextResponse.redirect(`${process.env.SHOPIFY_APP_URL}/success`);

  } catch (error: any) {
    console.error("Callback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
