import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import BN from "bn.js";
import { LAMPORTS_PER_USDC } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert USDC base units (u64) to a human-readable string like "12.50" */
export function formatUsdc(amount: BN | bigint | number): string {
  const bn =
    amount instanceof BN
      ? amount
      : new BN(amount.toString());
  const whole = bn.divn(LAMPORTS_PER_USDC);
  const frac = bn.modn(LAMPORTS_PER_USDC);
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2); // 2 decimal places
  return `${whole.toString()}.${fracStr}`;
}

/** Convert human USDC amount string ("12.50") to base units BN */
export function parseUsdc(amount: string): BN {
  const [whole = "0", frac = "0"] = amount.split(".");
  const fracPadded = frac.padEnd(6, "0").slice(0, 6);
  return new BN(whole)
    .muln(LAMPORTS_PER_USDC)
    .add(new BN(fracPadded));
}

/** Shorten a base58 address for display: "Abc1...xyz9" */
export function shortAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/** Compute campaign progress percentage (0-100), capped at 100 */
export function progressPct(totalRaised: BN, goal: BN): number {
  if (goal.isZero()) return 0;
  const pct = totalRaised.muln(100).div(goal).toNumber();
  return Math.min(pct, 100);
}

/** Unix timestamp → "May 9, 2026" */
export function formatDeadline(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** True if deadline has passed */
export function isDeadlinePassed(deadlineTs: number): boolean {
  return Date.now() / 1000 >= deadlineTs;
}
