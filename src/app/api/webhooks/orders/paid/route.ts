// src/app/api/webhooks/orders/paid/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { callShopifyAdminAPI } from "@/lib/shopify";
import { getPointSettings } from "@/lib/point-settings";

type ShopifyOrderPaidPayload = {
  id?: number | string;
  email?: string;
  total_price?: string;
  subtotal_price?: string;
  financial_status?: string;
  discount_codes?: Array<{
    code?: string;
    amount?: string;
    type?: string;
  }>;
  line_items?: Array<{
    product_id?: number | string | null;
    price?: string;
    quantity?: number | string;
    total_discount?: string;
    pre_tax_price?: string;
  }>;
  customer?: {
    id?: number | string;
    email?: string;
  } | null;
};

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || !hmacHeader) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const digestBuffer = Buffer.from(digest, "utf8");
  const hmacBuffer = Buffer.from(hmacHeader, "utf8");

  if (digestBuffer.length !== hmacBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

function normalizeTag(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parsePrice(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "0"));

  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateLineItemSubtotal(lineItem: NonNullable<ShopifyOrderPaidPayload["line_items"]>[number]) {
  const preTaxPrice = parsePrice(lineItem.pre_tax_price);

  if (preTaxPrice > 0) {
    return preTaxPrice;
  }

  const price = parsePrice(lineItem.price);
  const quantity = parsePrice(lineItem.quantity || 1);
  const totalDiscount = parsePrice(lineItem.total_discount);

  return Math.max(price * quantity - totalDiscount, 0);
}

function getProductNumericIdFromGid(gid: string) {
  return gid.split("/").pop() || gid;
}

async function fetchProductTagsByIds(productIds: string[], shop?: string | null) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));

  if (uniqueProductIds.length === 0) {
    return new Map<string, string[]>();
  }

  const query = `
    query ProductTags($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          tags
        }
      }
    }
  `;

  const data = await callShopifyAdminAPI(
    query,
    {
      ids: uniqueProductIds.map((productId) => `gid://shopify/Product/${productId}`),
    },
    shop || undefined
  );

  const tagsByProductId = new Map<string, string[]>();
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];

  for (const node of nodes) {
    if (!node?.id) continue;

    const productId = getProductNumericIdFromGid(String(node.id));
    const tags = Array.isArray(node.tags) ? node.tags.map(normalizeTag) : [];

    tagsByProductId.set(productId, tags);
  }

  return tagsByProductId;
}


export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.warn("Webhook rejected: invalid HMAC");

      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody) as ShopifyOrderPaidPayload;

    const orderId = String(payload.id ?? "").trim();
    const email = String(payload.email ?? payload.customer?.email ?? "")
      .trim()
      .toLowerCase();
    const customerId = String(payload.customer?.id ?? "").trim();
    const totalPrice = Number.parseFloat(String(payload.total_price ?? "0"));
    const subtotalPrice = Number.parseFloat(String(payload.subtotal_price ?? "0"));
    const financialStatus = String(payload.financial_status ?? "")
      .trim()
      .toLowerCase();
    const shopDomain = String(req.headers.get("x-shopify-shop-domain") ?? "")
      .trim()
      .toLowerCase();
    const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];

    const discountCodes = Array.isArray(payload.discount_codes)
      ? payload.discount_codes
          .map((discount) => String(discount.code ?? "").trim())
          .filter(Boolean)
      : [];

    const pointDiscountCode =
      discountCodes.find((code) => code.startsWith("POINT-")) || "";

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
      if (!customerId) {
        console.warn("No matching customer found:", { orderId, customerId, email });
        return NextResponse.json(
          { success: false, message: "Customer not found" },
          { status: 404 }
        );
      }

      const newCustomerRef = db.collection("customers").doc(customerId);

      await newCustomerRef.set(
        {
          id: customerId,
          customerId: Number(customerId),
          shopifyCustomerGid: `gid://shopify/Customer/${customerId}`,
          email,
          name: "",
          points: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      customerDoc = await newCustomerRef.get();

      console.log("✅ Created customer from webhook", {
        orderId,
        customerId,
        email,
      });
    }

    const customerData = customerDoc.data() || {};

    const settings = await getPointSettings(db, shopDomain);
    const pointRate =
      typeof settings?.pointRate === "number" && Number.isFinite(settings.pointRate)
        ? settings.pointRate
        : 0.03;

    const includeShipping = Boolean(settings?.includeShipping);
    const excludedTags = Array.isArray(settings?.excludedTags)
      ? settings.excludedTags.map(normalizeTag).filter(Boolean)
      : [];

    let calculationBase =
      includeShipping || !Number.isFinite(subtotalPrice) || subtotalPrice <= 0
        ? totalPrice
        : subtotalPrice;
    let excludedLineItemsSubtotal = 0;
    let eligibleLineItemsSubtotal: number | null = null;
    let excludedProductIds: string[] = [];

    if (excludedTags.length > 0 && lineItems.length > 0) {
      const productIds = lineItems
        .map((lineItem) => String(lineItem.product_id ?? "").trim())
        .filter(Boolean);

      const productTagsById = await fetchProductTagsByIds(productIds, shopDomain);

      let eligibleSubtotal = 0;
      let excludedSubtotal = 0;
      const excludedProductIdSet = new Set<string>();

      for (const lineItem of lineItems) {
        const productId = String(lineItem.product_id ?? "").trim();
        const lineItemSubtotal = calculateLineItemSubtotal(lineItem);
        const productTags = productTagsById.get(productId) || [];
        const isExcluded = productTags.some((tag) => excludedTags.includes(tag));

        if (isExcluded) {
          excludedSubtotal += lineItemSubtotal;

          if (productId) {
            excludedProductIdSet.add(productId);
          }
        } else {
          eligibleSubtotal += lineItemSubtotal;
        }
      }

      const shippingAmount =
        includeShipping &&
        Number.isFinite(totalPrice) &&
        Number.isFinite(subtotalPrice) &&
        totalPrice > subtotalPrice &&
        eligibleSubtotal > 0
          ? totalPrice - subtotalPrice
          : 0;

      eligibleLineItemsSubtotal = eligibleSubtotal;
      excludedLineItemsSubtotal = excludedSubtotal;
      excludedProductIds = Array.from(excludedProductIdSet);
      calculationBase = eligibleSubtotal + shippingAmount;
    }

    const addPoints = Math.floor(calculationBase * pointRate);

    let redemptionRef:
      | FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
      | null = null;
    let redemptionSnap:
      | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
      | null = null;
    let redemptionPoints = 0;

    if (pointDiscountCode) {
      redemptionRef = db.collection("point_redemptions").doc(pointDiscountCode);
      redemptionSnap = await redemptionRef.get();

      if (redemptionSnap.exists) {
        const redemption = redemptionSnap.data() || {};

        if (
          redemption.status === "issued" &&
          String(redemption.customerId) === String(customerDoc.id) &&
          typeof redemption.points === "number" &&
          Number.isFinite(redemption.points) &&
          redemption.points > 0
        ) {
          redemptionPoints = redemption.points;
        }
      }
    }

    if (addPoints <= 0 && redemptionPoints <= 0) {
      console.log("Webhook skipped: calculated points are zero", {
        orderId,
        totalPrice,
        subtotalPrice,
        calculationBase,
        includeShipping,
        pointRate,
        excludedTags,
        excludedLineItemsSubtotal,
        eligibleLineItemsSubtotal,
        excludedProductIds,
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "calculated_points_zero",
      });
    }

    const pointLogRef = db.collection("point_logs").doc(`purchase_${orderId}`);

    await db.runTransaction(async (transaction) => {
      if (addPoints > 0) {
        const pointLogSnap = await transaction.get(pointLogRef);

        if (pointLogSnap.exists) {
          throw new Error("POINT_ALREADY_GRANTED");
        }
      }

      let latestRedemptionSnap:
        | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
        | null = null;
      let latestRedemption: FirebaseFirestore.DocumentData = {};

      if (redemptionRef && redemptionSnap?.exists && redemptionPoints > 0) {
        latestRedemptionSnap = await transaction.get(redemptionRef);
        latestRedemption = latestRedemptionSnap.data() || {};
      }

      const currentPoints =
        typeof customerData.points === "number" && Number.isFinite(customerData.points)
          ? customerData.points
          : 0;

      const now = new Date().toISOString();
      const nextPoints = currentPoints + addPoints - redemptionPoints;

      transaction.update(customerDoc!.ref, {
        points: nextPoints,
        updatedAt: now,
      });

      if (addPoints > 0) {
        transaction.set(pointLogRef, {
          customerDocId: customerDoc!.id,
          customerId: customerId || null,
          shop: shopDomain,
          type: "add",
          points: addPoints,
          orderId,
          reason: "purchase",
          email,
          totalPrice,
          subtotalPrice,
          calculationBase,
          includeShipping,
          pointRate,
          excludedTags,
          excludedLineItemsSubtotal,
          eligibleLineItemsSubtotal,
          excludedProductIds,
          timestamp: now,
        });
      }

      if (redemptionRef && latestRedemptionSnap?.exists && redemptionPoints > 0) {
        if (latestRedemption.status === "issued") {
          transaction.set(
            db.collection("point_logs").doc(`point_use_${orderId}_${pointDiscountCode}`),
            {
              customerDocId: customerDoc!.id,
              customerId: customerDoc!.id,
              shop: shopDomain,
              type: "use",
              points: redemptionPoints,
              orderId,
              reason: "point_use",
              discountCode: pointDiscountCode,
              timestamp: now,
            }
          );

          transaction.update(redemptionRef, {
            status: "used",
            usedAt: now,
            orderId,
          });
        }
      }
    });

    console.log("✅ Added purchase points", {
      orderId,
      customerDocId: customerDoc.id,
      customerId,
      email,
      addPoints,
      calculationBase,
      excludedTags,
      excludedLineItemsSubtotal,
      eligibleLineItemsSubtotal,
      excludedProductIds,
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
