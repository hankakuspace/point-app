// src/app/admin/AdminNav.tsx
"use client";

import { usePathname } from "next/navigation";

const adminNavItems = [
  {
    url: "/admin/customers",
    label: "顧客管理",
    match: "/admin/customers",
  },
  {
    url: "/admin/logs",
    label: "ポイント履歴",
    match: "/admin/logs",
  },
  {
    url: "/admin/settings",
    label: "ポイント付与設定",
    match: "/admin/settings",
  },
  {
    url: "/admin/redemptions",
    label: "ポイント利用コード",
    match: "/admin/redemptions",
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e1e3e5",
        padding: "12px 20px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "6px",
            background: "#fff4ce",
            color: "#8a6116",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          P
        </span>

        <span
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#202223",
          }}
        >
          ポイントMAN
        </span>
      </div>

      <nav
        aria-label="ポイントMAN 管理メニュー"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {adminNavItems.map((item) => {
          const selected = pathname.startsWith(item.match);

          return (
            <a
              key={item.url}
              href={item.url}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "36px",
                padding: "0 14px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottom: selected
                  ? "3px solid #303030"
                  : "3px solid transparent",
                background: selected ? "#f6f6f7" : "transparent",
                color: selected ? "#202223" : "#5c5f62",
                fontSize: "14px",
                fontWeight: selected ? 700 : 500,
                textDecoration: "none",
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
