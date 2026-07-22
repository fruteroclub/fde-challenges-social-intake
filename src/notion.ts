import { Client } from "@notionhq/client";
import type { RawReply } from "./collect.js";
import type { ExtractedChallenge } from "./extract.js";

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

// Deterministic per-reply ID so re-runs upsert instead of duplicating rows.
function stableId(reply: RawReply): string {
  return `${reply.platform}:${reply.replyUrl ?? `${reply.authorHandle}:${reply.text.slice(0, 40)}`}`;
}

function richText(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}

export async function upsertChallenge(
  config: NotionConfig,
  reply: RawReply,
  extracted: ExtractedChallenge,
): Promise<void> {
  const notion = new Client({ auth: config.apiKey });
  const id = stableId(reply);

  const existing = await notion.databases.query({
    database_id: config.databaseId,
    filter: { property: "id", rich_text: { equals: id } },
  });

  const properties = {
    id: richText(id),
    source_platform: { select: { name: reply.platform } },
    source_post_url: { url: reply.postUrl },
    submitter_handle: richText(reply.authorHandle),
    submitted_at: reply.timestamp ? { date: { start: reply.timestamp } } : { date: null },
    raw_text: richText(reply.text),
    business_or_client_type: richText(extracted.business_or_client_type),
    painful_process: richText(extracted.painful_process),
    tools_or_data_involved: richText(extracted.tools_or_data_involved),
    desired_outcome: richText(extracted.desired_outcome),
    public_safety_status: { select: { name: extracted.public_safety_status } },
    challenge_summary: richText(extracted.challenge_summary),
    filter_status: { select: { name: extracted.filter_status } },
    filter_reason: richText(extracted.filter_reason),
    feasibility_score: { number: extracted.feasibility_score },
    public_build_value_score: { number: extracted.public_build_value_score },
    public_engagement_count: { number: reply.engagementCount },
  };

  if (existing.results.length > 0) {
    // Refresh scores + engagement count on the existing row; leave
    // aibus_shortlist_status and dabl_frutero_approval_status untouched so a
    // recurring refresh never clobbers human review state.
    await notion.pages.update({ page_id: existing.results[0].id, properties });
    return;
  }

  // needs_clarification and rejected rows are still written for the audit
  // trail, but aibus_shortlist_status starts (and, per the Week 1 decision,
  // stays) "not_reviewed" — that's what keeps them out of the shortlist.
  await notion.pages.create({
    parent: { database_id: config.databaseId },
    properties: {
      ...properties,
      aibus_shortlist_status: { select: { name: "not_reviewed" } },
      dabl_frutero_approval_status: { select: { name: "pending" } },
    },
  });
}
