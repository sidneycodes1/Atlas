import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

  try {
    new PublicKey(address);
  } catch (e) {
    return NextResponse.json({ balance: 0, error: 'Invalid address' });
  }

  try {
    const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
    const balance = await conn.getBalance(new PublicKey(address));
    return NextResponse.json({ balance: balance / 1e9 }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('[Get Balance API] Error:', error.message);
    return NextResponse.json({ balance: 0, error: error.message });
  }
}
