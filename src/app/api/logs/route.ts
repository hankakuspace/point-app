// src/app/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import admin from 'firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || '';
    const type = searchParams.get('type') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    let queryRef: FirebaseFirestore.Query = db
      .collection('point_logs');

    if (customerId) {
      queryRef = queryRef.where('customerId', '==', customerId);
    }
    if (type) {
      queryRef = queryRef.where('type', '==', type);
    }
    if (startDate) {
      const startLocal = new Date(startDate + 'T00:00:00'); // JST
      const startUTC = new Date(startLocal.getTime() - 9 * 60 * 60 * 1000); // JST→UTC
      const start = admin.firestore.Timestamp.fromDate(startUTC);
      queryRef = queryRef.where('timestamp', '>=', start);
    }
    if (endDate) {
      const endLocal = new Date(endDate + 'T23:59:59'); // JST
      const endUTC = new Date(endLocal.getTime() - 9 * 60 * 60 * 1000); // JST→UTC
      const end = admin.firestore.Timestamp.fromDate(endUTC);
      queryRef = queryRef.where('timestamp', '<=', end);
    }

    const snapshot = await queryRef.get();
    let data = snapshot.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        ...d,
        timestamp: d.timestamp?.toDate
          ? d.timestamp.toDate().toISOString()
          : d.timestamp || null,
      };
    });

    // サーバー側で降順ソート保証
    data = data.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ logs: data });
  } catch (error: any) {
    console.error('Error in GET /api/logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
