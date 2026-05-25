// src/app/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/firebase";
import { getPointSettings } from "@/lib/point-settings";

type HomePageProps = {
  searchParams?: Promise<{
    shop?: string;
    logged_in_customer_id?: string;
    path_prefix?: string;
    timestamp?: string;
    signature?: string;
    embedded?: string;
    host?: string;
    mode?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;

  const loggedInCustomerId = params?.logged_in_customer_id;
  const shop = params?.shop;
  const host = params?.host;
  const mode = params?.mode;

  if (!loggedInCustomerId && mode === "cart") {
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
            ポイントを利用するにはログインが必要です
          </p>

          <p
            style={{
              margin: "0 0 12px",
              fontSize: "13px",
              color: "#6d7175",
              lineHeight: 1.6,
            }}
          >
            ログイン後、保有ポイントを確認してカートで利用できます。
          </p>

          <a
            href="/account"
            target="_top"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "8px",
              padding: "10px 12px",
              background: "#008060",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ログインする
          </a>
        </section>
      </main>
    );
  }

  if (!loggedInCustomerId) {
    const redirectParams = new URLSearchParams();

    if (shop) {
      redirectParams.set("shop", shop);
    }

    if (host) {
      redirectParams.set("host", host);
    }

    const redirectQuery = redirectParams.toString();

    redirect(
      redirectQuery
        ? `/admin/customers?${redirectQuery}`
        : "/admin/customers"
    );
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

  const settings = await getPointSettings(db, shop);

  const minUsePoints =
    typeof settings?.minUsePoints === "number"
      ? settings.minUsePoints
      : 100;

  const maxUsePoints =
    typeof settings?.maxUsePoints === "number"
      ? settings.maxUsePoints
      : 1000;

  const email =
    typeof customer?.email === "string"
      ? customer.email
      : "";

  const usePointFormAction = shop
    ? `/apps/apps/api/use-point-form?shop=${encodeURIComponent(shop)}`
    : "/apps/apps/api/use-point-form";

  if (mode === "cart") {
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "13px",
                  color: "#6d7175",
                }}
              >
                ポイントMAN
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                {points.toLocaleString()} pt
              </p>
            </div>

            <span
              style={{
                display: "inline-flex",
                padding: "4px 10px",
                borderRadius: "999px",
                background: "#ecfdf3",
                color: "#166534",
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              利用可能
            </span>
          </div>

          {customerSnap.exists ? (
            <form method="post" action={usePointFormAction} target="_top">
              <input type="hidden" name="customerId" value={loggedInCustomerId} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="returnMode" value="cart" />

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                利用ポイント数
                <input
                  name="usePoints"
                  type="number"
                  min={minUsePoints}
                  max={Math.min(maxUsePoints, points)}
                  defaultValue={minUsePoints}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #c9cccf",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    fontSize: "14px",
                  }}
                />
              </label>

              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  color: "#6d7175",
                }}
              >
                {minUsePoints.toLocaleString()} pt 〜{" "}
                {Math.min(maxUsePoints, points).toLocaleString()} pt まで利用できます。
              </p>

              <button
                type="submit"
                disabled={points < minUsePoints}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  background: points < minUsePoints ? "#c9cccf" : "#008060",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: points < minUsePoints ? "not-allowed" : "pointer",
                }}
              >
                ポイントを使う
              </button>
            </form>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#9a3412",
              }}
            >
              ポイント情報がまだ作成されていません。
            </p>
          )}
        </section>
      </main>
    );
  }

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

        {customerSnap.exists && (
          <section
            style={{
              marginTop: "24px",
              borderTop: "1px solid #dfe3e8",
              paddingTop: "24px",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "18px",
                color: "#202223",
              }}
            >
              ポイントを利用する
            </h2>

            <p
              style={{
                margin: "0 0 16px",
                fontSize: "14px",
                color: "#6d7175",
                lineHeight: 1.7,
              }}
            >
              1ポイント = 1円として利用できます。発行された割引コードをチェックアウト画面で入力してください。
            </p>

            <form method="post" action={usePointFormAction} target="_top">
              <input type="hidden" name="customerId" value={loggedInCustomerId} />
              <input type="hidden" name="email" value={email} />

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  fontSize: "14px",
                  color: "#202223",
                  fontWeight: 600,
                }}
              >
                利用ポイント数
                <input
                  name="usePoints"
                  type="number"
                  min={minUsePoints}
                  max={Math.min(maxUsePoints, points)}
                  defaultValue={minUsePoints}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #c9cccf",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "16px",
                  }}
                />
              </label>

              <p
                style={{
                  margin: "12px 0 16px",
                  fontSize: "13px",
                  color: "#6d7175",
                }}
              >
                利用可能範囲：{minUsePoints.toLocaleString()} pt 〜{" "}
                {Math.min(maxUsePoints, points).toLocaleString()} pt
              </p>

              <button
                type="submit"
                disabled={points < minUsePoints}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  background: points < minUsePoints ? "#c9cccf" : "#008060",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: points < minUsePoints ? "not-allowed" : "pointer",
                }}
              >
                割引コードを発行する
              </button>
            </form>
          </section>
        )}

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
