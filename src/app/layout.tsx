import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { PrivyAppProvider } from "@/components/providers/PrivyProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ui",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Atlas | Autonomous Transaction Recovery for Solana",
  description: "Self-healing transactions for Solana Devnet using Yellowstone gRPC, Jito, and AI Recovery Agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} font-ui antialiased`}>
        <PrivyAppProvider>
          {children}
        </PrivyAppProvider>
      </body>
    </html>
  );
}
