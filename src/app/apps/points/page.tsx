// src/app/apps/points/page.tsx
export default function PointsPage() {
  return (
    <main
      style={{
        padding: "2rem",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          lineHeight: 1.8,
        }}
      >
        <h1>ポイントMAN ストアフロント導入</h1>

        <p>
          ポイントMANのストアフロント表示は、Shopify App Proxy経由の
          <code> /apps/apps/api/cart-points </code>
          を利用します。
        </p>

        <p>
          Shopify管理画面内のポイントMANアプリで「セットアップ」ページを開くと、
          App Proxy URL、カートへの設置方法、テスト手順を確認できます。
        </p>

        <h2>App Proxy URL</h2>

        <pre
          style={{
            overflowX: "auto",
            background: "#f6f6f7",
            border: "1px solid #dfe3e8",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          https://{"{shop-domain}"}/apps/apps/api/cart-points
        </pre>

        <p>
          カート画面では、ログイン顧客IDとカート内の商品IDを含めて
          App Proxy URLを呼び出します。アプリ側ではShopifyが付与する
          App Proxy署名を検証します。
        </p>
      </section>
    </main>
  );
}
