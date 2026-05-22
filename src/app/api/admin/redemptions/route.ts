// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const shop = req.nextUrl.searchParams.get("shop") || "";

    const query = shop
      ? db.collection("point_redemptions").where("shop", "==", shop)
      : db.collection("point_redemptions");

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
