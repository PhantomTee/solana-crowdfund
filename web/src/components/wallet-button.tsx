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
    return (
      <Button size="sm" loading>
        Connecting
      </Button>
    );
  }

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 border border-[#ede8e2]">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-stone-600 font-mono">
            {shortAddress(publicKey.toBase58())}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="p-1.5 rounded-xl text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-150"
          title="Disconnect"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setVisible(true)}>
      <Wallet className="w-3.5 h-3.5" />
      Connect Wallet
    </Button>
  );
}
