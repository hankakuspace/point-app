import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
) {
  const { searchParams } = new URL(req.url);
  const echo = searchParams.get("echo") || "no-echo";

  return NextResponse.json({
    ok: true,
    slug: context.params.slug,
    echo,
  });
}
