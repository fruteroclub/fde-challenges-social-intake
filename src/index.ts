import { collectLinkedInReplies, collectXReplies } from "./collect.js";
import { extractChallenge } from "./extract.js";
import { upsertChallenge } from "./notion.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const nebiusApiKey = requireEnv("NEBIUS_API_KEY");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDatabaseId = requireEnv("NOTION_DATABASE_ID");

  const xPostUrl = process.env.X_POST_URL;
  const linkedinPostUrl = process.env.LINKEDIN_POST_URL;
  if (!xPostUrl && !linkedinPostUrl) {
    throw new Error("Set at least one of X_POST_URL or LINKEDIN_POST_URL");
  }

  const replies = [
    ...(xPostUrl
      ? await collectXReplies(xPostUrl, requireEnv("X_STORAGE_STATE_PATH"))
      : []),
    ...(linkedinPostUrl
      ? await collectLinkedInReplies(linkedinPostUrl, requireEnv("LINKEDIN_STORAGE_STATE_PATH"))
      : []),
  ];

  console.log(`Collected ${replies.length} raw replies`);

  for (const reply of replies) {
    try {
      const extracted = await extractChallenge(reply, nebiusApiKey);
      await upsertChallenge({ apiKey: notionApiKey, databaseId: notionDatabaseId }, reply, extracted);
      console.log(`Upserted ${reply.platform} reply from ${reply.authorHandle}: ${extracted.filter_status}`);
    } catch (err) {
      console.error(`Failed to process reply from ${reply.authorHandle}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
