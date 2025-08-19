// src/app/api/proxy/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

// Next.js App Router 正しいハンドラ定義
export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
): Promise<NextResponse> {
  const { params } = context;

  return NextResponse.json({
    ok: true,
    slug: params.slug,
  });
}
