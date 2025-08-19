import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return new Response(
    JSON.stringify({
      ok: true,
      slug: params.slug,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
