// src/app/admin/csv-bulk-points/page.tsx
"use client";

import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Button,
  Toast,
  Banner,
} from "@shopify/polaris";

type FailedRow = {
  lineNumber?: number;
  customerId?: string;
  email?: string;
  reason?: string;
};

type CsvBulkAddResult = {
  successCount: number;
  failedRows: FailedRow[];
};

export default function CsvBulkPointsPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvReason, setCsvReason] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [result, setResult] = useState<CsvBulkAddResult | null>(null);

  const getShopFromCurrentContext = () => {
    const params = new URLSearchParams(window.location.search);
    const urlShop = params.get("shop") || "";

    if (urlShop) {
      sessionStorage.setItem("pointman-shop", urlShop);
      return urlShop;
    }

    const storedShop = sessionStorage.getItem("pointman-shop") || "";

    if (storedShop) {
      return storedShop;
    }

    try {
      const referrerUrl = new URL(document.referrer);
      const match = referrerUrl.pathname.match(/\/store\/([^\/]+)/);

      if (match?.[1]) {
        const inferredShop = `${match[1]}.myshopify.com`;
        sessionStorage.setItem("pointman-shop", inferredShop);
        return inferredShop;
      }
    } catch (error) {
      console.error("Failed to infer shop from referrer:", error);
    }

    return "";
  };

  const getShopifySessionHeaders = async (
    baseHeaders: HeadersInit = {}
  ) => {
    const headers = new Headers(baseHeaders);
    const shopifyWindow = window as typeof window & {
      shopify?: {
        idToken?: () => Promise<string>;
      };
    };

    for (let i = 0; i < 20; i += 1) {
      if (typeof shopifyWindow.shopify?.idToken === "function") {
        const token = await shopifyWindow.shopify.idToken();

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return headers;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }

    return headers;
  };

  const handleCsvBulkAdd = async () => {
    if (!csvFile) {
      alert("CSVファイルを選択してください");
      return;
    }

    const shop = getShopFromCurrentContext();

    if (!shop) {
      alert("shop が取得できませんでした。アプリをShopify管理画面から開き直してください。");
      return;
    }

    const formData = new FormData();
    formData.append("csv", csvFile);
    formData.append("reason", csvReason || "csv_import");

    setCsvLoading(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/points/csv-bulk-add?shop=${encodeURIComponent(shop)}`,
        {
          method: "POST",
          headers: await getShopifySessionHeaders(),
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMessage = Array.isArray(data.errors)
          ? data.errors.join("\n")
          : data.error || "不明なエラー";

        alert(`CSV一括付与に失敗しました:\n${errorMessage}`);
        return;
      }

      const failedRows = Array.isArray(data.failedRows)
        ? data.failedRows
        : [];

      setResult({
        successCount: Number(data.successCount || 0),
        failedRows,
      });

      const failedMessage =
        failedRows.length > 0 ? ` / 失敗: ${failedRows.length}件` : "";

      setToastMessage(
        `CSV一括付与が完了しました（成功: ${data.successCount}件${failedMessage}）`
      );
      setToastActive(true);

      if (failedRows.length > 0) {
        console.warn("CSV bulk add failed rows:", failedRows);
      }
    } catch (error) {
      console.error(error);
      alert("CSV一括付与エラー");
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <Page
      title="CSV一括付与"
      subtitle="customerId または email と points を含むCSVで、既存顧客へポイントを一括付与します。"
      fullWidth
    >
      {toastActive && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastActive(false)}
        />
      )}

      <Layout>
        <Layout.Section>
          <Card>
            <div
              style={{
                padding: "16px",
                display: "grid",
                gap: "16px",
              }}
            >
              <Banner tone="warning">
                CSV一括付与は、既存顧客に対してポイントを加算します。
                実行後の取り消しはできません。実行前にCSV内容を必ず確認してください。
              </Banner>

              <div>
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  CSV一括ポイント付与
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  CSV内に reason がある場合は、CSVの内容が優先されます。
                  reason が空の場合のみ、画面の付与理由を使用します。
                </Text>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.7fr) auto",
                  gap: "12px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#202223",
                    }}
                  >
                    CSVファイル
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] || null;
                      setCsvFile(file);
                    }}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    形式: customerId,email,points,reason
                  </Text>
                </div>

                <TextField
                  label="付与理由（CSVに reason がない場合）"
                  value={csvReason}
                  onChange={(value) => setCsvReason(value)}
                  autoComplete="off"
                  placeholder="例：キャンペーン付与"
                  helpText="CSV内に reason がある場合は、CSVの内容が優先されます。"
                />

                <Button
                  variant="primary"
                  onClick={handleCsvBulkAdd}
                  loading={csvLoading}
                  disabled={!csvFile}
                >
                  CSV一括付与
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {result && (
          <Layout.Section>
            <Card>
              <div
                style={{
                  padding: "16px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  実行結果
                </Text>

                <Text as="p" variant="bodySm">
                  成功: {result.successCount}件 / 失敗: {result.failedRows.length}件
                </Text>

                {result.failedRows.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    {result.failedRows.slice(0, 20).map((row, index) => (
                      <div
                        key={`${row.lineNumber || index}-${row.customerId || row.email || index}`}
                        style={{
                          padding: "10px 12px",
                          border: "1px solid #dfe3e8",
                          borderRadius: "8px",
                          background: "#f6f6f7",
                        }}
                      >
                        <Text as="p" variant="bodySm">
                          行: {row.lineNumber || "-"} / 顧客ID: {row.customerId || "-"} / メール: {row.email || "-"}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          理由: {row.reason || "-"}
                        </Text>
                      </div>
                    ))}

                    {result.failedRows.length > 20 && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        失敗行が20件を超えています。詳細はブラウザのコンソールを確認してください。
                      </Text>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
