// src/app/admin/AdminShell.tsx
"use client";

import { Suspense, useEffect } from "react";
import "@shopify/polaris/build/esm/styles.css";

import {
  AppProvider,
  Frame,
} from "@shopify/polaris";

import AdminNav from "./AdminNav";

function getShopFromAdminContext() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const urlShop = params.get("shop") || "";

    if (urlShop) {
      window.sessionStorage.setItem("pointman-shop", urlShop);
      return urlShop;
    }
  } catch (error) {}

  try {
    const storedShop = window.sessionStorage.getItem("pointman-shop") || "";

    if (storedShop) {
      return storedShop;
    }
  } catch (error) {}

  try {
    const referrerUrl = new URL(document.referrer);
    const match = referrerUrl.pathname.match(new RegExp("/store/([^/]+)"));

    if (match && match[1]) {
      const inferredShop = `${match[1]}.myshopify.com`;
      window.sessionStorage.setItem("pointman-shop", inferredShop);
      return inferredShop;
    }
  } catch (error) {}

  return "";
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    let cancelled = false;

    const ensureOAuth = async () => {
      const shop = getShopFromAdminContext();

      if (!shop) {
        return;
      }

      try {
        const shopifyWindow = window as typeof window & {
          shopify?: {
            idToken?: () => Promise<string>;
          };
        };

        if (typeof shopifyWindow.shopify?.idToken !== "function") {
          setTimeout(() => {
            if (!cancelled) {
              window.location.href = `/api/auth?shop=${encodeURIComponent(shop)}`;
            }
          }, 1500);
          return;
        }

        const token = await shopifyWindow.shopify.idToken();

        if (!token && !cancelled) {
          window.location.href = `/api/auth?shop=${encodeURIComponent(shop)}`;
        }
      } catch (error) {
        if (!cancelled) {
          window.location.href = `/api/auth?shop=${encodeURIComponent(shop)}`;
        }
      }
    };

    ensureOAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppProvider i18n={{}}>
      <Frame>
        <div
          style={{
            minHeight: "100vh",
            background: "#f6f6f7",
          }}
        >
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>

          <div
            style={{
              padding: "20px",
            }}
          >
            {children}
          </div>
        </div>
      </Frame>
    </AppProvider>
  );
}
