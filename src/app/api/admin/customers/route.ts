// src/app/api/admin/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

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
    const shop = req.nextUrl.searchParams.get("shop") || "";

    const customersQuery = shop
      ? db.collection("customers").where("shop", "==", shop)
      : db.collection("customers");

    const customersSnapshot = await customersQuery.get();

    const pointLogsSnapshot = shop
      ? await db
          .collection("point_logs")
          .where("shop", "==", shop)
          .get()
      : await db
          .collection("point_logs")
          .orderBy("timestamp", "desc")
          .limit(300)
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
