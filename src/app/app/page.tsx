"use client";

import { useEffect, useState } from "react";

export default function AppPage() {
  const [loading, setLoading] = useState(true);
  const [shopData, setShopData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shop = params.get("shop");
        if (!shop) return;

        const res = await fetch(`/api/shop-data?shop=${shop}`);
        const data = await res.json();
        setShopData(data);
      } catch (err) {
        console.error("API fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (!shopData) return <p>データがありません</p>;

  return (
    <div>
      <h1>美サーチポイント管理アプリ</h1>
      <pre>{JSON.stringify(shopData, null, 2)}</pre>
    </div>
  );
}
