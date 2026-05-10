export interface PaymentRecord {
  campaignId: string;
  txSig: string;
  amount: number;        // micro-USDC (6 decimals)
  amountUsdc: number;    // human-readable
  timestamp: number;     // ms since epoch
  source?: "x402" | "agent"; // origin of the payment
}

class PaymentStore {
  private byCampaign: Map<string, PaymentRecord[]> = new Map();
  private seen: Set<string> = new Set();

  /** Idempotent — ignores duplicate tx signatures */
  record(payment: PaymentRecord): boolean {
    if (this.seen.has(payment.txSig)) return false;
    this.seen.add(payment.txSig);
    const list = this.byCampaign.get(payment.campaignId) ?? [];
    this.byCampaign.set(payment.campaignId, [...list, payment]);
    return true;
  }

  getByCampaign(campaignId: string): PaymentRecord[] {
    return this.byCampaign.get(campaignId) ?? [];
  }

  getAll(): PaymentRecord[] {
    return Array.from(this.byCampaign.values()).flat()
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Module-level singleton — lives for the Node.js process lifetime
export const paymentStore = new PaymentStore();
