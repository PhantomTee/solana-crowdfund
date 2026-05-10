import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolFund — Decentralised Crowdfunding on Solana",
  description:
    "Milestone-based crowdfunding with trustless USDC escrow. No platform fees.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fdfcf8] text-[#1c1917] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
