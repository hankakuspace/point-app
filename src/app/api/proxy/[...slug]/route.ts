import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const { searchParams } = new URL(req.url);
  const echo = searchParams.get("echo") || "no-echo";

  return NextResponse.json({
    ok: true,
    slug: params.slug,
    echo,
  });
}
