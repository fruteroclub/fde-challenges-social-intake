# Nebius Token Factory extraction

Supports: README Step 8 and `src/extract.ts`. Why this endpoint and model,
and how the extraction prompt maps a raw reply onto the `FDE Challenges`
schema.

## Reused, not re-derived

This project's Nebius Token Factory setup is deliberately identical to the
one already documented and proven in the Nebius webinar series
(`../../../../nebius/`, a sibling child project under `devrel/`), specifically
Steps 11-13 of
[`nebius-fde-trainer-webinar-series/01-nebius-cloud-builder-environment/written-guide.md`](../../../../nebius/code/nebius-fde-trainer-webinar-series/01-nebius-cloud-builder-environment/written-guide.md).
That guide's dry run already validated the endpoint, auth header, and model
choice work; this project reuses those exact values instead of re-testing
them from scratch:

- Endpoint: `https://api.tokenfactory.nebius.com/v1/chat/completions`
  (OpenAI-compatible chat completions).
- Auth: `Authorization: Bearer $NEBIUS_API_KEY`.
- Model: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` — the smallest obvious
  NVIDIA/Nemotron text model available at the time the webinar series picked
  it. Larger Nemotron variants exist in Token Factory's catalog if extraction
  quality on real replies turns out to need more capability than the Nano
  model provides — that's a live tradeoff to watch during Step 9, not a
  closed decision.

## What the extraction prompt actually does

`extractChallenge` sends the raw reply text as the user message, with a
system prompt that:

1. Restates the intake prompt the reply is responding to (business/client
   type, painful process, tools/data, desired outcome, public-safety note) —
   giving the model the same context a human reviewer would have.
2. Asks for one of three `filter_status` values: `candidate`, `rejected`
   (spam, jokes, pure commentary, vague AI curiosity, non-business problems),
   or `needs_clarification` (a genuine attempt missing enough of the four
   fields to score confidently).
3. Asks for two 1-5 scores — `feasibility_score` and
   `public_build_value_score` — using the exact rubric language from the
   [Week 1 service spec](../../../workstreams/fde-challenges-social-intake/docs/week-1-fde-challenges-social-intake-service-spec.md#scoring-rubric),
   so the model's scoring criteria match what a human reviewer would apply by
   hand.
4. Requires JSON-only output, matching the exact shape of `ExtractedChallenge`.

## Why there's a loose-JSON-parse fallback

The request doesn't set an explicit `response_format: json_object` — whether
Token Factory's OpenAI-compatible endpoint honors that field for this specific
model wasn't verified before writing this code. Instead, `extract.ts` relies
on the prompt instruction ("Respond with ONLY valid JSON") plus a fallback
parser (`parseJsonLoose`) that extracts the first `{...}` block from the
response if a direct `JSON.parse` fails — a defensive choice for a model that
might wrap JSON in prose or markdown fencing despite instructions, rather than
assuming strict compliance.

## What `needs_clarification` actually does downstream

Per the Week 1 decision to exclude needs-clarification submissions from the
shortlist entirely, rows with that `filter_status` still get written to
Notion (for the audit trail), but `notion.ts` only sets
`aibus_shortlist_status: "not_reviewed"` on creation and never advances it —
see [`notion-schema-and-storage.md`](notion-schema-and-storage.md) for the
full upsert logic.

## Sources

- Token Factory quickstart: https://docs.tokenfactory.nebius.com/quickstart
  (referenced from the Nebius webinar guide; not independently re-fetched for
  this project — the webinar guide's dry-run-verified values were reused
  directly instead).
- The scoring rubric this prompt encodes:
  [`../../../workstreams/fde-challenges-social-intake/docs/week-1-fde-challenges-social-intake-service-spec.md`](../../../workstreams/fde-challenges-social-intake/docs/week-1-fde-challenges-social-intake-service-spec.md).
