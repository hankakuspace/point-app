import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { registerOrderPaidWebhook } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");

    if (!shop || !code) {
      return new NextResponse("Missing shop or code", { status: 400 });
    }

    // ================================
    // ① Shopify からアクセストークンを取得
    // ================================
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    const rawText = await tokenRes.text(); // レスポンスを必ず文字列で取る

    if (!tokenRes.ok) {
      console.error("❌ Token exchange failed:", tokenRes.status, rawText);
      return new NextResponse(
        `Failed to exchange token: ${tokenRes.status} ${rawText}`,
        { status: 500 }
      );
    }

    const tokenJson = JSON.parse(rawText);
    const accessToken = tokenJson.access_token as string;
    console.log("✅ Access token retrieved for", shop);

    // ================================
    // ② Firestore に保存
    // ================================
    await db.collection("shops").doc(shop).set(
      { accessToken, installedAt: new Date().toISOString() },
      { merge: true }
    );

    // ================================
    // ③ Webhook を登録
    // ================================
    await registerOrderPaidWebhook(shop, accessToken);

    // ================================
    // ④ 成功時はトップページにリダイレクト
    // ================================
    return NextResponse.redirect(
      `${process.env.SHOPIFY_APP_URL}/?installed=1&shop=${shop}`
    );
  } catch (err) {
    console.error("❌ Auth callback error:", err);
    return new NextResponse("Auth callback failed", { status: 500 });
  }
}
