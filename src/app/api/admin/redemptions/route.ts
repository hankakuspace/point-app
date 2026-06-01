// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const requestedShop = req.nextUrl.searchParams.get("shop") || "";
    const session = await requireShopifySessionToken(req, requestedShop);

    if (!session.ok) {
      return session.response;
    }

    const shop = session.shop;

    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Missing shop" },
        { status: 400 }
      );
    }

    const query = db.collection("point_redemptions").where("shop", "==", shop);

    const snapshot = await query.get();

    const redemptions = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
        };
      })
      .sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();

        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      redemptions,
    });
  } catch (error) {
    console.error("Failed to fetch point redemptions:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
