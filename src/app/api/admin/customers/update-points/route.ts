// src/app/api/admin/customers/update-points/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { customerId, amount } = body;
    const requestedShop =
      typeof body.shop === "string" && body.shop.trim()
        ? body.shop.trim()
        : "";

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

    if (!customerId || typeof amount !== "number") {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      );
    }

    const customerRef = db.collection("customers").doc(customerId);

    const snapshot = await customerRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    const customer = snapshot.data();
    const customerShop =
      typeof customer?.shop === "string" ? customer.shop.trim().toLowerCase() : "";

    if (customerShop !== shop) {
      return NextResponse.json(
        { success: false, error: "Customer shop mismatch" },
        { status: 403 }
      );
    }

    const currentPoints = customer?.points || 0;

    const newPoints = currentPoints + amount;

    await customerRef.update({
      points: newPoints,
    });

    await db.collection("point_logs").add({
      customerId,
      shop,
      type: amount > 0 ? "add" : "use",
      points: Math.abs(amount),
      reason: "admin_edit",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      points: newPoints,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
