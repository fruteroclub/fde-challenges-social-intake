# FDE Challenges — social intake worker

Week 1 build for the Dabl Club x Frutero forward-deployed-series. Collects
public replies to the launch post on X/LinkedIn, extracts and scores FDE
challenge candidates via Nebius Token Factory, and upserts them into a Notion
`FDE Challenges` database. Runs as a recurring worker launched inside a Tenki
Sandbox — see
[`../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md`](../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md)
for the full architecture and the decisions behind it.

## Layout

```
src/
  collect.ts              Playwright: scrape replies to a specific post (X + LinkedIn)
  extract.ts              Nebius Token Factory: extract + score each reply
  notion.ts               Upsert extracted rows into the FDE Challenges Notion DB
  index.ts                Orchestrator entrypoint (what runs inside the sandbox)
  capture-auth-state.ts   One-time local tool: capture a logged-in session
template/                 Tenki Sandbox template (Playwright + Chromium pre-baked)
.github/workflows/        GitHub Actions cron that launches the sandbox worker
```

## One-time setup

1. **Capture authenticated sessions** for a dedicated test/burner account (not
   Frutero's or Dabl's real accounts — see DECISIONS.md for why):

   ```bash
   npm install
   npm run capture-auth -- x ./secrets/x.storageState.json
   npm run capture-auth -- linkedin ./secrets/linkedin.storageState.json
   ```

   This opens a real, visible browser window. You log in by hand; the script
   only saves the resulting session for reuse. It never automates the login
   itself.

2. **Build and publish the Tenki template** — see
   [`template/README.md`](template/README.md).

3. **Create the Tenki auth-state volume** and write the two `storageState.json`
   files into it — also in `template/README.md`.

4. **Set up Notion**: create the `FDE Challenges` database with the properties
   listed in the Week 1 service spec's schema table, plus an `id` rich-text
   property (used internally for upsert de-duplication — not part of the
   original spec schema). Create a Notion integration, share the database with
   it, grab the API key and database ID.

5. **Set GitHub Actions secrets/variables** on the repo once it's pushed:
   - Secrets: `TENKI_API_KEY`, `TENKI_AUTH_VOLUME_ID`, `NEBIUS_API_KEY`,
     `NOTION_API_KEY`, `NOTION_DATABASE_ID`
   - Variables: `TENKI_IMAGE` (e.g. `myworkspace/fde-intake-worker:latest`),
     `X_POST_URL`, `LINKEDIN_POST_URL`

## Local test run

```bash
cp .env.example .env   # fill in values, storageState paths point at ./secrets/
npm run dev
```

## Known limitations (see DECISIONS.md for the full reasoning)

- LinkedIn's comment DOM selectors in `collect.ts` are best-effort and likely
  need adjustment against a live post — LinkedIn's class names shift more
  than X's `data-testid` attributes do.
- LinkedIn has no confirmed cheap fallback if the test account gets rate
  limited or blocked there. X falls back to the official API in that case;
  LinkedIn does not.
- The GitHub Actions workflow's session-ID resolution (tag + `list --json`)
  is not yet verified against a live `tenki` CLI run — flagged inline in
  `refresh.yml`.
- `public_engagement_count` for LinkedIn replies is hardcoded to 0 — not
  reliably exposed per-comment in the DOM.
