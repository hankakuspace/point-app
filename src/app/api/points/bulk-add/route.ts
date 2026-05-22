// src/app/api/points/bulk-add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, points, reason } = body;
    const shop =
      typeof body.shop === 'string' && body.shop.trim()
        ? body.shop.trim()
        : '';

    if (!points || typeof points !== 'number') {
      return NextResponse.json({ error: 'ポイント数を指定してください' }, { status: 400 });
    }

    const batch = db.batch();
    const customersRef = db.collection('customers');

    if (customerId) {
      // 特定顧客に付与
      const customerDoc = customersRef.doc(customerId);
      batch.update(customerDoc, { points: admin.firestore.FieldValue.increment(points) });

      const logRef = db.collection('point_logs').doc();
      const customerSnap = await customerDoc.get();
      const customerData = customerSnap.exists ? customerSnap.data() || {} : {};

      batch.set(logRef, {
        customerId,
        shop: shop || customerData.shop || null,
        type: 'add',
        points,
        orderId: null,
        reason: reason || 'bulk_add',
        timestamp: new Date().toISOString(),
      });
    } else {
      // 全顧客に付与
      const snapshot = shop
        ? await customersRef.where('shop', '==', shop).get()
        : await customersRef.get();
      snapshot.forEach((doc) => {
        const customerRef = customersRef.doc(doc.id);
        batch.update(customerRef, { points: admin.firestore.FieldValue.increment(points) });

        const logRef = db.collection('point_logs').doc();
        const customerData = doc.data() || {};

        batch.set(logRef, {
          customerId: doc.id,
          shop: shop || customerData.shop || null,
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
  } catch (error: any) {
    console.error('Error in POST /api/points/bulk-add:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
