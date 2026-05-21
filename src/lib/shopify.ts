// src/lib/shopify.ts
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-07";
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
  restResources,
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
