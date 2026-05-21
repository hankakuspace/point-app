// src/app/api/admin/redemptions/expire/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const DEFAULT_EXPIRE_MINUTES = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const expireMinutes =
      typeof body.expireMinutes === "number" &&
      Number.isFinite(body.expireMinutes) &&
      body.expireMinutes > 0
        ? body.expireMinutes
        : DEFAULT_EXPIRE_MINUTES;

    const now = new Date();
    const threshold = new Date(
      now.getTime() - expireMinutes * 60 * 1000
    );

    const snapshot = await db
      .collection("point_redemptions")
      .where("status", "==", "issued")
      .get();

    const expiredTargets = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;

      if (!createdAt) {
        return false;
      }

      const createdDate =
        typeof createdAt === "string"
          ? new Date(createdAt)
          : createdAt?.toDate
            ? createdAt.toDate()
            : null;

      if (!createdDate || Number.isNaN(createdDate.getTime())) {
        return false;
      }

      return createdDate <= threshold;
    });

    if (expiredTargets.length === 0) {
      return NextResponse.json({
        success: true,
        expiredCount: 0,
        expireMinutes,
      });
    }

    const batch = db.batch();
    const expiredAt = now.toISOString();

    expiredTargets.forEach((doc) => {
      batch.update(doc.ref, {
        status: "expired",
        expiredAt,
        updatedAt: expiredAt,
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      expiredCount: expiredTargets.length,
      expireMinutes,
      expiredIds: expiredTargets.map((doc) => doc.id),
    });
  } catch (error) {
    console.error("Failed to expire point redemptions:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
