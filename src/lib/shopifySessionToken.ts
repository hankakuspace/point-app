// src/lib/shopifySessionToken.ts
import { NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";

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
  return value
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();
}

function getShopFromPayload(payload: SessionTokenPayload) {
  const source = payload.dest || payload.iss || "";

  if (!source) {
    return "";
  }

  try {
    return normalizeShopDomain(new URL(source).hostname);
  } catch {
    return normalizeShopDomain(source);
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

    if (
      normalizedExpectedShop &&
      tokenShop &&
      tokenShop !== normalizedExpectedShop
    ) {
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
      shop: normalizedExpectedShop || tokenShop,
    };
  } catch (error) {
    console.error("Failed to verify Shopify session token:", error);

    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Invalid session token" },
        { status: 401 }
      ),
    };
  }
}
