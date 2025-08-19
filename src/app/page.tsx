"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");

  useEffect(() => {
    if (shop) {
      window.location.href = `/api/auth?shop=${shop}`;
    }
  }, [shop]);

  return <div>Loading Shopify App…</div>;
}
