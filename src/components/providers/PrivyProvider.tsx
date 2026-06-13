"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { createSolanaRpc } from "@solana/kit";

const PrivyProviderAny = PrivyProvider as any;

export function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmq1noahl001w0cjuf49vf3m7";
  const router = useRouter();

  const solanaConnectors = toSolanaWalletConnectors({
    shouldAutoConnect: true,
  });

  return (
    <PrivyProviderAny
      appId={appId}
      onSuccess={() => {
        router.push("/dashboard");
      }}
      config={{
        loginMethods: ["google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#f0c93a",
          showWalletLoginFirst: false,
          walletChainType: "solana-only",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc("https://api.devnet.solana.com"),
            },
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      } as any}
    >
      {children}
    </PrivyProviderAny>
  );
}
