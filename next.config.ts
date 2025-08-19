import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { slug: string[] } }
) {
  const { slug } = context.params;

  return NextResponse.json({
    message: "Proxy route working",
    slug,
  });
}
