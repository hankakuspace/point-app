// src/app/api/admin/redemptions/expire/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { callShopifyAdminAPI } from "@/lib/shopify";

export const runtime = "nodejs";

const DEFAULT_EXPIRE_MINUTES = 30;

type ExpireResult = {
  id: string;
  shopifyDeactivated: boolean;
  error?: string;
};

async function findDiscountNodeIdByCode(discountCode: string, shop?: string | null) {
  const query = `
    query DiscountByCode($query: String!) {
      discountNodes(first: 1, query: $query) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const data = await callShopifyAdminAPI(
    query,
    {
      query: `code:${discountCode}`,
    },
    shop || undefined
  );

  return data?.discountNodes?.edges?.[0]?.node?.id || null;
}

async function deactivateShopifyDiscount(
  discountCode: string,
  discountNodeId?: string | null,
  shop?: string | null
) {
  const targetDiscountNodeId =
    discountNodeId || (await findDiscountNodeIdByCode(discountCode, shop));

  if (!targetDiscountNodeId) {
    return {
      shopifyDeactivated: false,
      error: "Discount node not found",
    };
  }

  const mutation = `
    mutation DeactivateDiscount($id: ID!) {
      discountCodeDeactivate(id: $id) {
        codeDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await callShopifyAdminAPI(
    mutation,
    {
      id: targetDiscountNodeId,
    },
    shop || undefined
  );

  const userErrors = data?.discountCodeDeactivate?.userErrors || [];

  if (userErrors.length > 0) {
    return {
      shopifyDeactivated: false,
      error: userErrors.map((error: any) => error.message).join(" / "),
    };
  }

  return {
    shopifyDeactivated: true,
    discountNodeId: targetDiscountNodeId,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const retryFailed =
      typeof body.retryFailed === "boolean" ? body.retryFailed : false;

    const targetShop =
      typeof body.shop === "string" && body.shop.trim()
        ? body.shop.trim()
        : "";

    const expireMinutes =
      typeof body.expireMinutes === "number" &&
      Number.isFinite(body.expireMinutes) &&
      body.expireMinutes > 0
        ? body.expireMinutes
        : DEFAULT_EXPIRE_MINUTES;

    const now = new Date();
    const threshold = new Date(
      now.getTime() - expireMinutes * 60 * 1000
    );

    const snapshot = await db
      .collection("point_redemptions")
      .where("status", "==", retryFailed ? "expired" : "issued")
      .get();

    const expiredTargets = retryFailed
      ? snapshot.docs.filter((doc) => {
          const data = doc.data();

          if (targetShop && data.shop !== targetShop) {
            return false;
          }

          return data.shopifyDeactivated === false;
        })
      : snapshot.docs.filter((doc) => {
          const data = doc.data();

          if (targetShop && data.shop !== targetShop) {
            return false;
          }

          const createdAt = data.createdAt;

          if (!createdAt) {
            return false;
          }

          const createdDate =
            typeof createdAt === "string"
              ? new Date(createdAt)
              : createdAt?.toDate
                ? createdAt.toDate()
                : null;

          if (!createdDate || Number.isNaN(createdDate.getTime())) {
            return false;
          }

          return createdDate <= threshold;
        });

    if (expiredTargets.length === 0) {
      return NextResponse.json({
        success: true,
        expiredCount: 0,
        expireMinutes,
        results: [],
      });
    }

    const expiredAt = now.toISOString();
    const results: ExpireResult[] = [];

    for (const doc of expiredTargets) {
      const data = doc.data();
      const discountCode = String(data.discountCode || doc.id);
      const shop = typeof data.shop === "string" ? data.shop : null;
      const discountNodeId =
        typeof data.discountNodeId === "string"
          ? data.discountNodeId
          : null;

      try {
        const deactivateResult = await deactivateShopifyDiscount(
          discountCode,
          discountNodeId,
          shop
        );

        await doc.ref.update({
          ...(retryFailed ? {} : { status: "expired", expiredAt }),
          updatedAt: expiredAt,
          shopifyDeactivated: deactivateResult.shopifyDeactivated,
          discountNodeId:
            (deactivateResult as any).discountNodeId || discountNodeId || null,
          expireError: deactivateResult.error || null,
        });

        results.push({
          id: doc.id,
          shopifyDeactivated: deactivateResult.shopifyDeactivated,
          error: deactivateResult.error,
        });
      } catch (error) {
        const errorMessage = (error as Error).message;

        await doc.ref.update({
          ...(retryFailed ? {} : { status: "expired", expiredAt }),
          updatedAt: expiredAt,
          shopifyDeactivated: false,
          expireError: errorMessage,
        });

        results.push({
          id: doc.id,
          shopifyDeactivated: false,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiredTargets.length,
      expireMinutes,
      retryFailed,
      expiredIds: expiredTargets.map((doc) => doc.id),
      results,
    });
  } catch (error) {
    console.error("Failed to expire point redemptions:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
