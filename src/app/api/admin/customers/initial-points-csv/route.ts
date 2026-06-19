// src/app/api/admin/customers/initial-points-csv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export const runtime = "nodejs";

type ShopifyMoneyV2 = {
  amount: string;
  currencyCode: string;
};

type ShopifyCustomerNode = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  amountSpent: ShopifyMoneyV2 | null;
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

type CsvCustomerRow = {
  customerId: string;
  email: string;
  points: number;
  reason: string;
  totalSpent: number;
  name: string;
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

function escapeCsvValue(value: string | number) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildCsv(rows: CsvCustomerRow[]) {
  const header = [
    "customerId",
    "email",
    "points",
    "reason",
    "totalSpent",
    "name",
  ];

  const body = rows.map((row) =>
    [
      row.customerId,
      row.email,
      row.points,
      row.reason,
      row.totalSpent,
      row.name,
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return `\uFEFF${[header.join(","), ...body].join("\n")}`;
}

export async function GET(req: NextRequest) {
  try {
    const requestedShop = req.nextUrl.searchParams.get("shop") || "";
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

    const reason =
      req.nextUrl.searchParams.get("reason")?.trim() ||
      "過去購入分ポイント移行";
    const pointRate = 0.01;

    let hasNextPage = true;
    let after: string | null = null;
    const rows: CsvCustomerRow[] = [];

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
                amountSpent {
                  amount
                  currencyCode
                }
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

      const result = (await response.json()) as ShopifyCustomersResponse;

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
        const totalSpent = Number(customer.amountSpent?.amount || 0);
        const points = Math.floor(totalSpent * pointRate);

        if (!Number.isFinite(totalSpent) || points <= 0) {
          continue;
        }

        rows.push({
          customerId: getNumericCustomerId(customer.id),
          email: customer.email || "",
          points,
          reason,
          totalSpent,
          name: buildCustomerName(customer),
        });
      }

      hasNextPage = customers.pageInfo.hasNextPage;
      after = customers.pageInfo.endCursor;
    }

    const csv = buildCsv(rows);
    const filename = `initial-points-${shop.replace(/[^a-zA-Z0-9.-]/g, "_")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to create initial points CSV:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
