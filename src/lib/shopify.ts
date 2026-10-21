// src/lib/shopify.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

// Only canonical Shopify shop hosts may receive credentials.
export function validateShopDomain(value: string) {
  if (typeof value !== "string") return "";
  const shop = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(shop)
    ? shop
    : "";
}

export const OAUTH_COOKIE_NAME = "__Host-pointman-oauth";
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  // Shopify returns via a cross-site, top-level GET navigation.
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

export function createOAuthState(shop: string) {
  const state = randomBytes(32).toString("hex");
  const data = Buffer.from(JSON.stringify({
    state, shop, expiresAt: Date.now() + OAUTH_COOKIE_OPTIONS.maxAge * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(data).digest("hex");
  return { state, cookie: `${data}.${signature}` };
}

export function verifyOAuthState(cookie: string, state: string, shop: string) {
  try {
    const parts = cookie.split(".");
    if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
    const signature = createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
      .update(parts[0]).digest();
    if (!timingSafeEqual(signature, Buffer.from(parts[1], "hex"))) return false;
    const saved = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return /^[a-f0-9]{64}$/.test(state) && saved.state === state &&
      saved.shop === shop && Number.isFinite(saved.expiresAt) &&
      saved.expiresAt > Date.now();
  } catch {
    return false;
  }
}

// Backport Shopify 6675463's OAuth query encoding without updating the SDK.
// URLSearchParams values are already decoded once; do not decode them again.
export function verifyShopifyOAuthHmac(params: URLSearchParams) {
  const hmac = params.get("hmac") || "";
  const timestamp = params.get("timestamp") || "";
  if (!/^[a-f0-9]{64}$/.test(hmac) || !/^\d+$/.test(timestamp) ||
      !Number.isFinite(Number(timestamp)) ||
      Math.abs(Math.trunc(Date.now() / 1000) - Number(timestamp)) > 90) {
    return false;
  }
  const canonical = new URLSearchParams();
  const keys = [...params.keys()];
  if (keys.some((key) => params.getAll(key).length !== 1)) return false;
  keys.sort((a, b) => a.localeCompare(b)).forEach((key) => {
    if (key !== "hmac" && key !== "signature") {
      canonical.append(key, params.get(key)!);
    }
  });
  const message = canonical.toString().replace(/\+/g, "%20");
  const expected = createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(message).digest();
  return timingSafeEqual(expected, Buffer.from(hmac, "hex"));
}

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
    : ["read_discounts", "write_discounts"],
  hostName: process.env.SHOPIFY_APP_URL!.replace(/^https?:\/\//, ""),
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION,
  sessionStorage: new SimpleMemorySessionStorage(),
});

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
  const validatedShop = validateShopDomain(shop);
  if (!validatedShop) throw new Error("Invalid shop host");

  const response = await fetch(`https://${validatedShop}/admin/oauth/access_token`, {
    redirect: "error",
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
      `Shopify token refresh error: ${response.status}`
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
      throw new Error("Shop not found");
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

  if (!validateShopDomain(targetShop)) throw new Error("Invalid shop host");

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
      redirect: "error",
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
      `Shopify Admin API error: ${response.status}`
    );
  }

  if (result.errors) {
    throw new Error(
      "Shopify GraphQL error"
    );
  }

  return result.data;
}
