// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";


export async function GET(req: Request) {
  try {
    // クエリから shop を取得（例: /api/products?shop=ruhra-store.myshopify.com）
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    // Firestore からアクセストークンを取得
    const db = getFirestore();
    const shopDoc = await db.collection("shops").doc(shop).get();

    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const { accessToken } = shopDoc.data() as { accessToken: string };

    if (!accessToken) {
      return NextResponse.json({ error: "Access token not found" }, { status: 401 });
    }

    // Shopify Admin API を呼び出す
    const response = await fetch(
      `https://${shop}/admin/api/2025-01/products.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Shopify API error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 取得した商品データをそのまま返す
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
