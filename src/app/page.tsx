"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Content() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const installed = searchParams.get("installed");

  if (installed) {
    return <div>✅ アプリのインストールが完了しました！</div>;
  }

  if (shop) {
    return <div>Shopify ストア <b>{shop}</b> でアプリを開いています。</div>;
  }

  return <div>ようこそ！</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}
