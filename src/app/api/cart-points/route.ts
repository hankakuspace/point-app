// src/app/api/cart-points/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

function renderHtml(html: string) {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

function renderLoginHtml() {
  return renderHtml(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202223; }
    .box { border: 1px solid #dfe3e8; border-radius: 12px; padding: 14px; background: #fff; }
    .label { margin: 0 0 6px; font-size: 13px; color: #6d7175; }
    .title { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
    .text { margin: 0; font-size: 13px; color: #6d7175; line-height: 1.6; }
    .button { display: inline-flex; justify-content: center; width: 100%; box-sizing: border-box; margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #008060; color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <p class="label">ポイントMAN</p>
    <p class="title">ポイントを利用するにはログインが必要です</p>
    <p class="text">ログイン後、保有ポイントを確認してカートで利用できます。</p>
    <a class="button" href="/account" target="_top">ログインする</a>
  </div>
</body>
</html>`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop") || "";
  const customerId = url.searchParams.get("logged_in_customer_id") || "";

  if (!customerId) {
    return renderLoginHtml();
  }

  const [customerSnap, settingsSnap] = await Promise.all([
    db.collection("customers").doc(customerId).get(),
    db.collection("settings").doc("default").get(),
  ]);

  if (!customerSnap.exists) {
    return renderHtml(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202223; }
    .box { border: 1px solid #dfe3e8; border-radius: 12px; padding: 14px; background: #fff; }
    .label { margin: 0 0 6px; font-size: 13px; color: #6d7175; }
    .title { margin: 0; font-size: 15px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="box">
    <p class="label">ポイントMAN</p>
    <p class="title">ポイント情報がまだ作成されていません。</p>
  </div>
</body>
</html>`);
  }

  const customer = customerSnap.data() || {};
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

  const points =
    typeof customer.points === "number" && Number.isFinite(customer.points)
      ? customer.points
      : 0;

  const email = typeof customer.email === "string" ? customer.email : "";

  const minUsePoints =
    typeof settings.minUsePoints === "number" && Number.isFinite(settings.minUsePoints)
      ? settings.minUsePoints
      : 100;

  const maxUsePoints =
    typeof settings.maxUsePoints === "number" && Number.isFinite(settings.maxUsePoints)
      ? settings.maxUsePoints
      : 1000;

  const maxAvailable = Math.min(maxUsePoints, points);
  const canUse = points >= minUsePoints;
  const rangeText = canUse
    ? `${minUsePoints.toLocaleString()} pt 〜 ${maxAvailable.toLocaleString()} pt まで利用できます。`
    : `ポイントは${minUsePoints.toLocaleString()} ptから利用できます。`;

  return renderHtml(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202223; }
    .box { border: 1px solid #dfe3e8; border-radius: 12px; padding: 14px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .label { margin: 0 0 4px; font-size: 13px; color: #6d7175; }
    .points { margin: 0; font-size: 18px; font-weight: 700; }
    .pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #ecfdf3; color: #166534; font-size: 12px; font-weight: 700; white-space: nowrap; }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #c9cccf; border-radius: 8px; padding: 9px 10px; font-size: 14px; }
    .range { margin: 0 0 12px; font-size: 12px; color: #6d7175; }
    button { width: 100%; border: none; border-radius: 8px; padding: 10px 12px; background: ${canUse ? "#008060" : "#c9cccf"}; color: #fff; font-size: 14px; font-weight: 700; cursor: ${canUse ? "pointer" : "not-allowed"}; }
  </style>
</head>
<body>
  <div class="box">
    <div class="head">
      <div>
        <p class="label">ポイントMAN</p>
        <p class="points">${points.toLocaleString()} pt</p>
      </div>
      <span class="pill">${canUse ? "利用可能" : "利用不可"}</span>
    </div>

    <form method="post" action="/apps/apps/api/use-point-form" target="_top">
      <input type="hidden" name="customerId" value="${customerId}" />
      <input type="hidden" name="email" value="${email}" />
      <input type="hidden" name="returnMode" value="cart" />

      <label>
        利用ポイント数
        <input
          name="usePoints"
          type="number"
          min="${minUsePoints}"
          max="${maxAvailable}"
          value="${minUsePoints}"
          ${canUse ? "" : "disabled"}
        />
      </label>

      <p class="range">${rangeText}</p>

      <button type="submit" ${canUse ? "" : "disabled"}>ポイントを使う</button>
    </form>
  </div>
</body>
</html>`);
}
