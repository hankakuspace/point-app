// src/app/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/firebase";

type HomePageProps = {
  searchParams?: Promise<{
    shop?: string;
    logged_in_customer_id?: string;
    host?: string;
    mode?: string;
  }>;
};

function StorefrontInfoCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main
      style={{
        background: "#ffffff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#202223",
        maxWidth: "420px",
      }}
    >
      <section
        style={{
          border: "1px solid #dfe3e8",
          borderRadius: "12px",
          padding: "16px",
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            fontSize: "13px",
            color: "#6d7175",
          }}
        >
          ポイントMAN
        </p>

        <p
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: 700,
            color: "#202223",
          }}
        >
          {title}
        </p>

        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6d7175",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
      </section>
    </main>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;

  const loggedInCustomerId = params?.logged_in_customer_id;
  const shop = params?.shop;
  const host = params?.host;
  const mode = params?.mode;

  if (mode === "cart") {
    if (!loggedInCustomerId) {
      return (
        <StorefrontInfoCard
          title="ポイントを利用するにはログインが必要です"
          message="ログイン後、保有ポイントを確認してカートで利用できます。"
        />
      );
    }

    return (
      <StorefrontInfoCard
        title="カートでポイントを確認できます"
        message="ポイント残高の表示と利用は、署名検証済みのカート用ポイントMANパネルから行ってください。"
      />
    );
  }

  if (loggedInCustomerId) {
    return (
      <StorefrontInfoCard
        title="カートでポイントを確認できます"
        message="ポイント残高の表示と利用は、署名検証済みのカート用ポイントMANパネルから行ってください。"
      />
    );
  }

  if (!shop) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f6f6f7",
          padding: "40px 16px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: "#202223",
        }}
      >
        <section
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #dfe3e8",
            borderRadius: "16px",
            padding: "28px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "13px",
              color: "#6d7175",
            }}
          >
            ポイントMAN
          </p>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "24px",
              lineHeight: 1.4,
              color: "#202223",
            }}
          >
            Shopify管理画面からアプリを開いてください
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#6d7175",
              lineHeight: 1.7,
            }}
          >
            管理画面を表示するには、Shopify管理画面のアプリ一覧からポイントMANを開いてください。
          </p>
        </section>
      </main>
    );
  }

  const shopSnap = await db.collection("shops").doc(shop).get();
  const shopData = shopSnap.exists ? shopSnap.data() : null;
  const accessToken =
    typeof shopData?.accessToken === "string" ? shopData.accessToken : "";

  if (!accessToken) {
    redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
  }

  const redirectParams = new URLSearchParams();

  redirectParams.set("shop", shop);

  if (host) {
    redirectParams.set("host", host);
  }

  redirect(`/admin/customers?${redirectParams.toString()}`);
}
