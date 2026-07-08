// src/app/api/admin/customers/sync-shopify/route.ts
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export const runtime = "nodejs";

type ShopifyCustomerNode = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: string | null;
};

type ShopifyCustomerEdge = {
  cursor: string;
  node: ShopifyCustomerNode;
};

type ShopifyCustomersResponse = {
  data?: {
    customers?: {
      edges: ShopifyCustomerEdge[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: unknown;
};

type ShopifyTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type ShopAuthData = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  tokenType?: string;
  scope?: string;
};

function getNumericCustomerId(gid: string) {
  return gid.split("/").pop() || gid;
}

function buildCustomerName(customer: ShopifyCustomerNode) {
  return [customer.lastName, customer.firstName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getShopifyCustomerFetchErrorMessage(details: unknown) {
  const detailText = JSON.stringify(details || "");

  if (
    detailText.includes("Invalid API key or access token") ||
    detailText.includes("unrecognized login or wrong password")
  ) {
    return "Shopify認証が無効になっています。アプリを開き直して再認証してください。";
  }

  return "Shopify顧客情報の取得に失敗しました。時間をおいて再実行してください。";
}

function shouldRefreshAccessToken(expiresAt?: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiresAtTime)) {
    return false;
  }

  const refreshBufferMs = 5 * 60 * 1000;
  return expiresAtTime <= Date.now() + refreshBufferMs;
}

async function refreshShopifyAccessToken(shop: string, refreshToken: string) {
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as ShopifyTokenResponse;

  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error("Shopify token refresh failed:", {
      shop,
      status: tokenRes.status,
      tokenJson,
    });

    throw new Error("SHOPIFY_TOKEN_REFRESH_FAILED");
  }

  const issuedAt = Date.now();
  const accessTokenExpiresAt =
    typeof tokenJson.expires_in === "number"
      ? new Date(issuedAt + tokenJson.expires_in * 1000).toISOString()
      : null;

  const refreshTokenExpiresAt =
    typeof tokenJson.refresh_token_expires_in === "number"
      ? new Date(issuedAt + tokenJson.refresh_token_expires_in * 1000).toISOString()
      : null;

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    scope: typeof tokenJson.scope === "string" ? tokenJson.scope : "",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop = body.shop;

    const session = await requireShopifySessionToken(req, shop);

    if (!session.ok) {
      return session.response;
    }

    if (!shop || typeof shop !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing shop" },
        { status: 400 }
      );
    }

    const shopDoc = await db.collection("shops").doc(shop).get();

    if (!shopDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Shop not found" },
        { status: 404 }
      );
    }

    const shopData = shopDoc.data() as ShopAuthData;
    let accessToken = shopData.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify認証が見つかりません。アプリを開き直して再認証してください。",
        },
        { status: 401 }
      );
    }

    if (shouldRefreshAccessToken(shopData.accessTokenExpiresAt)) {
      if (!shopData.refreshToken) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Shopify認証の更新に必要な情報が見つかりません。アプリを開き直して再認証してください。",
          },
          { status: 401 }
        );
      }

      try {
        const refreshedToken = await refreshShopifyAccessToken(
          shop,
          shopData.refreshToken
        );

        accessToken = refreshedToken.accessToken;

        await db.collection("shops").doc(shop).set(
          {
            accessToken: refreshedToken.accessToken,
            refreshToken: refreshedToken.refreshToken,
            accessTokenExpiresAt: refreshedToken.accessTokenExpiresAt,
            refreshTokenExpiresAt: refreshedToken.refreshTokenExpiresAt,
            tokenType: "expiring_offline",
            scope: refreshedToken.scope || shopData.scope || "",
            tokenRefreshedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Shopify token refresh error:", error);

        return NextResponse.json(
          {
            success: false,
            error:
              "Shopify認証の更新に失敗しました。アプリを開き直して再認証してください。",
          },
          { status: 401 }
        );
      }
    }

    const existingCustomersSnapshot = await db
      .collection("customers")
      .where("shop", "==", shop)
      .get();

    const existingCustomerIds = new Set(
      existingCustomersSnapshot.docs.map((doc) => doc.id)
    );

    let batch = db.batch();
    let batchOperationCount = 0;

    const commitBatchIfNeeded = async (force = false) => {
      if (batchOperationCount === 0) {
        return;
      }

      if (!force && batchOperationCount < 450) {
        return;
      }

      await batch.commit();
      batch = db.batch();
      batchOperationCount = 0;
    };

    let hasNextPage = true;
    let after: string | null = null;
    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    while (hasNextPage) {
      const query = `
        query Customers($first: Int!, $after: String) {
          customers(first: $first, after: $after) {
            edges {
              cursor
              node {
                id
                firstName
                lastName
                email
                createdAt
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const response = await fetch(
        `https://${shop}/admin/api/2025-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              first: 250,
              after,
            },
          }),
        }
      );

      const result = (await response.json()) as ShopifyCustomersResponse;

      if (!response.ok || result.errors) {
        console.error("Shopify customers sync fetch failed:", {
          status: response.status,
          errors: result.errors,
          result,
        });

        return NextResponse.json(
          {
            success: false,
            error: getShopifyCustomerFetchErrorMessage(
              result.errors || result
            ),
          },
          { status: response.status || 500 }
        );
      }

      const customers = result.data?.customers;

      if (!customers) {
        break;
      }

      for (const edge of customers.edges) {
        const customer = edge.node;
        const customerId = getNumericCustomerId(customer.id);
        const customerRef = db.collection("customers").doc(customerId);
        const isExistingCustomer = existingCustomerIds.has(customerId);

        const customerData = {
          shop,
          shopifyCustomerGid: customer.id,
          name: buildCustomerName(customer),
          email: customer.email || "",
          createdAt: customer.createdAt || null,
          updatedAt: new Date().toISOString(),
        };

        if (isExistingCustomer) {
          batch.set(customerRef, customerData, { merge: true });
          updatedCount += 1;
        } else {
          batch.set(
            customerRef,
            {
              ...customerData,
              points: FieldValue.increment(0),
            },
            { merge: true }
          );

          existingCustomerIds.add(customerId);
          createdCount += 1;
        }

        batchOperationCount += 1;
        syncedCount += 1;

        await commitBatchIfNeeded();
      }

      hasNextPage = customers.pageInfo.hasNextPage;
      after = customers.pageInfo.endCursor;
    }

    await commitBatchIfNeeded(true);

    return NextResponse.json({
      success: true,
      shop,
      syncedCount,
      createdCount,
      updatedCount,
    });
  } catch (error) {
    console.error("Failed to sync Shopify customers:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
