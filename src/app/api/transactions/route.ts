import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  
  try {
    const transactions = await kv.get(`atlas_txs_${address}`) || [];
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Failed to get KV data', error);
    return NextResponse.json({ transactions: [] });
  }
}

export async function POST(req: NextRequest) {
  const { address, transaction } = await req.json();
  if (!address || !transaction) {
    return NextResponse.json({ error: 'Missing address or transaction' }, { status: 400 });
  }
  
  try {
    const existing = (await kv.get(`atlas_txs_${address}`)) || [];
    const updated = [transaction, ...(existing as any[])].slice(0, 50); // keep last 50
    await kv.set(`atlas_txs_${address}`, updated);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set KV data', error);
    return NextResponse.json({ error: 'Failed to persist' }, { status: 500 });
  }
}
