// src/app/api/admin/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

function getTimestampValue(value: any) {
  if (!value) {
    return 0;
  }

  if (typeof value === "string") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value.toDate === "function") {
    const time = value.toDate().getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value._seconds === "number") {
    return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000);
  }

  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const requestedShop = req.nextUrl.searchParams.get("shop") || "";
    const session = await requireShopifySessionToken(req, requestedShop);

    if (!session.ok) {
      return session.response;
    }

    const shop = session.shop;
    const snapshot = await db
      .collection("point_logs")
      .where("shop", "==", shop)
      .get();

    const logs = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp))
      .slice(0, 50);

    return NextResponse.json(logs);
  } catch {
    console.error("Error fetching logs");
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
