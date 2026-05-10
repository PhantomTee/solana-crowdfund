import { paymentStore } from "@/lib/payment-store";
import { NextRequest } from "next/server";

// GET /api/campaigns/[id]/payments
// Returns all x402 payment records for a campaign
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const records = paymentStore.getByCampaign(id);

  return Response.json({
    campaignId: id,
    count:      records.length,
    payments:   records,
  });
}
