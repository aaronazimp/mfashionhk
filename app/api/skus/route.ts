import { NextRequest, NextResponse } from 'next/server';
import { updateProductBySku } from '@/lib/products';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originalSku, update } = body || {};

    if (!originalSku || !update) {
      return NextResponse.json({ error: 'originalSku and update are required' }, { status: 400 });
    }

    const updated = updateProductBySku(originalSku, update);
    if (!updated) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    return NextResponse.json({ product: updated });
  } catch (err) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}
