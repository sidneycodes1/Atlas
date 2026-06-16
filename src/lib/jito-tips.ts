import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Fetches dynamic tip data from the Jito Tip Floor API.
 * 
 * Dynamic tips matter because the tip floor changes based on network congestion.
 * Static tips risk being too low during high demand (resulting in dropped bundles)
 * or wastefully high during quiet periods.
 * 
 * @param urgency 'normal' uses the 50th percentile, 'retry' uses the 75th percentile
 * @returns Tip amount in lamports
 */
export async function getDynamicTip(urgency: 'normal' | 'retry'): Promise<number> {
  const DEFAULT_TIP = 10000;
  
  try {
    const res = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor', {
      cache: 'no-store',
      // Adding a small timeout to not delay bundling significantly if Jito is down
      signal: AbortSignal.timeout(2000)
    });
    
    if (!res.ok) {
      console.warn(`[Jito Tips] Failed to fetch tip floor: ${res.statusText}. Using fallback ${DEFAULT_TIP}`);
      return DEFAULT_TIP;
    }
    
    const data = await res.json();
    
    if (!data || !data.length || !data[0]) {
      console.warn(`[Jito Tips] Empty or malformed tip floor response. Using fallback ${DEFAULT_TIP}`);
      return DEFAULT_TIP;
    }
    
    const tipData = data[0];
    let tipInSol = tipData.landed_tips_50th_percentile;
    let usedPercentile = '50th';
    
    if (urgency === 'retry') {
      tipInSol = tipData.landed_tips_75th_percentile;
      usedPercentile = '75th';
    }
    
    // Safety check just in case the percentile is missing
    if (typeof tipInSol !== 'number') {
      console.warn(`[Jito Tips] Missing ${usedPercentile} percentile data. Using fallback ${DEFAULT_TIP}`);
      return DEFAULT_TIP;
    }
    
    const tipLamports = Math.floor(tipInSol * LAMPORTS_PER_SOL);
    
    console.log(`[Jito Tips] Fetched dynamic tip: ${tipLamports} lamports (urgency: ${urgency}, percentile: ${usedPercentile})`);
    
    return tipLamports;
    
  } catch (error: any) {
    console.warn(`[Jito Tips] Network error fetching tip floor: ${error.message}. Using fallback ${DEFAULT_TIP}`);
    return DEFAULT_TIP;
  }
}
