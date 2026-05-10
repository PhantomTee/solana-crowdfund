export interface AgentRun {
  id: string;
  timestamp: number;       // ms
  campaignId: string;      // campaign PDA base58
  amountUsdc: number;      // human USDC donated
  txSig: string;           // Solana tx signature (empty on error)
  reasoning: string;       // Virtuals AI reasoning text
  status: "success" | "error";
  error?: string;
}

class AgentStore {
  private runs: AgentRun[] = [];
  private lastRunTime = 0;  // ms epoch

  record(run: AgentRun): void {
    this.runs.unshift(run);
    if (this.runs.length > 100) this.runs.pop();
  }

  setLastRunTime(t: number): void { this.lastRunTime = t; }
  getLastRunTime(): number        { return this.lastRunTime; }

  getAll(): AgentRun[] { return [...this.runs]; }

  getByCampaign(campaignId: string): AgentRun[] {
    return this.runs.filter(
      (r) => r.campaignId === campaignId && r.status === "success"
    );
  }
}

// Module-level singleton — lives for the Node.js process lifetime
export const agentStore = new AgentStore();
