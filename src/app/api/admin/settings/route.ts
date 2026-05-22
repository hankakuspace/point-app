// src/app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

const SETTINGS_DOC_ID = "default"; // 単一ストア用。マルチストアなら shopId をキーに。

export async function GET() {
  try {
    const doc = await db.collection("settings").doc(SETTINGS_DOC_ID).get();
    if (!doc.exists) {
      return NextResponse.json({
        pointRate: 0.03,
        includeShipping: false,
        excludedTags: [],
        minUsePoints: 100,
        maxUsePoints: 1000,
      });
    }
    return NextResponse.json(doc.data());
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const data = {
      pointRate: Number(body.pointRate) || 0.03,
      includeShipping: Boolean(body.includeShipping),
      excludedTags: Array.isArray(body.excludedTags)
        ? body.excludedTags
        : (body.excludedTags || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      minUsePoints: Number(body.minUsePoints) || 100,
      maxUsePoints: Number(body.maxUsePoints) || 1000,
    };

    await db.collection("settings").doc(SETTINGS_DOC_ID).set(data, { merge: true });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
