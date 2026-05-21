// src/app/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/firebase";

type HomePageProps = {
  searchParams?: Promise<{
    shop?: string;
    logged_in_customer_id?: string;
    path_prefix?: string;
    timestamp?: string;
    signature?: string;
    embedded?: string;
    host?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;

  const loggedInCustomerId = params?.logged_in_customer_id;
  const shop = params?.shop;

  if (!loggedInCustomerId) {
    redirect("/admin/customers");
  }

  const customerRef = db
    .collection("customers")
    .doc(loggedInCustomerId);

  const customerSnap = await customerRef.get();

  const customer = customerSnap.exists
    ? customerSnap.data()
    : null;

  const points =
    typeof customer?.points === "number"
      ? customer.points
      : 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f6f7",
        padding: "40px 16px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
        <div
          style={{
            marginBottom: "24px",
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
              margin: 0,
              fontSize: "24px",
              lineHeight: 1.4,
              color: "#202223",
            }}
          >
            保有ポイント
          </h1>
        </div>

        <div
          style={{
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            borderRadius: "14px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "14px",
              color: "#166534",
              fontWeight: 600,
            }}
          >
            現在のポイント残高
          </p>

          <p
            style={{
              margin: 0,
              fontSize: "36px",
              lineHeight: 1.2,
              color: "#14532d",
              fontWeight: 700,
            }}
          >
            {points.toLocaleString()} pt
          </p>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: "10px 16px",
            margin: 0,
            fontSize: "14px",
            color: "#202223",
          }}
        >
          <dt style={{ color: "#6d7175" }}>顧客ID</dt>
          <dd style={{ margin: 0 }}>{loggedInCustomerId}</dd>

          <dt style={{ color: "#6d7175" }}>ストア</dt>
          <dd style={{ margin: 0 }}>{shop || "-"}</dd>

          <dt style={{ color: "#6d7175" }}>登録状態</dt>
          <dd style={{ margin: 0 }}>
            {customerSnap.exists
              ? "ポイントMAN登録済み"
              : "ポイントMAN未登録"}
          </dd>
        </dl>

        {!customerSnap.exists && (
          <p
            style={{
              margin: "24px 0 0",
              padding: "12px 14px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "10px",
              color: "#9a3412",
              fontSize: "14px",
            }}
          >
            この顧客IDのポイント情報はまだ作成されていません。
          </p>
        )}
      </section>
    </main>
  );
}
