// src/app/api/customer-account/points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getNumericCustomerId(value: string) {
  return value.split("/").pop() || value;
}

export async function GET(req: NextRequest) {
  try {
    const customerIdParam = req.nextUrl.searchParams.get("customerId") || "";
    const customerId = getNumericCustomerId(customerIdParam);

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing customerId",
        },
        { status: 400 }
      );
    }

    const customerDoc = await db.collection("customers").doc(customerId).get();

    if (!customerDoc.exists) {
      return NextResponse.json({
        success: true,
        customerId,
        points: 0,
      });
    }

    const customerData = customerDoc.data() || {};
    const points =
      typeof customerData.points === "number" && Number.isFinite(customerData.points)
        ? customerData.points
        : 0;

    return NextResponse.json({
      success: true,
      customerId,
      points,
    });
  } catch (error) {
    console.error("Failed to fetch customer account points:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
