// src/app/api/admin/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
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

    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Missing shop" },
        { status: 400 }
      );
    }

    const customersQuery = db.collection("customers").where("shop", "==", shop);

    const customersSnapshot = await customersQuery.get();

    const pointLogsSnapshot = await db
      .collection("point_logs")
      .where("shop", "==", shop)
      .get();

    const sortedPointLogs = pointLogsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp))
      .slice(0, 300);

    const latestPointLogsByCustomerId = new Map<string, any>();

    sortedPointLogs.forEach((data: any) => {
      const customerId = data.customerId;

      if (!customerId) {
        return;
      }

      if (!latestPointLogsByCustomerId.has(customerId)) {
        latestPointLogsByCustomerId.set(customerId, data);
      }
    });

    const customers = customersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      latestPointLog: latestPointLogsByCustomerId.get(doc.id) || null,
    }));

    return NextResponse.json({ customers });
  } catch (err) {
    console.error("Failed to fetch customers:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
