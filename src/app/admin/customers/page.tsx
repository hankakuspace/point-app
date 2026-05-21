// src/app/admin/customers/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Page,
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<BulkOperation>("add");
  const [bulkPoints, setBulkPoints] = useState<string>("100");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [shopDomain, setShopDomain] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(customers);

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
      subtitle={`登録顧客数: ${customers.length}件`}
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

      <Card>
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <Text as="p" variant="bodyMd" fontWeight="medium">
              Shopify顧客同期
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Shopifyの顧客一覧をポイントMANへ取り込みます。既存ポイントは上書きしません。
            </Text>
          </div>

          <Button
            onClick={handleSyncShopifyCustomers}
            loading={syncLoading}
          >
            Shopify顧客同期
          </Button>
        </div>
      </Card>

      <div style={{ height: "12px" }} />

      {selectedResources.length > 0 && (
        <>
          <Card>
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <Text as="p" variant="bodyMd" fontWeight="medium">
                選択中：{selectedResources.length}名
              </Text>

              <Button
                variant="primary"
                onClick={() => setBulkModalOpen(true)}
              >
                選択顧客にポイント操作
              </Button>
            </div>
          </Card>

          <div style={{ height: "12px" }} />
        </>
      )}

      <Card>
        <IndexTable
          resourceName={{
            singular: "customer",
            plural: "customers",
          }}
          itemCount={customers.length}
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
            { title: "登録日" },
          ]}
        >
          {customers.map((customer, index) => (
            <IndexTable.Row
              id={customer.id}
              key={customer.id}
              selected={selectedResources.includes(customer.id)}
              position={index}
            >
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="medium">
                  {customer.id}
                </Text>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.name || "-"}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.email || "-"}
              </IndexTable.Cell>

              <IndexTable.Cell>
                <Badge tone="success">
                  {customer.points || 0} pt
                </Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {customer.latestPointLog ? (
                  <div style={{ display: "grid", gap: "4px" }}>
                    <Badge
                      tone={
                        customer.latestPointLog.type === "use"
                          ? "critical"
                          : "success"
                      }
                    >
                      {customer.latestPointLog.type === "use" ? "-" : "+"}
                      {customer.latestPointLog.points || 0} pt
                    </Badge>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {formatPointLogReason(customer.latestPointLog.reason)}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {formatDate(customer.latestPointLog.timestamp)}
                    </Text>
                  </div>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {formatDate(customer.createdAt)}
              </IndexTable.Cell>

            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
