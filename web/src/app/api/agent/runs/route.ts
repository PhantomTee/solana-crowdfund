import { NextRequest } from "next/server";
import { agentStore } from "@/lib/agent-store";

/** GET /api/agent/runs?campaignId=<pda>
 *  Returns all successful agent runs, optionally filtered by campaign. */
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");

  const runs = campaignId
    ? agentStore.getByCampaign(campaignId)
    : agentStore.getAll();

  return Response.json({ runs, count: runs.length });
}
