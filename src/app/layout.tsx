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
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
