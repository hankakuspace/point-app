import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
) {
  // context から slug を取得
  const slug = context.params.slug;

  return NextResponse.json({
    ok: true,
    slug,
  });
}
