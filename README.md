# FDE Challenges — Social Intake Worker (Written Guide)

Week 1 build for the Dabl Club x Frutero forward-deployed-series. This is the
step-by-step companion to
[`video-tutorial-script.md`](video-tutorial-script.md) — follow it top to
bottom and you'll have the whole thing built and deployed, not just
configured. For the architecture decisions behind each choice, see
[`../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../workstreams/fde-challenges-social-intake/DECISIONS.md)
and
[`week-1-implementation-plan.md`](../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md).

Each step below has a short "why" and the exact commands. Where there's more
to understand than fits here, it links out to a companion doc in
[`docs/`](docs/) — deeper, but not everything at once.

## What you'll build

- A Tenki Sandbox template with Chromium pre-baked, published to your
  workspace's registry.
- A Persistent Volume holding an authenticated test-account browser session,
  reused across ephemeral worker runs.
- A Notion `FDE Challenges` database receiving real, structured rows scored by
  Nebius Token Factory.
- A GitHub Actions workflow that launches a disposable Tenki Sandbox worker on
  a schedule, runs the collection -> extraction -> Notion pipeline, and tears
  itself down.

## Prerequisites

- A Tenki account (`tenki.cloud`) — already have this.
- A Nebius account with Token Factory access (`tokenfactory.nebius.com`).
- A Notion account/workspace you can create a database and integration in.
- Push access to
  [fruteroclub/fde-challenges-social-intake](https://github.com/fruteroclub/fde-challenges-social-intake),
  or your own fork.
- Node 22+ and npm locally.
- A dedicated test/burner X and/or LinkedIn account — not Frutero's or Dabl's
  real accounts. See [`docs/auth-strategy-and-platform-tos.md`](docs/auth-strategy-and-platform-tos.md)
  for why this matters before you create one.

## Layout

```
src/
  collect.ts              Playwright: scrape replies to a specific post (X + LinkedIn)
  extract.ts              Nebius Token Factory: extract + score each reply
  notion.ts               Upsert extracted rows into the FDE Challenges Notion DB
  index.ts                Orchestrator entrypoint (what runs inside the sandbox)
  capture-auth-state.ts   One-time local tool: capture a logged-in session
template/                 Tenki Sandbox template (Playwright + Chromium pre-baked)
docs/                      Companion deep-dive docs, one per major decision
.github/workflows/        GitHub Actions cron that launches the sandbox worker
mcp-workaround/           Temporary pinned MCP fallback for the CLI scope bug
video-tutorial-script.md  Filming script for the Week 1 video
```

## Step 1 — Install the Tenki CLI and authenticate with an API key

Why: everything downstream (templates, volumes, sandbox sessions) is
workspace-scoped, so you need to be signed in and know your workspace before
anything else works.

`tenki login`'s default interactive flow opens a browser and waits for an
OAuth redirect to a `127.0.0.1` localhost callback — confirmed hands-on that
this fails in some environments (the callback never completes). Skip it
entirely and authenticate with an API key instead, which also sets up
something Step 10 needs anyway: GitHub Actions authenticates the same way,
via `TENKI_API_KEY` as a repo secret.

```bash
curl -fsSL https://tenki.cloud/install.sh | bash
```

Generate the key in the dashboard, not the CLI:

1. Sign in at [app.tenki.cloud](https://app.tenki.cloud) and select **Tenki
   Sandbox**. First time through, this completes Sandbox onboarding and Tenki
   generates an initial API key for you — copy it when shown.
2. For any additional key (e.g. a separate one for CI later): **API Keys** ->
   **Create API Key** -> name it, optionally set an expiration -> **Create
   Key** -> copy it.

Then authenticate the CLI non-interactively:

```bash
export TENKI_API_KEY=tk_your_api_key
tenki login --api-key "$TENKI_API_KEY"
tenki status
```

`tenki status` confirms it and prints the workspace — note that name/ID,
every following command references it.

Deeper: [`docs/tenki-sandbox-fundamentals.md`](docs/tenki-sandbox-fundamentals.md).

## Step 2 — Try the sandbox primitive (recommended, not required)

Why: everything after this step is the same three verbs — `create`, `exec`,
`terminate` — just wired to the real pipeline instead of a toy command. Worth
proving to yourself once before adding complexity.

```bash
tenki sandbox create --name demo
tenki sandbox set <session-id>
tenki sandbox exec -c 'uname -a && whoami'
tenki sandbox terminate
```

### Temporary fallback: Tenki MCP

If `tenki login --api-key` succeeds but `tenki sandbox create` returns
`project_id is required`, follow the isolated
[`mcp-workaround/`](mcp-workaround/README.md) path instead. It uses Tenki's
API through a pinned MCP server, explicitly resolves workspace/project scope,
and includes a separate GitHub Actions workflow. Keep this main CLI path as
the default and remove the fallback once the CLI bug is fixed.

## Step 3 — Build and publish the Tenki template

Why: without this, every worker session would spend a minute or two
downloading and installing Chromium before doing any real work, for a job that
itself only takes seconds. The template pays that cost exactly once.

```bash
tenki sandbox template create \
  --name fde-intake-worker \
  --setup-script "$(cat template/setup-script.sh)" \
  --tags fde-challenges-social-intake

tenki sandbox template build <template-id> --wait
```

This step takes a few minutes (apt installs + browser download).

```bash
tenki sandbox registry publish \
  --image <your-workspace>/fde-intake-worker:latest \
  --from-template <template-id> \
  --visibility private
```

`<your-workspace>/fde-intake-worker:latest` is the reference every worker
session boots from. Save it — it becomes `TENKI_IMAGE` in Step 10.

Deeper: [`docs/tenki-sandbox-fundamentals.md`](docs/tenki-sandbox-fundamentals.md#templates).

## Step 4 — Create the persistent volume

Why: sandboxes are disposable — nothing on their filesystem survives
termination. The volume is where the authenticated browser session lives
instead, so workers reuse it without re-logging-in every run.

```bash
tenki sandbox volume create --workspace <your-workspace> --name fde-auth-state --size 1GB
```

Save the volume ID — it becomes `TENKI_AUTH_VOLUME_ID` in Step 10.

Deeper: [`docs/tenki-sandbox-fundamentals.md`](docs/tenki-sandbox-fundamentals.md#persistent-volumes).

## Step 5 — Capture the test-account session

Why: confirmed empirically (2026-07-22) that both X and LinkedIn block reply
content for logged-out visitors — X shows only a `Read N reply` teaser,
LinkedIn redirects to an authwall. An authenticated session is required, and
it comes from a dedicated test/burner account, not Frutero's or Dabl's real
ones — full reasoning in
[`docs/auth-strategy-and-platform-tos.md`](docs/auth-strategy-and-platform-tos.md).

```bash
npm install
npm run capture-auth -- x ./secrets/x.storageState.json
npm run capture-auth -- linkedin ./secrets/linkedin.storageState.json
```

This opens a real, visible browser window. **You log in by hand, as the test
account** — the script never touches the login form. It only saves the
resulting session afterward, so everything automated from here on reuses a
session a human actually created.

## Step 6 — Seed the volume with the captured sessions

Why: the volume needs the two `storageState.json` files on it before any
worker session can mount them read-only.

```bash
tenki sandbox create --name fde-auth-seed --volume <volume-id>:/workspace/secrets
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/x.storageState.json --data-file ./secrets/x.storageState.json
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/linkedin.storageState.json --data-file ./secrets/linkedin.storageState.json
tenki sandbox terminate --session <seed-session-id>
```

One throwaway session, mounted read-write just this once. Every worker session
after this mounts the same volume `:ro`.

## Step 7 — Set up Notion

Why: Notion is the human review surface — where a real person looks at scored
challenge candidates and decides what gets shortlisted.

1. Create a database named `FDE Challenges` with the properties from the
   [Week 1 service spec's schema table](../../workstreams/fde-challenges-social-intake/docs/week-1-fde-challenges-social-intake-service-spec.md)
   (see "FDE Challenges database schema"), plus one extra: an `id` rich-text
   property, used internally for upsert de-duplication — not part of the
   original spec schema.
2. Create a Notion integration, share the database with it.
3. Copy the integration's API key and the database ID (from its URL).

Deeper, including the exact schema-to-Notion-property mapping and why upsert
works the way it does:
[`docs/notion-schema-and-storage.md`](docs/notion-schema-and-storage.md).

## Step 8 — Set up Nebius Token Factory

Why: this is the extraction/scoring step — reusing the exact same setup
pattern as the Nebius webinar series rather than re-deriving it.

```bash
# from https://tokenfactory.nebius.com
export NEBIUS_API_KEY=...
```

Deeper, including why this specific model and endpoint, and the prompt design
behind the extraction:
[`docs/nebius-token-factory-extraction.md`](docs/nebius-token-factory-extraction.md).

## Step 9 — Run the worker locally

Why: this is the real test. Everything before this was setup; this is where
collection, extraction, and storage actually run together for the first time.

```bash
cp .env.example .env
# fill in NEBIUS_API_KEY, NOTION_API_KEY, NOTION_DATABASE_ID,
# X_POST_URL and/or LINKEDIN_POST_URL,
# X_STORAGE_STATE_PATH / LINKEDIN_STORAGE_STATE_PATH -> ./secrets/*.json

npm run dev
```

If this doesn't work cleanly the first time — especially on LinkedIn — that's
expected, not a sign something is fundamentally wrong. See
[`docs/collection-design.md`](docs/collection-design.md) for what's most
likely to need adjustment and why.

## Step 10 — Wire GitHub Actions and trigger the recurring worker

Why: this is the actual Week 1 lesson — a scheduled trigger that costs
nothing between runs, launching a disposable sandbox that costs fractions of
a cent per run.

On [fruteroclub/fde-challenges-social-intake](https://github.com/fruteroclub/fde-challenges-social-intake),
set:

- Secrets: `TENKI_API_KEY`, `TENKI_AUTH_VOLUME_ID`, `NEBIUS_API_KEY`,
  `NOTION_API_KEY`, `NOTION_DATABASE_ID`
- Variables: `TENKI_IMAGE` (from Step 3), `X_POST_URL`, `LINKEDIN_POST_URL`

Trigger manually via `workflow_dispatch`:

```bash
gh workflow run refresh.yml
gh run watch
```

**Note:** the `schedule` trigger in `refresh.yml` is commented out until this
step is actually complete. GitHub Actions fires `schedule` the moment the
workflow file exists on the default branch, whether or not secrets are set —
pushing this repo before setup was done triggered exactly that: a run with
every secret empty, `tenki login` falling back to an interactive device-login
flow that can't complete headless, and a 15-minute timeout failure email.
Once you've confirmed a manual `workflow_dispatch` run succeeds end-to-end,
uncomment the `schedule` block in `refresh.yml`.

Deeper on why GitHub Actions cron and not Tenki Runners, and the one part of
this workflow that's unverified against a live run:
[`docs/recurring-trigger-design.md`](docs/recurring-trigger-design.md).

## Step 11 — Verify results in Notion

Open the `FDE Challenges` database. Each row is one reply, scored for
feasibility and public build value, with a filter status. Rows marked
`needs_clarification` stay out of the Week 1 shortlist by design — see
`notion.ts`'s upsert logic and
[`docs/notion-schema-and-storage.md`](docs/notion-schema-and-storage.md).

## Cost model

Tenki Sandbox bills per second. A worker run lasting a couple of minutes costs
fractions of a cent even on the default Small instance ($0.17/hr). Full
breakdown, including why the refresh cadence is conservative:
[`docs/cost-and-operations.md`](docs/cost-and-operations.md).

## Known limitations

- **Currently blocking: two Tenki CLI (v1.0.0) bugs stop Step 2 onward for
  everyone**, not just this account. (1) The interactive login callback
  receives a `session_token` in its URL but the CLI reports it missing —
  reproduced via `tenki login --no-browser`. (2) `--api-key` auth never
  resolves a `project_id`/`workspace_id`, and no CLI flag or env var accepts
  one manually, even though the account genuinely has exactly one of each
  (confirmed via the SDK's `whoAmI()`, bypassing the CLI entirely). Full
  repro in
  [`../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../workstreams/fde-challenges-social-intake/DECISIONS.md)'s
  2026-07-23 entry. Reported to Tenki support; this note stays until resolved.
- LinkedIn's comment DOM selectors in `collect.ts` are best-effort and likely
  need adjustment against a live post — see
  [`docs/collection-design.md`](docs/collection-design.md).
- LinkedIn has no confirmed cheap fallback if the test account gets rate
  limited or blocked there. X falls back to the official API in that case;
  LinkedIn does not.
- The GitHub Actions workflow's session-ID resolution (tag + `list --json`)
  is not yet verified against a live `tenki` CLI run — see
  [`docs/recurring-trigger-design.md`](docs/recurring-trigger-design.md).
- `public_engagement_count` for LinkedIn replies is hardcoded to 0 — not
  reliably exposed per-comment in the DOM.
