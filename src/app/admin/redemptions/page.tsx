// src/app/admin/redemptions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Spinner,
  Select,
  Button,
  TextField,
  Pagination,
  Tooltip,
} from "@shopify/polaris";

type RedemptionStatus =
  | "all"
  | "issued"
  | "used"
  | "expired"
  | "shopify_pending"
  | "expire_error";

interface PointRedemption {
  id: string;
  customerId?: string;
  email?: string;
  discountCode?: string;
  points?: number;
  status?: "issued" | "used" | "expired";
  orderId?: string | null;
  createdAt?: string | null;
  usedAt?: string | null;
  expiredAt?: string | null;
  shopifyDeactivated?: boolean | null;
  expireError?: string | null;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  } catch {
    return "-";
  }
}

function getStatusBadge(status?: string) {
  if (status === "used") {
    return <Badge tone="success">使用済み</Badge>;
  }

  if (status === "expired") {
    return <Badge tone="critical">期限切れ</Badge>;
  }

  return <Badge tone="attention">未使用</Badge>;
}

function getShopifyDeactivatedBadge(redemption: PointRedemption) {
  if (redemption.status !== "expired") {
    return "-";
  }

  if (redemption.shopifyDeactivated === true) {
    return <Badge tone="success">無効化済み</Badge>;
  }

  if (redemption.shopifyDeactivated === false) {
    return <Badge tone="critical">未完了</Badge>;
  }

  return <Badge tone="attention">未確認</Badge>;
}

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState<PointRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RedemptionStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expireLoading, setExpireLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState("20");

  const fetchRedemptions = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/redemptions", {
        cache: "no-store",
      });

      const data = await res.json();

      setRedemptions(data.redemptions || []);
    } catch (error) {
      console.error("Failed to fetch redemptions:", error);
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

  const handleExpireIssuedCodes = async () => {
    if (!confirm("30分以上前に発行された未使用コードを期限切れにしますか？")) {
      return;
    }

    setExpireLoading(true);

    try {
      const res = await fetch("/api/admin/redemptions/expire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("未使用コードの期限切れ処理に失敗しました");
        return;
      }

      alert(`${data.expiredCount || 0}件の未使用コードを期限切れにしました`);

      setPage(0);
      await fetchRedemptions();
    } catch (error) {
      console.error("Failed to expire redemptions:", error);
      alert("未使用コードの期限切れ処理でエラーが発生しました");
    } finally {
      setExpireLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const filteredRedemptions = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return redemptions.filter((redemption) => {
      const matchesStatus =
        statusFilter === "all" ||
        redemption.status === statusFilter ||
        (statusFilter === "shopify_pending" &&
          redemption.status === "expired" &&
          redemption.shopifyDeactivated === false) ||
        (statusFilter === "expire_error" && Boolean(redemption.expireError));

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearchText) {
        return true;
      }

      const searchableValues = [
        redemption.id,
        redemption.discountCode,
        redemption.customerId,
        redemption.email,
        redemption.orderId,
      ];

      return searchableValues.some((value) =>
        String(value || "").toLowerCase().includes(normalizedSearchText)
      );
    });
  }, [redemptions, statusFilter, searchText]);

  const pageSizeNumber = Number(pageSize);
  const visibleRedemptions = filteredRedemptions.slice(
    page * pageSizeNumber,
    (page + 1) * pageSizeNumber
  );
  const pageStart =
    filteredRedemptions.length === 0 ? 0 : page * pageSizeNumber + 1;
  const pageEnd =
    filteredRedemptions.length === 0
      ? 0
      : Math.min((page + 1) * pageSizeNumber, filteredRedemptions.length);

  const summaryCounts = useMemo(() => {
    return redemptions.reduce(
      (counts, redemption) => {
        counts.all += 1;

        if (redemption.status === "issued") {
          counts.issued += 1;
        }

        if (redemption.status === "used") {
          counts.used += 1;
        }

        if (redemption.status === "expired") {
          counts.expired += 1;
        }

        if (
          redemption.status === "expired" &&
          redemption.shopifyDeactivated === false
        ) {
          counts.shopifyDeactivatePending += 1;
        }

        if (redemption.expireError) {
          counts.expireError += 1;
        }

        return counts;
      },
      {
        all: 0,
        issued: 0,
        used: 0,
        expired: 0,
        shopifyDeactivatePending: 0,
        expireError: 0,
      }
    );
  }, [redemptions]);

  const exportCSV = () => {
    if (filteredRedemptions.length === 0) return;

    const header = [
      "id",
      "discountCode",
      "status",
      "customerId",
      "email",
      "points",
      "orderId",
      "shopifyDeactivated",
      "expireError",
      "createdAt",
      "usedAt",
      "expiredAt",
    ];

    const rows = filteredRedemptions.map((redemption) => [
      redemption.id,
      redemption.discountCode || "",
      redemption.status || "",
      redemption.customerId || "",
      redemption.email || "",
      redemption.points || 0,
      redemption.orderId || "",
      redemption.shopifyDeactivated === true
        ? "true"
        : redemption.shopifyDeactivated === false
          ? "false"
          : "",
      redemption.expireError || "",
      redemption.createdAt || "",
      redemption.usedAt || "",
      redemption.expiredAt || "",
    ]);

    const csvContent =
      "\uFEFF" +
      [header, ...rows]
        .map((row) =>
          row
            .map((value) => JSON.stringify(String(value ?? "")))
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "point_redemptions.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (filteredRedemptions.length === 0) return;

    const jsonContent = JSON.stringify(filteredRedemptions, null, 2);
    const blob = new Blob([jsonContent], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "point_redemptions.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spinner accessibilityLabel="Loading redemptions" size="large" />
      </div>
    );
  }

  return (
    <Page
      title="ポイント利用コード"
      subtitle={`発行コード数: ${redemptions.length}件 / 表示: ${filteredRedemptions.length}件`}
      fullWidth
      secondaryActions={[
        {
          content: "CSV",
          onAction: exportCSV,
        },
        {
          content: "JSON",
          onAction: exportJSON,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSearchText(searchInput.trim());
                setPage(0);
              }}
              style={{
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "minmax(280px, 1fr) 220px auto",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <TextField
                label="検索"
                placeholder="コード・顧客ID・注文ID・メールで検索"
                value={searchInput}
                onChange={(value) => setSearchInput(value)}
                autoComplete="off"
              />

              <Select
                label="状態"
                options={[
                  { label: "すべて", value: "all" },
                  { label: "未使用", value: "issued" },
                  { label: "使用済み", value: "used" },
                  { label: "期限切れ", value: "expired" },
                  { label: "Shopify未完了", value: "shopify_pending" },
                  { label: "エラーあり", value: "expire_error" },
                ]}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as RedemptionStatus);
                  setPage(0);
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <Button size="large" variant="primary" submit>
                  検索
                </Button>

                <Button
                  size="large"
                  onClick={() => {
                    setSearchInput("");
                    setSearchText("");
                    setPage(0);
                  }}
                >
                  リセット
                </Button>

                <Button size="large" onClick={fetchRedemptions}>
                  再読み込み
                </Button>

                <Button
                  size="large"
                  onClick={handleExpireIssuedCodes}
                  loading={expireLoading}
                >
                  未使用コードを期限切れにする
                </Button>
              </div>
            </form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div
              style={{
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: "0",
              }}
            >
              {[
                { label: "すべて", value: summaryCounts.all, filter: "all" },
                { label: "未使用", value: summaryCounts.issued, filter: "issued" },
                { label: "使用済み", value: summaryCounts.used, filter: "used" },
                { label: "期限切れ", value: summaryCounts.expired, filter: "expired" },
                {
                  label: "Shopify未完了",
                  value: summaryCounts.shopifyDeactivatePending,
                  filter: "shopify_pending",
                },
                {
                  label: "エラーあり",
                  value: summaryCounts.expireError,
                  filter: "expire_error",
                },
              ].map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setStatusFilter(item.filter as RedemptionStatus);
                    setPage(0);
                  }}
                  style={{
                    width: "100%",
                    padding: "0 20px",
                    border: "none",
                    borderLeft: index === 0 ? "none" : "1px solid #dfe3e8",
                    background:
                      statusFilter === item.filter ? "#f6f6f7" : "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <Text as="p" variant="bodySm" tone="subdued">
                    {item.label}
                  </Text>
                  <Text as="p" variant="headingLg">
                    {item.value}件
                  </Text>
                </button>
              ))}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div
              style={{
                padding: "16px 16px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Text as="p" variant="bodySm" tone="subdued">
                {pageStart}〜{pageEnd}件 / 全{filteredRedemptions.length}件
              </Text>

              <div style={{ width: "140px" }}>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "20件", value: "20" },
                    { label: "50件", value: "50" },
                    { label: "100件", value: "100" },
                  ]}
                  value={pageSize}
                  onChange={(value) => {
                    setPageSize(value);
                    setPage(0);
                  }}
                />
              </div>
            </div>

            <IndexTable
          resourceName={{
            singular: "redemption",
            plural: "redemptions",
          }}
          itemCount={visibleRedemptions.length}
          selectable={false}
          headings={[
            { title: "コード" },
            { title: "状態" },
            { title: "顧客ID" },
            { title: "ポイント" },
            { title: "注文ID" },
            { title: "Shopify無効化" },
            { title: "エラー内容" },
            { title: "発行日時" },
            { title: "最終状態日時" },
          ]}
        >
          {visibleRedemptions.map((redemption, index) => (
            <IndexTable.Row
              id={redemption.id}
              key={redemption.id}
              position={index}
            >
              <IndexTable.Cell>
                <Tooltip
                  content={
                    copiedKey === `code-${redemption.id}`
                      ? "コピーした"
                      : "コピー"
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        redemption.discountCode || redemption.id,
                        `code-${redemption.id}`
                      )
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
                      {redemption.discountCode || redemption.id}
                    </Text>
                  </button>
                </Tooltip>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {getStatusBadge(redemption.status)}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.customerId ? (
                  <Tooltip
                    content={
                      copiedKey === `customer-${redemption.id}`
                        ? "コピーした"
                        : "コピー"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          redemption.customerId,
                          `customer-${redemption.id}`
                        )
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
                      {redemption.customerId}
                    </button>
                  </Tooltip>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>

              <IndexTable.Cell>
                <Badge tone="info">
                  {redemption.points || 0} pt
                </Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.orderId ? (
                  <Tooltip
                    content={
                      copiedKey === `order-${redemption.id}`
                        ? "コピーした"
                        : "コピー"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        copyText(redemption.orderId, `order-${redemption.id}`)
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
                      {redemption.orderId}
                    </button>
                  </Tooltip>
                ) : (
                  "-"
                )}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {getShopifyDeactivatedBadge(redemption)}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.expireError || "-"}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {formatDate(redemption.createdAt)}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.status === "used"
                  ? formatDate(redemption.usedAt)
                  : redemption.status === "expired"
                    ? formatDate(redemption.expiredAt)
                    : "-"}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>

            <div
              style={{
                padding: "16px",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Pagination
                hasPrevious={page > 0}
                onPrevious={() =>
                  setPage((currentPage) => Math.max(currentPage - 1, 0))
                }
                hasNext={
                  (page + 1) * pageSizeNumber < filteredRedemptions.length
                }
                onNext={() => setPage((currentPage) => currentPage + 1)}
              />

              <Text as="p" variant="bodySm" tone="subdued">
                {pageStart}〜{pageEnd}件目 / 全{filteredRedemptions.length}件
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
