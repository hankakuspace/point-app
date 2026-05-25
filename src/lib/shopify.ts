// src/lib/shopify.ts
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

/**
 * ✅ シンプルなメモリセッションストレージ実装（MemorySessionStorage互換）
 */
class SimpleMemorySessionStorage {
  store = new Map<string, any>();

  async storeSession(session: any) {
    this.store.set(session.id, session);
    return true;
  }

  async loadSession(id: string) {
    return this.store.get(id) || null;
  }

  async deleteSession(id: string) {
    this.store.delete(id);
    return true;
  }

  async deleteSessions(ids: string[]) {
    ids.forEach((id) => this.store.delete(id));
    return true;
  }

  async findSessionsByShop(shop: string) {
    return Array.from(this.store.values()).filter((s) => s.shop === shop);
  }
}

/**
 * ✅ Shopify APIクライアント初期化
 */
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SCOPES
    ? process.env.SCOPES.split(",")
    : ["read_checkouts", "write_checkouts", "read_discounts", "write_discounts"],
  hostName: process.env.SHOPIFY_APP_URL!.replace(/^https?:\/\//, ""),
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION,
  sessionStorage: new SimpleMemorySessionStorage(),
});

/**
 * ✅ 注文支払い完了Webhook登録
 */
export async function registerOrderPaidWebhook(shop: string, accessToken: string) {
  const endpoint = `https://${shop}/admin/api/2025-07/webhooks.json`;

  const body = {
    webhook: {
      topic: "orders/paid",
      address: `${process.env.SHOPIFY_APP_URL}/api/webhooks/orders/paid`,
      format: "json",
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Webhook registration failed:", response.status, response.statusText);
      console.error("Response text:", text);
      return { error: text, status: response.status };
    }

    const result = await response.json();
    console.log("📦 Webhook registration result:", JSON.stringify(result, null, 2));

    return result;
  } catch (error: any) {
    console.error("💥 registerOrderPaidWebhook Error:", error.message);
    return { error: error.message };
  }
}

/**
 * ✅ Shopify Admin GraphQL API 呼び出し
 * Firestore の shops/{shop} に保存済みの accessToken を使用する。
 * shop が未指定の場合は、単一ストア運用前提で shops の先頭1件を使用する。
 */
interface StoredShopToken {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  scope?: string;
  tokenType?: string;
}

function isAccessTokenExpiringSoon(accessTokenExpiresAt?: string | null) {
  if (!accessTokenExpiresAt) {
    return false;
  }

  const expiresAtMs = new Date(accessTokenExpiresAt).getTime();

  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  const refreshBufferMs = 5 * 60 * 1000;

  return expiresAtMs <= Date.now() + refreshBufferMs;
}

async function refreshShopifyOfflineAccessToken(
  shop: string,
  refreshToken: string
) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
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

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Shopify token refresh error: ${JSON.stringify(result)}`
    );
  }

  return result as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    scope?: string;
  };
}

async function getShopifyAdminAccessToken(shop?: string) {
  const { db } = await import("@/lib/firebaseAdmin");

  let targetShop = shop;
  let shopDoc;

  if (targetShop) {
    shopDoc = await db.collection("shops").doc(targetShop).get();

    if (!shopDoc.exists) {
      throw new Error(`Shop not found: ${targetShop}`);
    }
  } else {
    const shopsSnapshot = await db.collection("shops").limit(1).get();

    if (shopsSnapshot.empty) {
      throw new Error("No installed shop found");
    }

    shopDoc = shopsSnapshot.docs[0];
    targetShop = shopDoc.id;
  }

  const shopData = shopDoc.data() as StoredShopToken | undefined;

  if (!targetShop || !shopData?.accessToken) {
    throw new Error("Missing shop or access token");
  }

  if (
    shopData.refreshToken &&
    isAccessTokenExpiringSoon(shopData.accessTokenExpiresAt)
  ) {
    const refreshed = await refreshShopifyOfflineAccessToken(
      targetShop,
      shopData.refreshToken
    );

    const issuedAt = Date.now();
    const accessTokenExpiresAt = refreshed.expires_in
      ? new Date(issuedAt + refreshed.expires_in * 1000).toISOString()
      : null;
    const refreshTokenExpiresAt = refreshed.refresh_token_expires_in
      ? new Date(issuedAt + refreshed.refresh_token_expires_in * 1000).toISOString()
      : shopData.refreshTokenExpiresAt || null;

    const nextAccessToken = refreshed.access_token;
    const nextRefreshToken = refreshed.refresh_token || shopData.refreshToken;

    await db.collection("shops").doc(targetShop).set(
      {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        tokenType: "expiring_offline",
        scope: refreshed.scope || shopData.scope || "",
        tokenRefreshedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      targetShop,
      accessToken: nextAccessToken,
    };
  }

  return {
    targetShop,
    accessToken: shopData.accessToken,
  };
}

export async function callShopifyAdminAPI(
  query: string,
  variables: Record<string, any> = {},
  shop?: string
) {
  const { targetShop, accessToken } = await getShopifyAdminAccessToken(shop);

  const response = await fetch(
    `https://${targetShop}/admin/api/2025-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Shopify Admin API error: ${JSON.stringify(result)}`
    );
  }

  if (result.errors) {
    throw new Error(
      `Shopify GraphQL error: ${JSON.stringify(result.errors)}`
    );
  }

  return result.data;
}
