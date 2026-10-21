// src/app/api/points/bulk-add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import admin from 'firebase-admin';
import { requireShopifySessionToken } from '@/lib/shopifySessionToken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, points, reason } = body;
    const requestedShop =
      typeof body.shop === 'string' && body.shop.trim()
        ? body.shop.trim()
        : '';

    const session = await requireShopifySessionToken(req, requestedShop);

    if (!session.ok) {
      return session.response;
    }

    const shop = session.shop;

    if (!points || typeof points !== 'number') {
      return NextResponse.json({ error: 'ポイント数を指定してください' }, { status: 400 });
    }

    const batch = db.batch();
    const customersRef = db.collection('customers');

    if (customerId) {
      // 特定顧客に付与
      const customerDoc = customersRef.doc(customerId);

      const logRef = db.collection('point_logs').doc();
      const customerSnap = await customerDoc.get();
      const customerData = customerSnap.exists ? customerSnap.data() || {} : {};

      if (!customerSnap.exists) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      const customerShop = typeof customerData.shop === 'string'
        ? customerData.shop.trim().toLowerCase() : '';
      if (customerShop !== shop) {
        return NextResponse.json({ error: 'Customer shop mismatch' }, { status: 403 });
      }
      batch.update(customerDoc, { points: admin.firestore.FieldValue.increment(points) },
        { lastUpdateTime: customerSnap.updateTime! });

      batch.set(logRef, {
        customerId,
        shop,
        type: 'add',
        points,
        orderId: null,
        reason: reason || 'bulk_add',
        timestamp: new Date().toISOString(),
      });
    } else {
      // 全顧客に付与
      const snapshot = await customersRef.where('shop', '==', shop).get();
      snapshot.forEach((doc) => {
        const customerRef = customersRef.doc(doc.id);
        batch.update(customerRef, { points: admin.firestore.FieldValue.increment(points) },
          { lastUpdateTime: doc.updateTime });

        const logRef = db.collection('point_logs').doc();

        batch.set(logRef, {
          customerId: doc.id,
          shop,
          type: 'add',
          points,
          orderId: null,
          reason: reason || 'bulk_add',
          timestamp: new Date().toISOString(),
        });
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch {
    console.error('Error in POST /api/points/bulk-add');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
