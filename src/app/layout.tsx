// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ポイントMAN",
  description: "Shopify stores point management app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shopifyApiKey = process.env.SHOPIFY_API_KEY || "";

  return (
    <html lang="ja">
      <head>
        <meta name="shopify-api-key" content={shopifyApiKey} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === "undefined" || window.__pointmanShopInitialized) {
                  return;
                }

                window.__pointmanShopInitialized = true;

                var shop = "";

                try {
                  var params = new URLSearchParams(window.location.search);
                  shop = params.get("shop") || "";
                } catch (error) {}

                if (!shop) {
                  try {
                    var storedShop = window.sessionStorage.getItem("pointman-shop") || "";
                    shop = storedShop;
                  } catch (error) {}
                }

                if (!shop) {
                  try {
                    var referrerUrl = new URL(document.referrer);
                    var match = referrerUrl.pathname.match(new RegExp("/store/([^/]+)"));

                    if (match && match[1]) {
                      shop = match[1] + ".myshopify.com";
                    }
                  } catch (error) {}
                }

                if (shop) {
                  try {
                    window.sessionStorage.setItem("pointman-shop", shop);
                  } catch (error) {}

                  try {
                    var currentParams = new URLSearchParams(window.location.search);
                    var currentShop = currentParams.get("shop") || "";

                    if (!currentShop && window.location.pathname.indexOf("/admin") === 0) {
                      currentParams.set("shop", shop);

                      var nextUrl =
                        window.location.pathname +
                        "?" +
                        currentParams.toString() +
                        window.location.hash;

                      window.location.replace(nextUrl);
                      return;
                    }
                  } catch (error) {}

                  try {
                    var appBridgeConfig = {
                      apiKey: "${shopifyApiKey}",
                      shop: shop
                    };

                    window.sessionStorage.setItem(
                      "app-bridge-config",
                      JSON.stringify(appBridgeConfig)
                    );
                  } catch (error) {}
                }
              })();
            `,
          }}
        />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === "undefined" || window.__pointmanFetchPatched) {
                  return;
                }

                window.__pointmanFetchPatched = true;

                var originalFetch = window.fetch.bind(window);

                window.fetch = async function (input, init) {
                  var requestUrl =
                    typeof input === "string"
                      ? input
                      : input && input.url
                        ? input.url
                        : "";

                  var targetUrl;

                  try {
                    targetUrl = new URL(requestUrl, window.location.origin);
                  } catch (error) {
                    return originalFetch(input, init);
                  }

                  var isSameOriginApiRequest =
                    targetUrl.origin === window.location.origin &&
                    targetUrl.pathname.indexOf("/api/") === 0;

                  if (!isSameOriginApiRequest) {
                    return originalFetch(input, init);
                  }

                  try {
                    if (!window.shopify || typeof window.shopify.idToken !== "function") {
                      return originalFetch(input, init);
                    }

                    var token = await window.shopify.idToken();

                    if (!token) {
                      return originalFetch(input, init);
                    }

                    var nextInit = init ? Object.assign({}, init) : {};
                    var headers = new Headers(nextInit.headers || {});

                    if (!headers.has("Authorization")) {
                      headers.set("Authorization", "Bearer " + token);
                    }

                    nextInit.headers = headers;

                    return originalFetch(input, nextInit);
                  } catch (error) {
                    return originalFetch(input, init);
                  }
                };
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
