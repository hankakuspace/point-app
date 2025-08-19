import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const { slug } = params;

    return NextResponse.json({
      ok: true,
      message: "Proxy route working",
      slug,
    });
  } catch (error) {
    console.error("Proxy route error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
