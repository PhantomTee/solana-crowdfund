import { NextRequest } from "next/server";

const API_KEY  = process.env.ELEVENLABS_API_KEY!;
// Default: Rachel (free tier). Override with ELEVENLABS_VOICE_ID for a custom voice.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function POST(req: NextRequest) {
  if (!API_KEY || !VOICE_ID) {
    return Response.json(
      { error: "ElevenLabs credentials not configured on server" },
      { status: 500 }
    );
  }

  const { title, description, goalUsdc, deadlineTs, milestoneCount } =
    await req.json();

  const deadlineDate = new Date((deadlineTs as number) * 1000).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  // Build a natural pitch from the campaign parameters
  const lines = [
    title
      ? `Hi, I'm launching a campaign called "${title}".`
      : "Hi, I'm launching a fundraising campaign on SolFund.",

    description ? description.trim() : "",

    `I'm raising ${goalUsdc} USDC${
      milestoneCount > 1
        ? `, broken into ${milestoneCount} milestone payouts so funds are released responsibly`
        : ""
    }. The campaign closes on ${deadlineDate}.`,

    "All funds are held in a trustless USDC escrow on Solana Devnet. If the goal isn't reached, every donor gets a full automatic refund, no questions asked.",

    title
      ? `Back "${title}" today and help make it a reality.`
      : "Back this campaign today and help make it a reality.",
  ]
    .filter(Boolean)
    .join(" ");

  let elRes: Response;
  try {
    elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   API_KEY,
          "Content-Type": "application/json",
          "Accept":       "audio/mpeg",
        },
        body: JSON.stringify({
          text:       lines,
          model_id:   "eleven_turbo_v2_5",
          voice_settings: { stability: 0.48, similarity_boost: 0.78 },
        }),
      }
    );
  } catch (err) {
    return Response.json(
      { error: `Network error calling ElevenLabs: ${err}` },
      { status: 502 }
    );
  }

  if (!elRes.ok) {
    const detail = await elRes.text();
    return Response.json(
      { error: `ElevenLabs API error ${elRes.status}: ${detail}` },
      { status: elRes.status }
    );
  }

  const audioBuffer = await elRes.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  return Response.json({
    audioBase64,
    mimeType:  "audio/mpeg",
    pitchText: lines,
  });
}
