// src/app/api/customer-account/points/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function getNumericCustomerId(value: string) {
  return value.split("/").pop() || value;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    const customerIdParam = req.nextUrl.searchParams.get("customerId") || "";
    const customerId = getNumericCustomerId(customerIdParam);

    if (!customerId) {
      return jsonResponse(
        {
          success: false,
          error: "Missing customerId",
        },
        400
      );
    }

    const customerDoc = await db.collection("customers").doc(customerId).get();

    if (!customerDoc.exists) {
      return jsonResponse({
        success: true,
        customerId,
        points: 0,
        found: false,
      });
    }

    const customerData = customerDoc.data() || {};
    const points =
      typeof customerData.points === "number" && Number.isFinite(customerData.points)
        ? customerData.points
        : 0;

    return jsonResponse({
      success: true,
      customerId,
      points,
      found: true,
    });
  } catch (error) {
    console.error("Failed to fetch customer account points:", error);

    return jsonResponse(
      {
        success: false,
        error: "Internal Server Error",
      },
      500
    );
  }
}
