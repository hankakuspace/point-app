// src/lib/shopifySessionToken.ts
import { NextResponse } from "next/server";
import { shopify, validateShopDomain } from "@/lib/shopify";

type SessionTokenPayload = {
  dest?: string;
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  sid?: string;
};

function normalizeShopDomain(value: string) {
  return validateShopDomain(value.replace(/^https:\/\//, "").replace(/\/$/, ""));
}

function getShopFromPayload(payload: SessionTokenPayload) {
  try {
    const dest = new URL(payload.dest || "");
    const issuer = new URL(payload.iss || "");
    const shop = validateShopDomain(dest.hostname);
    if (!shop || dest.protocol !== "https:" || issuer.protocol !== "https:" ||
        dest.port || issuer.port || dest.username || dest.password ||
        issuer.username || issuer.password || dest.search || dest.hash ||
        issuer.search || issuer.hash || dest.pathname !== "/" ||
        issuer.pathname !== "/admin" || issuer.hostname !== shop ||
        !Number.isFinite(payload.exp) || !Number.isFinite(payload.nbf) ||
        !Number.isFinite(payload.iat)) return "";
    return shop;
  } catch {
    return "";
  }
}

export async function requireShopifySessionToken(
  req: Request,
  expectedShop?: string
) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Missing session token" },
        { status: 401 }
      ),
    };
  }

  try {
    const payload = (await shopify.session.decodeSessionToken(
      token
    )) as SessionTokenPayload;

    const tokenShop = getShopFromPayload(payload);
    const normalizedExpectedShop = expectedShop
      ? normalizeShopDomain(expectedShop)
      : "";

    if (!tokenShop) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, error: "Invalid session token shop" },
          { status: 401 }
        ),
      };
    }

    if (expectedShop && (!normalizedExpectedShop || tokenShop !== normalizedExpectedShop)) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, error: "Session token shop mismatch" },
          { status: 403 }
        ),
      };
    }

    return {
      ok: true as const,
      payload,
      shop: tokenShop,
    };
  } catch {
    console.error("Failed to verify Shopify session token");

    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Invalid session token" },
        { status: 401 }
      ),
    };
  }
}
