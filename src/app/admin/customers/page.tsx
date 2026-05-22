// src/app/admin/customers/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Spinner,
  Toast,
  Button,
  Modal,
  TextField,
  Select,
  Banner,
  Tooltip,
  useIndexResourceState,
} from "@shopify/polaris";

interface PointLog {
  id: string;
  customerId: string;
  type: "add" | "use";
  points: number;
  reason?: string;
  orderId?: string;
  timestamp?: any;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  points: number;
  createdAt: any;
  latestPointLog?: PointLog | null;
}

type BulkOperation = "add" | "use";

type LatestLogMeta = {
  label: string;
  dotColor: string;
};

function getLatestLogMeta(reason?: string): LatestLogMeta {
  switch (reason) {
    case "purchase":
      return {
        label: "購入",
        dotColor: "#86efac",
      };

    case "admin_add":
    case "admin_edit":
      return {
        label: "手動",
        dotColor: "#93c5fd",
      };

    case "admin_use":
    case "point_use":
      return {
        label: "利用",
        dotColor: "#f9a8d4",
      };

    case "campaign":
      return {
        label: "特典",
        dotColor: "#c4b5fd",
      };

    case "migration":
      return {
        label: "移行",
        dotColor: "#fde68a",
      };

    case "adjustment":
      return {
        label: "調整",
        dotColor: "#d1d5db",
      };

    case "expired":
      return {
        label: "失効",
        dotColor: "#d1d5db",
      };

    case "refund_cancel":
      return {
        label: "取消",
        dotColor: "#fdba74",
      };

    default:
      return {
        label: "履歴",
        dotColor: "#d1d5db",
      };
  }
}

function formatShortDate(value: any) {
  if (!value) return "-";

  try {
    const date =
      typeof value === "string"
        ? new Date(value)
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return "-";
    }

    return `${date.getMonth() + 1}/${date.getDate()} ${date
      .getHours()
      .toString()
      .padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  } catch {
    return "-";
  }
}



export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<BulkOperation>("add");
  const [bulkPoints, setBulkPoints] = useState<string>("100");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [shopDomain, setShopDomain] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return [
      customer.id,
      customer.name,
      customer.email,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(keyword)
      );
  });

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredCustomers);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");

    if (shop) {
      sessionStorage.setItem("pointman-shop", shop);
      setShopDomain(shop);
      return;
    }

    const storedShop = sessionStorage.getItem("pointman-shop");

    if (storedShop) {
      setShopDomain(storedShop);
    }
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/customers", {
        cache: "no-store",
      });

      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (value?: string | null, key?: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);

      if (key) {
        setCopiedKey(key);
        window.setTimeout(() => {
          setCopiedKey((currentKey) => currentKey === key ? null : currentKey);
        }, 1200);
      }
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const handleSyncShopifyCustomers = async () => {
    if (!shopDomain) {
      alert("shop が取得できませんでした。アプリをShopify管理画面から開き直してください。");
      return;
    }

    if (!confirm("Shopifyの顧客情報をポイントMANへ同期しますか？")) {
      return;
    }

    setSyncLoading(true);

    try {
      const res = await fetch("/api/admin/customers/sync-shopify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: shopDomain,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("Shopify顧客同期に失敗しました: " + (data.error || "不明なエラー"));
        return;
      }

      setToastMessage(
        `Shopify顧客同期が完了しました（作成: ${data.createdCount}件 / 更新: ${data.updatedCount}件）`
      );
      setToastActive(true);

      await fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("Shopify顧客同期エラー");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleBulkPointUpdate = async () => {
    const pointValue = Number(bulkPoints);

    if (selectedResources.length === 0) {
      alert("対象顧客を選択してください");
      return;
    }

    if (!bulkPoints || Number.isNaN(pointValue) || pointValue <= 0) {
      alert("ポイント数を入力してください");
      return;
    }

    const amount =
      bulkOperation === "add" ? pointValue : -pointValue;

    setBulkLoading(true);

    try {
      const results = await Promise.all(
        selectedResources.map(async (customerId) => {
          const res = await fetch(
            "/api/admin/customers/update-points",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customerId,
                amount,
                reason: bulkReason,
              }),
            }
          );

          const data = await res.json();

          return {
            customerId,
            success: data.success,
          };
        })
      );

      const failed = results.filter((result) => !result.success);

      if (failed.length > 0) {
        alert(
          `${failed.length}件のポイント更新に失敗しました`
        );
      } else {
        setToastMessage(
          bulkOperation === "add"
            ? `${selectedResources.length}名に ${pointValue} pt 付与しました`
            : `${selectedResources.length}名から ${pointValue} pt 減算しました`
        );
        setToastActive(true);
        setBulkModalOpen(false);
        setBulkPoints("100");
        setBulkReason("");
      }

      await fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("一括ポイント更新エラー");
    } finally {
      setBulkLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const formatDate = (createdAt: any) => {
    if (!createdAt) return "-";

    try {
      if (typeof createdAt === "string") {
        return new Date(createdAt).toLocaleString();
      }

      if (createdAt?.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }

      return "-";
    } catch {
      return "-";
    }
  };

  const formatPointLogReason = (reason?: string) => {
    if (reason === "purchase") return "購入付与";
    if (reason === "admin_edit") return "管理調整";
    if (reason === "campaign") return "キャンペーン";
    if (!reason) return "-";
    return reason;
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spinner accessibilityLabel="Loading customers" size="large" />
      </div>
    );
  }

  return (
    <Page
      title="顧客管理"
      subtitle={`登録顧客数: ${customers.length}件 / 表示: ${filteredCustomers.length}件`}
      fullWidth
    >
      {toastActive && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastActive(false)}
        />
      )}

      <Modal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="選択顧客へのポイント操作"
        primaryAction={{
          content:
            bulkOperation === "add"
              ? "ポイント付与を実行"
              : "ポイント減算を実行",
          onAction: handleBulkPointUpdate,
          loading: bulkLoading,
        }}
        secondaryActions={[
          {
            content: "キャンセル",
            onAction: () => setBulkModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ display: "grid", gap: "16px" }}>
            <Banner tone="info">
              {selectedResources.length}名の顧客が選択されています。
            </Banner>

            <Select
              label="操作"
              options={[
                { label: "ポイント付与", value: "add" },
                { label: "ポイント減算", value: "use" },
              ]}
              value={bulkOperation}
              onChange={(value) =>
                setBulkOperation(value as BulkOperation)
              }
            />

            <TextField
              label="ポイント数"
              type="number"
              value={bulkPoints}
              onChange={(value) => setBulkPoints(value)}
              autoComplete="off"
            />

            <TextField
              label="理由"
              value={bulkReason}
              onChange={(value) => setBulkReason(value)}
              autoComplete="off"
              placeholder="例：キャンペーン付与、調整対応など"
            />
          </div>
        </Modal.Section>
      </Modal>

      <Layout>
        <Layout.Section>
          <div
            style={{
              display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(360px, 1fr) minmax(260px, 0.7fr)",
          gap: "12px",
          alignItems: "stretch",
        }}
      >
        <Card>
          <div style={{ padding: "12px 16px" }}>
            <TextField
              label="顧客検索"
              value={searchQuery}
              onChange={(value) => setSearchQuery(value)}
              autoComplete="off"
              placeholder="ID・名前・メールで検索"
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
            />
          </div>
        </Card>

        <Card>
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              height: "100%",
            }}
          >
            <div>
              <Text as="p" variant="bodyMd" fontWeight="medium">
                Shopify顧客同期
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Shopifyの顧客一覧を取り込みます。既存ポイントは上書きしません。
              </Text>
            </div>

            <div
              style={{
                flexShrink: 0,
                minWidth: "96px",
              }}
            >
              <Button
                onClick={handleSyncShopifyCustomers}
                loading={syncLoading}
                fullWidth
              >
                同期する
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              height: "100%",
            }}
          >
            <Text as="p" variant="bodyMd" fontWeight="medium">
              選択中：{selectedResources.length}名
            </Text>

            <Button
              variant="primary"
              onClick={() => setBulkModalOpen(true)}
              disabled={selectedResources.length === 0}
            >
              選択顧客にポイント操作
            </Button>
          </div>
        </Card>
          </div>
        </Layout.Section>

        <Layout.Section>
          <Card>
        <IndexTable
          resourceName={{
            singular: "customer",
            plural: "customers",
          }}
          itemCount={filteredCustomers.length}
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: "ID" },
            { title: "名前" },
            { title: "メール" },
            { title: "ポイント" },
            { title: "最新履歴" },
          ]}
        >
          {filteredCustomers.map((customer, index) => (
            <IndexTable.Row
              id={customer.id}
              key={customer.id}
              selected={selectedResources.includes(customer.id)}
              position={index}
            >
              <IndexTable.Cell>
                <Tooltip
                  content={
                    copiedKey === `customer-id-${customer.id}`
                      ? "コピーした"
                      : "コピー"
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      copyText(customer.id, `customer-id-${customer.id}`)
                    }
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "inherit",
                      font: "inherit",
                    }}
                  >
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      {customer.id}
                    </Text>
                  </button>
                </Tooltip>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.name ? (
                  <Tooltip
                    content={
                      copiedKey === `customer-name-${customer.id}`
                        ? "コピーした"
                        : "コピー"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        copyText(customer.name, `customer-name-${customer.id}`)
                      }
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "inherit",
                        font: "inherit",
                      }}
                    >
                      {customer.name}
                    </button>
                  </Tooltip>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.email ? (
                  <Tooltip
                    content={
                      copiedKey === `customer-email-${customer.id}`
                        ? "コピーした"
                        : "コピー"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        copyText(customer.email, `customer-email-${customer.id}`)
                      }
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "inherit",
                        font: "inherit",
                      }}
                    >
                      {customer.email}
                    </button>
                  </Tooltip>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>

              <IndexTable.Cell>
                <Badge tone="success">
                  {customer.points || 0} pt
                </Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.latestPointLog ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "fit-content",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background:
                          customer.latestPointLog.type === "use"
                            ? "#fde2e1"
                            : "#d1fadf",
                        color:
                          customer.latestPointLog.type === "use"
                            ? "#8e1f0b"
                            : "#0c5132",
                        fontSize: "12px",
                        fontWeight: 600,
                        lineHeight: "18px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {customer.latestPointLog.type === "use" ? "-" : "+"}
                      {customer.latestPointLog.points || 0} pt
                    </span>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "999px",
                          background: getLatestLogMeta(
                            customer.latestPointLog.reason
                          ).dotColor,
                          flexShrink: 0,
                        }}
                      />

                      <Text as="span" variant="bodySm">
                        {getLatestLogMeta(
                          customer.latestPointLog.reason
                        ).label}
                      </Text>
                    </span>

                    <Text as="span" variant="bodySm" tone="subdued">
                      {formatShortDate(customer.latestPointLog.timestamp)}
                    </Text>
                  </div>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>


            </IndexTable.Row>
          ))}
        </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
