import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // Firestore 保存用
import { registerOrderPaidWebhook } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop")!;
  const accessToken = "..."; // ここは既存の認証フローで取得したトークン

  // トークンを Firestore へ保存（既存の実装に合わせる）
  await db.collection("shops").doc(shop).set({ accessToken }, { merge: true });

  // ✅ Webhook を登録
  await registerOrderPaidWebhook(shop, accessToken);

  return NextResponse.redirect(`${process.env.SHOPIFY_APP_URL}/?installed=1`);
}
