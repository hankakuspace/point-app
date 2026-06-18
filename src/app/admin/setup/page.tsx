// src/app/admin/setup/page.tsx
export const dynamic = "force-dynamic";

const setupSteps = [
  {
    title: "1. テーマエディタを開く",
    body: "Shopify管理画面の「オンラインストア」→「テーマ」→「カスタマイズ」を開きます。",
  },
  {
    title: "2. カートページを選択する",
    body: "テーマエディタ上部のページ選択から、カートページを開きます。",
  },
  {
    title: "3. Point MAN points ブロックを追加する",
    body: "カートページ内で「ブロックを追加」→「アプリ」→「Point MAN points」を選択し、カートに追加します。",
  },
  {
    title: "4. テーマを保存する",
    body: "Point MAN points ブロックを追加したら、テーマエディタ右上の保存ボタンで反映します。テーマコードを直接編集する必要はありません。",
  },
  {
    title: "5. カート画面で表示確認する",
    body: "ログイン済み顧客でカートを開き、使えるポイント、利用ポイント入力欄、ポイントを使うボタンが表示されることを確認します。",
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
          ポイントMANは、Theme App Extension の Point MAN points ブロックを利用して、
          カート画面にポイント表示・ポイント利用フォームを表示します。
          テーマエディタでブロックを追加して保存するだけで利用できます。
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
          テーマエディタを開いた後、カートページを選択し、Point MAN points ブロックを追加してください。
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
          確認項目
        </h2>

        <ul style={{ margin: 0, paddingLeft: "20px", color: "#075985", fontSize: "14px", lineHeight: 1.8 }}>
          <li>カートページに Point MAN points ブロックを追加して保存できること</li>
          <li>ログイン済み顧客のカート画面にポイントMANパネルが表示されること</li>
          <li>使えるポイント、利用ポイント入力欄、ポイントを使うボタンが表示されること</li>
          <li>ポイント利用後に割引コードが発行され、チェックアウトへ遷移すること</li>
          <li>注文完了後、管理画面の顧客ポイントとポイント履歴が更新されること</li>
        </ul>
      </section>
    </main>
  );
}
