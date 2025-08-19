import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const docRef = db.collection("shops").doc(shop);
  const snap = await docRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: `Shop not found: ${shop}` }, { status: 404 });
  }

  const data = snap.data();

  return NextResponse.json({
    shop,
    ...data,
  });
}
