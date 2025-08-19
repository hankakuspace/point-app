import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
) {
  const { slug } = context.params;

  return NextResponse.json({
    ok: true,
    slug,
  });
}
