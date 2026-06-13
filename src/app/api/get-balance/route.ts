import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnectionWithFallback } from '@/lib/solana/connection';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  
  try {
    const connection = await getConnectionWithFallback();
    const balance = await connection.getBalance(new PublicKey(address));
    return NextResponse.json({ balance: balance / 1e9 });
  } catch (error: any) {
    console.error('[Get Balance API] Error fetching balance:', error);
    return NextResponse.json({ balance: 0, error: error.message });
  }
}
