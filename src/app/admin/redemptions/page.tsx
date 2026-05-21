// src/app/admin/redemptions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Spinner,
  Select,
  Button,
} from "@shopify/polaris";

type RedemptionStatus = "all" | "issued" | "used" | "expired";

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
  const [expireLoading, setExpireLoading] = useState(false);

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
    if (statusFilter === "all") {
      return redemptions;
    }

    return redemptions.filter(
      (redemption) => redemption.status === statusFilter
    );
  }, [redemptions, statusFilter]);

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
    >
      <Card>
        <div
          style={{
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "220px auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <Select
            label="状態"
            options={[
              { label: "すべて", value: "all" },
              { label: "未使用", value: "issued" },
              { label: "使用済み", value: "used" },
              { label: "期限切れ", value: "expired" },
            ]}
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as RedemptionStatus)
            }
          />

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <Button onClick={fetchRedemptions}>再読み込み</Button>

            <Button
              onClick={handleExpireIssuedCodes}
              loading={expireLoading}
            >
              未使用コードを期限切れにする
            </Button>
          </div>
        </div>
      </Card>

      <div style={{ height: "12px" }} />

      <Card>
        <IndexTable
          resourceName={{
            singular: "redemption",
            plural: "redemptions",
          }}
          itemCount={filteredRedemptions.length}
          selectable={false}
          headings={[
            { title: "コード" },
            { title: "状態" },
            { title: "顧客ID" },
            { title: "ポイント" },
            { title: "注文ID" },
            { title: "Shopify無効化" },
            { title: "発行日時" },
            { title: "最終状態日時" },
          ]}
        >
          {filteredRedemptions.map((redemption, index) => (
            <IndexTable.Row
              id={redemption.id}
              key={redemption.id}
              position={index}
            >
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="medium">
                  {redemption.discountCode || redemption.id}
                </Text>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {getStatusBadge(redemption.status)}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.customerId || "-"}
              </IndexTable.Cell>

              <IndexTable.Cell>
                <Badge tone="info">
                  {redemption.points || 0} pt
                </Badge>
              </IndexTable.Cell>

              <IndexTable.Cell>
                {redemption.orderId || "-"}
              </IndexTable.Cell>

              <IndexTable.Cell>
                {getShopifyDeactivatedBadge(redemption)}
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
      </Card>
    </Page>
  );
}
