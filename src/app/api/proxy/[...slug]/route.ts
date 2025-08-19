import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: any) {
  return NextResponse.json({
    ok: true,
    slug: params.slug,
  });
}
