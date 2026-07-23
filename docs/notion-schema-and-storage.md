# Notion schema and storage

Supports: README Step 7 and `src/notion.ts`. How the Week 1 spec's schema maps
onto real Notion property types, why upsert works the way it does, and what
`needs_clarification` actually means for the shortlist.

## Why Notion (and what was ruled out)

Notion was chosen over Airtable, Google Sheets, and SQLite specifically
because it gives Dabl Club and Aibus a shareable review UI without needing
repo or database access — the shortlist/approval workflow in the Week 1 spec
is a human-review step, and Notion's native filtering/views fit that better
than a flat file or a spreadsheet would. See the "Week 1 spec's open
implementation choices resolved" decision in
[`../../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../../workstreams/fde-challenges-social-intake/DECISIONS.md)
for the full reasoning against the alternatives.

## Schema mapping

The [Week 1 service spec's schema table](../../../workstreams/fde-challenges-social-intake/docs/week-1-fde-challenges-social-intake-service-spec.md)
(see "FDE Challenges database schema")
maps onto Notion property types like this:

| Spec field | Notion property type | Notes |
|---|---|---|
| `id` | rich text | **Not in the original spec** — added for upsert de-duplication (see below). |
| `source_platform` | select (`x`, `linkedin`) | |
| `source_post_url` | url | |
| `submitter_handle` | rich text | |
| `submitted_at` | date | Left null if the source reply has no parseable timestamp. |
| `raw_text` | rich text | Truncated to 2000 characters — Notion rich-text blocks have a practical size limit per API call. |
| `business_or_client_type`, `painful_process`, `tools_or_data_involved`, `desired_outcome`, `challenge_summary`, `filter_reason` | rich text | Model output from `extract.ts`, written as-is. |
| `public_safety_status` | select (`safe`, `needs_anonymization`, `unsafe`, `unknown`) | |
| `filter_status` | select (`candidate`, `rejected`, `needs_clarification`) | |
| `feasibility_score`, `public_build_value_score` | number | 1-5, from the extraction step's rubric scoring. |
| `public_engagement_count` | number | From the collection step; hardcoded 0 for LinkedIn (see [`collection-design.md`](collection-design.md)). |
| `aibus_shortlist_status` | select (`not_reviewed`, `shortlisted`, `not_shortlisted`) | Set once on creation, never touched by the worker again. |
| `dabl_frutero_approval_status` | select (`pending`, `approved`, `rejected`) | Same — human-owned field, worker never writes to it after creation. |
| `notes` | rich text | Left empty by the worker — a field for human reviewers. |

## Why upsert, and why by a synthetic `id`

The recurring engagement refresh (see
[`recurring-trigger-design.md`](recurring-trigger-design.md)) means the same
reply gets processed repeatedly over time, and each run needs to update the
existing row's engagement count and scores rather than create a duplicate.
`stableId()` builds a deterministic key from the platform and either the
reply's own URL (when X's DOM exposes one) or a fallback of
`authorHandle + text prefix` (for LinkedIn, where no direct reply permalink is
extracted). That key is stored in the added `id` rich-text property and
queried on every run (`notion.databases.query` with a `rich_text: { equals }`
filter) to decide create-vs-update.

## What refreshing actually updates — and what it deliberately doesn't

On an existing row, `upsertChallenge` overwrites the extracted fields, scores,
and engagement count — but never touches `aibus_shortlist_status` or
`dabl_frutero_approval_status`. Those two fields exist for human review state,
and a recurring automated refresh silently clobbering a human's shortlist
decision would defeat the purpose of having a review step at all.

## How `needs_clarification` stays out of the Week 1 shortlist

Per the Week 1 decision to exclude needs-clarification submissions, those
rows are still written to Notion — nothing is silently dropped, so there's an
audit trail — but they start (and, since the worker never advances shortlist
status, stay) at `aibus_shortlist_status: "not_reviewed"`. That's the entire
mechanism: "excluded from the shortlist" means "never promoted past
not_reviewed by the automated worker," not a separate suppression rule.

## Sources

- Notion API reference: https://developers.notion.com/reference/intro
- Notion database query filters (used for the upsert lookup):
  https://developers.notion.com/reference/post-database-query-filter
- `@notionhq/client` (the SDK used in `notion.ts`): https://github.com/makenotion/notion-sdk-js
