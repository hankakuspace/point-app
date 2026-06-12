// src/app/admin/setup/page.tsx
export const dynamic = "force-dynamic";

const setupSteps = [
  {
    title: "1. App Proxy設定を確認する",
    body: "Shopify Partner側のPoint MANで、App Proxyのprefixが apps、subpathが apps、URLが https://point-app-gamma.vercel.app になっていることを確認します。",
  },
  {
    title: "2. Theme App Extensionをカートに追加する",
    body: "Shopifyテーマエディタでカートページを開き、ブロック追加からアプリの Point MAN points を選択して保存します。手動でLiquidを編集する必要はありません。",
  },
  {
    title: "3. ポイント表示を確認する",
    body: "ログイン済み顧客でカートを開き、使えるポイント、利用ポイント入力欄、ポイントを使うボタンが表示されることを確認します。",
  },
  {
    title: "4. ポイント利用をテストする",
    body: "ポイントを入力して送信し、割引コードが発行され、チェックアウトへ遷移することを確認します。",
  },
  {
    title: "5. 注文完了後の付与を確認する",
    body: "注文完了後、orders/paid Webhookにより顧客ポイントとポイント履歴が更新されることを管理画面で確認します。",
  },
];

export default function SetupPage() {
  return (
    <main style={{ display: "grid", gap: "20px" }}>
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#6d7175", fontSize: "13px" }}>
          ポイントMAN
        </p>
        <h1 style={{ margin: "0 0 12px", color: "#202223", fontSize: "24px" }}>
          ストアフロント導入ガイド
        </h1>
        <p style={{ margin: 0, color: "#5c5f62", fontSize: "14px", lineHeight: 1.7 }}>
          ポイントMANは、Theme App Extension の Point MAN points ブロックと Shopify App Proxy を利用して、
          カート画面にポイント表示・ポイント利用フォームを表示します。
          このページでは、マーチャントと審査担当者が確認できるよう、導入手順とテスト手順をまとめています。
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", color: "#202223", fontSize: "18px" }}>
          テーマエディタで有効化する
        </h2>
        <p style={{ margin: "0 0 12px", color: "#5c5f62", fontSize: "14px", lineHeight: 1.7 }}>
          Shopify管理画面の「オンラインストア」→「テーマ」→「カスタマイズ」からカートページを開き、
          「ブロックを追加」→「アプリ」→「Point MAN points」を選択して保存します。
        </p>
        <a
          href="https://admin.shopify.com/themes/current/editor"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            padding: "10px 14px",
            background: "#008060",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          テーマエディタを開く
        </a>
        <p style={{ margin: "12px 0 0", color: "#6d7175", fontSize: "13px", lineHeight: 1.7 }}>
          テーマエディタを開いた後、カートページを選択して Point MAN points ブロックを追加してください。
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", color: "#202223", fontSize: "18px" }}>
          App Proxy URL
        </h2>
        <pre
          style={{
            margin: 0,
            overflowX: "auto",
            background: "#f6f6f7",
            border: "1px solid #dfe3e8",
            borderRadius: "10px",
            padding: "14px",
            color: "#202223",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          https://{"{shop-domain}"}/apps/apps/api/cart-points
        </pre>
        <p style={{ margin: "12px 0 0", color: "#6d7175", fontSize: "13px", lineHeight: 1.7 }}>
          Point MAN points ブロックが、このApp Proxy URLを読み込みます。
          ShopifyがApp Proxy経由で署名付きパラメータを付与し、アプリ側で検証します。
        </p>
      </section>

      <section style={{ display: "grid", gap: "12px" }}>
        {setupSteps.map((step) => (
          <article
            key={step.title}
            style={{
              background: "#ffffff",
              border: "1px solid #dfe3e8",
              borderRadius: "14px",
              padding: "18px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "#202223", fontSize: "16px" }}>
              {step.title}
            </h2>
            <p style={{ margin: 0, color: "#5c5f62", fontSize: "14px", lineHeight: 1.7 }}>
              {step.body}
            </p>
          </article>
        ))}
      </section>

      <section
        style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <h2 style={{ margin: "0 0 8px", color: "#075985", fontSize: "17px" }}>
          審査・テスト時の確認項目
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", color: "#075985", fontSize: "14px", lineHeight: 1.8 }}>
          <li>テーマエディタで Point MAN points ブロックを追加できること</li>
          <li>カート画面で cart-points が 200 になること</li>
          <li>ポイントMANパネルが表示されること</li>
          <li>ポイント利用後に割引コードが発行され、チェックアウトへ遷移すること</li>
          <li>注文完了後、管理画面の顧客ポイントとポイント履歴が更新されること</li>
        </ul>
      </section>
    </main>
  );
}
