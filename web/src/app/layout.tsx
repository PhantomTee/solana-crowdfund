import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SolFund: Decentralised Crowdfunding on Solana",
  description:
    "Milestone-based crowdfunding with trustless USDC escrow. No platform fees.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={bricolage.variable}>
      <body
        className="min-h-screen antialiased"
        style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
