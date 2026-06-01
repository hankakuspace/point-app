// src/app/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase';
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

function getTimestampValue(value: any) {
  if (!value) {
    return 0;
  }

  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value.toDate === 'function') {
    const time = value.toDate().getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value._seconds === 'number') {
    return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000);
  }

  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop') || '';
    const customerId = searchParams.get('customerId') || '';
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const reason = searchParams.get('reason') || '';
    const orderId = searchParams.get('orderId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Missing shop" },
        { status: 400 }
      );
    }

    const session = await requireShopifySessionToken(req, shop);

    if (!session.ok) {
      return session.response;
    }

    let queryRef: FirebaseFirestore.Query = db.collection('point_logs');

    if (customerId) {
      queryRef = queryRef.where('customerId', '==', customerId);
    }

    if (type) {
      queryRef = queryRef.where('type', '==', type);
    }

    if (reason) {
      queryRef = queryRef.where('reason', '==', reason);
    }

    if (orderId) {
      queryRef = queryRef.where('orderId', '==', orderId);
    }

    if (startDate) {
      const startLocal = new Date(startDate + 'T00:00:00');
      const startUTC = new Date(startLocal.getTime() - 9 * 60 * 60 * 1000);
      const start = Timestamp.fromDate(startUTC);
      queryRef = queryRef.where('timestamp', '>=', start);
    }

    if (endDate) {
      const endLocal = new Date(endDate + 'T23:59:59');
      const endUTC = new Date(endLocal.getTime() - 9 * 60 * 60 * 1000);
      const end = Timestamp.fromDate(endUTC);
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

    if (shop) {
      data = data.filter((log) => log.shop === shop);
    }

    const searchKeyword = search.trim().toLowerCase();

    if (searchKeyword) {
      data = data.filter((log) => {
        const customer = String(log.customerId || '').toLowerCase();
        const order = String(log.orderId || '').toLowerCase();
        const id = String(log.id || '').toLowerCase();

        return (
          customer.includes(searchKeyword) ||
          order.includes(searchKeyword) ||
          id.includes(searchKeyword)
        );
      });
    }

    data = data.sort(
      (a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp)
    );

    return NextResponse.json({ logs: data });
  } catch (error: any) {
    console.error('Error in GET /api/logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
