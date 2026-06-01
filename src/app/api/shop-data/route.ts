// src/app/api/shop-data/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message: "This debug endpoint is disabled.",
    },
    { status: 410 }
  );
}
