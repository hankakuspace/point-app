import { NextRequest, NextResponse } from "next/server";
import type { RouteContext } from "next"; // ← 追加

export async function GET(
  req: NextRequest,
  context: RouteContext<{ slug: string[] }>
) {
  const { params } = context;
  return NextResponse.json({ ok: true, slug: params.slug });
}
