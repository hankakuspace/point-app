// src/app/api/use-point-form/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { callShopifyAdminAPI } from "@/lib/shopify";

function renderHtml({
  title,
  message,
  discountCode,
  remainingPoints,
}: {
  title: string;
  message: string;
  discountCode?: string;
  remainingPoints?: number;
}) {
  return new NextResponse(
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      background: #f6f6f7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #202223;
    }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 16px;
    }
    .card {
      background: #fff;
      border: 1px solid #dfe3e8;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    .code {
      margin-top: 20px;
      padding: 18px;
      background: #ecfdf3;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
    }
    .code strong {
      display: block;
      font-size: 28px;
      letter-spacing: 0.04em;
      color: #14532d;
    }
    a {
      display: inline-block;
      margin-top: 24px;
      color: #008060;
      font-weight: 700;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <p style="margin:0 0 8px;color:#6d7175;font-size:13px;">ポイントMAN</p>
      <h1 style="margin:0 0 16px;font-size:24px;">${title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.8;">${message}</p>

      ${
        discountCode
          ? `<div class="code">
              <p style="margin:0 0 8px;color:#166534;font-size:13px;">発行された割引コード</p>
              <strong>${discountCode}</strong>
            </div>`
          : ""
      }

      ${
        typeof remainingPoints === "number"
          ? `<p style="margin:20px 0 0;color:#6d7175;">残りポイント：${remainingPoints.toLocaleString()} pt</p>`
          : ""
      }

      <a href="/apps/apps">ポイント画面へ戻る</a>
    </section>
  </main>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

function renderCartDiscountRedirectHtml(discountCode: string) {
  const redirectUrl = `/discount/${encodeURIComponent(discountCode)}?redirect=/checkout`;

  return new NextResponse(
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>チェックアウトへ移動しています</title>
  <script>
    window.top.location.href = ${JSON.stringify(redirectUrl)};
  </script>
  <style>
    body {
      margin: 0;
      background: #f6f6f7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #202223;
    }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 16px;
    }
    .card {
      background: #fff;
      border: 1px solid #dfe3e8;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    a {
      color: #008060;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <p style="margin:0 0 8px;color:#6d7175;font-size:13px;">ポイントMAN</p>
      <h1 style="margin:0 0 16px;font-size:24px;">割引を適用しています</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">
        割引コード ${discountCode} を適用してチェックアウトへ移動しています。
      </p>
      <p style="margin:0;font-size:14px;">
        自動で移動しない場合は <a href="${redirectUrl}" target="_top">こちら</a> をクリックしてください。
      </p>
    </section>
  </main>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

async function deactivateReissuedShopifyDiscount(
  discountNodeId?: string | null,
  shop?: string | null
) {
  if (!discountNodeId) {
    return {
      shopifyDeactivated: false,
      error: "Missing discountNodeId",
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
      id: discountNodeId,
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
    error: null,
  };
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const shop = url.searchParams.get("shop") || "";
    const loggedInCustomerId = url.searchParams.get("logged_in_customer_id") || "";

    const formData = await req.formData();
    const returnMode = String(formData.get("returnMode") || "").trim();

    const formCustomerId = String(formData.get("customerId") || "").trim();
    const customerId = loggedInCustomerId || formCustomerId;

    const usePoints = Number(formData.get("usePoints"));

    if (!customerId) {
      return renderHtml({
        title: "ポイントを利用できません",
        message: "ログイン中の顧客IDを取得できませんでした。",
      });
    }

    if (!Number.isFinite(usePoints) || usePoints <= 0) {
      return renderHtml({
        title: "ポイントを利用できません",
        message: "利用ポイント数を正しく入力してください。",
      });
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
      return renderHtml({
        title: "ポイントを利用できません",
        message: `最低利用ポイントは ${minUsePoints.toLocaleString()} pt です。`,
      });
    }

    if (usePoints > maxUsePoints) {
      return renderHtml({
        title: "ポイントを利用できません",
        message: `最大利用ポイントは ${maxUsePoints.toLocaleString()} pt です。`,
      });
    }

    const customerRef = db.collection("customers").doc(customerId);
    const customerSnap = await customerRef.get();

    if (!customerSnap.exists) {
      return renderHtml({
        title: "ポイントを利用できません",
        message: "ポイントMANに顧客情報が登録されていません。",
      });
    }

    const customer = customerSnap.data() || {};
    const currentPoints =
      typeof customer.points === "number" && Number.isFinite(customer.points)
        ? customer.points
        : 0;

    const email = typeof customer.email === "string" ? customer.email : "";

    if (currentPoints < usePoints) {
      return renderHtml({
        title: "ポイントを利用できません",
        message: "保有ポイントを超えて利用することはできません。",
      });
    }

    const nowBeforeIssue = new Date().toISOString();

    const issuedSnapshot = await db
      .collection("point_redemptions")
      .where("customerId", "==", customerId)
      .where("status", "==", "issued")
      .get();

    if (!issuedSnapshot.empty) {
      const batch = db.batch();

      for (const doc of issuedSnapshot.docs) {
        const redemption = doc.data();
        const discountNodeId =
          typeof redemption.discountNodeId === "string"
            ? redemption.discountNodeId
            : null;
        const redemptionShop =
          typeof redemption.shop === "string"
            ? redemption.shop
            : shop || null;

        let shopifyDeactivated = false;
        let expireError: string | null = null;

        try {
          const deactivateResult =
            await deactivateReissuedShopifyDiscount(
              discountNodeId,
              redemptionShop
            );

          shopifyDeactivated = deactivateResult.shopifyDeactivated;
          expireError = deactivateResult.error || null;
        } catch (error) {
          shopifyDeactivated = false;
          expireError = (error as Error).message;
        }

        batch.update(doc.ref, {
          status: "expired",
          expiredAt: nowBeforeIssue,
          updatedAt: nowBeforeIssue,
          expireReason: "reissued",
          shopifyDeactivated,
          expireError,
        });
      }

      await batch.commit();
    }

    const discountAmount = usePoints;
    const discountCodeValue = `POINT-${Math.floor(Math.random() * 100000)}`;

    const mutation = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  edges {
                    node {
                      code
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      basicCodeDiscount: {
        title: `POINT-${email || customerId}-${Date.now()}`,
        startsAt: new Date().toISOString(),
        endsAt: null,
        code: discountCodeValue,
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
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      },
    };

    const response = await callShopifyAdminAPI(mutation, variables, shop || undefined);
    const discountResult = response?.discountCodeBasicCreate;
    const userErrors = discountResult?.userErrors || [];

    if (userErrors.length > 0) {
      return renderHtml({
        title: "割引コードを発行できません",
        message: userErrors.map((error: any) => error.message).join(" / "),
      });
    }

    const discountNodeId = discountResult?.codeDiscountNode?.id;
    const discountCode =
      discountResult?.codeDiscountNode?.codeDiscount?.codes?.edges?.[0]?.node?.code;

    if (!discountCode) {
      return renderHtml({
        title: "割引コードを発行できません",
        message: "Shopifyから割引コードが返りませんでした。",
      });
    }

    const remainingPoints = currentPoints;

    await db.collection("point_redemptions").doc(discountCode).set({
      customerId,
      email,
      discountCode,
      discountNodeId: discountNodeId || null,
      points: usePoints,
      status: "issued",
      source: returnMode === "cart" ? "cart" : "app_proxy",
      shop: shop || null,
      createdAt: new Date().toISOString(),
      usedAt: null,
      orderId: null,
    });

    if (returnMode === "cart") {
      return renderCartDiscountRedirectHtml(discountCode);
    }

    return renderHtml({
      title: "割引コードを発行しました",
      message: `${usePoints.toLocaleString()} pt を利用しました。チェックアウト画面で以下の割引コードを入力してください。`,
      discountCode,
      remainingPoints,
    });
  } catch (error) {
    console.error("use-point-form error:", error);

    return renderHtml({
      title: "ポイント利用エラー",
      message: (error as Error).message,
    });
  }
}
