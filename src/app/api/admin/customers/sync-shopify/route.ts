// src/app/api/admin/customers/sync-shopify/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";

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

function getNumericCustomerId(gid: string) {
  return gid.split("/").pop() || gid;
}

function buildCustomerName(customer: ShopifyCustomerNode) {
  return [customer.lastName, customer.firstName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop = body.shop;

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

    const shopData = shopDoc.data() as { accessToken?: string };
    const accessToken = shopData.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Access token not found" },
        { status: 401 }
      );
    }

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
              first: 100,
              after,
            },
          }),
        }
      );

      const result =
        (await response.json()) as ShopifyCustomersResponse;

      if (!response.ok || result.errors) {
        return NextResponse.json(
          {
            success: false,
            error: "Shopify customers fetch failed",
            details: result.errors || result,
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
        const existingCustomer = await customerRef.get();

        const customerData = {
          shop,
          shopifyCustomerGid: customer.id,
          name: buildCustomerName(customer),
          email: customer.email || "",
          createdAt: customer.createdAt || null,
          updatedAt: new Date().toISOString(),
        };

        if (existingCustomer.exists) {
          await customerRef.set(customerData, { merge: true });
          updatedCount += 1;
        } else {
          await customerRef.set(
            {
              ...customerData,
              points: 0,
            },
            { merge: true }
          );
          createdCount += 1;
        }

        syncedCount += 1;
      }

      hasNextPage = customers.pageInfo.hasNextPage;
      after = customers.pageInfo.endCursor;
    }

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
