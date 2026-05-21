// src/app/api/use-point/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { callShopifyAdminAPI } from "@/lib/shopify";

export async function POST(req: Request) {
  try {
    const { email, usePoints } = await req.json();

    if (!email || !usePoints || usePoints <= 0) {
      return NextResponse.json({ success: false, message: "Invalid input" });
    }

    const settingsSnap = await db.collection("settings").doc("default").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    const minUsePoints =
      typeof settings?.minUsePoints === "number" && Number.isFinite(settings.minUsePoints)
        ? settings.minUsePoints
        : 100;

    const maxUsePoints =
      typeof settings?.maxUsePoints === "number" && Number.isFinite(settings.maxUsePoints)
        ? settings.maxUsePoints
        : 1000;

    if (usePoints < minUsePoints) {
      return NextResponse.json({
        success: false,
        message: `Minimum use points is ${minUsePoints}`,
      });
    }

    if (usePoints > maxUsePoints) {
      return NextResponse.json({
        success: false,
        message: `Maximum use points is ${maxUsePoints}`,
      });
    }

    // Firestoreから顧客を検索
    const customersRef = db.collection("customers");
    const snapshot = await customersRef.where("email", "==", email).limit(1).get();
    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: "Customer not found" });
    }

    const customerDoc = snapshot.docs[0];
    const customerData = customerDoc.data();

    if ((customerData.points || 0) < usePoints) {
      return NextResponse.json({ success: false, message: "Not enough points" });
    }

    // 割引額を算出（1ポイント=1円）
    const discountAmount = usePoints;

    // ✅ Shopify Admin APIで割引コードを発行
    const mutation = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) { edges { node { code } } }
              }
            }
          }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      basicCodeDiscount: {
        title: `POINT-${email}-${Date.now()}`,
        startsAt: new Date().toISOString(),
        endsAt: null,
        code: `POINT-${Math.floor(Math.random() * 100000)}`,
        customerSelection: { all: true },
        customerGets: {
          value: {
            discountAmount: {
              amount: discountAmount,
              appliesOnEachItem: false,
            },
          },
          items: {
            all: true,
          },
        },
        combinesWith: {
          orderDiscounts: true,
          productDiscounts: true,
          shippingDiscounts: true,
        },
      },
    };

    const response = await callShopifyAdminAPI(mutation, variables);
    const discountResult = response?.discountCodeBasicCreate;
    const userErrors = discountResult?.userErrors || [];

    if (userErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: "Discount code creation failed",
        userErrors,
      });
    }

    const discountCode =
      discountResult?.codeDiscountNode?.codeDiscount?.codes?.edges?.[0]?.node?.code;

    if (!discountCode) {
      return NextResponse.json({
        success: false,
        message: "Failed to generate discount code",
        response,
      });
    }

    // Firestore更新
    await customerDoc.ref.update({
      points: customerData.points - usePoints,
    });

    await db.collection("point_logs").add({
      customerId: customerDoc.id,
      type: "use",
      points: usePoints,
      reason: "point_use",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      discountCode,
      used: usePoints,
    });
  } catch (error) {
    console.error("use-point error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message });
  }
}
