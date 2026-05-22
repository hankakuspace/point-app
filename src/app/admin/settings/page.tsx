// src/app/admin/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Checkbox,
  Button,
  Banner,
  Spinner,
  Toast,
  Text,
} from "@shopify/polaris";

interface Settings {
  pointRate: number;
  includeShipping: boolean;
  excludedTags: string[];
  minUsePoints: number;
  maxUsePoints: number;
}

const defaultSettings: Settings = {
  pointRate: 0.03,
  includeShipping: false,
  excludedTags: [],
  minUsePoints: 100,
  maxUsePoints: 1000,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pointRatePercent, setPointRatePercent] = useState("3");
  const [excludedTagsText, setExcludedTagsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/admin/settings", {
          cache: "no-store",
        });

        const data = await res.json();

        const loadedSettings: Settings = {
          pointRate:
            typeof data.pointRate === "number"
              ? data.pointRate
              : defaultSettings.pointRate,
          includeShipping: Boolean(data.includeShipping),
          excludedTags: Array.isArray(data.excludedTags)
            ? data.excludedTags
            : [],
          minUsePoints:
            typeof data.minUsePoints === "number"
              ? data.minUsePoints
              : defaultSettings.minUsePoints,
          maxUsePoints:
            typeof data.maxUsePoints === "number"
              ? data.maxUsePoints
              : defaultSettings.maxUsePoints,
        };

        setSettings(loadedSettings);
        setPointRatePercent(
          String(Math.round(loadedSettings.pointRate * 10000) / 100)
        );
        setExcludedTagsText(loadedSettings.excludedTags.join(", "));
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async () => {
    const ratePercent = Number(pointRatePercent);
    const minUsePoints = Number(settings.minUsePoints);
    const maxUsePoints = Number(settings.maxUsePoints);

    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      alert("付与率を正しく入力してください");
      return;
    }

    if (!Number.isFinite(minUsePoints) || minUsePoints < 0) {
      alert("最低利用ポイントを正しく入力してください");
      return;
    }

    if (!Number.isFinite(maxUsePoints) || maxUsePoints < 0) {
      alert("最大利用ポイントを正しく入力してください");
      return;
    }

    setSaving(true);

    try {
      const payload: Settings = {
        ...settings,
        pointRate: ratePercent / 100,
        excludedTags: excludedTagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        minUsePoints,
        maxUsePoints,
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("設定の保存に失敗しました");
        return;
      }

      setSettings(payload);
      setToastMessage("ポイント付与設定を保存しました");
      setToastActive(true);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("設定保存エラー");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spinner accessibilityLabel="Loading settings" size="large" />
      </div>
    );
  }

  return (
    <Page
      title="ポイント付与設定"
      subtitle="購入時のポイント付与率や利用条件を設定します"
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
            <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
              <Banner tone="info">
                付与率は「%」で入力してください。例：5 と入力すると、購入金額の5%をポイント付与します。
              </Banner>

              <TextField
                label="ポイント付与率（%）"
                type="number"
                step={0.01}
                value={pointRatePercent}
                onChange={(value) => setPointRatePercent(value)}
                autoComplete="off"
                suffix="%"
                helpText="小数も入力できます。例：3.5"
              />

              <Checkbox
                label="送料を含めてポイント計算する"
                checked={settings.includeShipping}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    includeShipping: checked,
                  })
                }
              />

              <TextField
                label="対象外商品タグ"
                value={excludedTagsText}
                onChange={(value) => setExcludedTagsText(value)}
                autoComplete="off"
                placeholder="no_point, sample"
                helpText="カンマ区切りで入力します。現時点では設定保存のみで、Webhook側の除外処理は未実装です。"
              />

              <TextField
                label="最低利用ポイント"
                type="number"
                value={String(settings.minUsePoints)}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    minUsePoints: Number(value),
                  })
                }
                autoComplete="off"
                suffix="pt"
              />

              <TextField
                label="最大利用ポイント"
                type="number"
                value={String(settings.maxUsePoints)}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    maxUsePoints: Number(value),
                  })
                }
                autoComplete="off"
                suffix="pt"
              />

              <div style={{ marginTop: "4px" }}>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  設定を保存
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
              <Text as="h2" variant="headingMd">
                現在の設定値
              </Text>

              <Text as="p" variant="bodyMd">
                付与率：{pointRatePercent || "0"}%
              </Text>

              <Text as="p" variant="bodyMd">
                送料計算：
                {settings.includeShipping ? "含める" : "含めない"}
              </Text>

              <Text as="p" variant="bodyMd">
                最低利用：{settings.minUsePoints} pt
              </Text>

              <Text as="p" variant="bodyMd">
                最大利用：{settings.maxUsePoints} pt
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
