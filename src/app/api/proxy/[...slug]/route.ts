// src/app/api/proxy/[...slug]/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message: "This proxy endpoint is disabled.",
    },
    { status: 410 }
  );
}
