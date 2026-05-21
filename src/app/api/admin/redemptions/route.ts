// src/app/api/admin/redemptions/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await db
      .collection("point_redemptions")
      .get();

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
