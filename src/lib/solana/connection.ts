import { Connection } from "@solana/web3.js";

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (connectionInstance) {
    return connectionInstance;
  }

  // Get RPC URL from environment variables
  // Check SOLINFRA_RPC_URL, HELIUS_RPC_URL, or fallback to devnet
  const rpcUrl =
    process.env.SOLINFRA_RPC_URL && !process.env.SOLINFRA_RPC_URL.includes("YOUR_SOLINFRA_RPC_KEY")
      ? process.env.SOLINFRA_RPC_URL
      : process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com";

  connectionInstance = new Connection(rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: rpcUrl.replace("https://", "wss://"), // Try to derive WebSocket endpoint
  });

  console.log(`[Solana] Connected to RPC: ${rpcUrl}`);
  return connectionInstance;
}

export async function getConnectionWithFallback(): Promise<Connection> {
  const rpcUrl = process.env.SOLANA_RPC_URL || 
                 process.env.SOLINFRA_RPC_URL || 
                 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

