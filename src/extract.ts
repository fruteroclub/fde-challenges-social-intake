import type { RawReply } from "./collect.js";

const TOKEN_FACTORY_URL = "https://api.tokenfactory.nebius.com/v1/chat/completions";
const MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

export interface ExtractedChallenge {
  business_or_client_type: string;
  painful_process: string;
  tools_or_data_involved: string;
  desired_outcome: string;
  public_safety_status: "safe" | "needs_anonymization" | "unsafe" | "unknown";
  challenge_summary: string;
  filter_status: "candidate" | "rejected" | "needs_clarification";
  filter_reason: string;
  feasibility_score: number;
  public_build_value_score: number;
}

const SYSTEM_PROMPT = `You are extracting structured FDE (Forward Deployed Engineer) challenge submissions from public social media replies.

The reply responds to this prompt:
"Do you have a business or client workflow that needs AI integration or a practical tech solution? Reply publicly with: 1) What kind of business/client is this? 2) What process is painful, slow, or expensive right now? 3) What tools/data are involved? 4) What would a useful outcome look like? 5) Is this safe to discuss publicly if we anonymize details?"

Reject spam, jokes, pure commentary, vague AI curiosity, and non-business problems (filter_status "rejected"). Mark "needs_clarification" when the reply is a genuine attempt but is missing enough of fields 1-4 to score confidently. Otherwise mark "candidate".

Score using this rubric (1-5 each):
- feasibility_score: 1 = too large/regulated for a public prototype, 3 = buildable as a workflow/spec but not a one-week prototype, 5 = clear one-week artifact possible.
- public_build_value_score: 1 = too niche/invisible, 3 = useful but narrow, 5 = recognizable business pattern with visible artifact potential.

Respond with ONLY valid JSON, no prose, matching exactly this shape:
{
  "business_or_client_type": string,
  "painful_process": string,
  "tools_or_data_involved": string,
  "desired_outcome": string,
  "public_safety_status": "safe" | "needs_anonymization" | "unsafe" | "unknown",
  "challenge_summary": string,
  "filter_status": "candidate" | "rejected" | "needs_clarification",
  "filter_reason": string,
  "feasibility_score": number,
  "public_build_value_score": number
}`;

function parseJsonLoose(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse JSON from model response");
    return JSON.parse(match[0]);
  }
}

export async function extractChallenge(
  reply: RawReply,
  apiKey: string,
): Promise<ExtractedChallenge> {
  const res = await fetch(TOKEN_FACTORY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: reply.text },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token Factory request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Token Factory response had no message content");
  }

  return parseJsonLoose(content) as ExtractedChallenge;
}
