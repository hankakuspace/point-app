// src/app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { getPointSettings, savePointSettings } from "@/lib/point-settings";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export async function GET(req: NextRequest) {
  try {
    const shop = req.nextUrl.searchParams.get("shop") || "";
    const session = await requireShopifySessionToken(req, shop);

    if (!session.ok) {
      return session.response;
    }

    const settings = await getPointSettings(db, shop);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const shop =
      typeof body.shop === "string" && body.shop.trim()
        ? body.shop.trim()
        : req.nextUrl.searchParams.get("shop") || "";

    const session = await requireShopifySessionToken(req, shop);

    if (!session.ok) {
      return session.response;
    }

    const data = {
      pointRate: Number(body.pointRate) || 0.03,
      includeShipping: Boolean(body.includeShipping),
      excludedTags: Array.isArray(body.excludedTags)
        ? body.excludedTags
        : (body.excludedTags || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      minUsePoints: Number(body.minUsePoints) || 100,
      maxUsePoints: Number(body.maxUsePoints) || 1000,
    };

    const settings = await savePointSettings(db, data, shop);

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
