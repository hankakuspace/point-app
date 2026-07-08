// src/app/admin/AdminNav.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@shopify/polaris";
import {
  HomeIcon,
  NoteIcon,
  SettingsIcon,
  AppsIcon,
} from "@shopify/polaris-icons";

const adminNavItems = [
  {
    url: "/admin/customers",
    label: "顧客管理",
    match: "/admin/customers",
    icon: HomeIcon,
  },
  {
    url: "/admin/logs",
    label: "ポイント履歴",
    match: "/admin/logs",
    icon: NoteIcon,
  },
  {
    url: "/admin/csv-bulk-points",
    label: "CSV一括付与",
    match: "/admin/csv-bulk-points",
    icon: NoteIcon,
  },
  {
    url: "/admin/settings",
    label: "ポイント付与設定",
    match: "/admin/settings",
    icon: SettingsIcon,
  },
  {
    url: "/admin/redemptions",
    label: "ポイント利用コード",
    match: "/admin/redemptions",
    icon: AppsIcon,
  },
  {
    url: "/admin/setup",
    label: "セットアップ",
    match: "/admin/setup",
    icon: SettingsIcon,
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const buildNavUrl = (url: string) => {
    return queryString ? `${url}?${queryString}` : url;
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e1e3e5",
        padding: "0 20px",
      }}
    >
      <nav
        aria-label="ポイントMAN 管理メニュー"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          overflowX: "auto",
          whiteSpace: "nowrap",
          minHeight: "48px",
        }}
      >
        {adminNavItems.map((item) => {
          const selected = pathname.startsWith(item.match);

          return (
            <a
              key={item.url}
              href={buildNavUrl(item.url)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                minHeight: "48px",
                padding: "0 14px",
                borderBottom: selected
                  ? "3px solid #303030"
                  : "3px solid transparent",
                color: selected ? "#202223" : "#5c5f62",
                fontSize: "14px",
                fontWeight: selected ? 700 : 500,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: "18px",
                  height: "18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon source={item.icon} tone="base" />
              </span>
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
