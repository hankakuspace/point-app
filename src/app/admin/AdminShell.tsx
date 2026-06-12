// src/app/admin/AdminShell.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import "@shopify/polaris/build/esm/styles.css";

import {
  AppProvider,
  Frame,
} from "@shopify/polaris";

import AdminNav from "./AdminNav";

type AuthStatus = "checking" | "ready" | "missing-shop";

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

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f7",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          color: "#202223",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#6d7175",
            fontSize: "13px",
          }}
        >
          ポイントMAN
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          Shopify認証を確認しています。
        </p>
      </div>
    </div>
  );
}

function MissingShopScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f7",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          color: "#202223",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#6d7175",
            fontSize: "13px",
          }}
        >
          ポイントMAN
        </p>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "18px",
            fontWeight: 700,
          }}
        >
          Shopify管理画面からアプリを開いてください
        </p>
        <p
          style={{
            margin: 0,
            color: "#6d7175",
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        >
          shop 情報を取得できませんでした。Shopify管理画面のアプリ一覧から Point MAN を開き直してください。
        </p>
      </div>
    </div>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const ensureOAuth = async () => {
      const shop = getShopFromAdminContext();

      if (!shop) {
        if (!cancelled) {
          setAuthStatus("missing-shop");
        }

        return;
      }

      try {
        const shopifyWindow = window as typeof window & {
          shopify?: {
            idToken?: () => Promise<string>;
          };
        };

        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (typeof shopifyWindow.shopify?.idToken === "function") {
            const token = await shopifyWindow.shopify.idToken();

            if (token && !cancelled) {
              setAuthStatus("ready");
              return;
            }
          }

          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }

        if (!cancelled) {
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
        {authStatus === "checking" && <LoadingScreen />}
        {authStatus === "missing-shop" && <MissingShopScreen />}
        {authStatus === "ready" && (
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
        )}
      </Frame>
    </AppProvider>
  );
}
