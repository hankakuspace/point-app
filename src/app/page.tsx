// src/app/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");

  useEffect(() => {
    if (shop) {
      // shop パラメータがあれば認証にリダイレクト
      window.location.href = `/api/auth?${searchParams.toString()}`;
    }
  }, [shop, searchParams]);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>美サーチポイント管理アプリ</h1>
      <p>Shopify ストアと連携するにはアプリをインストールしてください。</p>
    </main>
  );
}
