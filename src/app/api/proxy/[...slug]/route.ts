// src/app/api/proxy/[...slug]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
) {
  const { params } = context;
  const slug = params.slug || [];

  return NextResponse.json({
    ok: true,
    slug,
  });
}
