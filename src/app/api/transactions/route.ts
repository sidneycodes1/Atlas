import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function getFileData(address: string) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `atlas_txs_${address}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to read KV file', error);
    return [];
  }
}

async function setFileData(address: string, data: any) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `atlas_txs_${address}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write KV file', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  
  try {
    const transactions = await getFileData(address);
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
    const existing = await getFileData(address);
    const updated = [transaction, ...existing].slice(0, 50); // keep last 50
    await setFileData(address, updated);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set KV data', error);
    return NextResponse.json({ error: 'Failed to persist' }, { status: 500 });
  }
}
