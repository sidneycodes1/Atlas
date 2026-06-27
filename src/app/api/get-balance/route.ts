import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getConnectionWithFallback } from '@/lib/solana/connection';

async function getBalanceWithFallback(address: string): Promise<number> {
  const primaryUrl = process.env.SOLANA_RPC_URL || 
                     'https://api.devnet.solana.com';
  const fallbackUrl = 'https://api.devnet.solana.com';
  
  try {
    const conn = new Connection(primaryUrl, 'confirmed');
    return await conn.getBalance(new PublicKey(address));
  } catch (e) {
    console.log('[Get Balance] Primary RPC failed, trying public fallback...');
    const conn = new Connection(fallbackUrl, 'confirmed');
    return await conn.getBalance(new PublicKey(address));
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  
  try {
    const balance = await getBalanceWithFallback(address);
    return NextResponse.json({ balance: balance / 1e9 });
  } catch (error: any) {
    console.error('[Get Balance API] Error fetching balance:', error);
    return NextResponse.json({ balance: 0, error: error.message });
  }
}
