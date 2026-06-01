// src/app/api/webhooks/register/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        "Webhook registration is handled during Shopify OAuth callback. This legacy manual endpoint is disabled.",
    },
    { status: 410 }
  );
}
