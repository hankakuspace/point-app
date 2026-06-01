// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

function getShopFromHeaders(headersList: { get(name: string): string | null }) {
  const nextUrl = headersList.get("x-url") || "";
  const invokePath = headersList.get("x-invoke-path") || "";
  const matchedPath = headersList.get("x-matched-path") || "";

  const candidates = [nextUrl, invokePath, matchedPath].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const url = candidate.startsWith("http")
        ? new URL(candidate)
        : new URL(candidate, "https://point-app-gamma.vercel.app");

      const shop = url.searchParams.get("shop") || "";

      if (shop) {
        return shop;
      }
    } catch (error) {}
  }

  return "";
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const shop = getShopFromHeaders(headersList);

  if (shop) {
    const shopSnap = await db.collection("shops").doc(shop).get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const accessToken =
      typeof shopData?.accessToken === "string" ? shopData.accessToken : "";

    if (!accessToken) {
      redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
    }
  }

  return <AdminShell>{children}</AdminShell>;
}
