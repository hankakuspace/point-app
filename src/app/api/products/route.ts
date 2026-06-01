// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { callShopifyAdminAPI } from "@/lib/shopify";

function getNumericId(gid: string) {
  const parts = gid.split("/");
  const last = parts[parts.length - 1];
  return Number(last);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const query = `
      query ProductsForPointMan($first: Int!) {
        products(first: $first, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
              vendor
              productType
              status
              tags
              createdAt
              updatedAt
              featuredImage {
                url
                altText
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await callShopifyAdminAPI(query, { first: 250 }, shop);
    const edges = data?.products?.edges || [];

    const products = edges.map((edge: any) => {
      const product = edge.node;
      const firstVariant = product.variants?.edges?.[0]?.node || null;

      return {
        id: getNumericId(product.id),
        admin_graphql_api_id: product.id,
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        product_type: product.productType,
        status: String(product.status || "").toLowerCase(),
        tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        image: product.featuredImage
          ? {
              src: product.featuredImage.url,
              alt: product.featuredImage.altText || null,
            }
          : null,
        variants: firstVariant
          ? [
              {
                id: getNumericId(firstVariant.id),
                admin_graphql_api_id: firstVariant.id,
                price: firstVariant.price,
              },
            ]
          : [],
      };
    });

    return NextResponse.json({ products }, { status: 200 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
