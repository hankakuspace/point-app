// src/app/api/webhooks/orders/paid/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type ShopifyOrderPaidPayload = {
  id?: number | string;
  email?: string;
  total_price?: string;
  financial_status?: string;
  customer?: {
    id?: number | string;
    email?: string;
  } | null;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ShopifyOrderPaidPayload;

    const orderId = String(payload.id ?? "").trim();
    const email = String(payload.email ?? payload.customer?.email ?? "")
      .trim()
      .toLowerCase();
    const customerId = String(payload.customer?.id ?? "").trim();
    const totalPrice = Number.parseFloat(String(payload.total_price ?? "0"));
    const financialStatus = String(payload.financial_status ?? "")
      .trim()
      .toLowerCase();

    if (!orderId) {
      console.warn("Webhook skipped: missing order id");
      return NextResponse.json(
        { success: false, message: "Missing order id" },
        { status: 400 }
      );
    }

    if (!email && !customerId) {
      console.warn("Webhook skipped: missing customer identifier", { orderId });
      return NextResponse.json(
        { success: false, message: "Missing customer identifier" },
        { status: 400 }
      );
    }

    if (financialStatus && financialStatus !== "paid") {
      console.log("Webhook skipped: financial_status is not paid", {
        orderId,
        financialStatus,
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "financial_status_not_paid",
      });
    }

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      console.warn("Webhook skipped: invalid total price", { orderId, totalPrice });
      return NextResponse.json(
        { success: false, message: "Invalid total price" },
        { status: 400 }
      );
    }

    let customerDoc:
      | FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
      | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
      | null = null;

    if (customerId) {
      const directDoc = await db.collection("customers").doc(customerId).get();
      if (directDoc.exists) {
        customerDoc = directDoc;
      } else {
        const byCustomerIdSnapshot = await db
          .collection("customers")
          .where("customerId", "==", Number(customerId))
          .limit(1)
          .get();

        if (!byCustomerIdSnapshot.empty) {
          customerDoc = byCustomerIdSnapshot.docs[0];
        }
      }
    }

    if (!customerDoc && email) {
      const byEmailSnapshot = await db
        .collection("customers")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!byEmailSnapshot.empty) {
        customerDoc = byEmailSnapshot.docs[0];
      }
    }

    if (!customerDoc || !customerDoc.exists) {
      console.warn("No matching customer found:", { orderId, customerId, email });
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const customerData = customerDoc.data() || {};

    const settingsRef = db.collection("settings").doc("default");
    const settingsSnap = await settingsRef.get();
    const settings = settingsSnap.exists ? settingsSnap.data() : { pointRate: 0.03 };
    const pointRate =
      typeof settings?.pointRate === "number" && Number.isFinite(settings.pointRate)
        ? settings.pointRate
        : 0.03;

    const addPoints = Math.floor(totalPrice * pointRate);

    if (addPoints <= 0) {
      console.log("Webhook skipped: calculated points are zero", {
        orderId,
        totalPrice,
        pointRate,
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "calculated_points_zero",
      });
    }

    const pointLogRef = db.collection("point_logs").doc(`purchase_${orderId}`);

    await db.runTransaction(async (transaction) => {
      const pointLogSnap = await transaction.get(pointLogRef);

      if (pointLogSnap.exists) {
        throw new Error("POINT_ALREADY_GRANTED");
      }

      const currentPoints =
        typeof customerData.points === "number" && Number.isFinite(customerData.points)
          ? customerData.points
          : 0;

      transaction.update(customerDoc!.ref, {
        points: currentPoints + addPoints,
        updatedAt: new Date().toISOString(),
      });

      transaction.set(pointLogRef, {
        customerDocId: customerDoc!.id,
        customerId: customerId || null,
        type: "add",
        points: addPoints,
        orderId,
        reason: "purchase",
        email,
        totalPrice,
        pointRate,
        timestamp: new Date().toISOString(),
      });
    });

    console.log("✅ Added purchase points", {
      orderId,
      customerDocId: customerDoc.id,
      customerId,
      email,
      addPoints,
    });

    return NextResponse.json({
      success: true,
      added: addPoints,
      orderId,
      customerDocId: customerDoc.id,
      customerId,
    });
  } catch (error) {
    if ((error as Error).message === "POINT_ALREADY_GRANTED") {
      console.log("Webhook skipped: points already granted");
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "already_granted",
      });
    }

    console.error("Webhook error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
