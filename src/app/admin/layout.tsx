// src/app/admin/layout.tsx
"use client";

import "@shopify/polaris/build/esm/styles.css";

import {
  AppProvider,
  Frame,
} from "@shopify/polaris";

import AdminNav from "./AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider i18n={{}}>
      <Frame>
        <div
          style={{
            minHeight: "100vh",
            background: "#f6f6f7",
          }}
        >
          <AdminNav />

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
