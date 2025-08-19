import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const shop = "pointman-dev.myshopify.com"; // 開発ストアのドメイン
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || ""; // Firestoreから取得してもOK

  try {
    // Webhook登録
    const response = await fetch(
      `https://${shop}/admin/api/2025-01/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic: "customers/create", // ✅ 顧客作成Webhook
            address: `${process.env.APP_URL}/api/webhooks/customers-create`,
            format: "json",
          },
        }),
      }
    );

    const data = await response.json();
    console.log("Webhook registration result:", data);

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("Webhook register error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
