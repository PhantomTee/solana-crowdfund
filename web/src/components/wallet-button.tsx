"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "./ui/button";
import { shortAddress } from "@/lib/utils";
import { Wallet, LogOut } from "lucide-react";

export function WalletButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return <Button size="sm" loading>Connecting</Button>;
  }

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 border text-sm font-mono"
          style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)", color: "var(--text-muted)" }}
        >
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {shortAddress(publicKey.toBase58())}
        </div>
        <button
          onClick={disconnect}
          title="Disconnect"
          className="h-8 w-8 flex items-center justify-center border transition-all hover:border-rose-400 hover:text-rose-500"
          style={{ border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setVisible(true)}>
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </Button>
  );
}
