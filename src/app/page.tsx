"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function Content() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");

  useEffect(() => {
    if (shop) {
      window.location.href = `/api/auth?shop=${shop}`;
    }
  }, [shop]);

  return <div>Loading Shopify App…</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Content />
    </Suspense>
  );
}
