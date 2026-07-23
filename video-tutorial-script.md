# Video Tutorial Script: Week 1 - FDE Challenges Social Intake (Tenki Sandbox + Nebius Token Factory)

## Recording Target

Target edited runtime: 18-22 minutes. This has more moving parts than the
Nebius Webinar 1 script (Tenki + Nebius Token Factory + Notion + GitHub
Actions vs. a single cloud VM), so expect more to cut in editing, not less.

This should feel like a guided build, not a command-reading session. The
companion docs for exact copy-paste blocks are
[`README.md`](README.md), [`template/README.md`](template/README.md), and
[`../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md`](../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md).

## Important: this has not been dry-run tested yet

Unlike the Nebius Webinar 1 script (written after a validated dry run), **this
recording is the first real end-to-end test of this pipeline.** Two segments
are flagged below as likely to need live debugging:

- **LinkedIn's comment selectors** (Segment 8) — best-effort CSS selectors
  that were never checked against a live post.
- **The GitHub Actions session-ID lookup** (Segment 11) — inferred from Tenki's
  docs, not verified against a real CLI response.

That's fine content, not a failure to hide. "Here's what broke and how I
figured it out" is exactly the FDE-relevant material this series is for. Don't
pre-script a fake success for these two — narrate the actual debugging live.

## Participant Outcome

By the end of the video, the viewer has seen:

- The Tenki CLI installed, authenticated, and a first sandbox created and
  torn down (the "hello world" from Tenki's own quickstart).
- A published Tenki Sandbox template with Chromium pre-baked.
- A persistent volume holding an authenticated test-account session, reused
  across ephemeral worker runs.
- Why the collection account is a dedicated test/burner account, not
  Frutero's or Dabl's real accounts.
- A Notion `FDE Challenges` database receiving real, structured rows scored
  by Nebius Token Factory.
- The worker running once locally, then once via a GitHub Actions
  cron-triggered sandbox — the actual "launch sandboxes as workers" pattern
  this series exists to teach.
- A clear "as an FDE would use it" framing: disposable, cost-efficient,
  scoped to one real workflow — not a throwaway dev box.

## Recording Rule

- Never show the Tenki API key, Nebius API key, Notion API key, or the test
  account's real login on screen.
- Say out loud, on camera, that this uses a dedicated test/burner account and
  why (isolates ToS/account-suspension risk from the brand accounts) — this is
  a real decision worth explaining, not just a disclaimer.
- Terminate every Tenki sandbox session shown before ending the recording —
  billing is per-second, but a forgotten `--sticky` session is still a real
  cost.
- When a command takes longer than 20-30 seconds (template build, Playwright
  system-dep install), pause recording or speed-ramp in editing.

## Timeline

| Time | Segment | Main Screen | Teaching Goal |
| --- | --- | --- | --- |
| 0:00-1:00 | Open | Camera / README | What Week 1 is and where it stops |
| 1:00-3:00 | Architecture | Diagram | Tenki Sandbox vs. Nebius Token Factory vs. Notion, and why a recurring worker |
| 3:00-4:00 | Tenki CLI install + login | Terminal | Authenticate and confirm workspace |
| 4:00-6:00 | Sandbox quickstart | Terminal | Ground the primitive: create, exec, terminate |
| 6:00-9:00 | Build the Template | Terminal + template/README.md | Bake Chromium once so workers skip cold install |
| 9:00-11:00 | Persistent Volume | Terminal | Durable auth state across disposable workers |
| 11:00-13:30 | Capture test-account session | Browser + terminal | Human logs in by hand; script only saves the session |
| 13:30-14:30 | Seed the volume | Terminal | Get the storageState files into Tenki |
| 14:30-16:00 | Notion + Nebius setup | Browser + terminal | Database schema, integration, API key |
| 16:00-18:30 | Run the worker locally | Terminal | Collection -> extraction -> Notion, live, whatever happens |
| 18:30-20:30 | Wire GitHub Actions + trigger | Browser + terminal | The actual scheduled-worker pattern |
| 20:30-21:30 | Show Notion results | Browser | The payoff: real scored challenge candidates |
| 21:30-22:30 | Wrap + recap + CTA | Camera | Cost recap, what's next, reply to the launch post |

If running long, cut Segment 4 (quickstart) to a voiceover-only recap and skip
straight to the real template build — the quickstart is nice-to-have grounding,
not essential once the architecture segment has explained it.

## Architecture Diagram

Show this early, then return to it before the wrap.

```mermaid
flowchart LR
  gha["GitHub Actions<br/>schedule: cron"]
  tenki["Tenki Sandbox<br/>ephemeral microVM"]
  tpl["Template<br/>Chromium pre-baked"]
  vol["Persistent Volume<br/>auth storageState (read-only)"]
  post["X / LinkedIn<br/>launch post replies"]
  tf["Nebius Token Factory<br/>Nemotron model"]
  notion["Notion<br/>FDE Challenges DB"]

  gha -->|"tenki sandbox create --image"| tenki
  tpl -.->|"published image"| tenki
  vol -->|"mounted :ro"| tenki
  tenki -->|"Playwright, authenticated"| post
  tenki -->|"extract + score"| tf
  tenki -->|"upsert rows"| notion
  tenki -->|"terminate"| gha
```

Narration:

"Four things stay separate. GitHub Actions is just the clock — it fires on a
schedule and does nothing else. Tenki Sandbox is the disposable compute — it
boots from a template that already has Chromium installed, does the work, and
disappears. Nebius Token Factory is where the actual language model call
happens. Notion is where the results land for a human to review. None of these run
all the time. That's the whole point."

## Pre-Recording Checklist

Open these tabs before recording:

- This repo's [`README.md`](README.md) and [`template/README.md`](template/README.md)
- Tenki Sandbox quickstart: https://tenki.cloud/docs/sandbox/quick-start-sandbox
- Tenki Templates docs: https://tenki.cloud/docs/sandbox/templates
- Tenki Persistent Volumes docs: https://tenki.cloud/docs/sandbox/volumes
- Nebius Token Factory console: https://tokenfactory.nebius.com
- Notion (a workspace you can create a test database in)
- The actual Dabl/Frutero launch post URL(s) — if the launch hasn't happened
  yet, use any real public post you're comfortable showing, and say so on
  camera ("we don't have a live launch post yet, so I'm testing against
  this one instead")

Terminal prep:

- One local terminal for `tenki` CLI and `npm` commands.
- A browser window for the test/burner account login (Segment 7) — keep this
  window framed so the login form doesn't show the actual password being typed.

## Segment 1: Open

Target time: 0:00-1:00

Narration:

"This is Week 1 of the Dabl Club and Frutero forward-deployed-series. The
challenge: Dabl and Frutero post publicly on X and LinkedIn asking builders for
real business problems that need an AI or tech solution. We need a way to
collect those replies, filter out the noise, and turn the real ones into a
scored, shortlist-ready backlog — without running a server 24/7 for what's
really an occasional job."

"Today we build that as a worker that spins up a disposable Tenki Sandbox on a
schedule, reads the replies, calls a model through Nebius Token Factory to
extract the structured fields, and writes the results into Notion. Then it
shuts itself down."

Learning beat:

- This is a public prototype, not production social listening — scoped to
  replies on one specific post.
- The point isn't just "scrape social media" — it's "run a specific,
  cost-efficient workflow the way an FDE actually would."

## Segment 2: Architecture

Target time: 1:00-3:00

Screen: the architecture diagram above.

Narration:

"GitHub Actions is only a clock. Tenki Sandbox is where the work actually
happens, in a microVM that gets destroyed right after. Nebius Token Factory is
an OpenAI-compatible inference endpoint — we're reusing the exact same
Nemotron model setup from the Nebius webinar series, so if you've seen that,
this will look familiar."

"Notion is the database a human reviews. And there's one more piece not in
this diagram yet: a Persistent Volume holding an authenticated browser
session, because — and this is worth explaining — X and LinkedIn don't show
you replies to a post unless you're logged in. We tested that before this
recording."

Learning beat:

- Confirmed live (2026-07-22): a specific X post's reply thread shows only a
  `Read N reply` teaser logged out; LinkedIn redirects straight to an
  authwall. Say this on camera with the actual URLs tested, it's a good,
  concrete "here's what we found out" beat.

## Segment 3: Install and Authenticate the Tenki CLI

Target time: 3:00-4:00

Run locally:

```bash
curl -fsSL https://tenki.cloud/install.sh | bash
tenki login
tenki status
```

Narration:

"`tenki login` opens a browser sign-in and picks a workspace automatically.
`tenki status` confirms it and shows the workspace — we'll need that ID for
everything downstream."

Learning beat:

- Note the workspace name/ID on screen (not sensitive, fine to show) — call it
  out verbally since every following command references it.

## Segment 4: Sandbox Quickstart

Target time: 4:00-6:00

Run locally:

```bash
tenki sandbox create --name demo
tenki sandbox set <session-id>
tenki sandbox exec -c 'uname -a && whoami'
tenki sandbox terminate
```

Narration:

"Before building the real thing, here's the primitive in its simplest form.
This is a disposable Linux microVM — sub-2-second boot, billed per second.
`create` boots it, `exec` runs a command inside it, `terminate` tears it down.
Everything after this is the same three verbs, just wired to our actual
workflow instead of `uname -a`."

Learning beat:

- This is literally Tenki's own quickstart — worth saying so, it's the
  cheapest way to build trust that the tool does what it claims before
  layering complexity on top.

## Segment 5: Build the Template

Target time: 6:00-9:00

Screen: `template/README.md` and `template/setup-script.sh`.

Run locally:

```bash
cat template/setup-script.sh
```

Narration:

"This setup script installs Playwright and its Chromium browser once, at
build time, not on every worker run. Without this, every sandbox session would
spend a minute or two downloading and installing the browser before doing any
real work — for a job that itself only takes a few seconds. The template is
where that cost gets paid exactly once."

Run locally:

```bash
tenki sandbox template create \
  --name fde-intake-worker \
  --setup-script "$(cat template/setup-script.sh)" \
  --tags fde-challenges-social-intake

tenki sandbox template build <template-id> --wait
```

Cut note: the build takes a few minutes (apt installs + browser download) —
speed-ramp this in editing.

```bash
tenki sandbox registry publish \
  --image <your-workspace>/fde-intake-worker:latest \
  --from-template <template-id> \
  --visibility private
```

Narration:

"Publishing gives it a reference — `<workspace>/fde-intake-worker:latest` —
that any session can boot from afterward with zero install step."

Learning beat:

- Note the Playwright version pin in `setup-script.sh` and `package.json`
  match (`1.61.1`) — call out why: the cached browser revision has to match
  what the bundled `node_modules/playwright` expects at run time.
- If you change this script later, `template update` + `template build --wait`
  + `registry publish` again — versioned, not silently mutated.

## Segment 6: Persistent Volume

Target time: 9:00-11:00

Run locally:

```bash
tenki sandbox volume create --workspace <your-workspace> --name fde-auth-state --size 1GB
```

Narration:

"Sandboxes are disposable — nothing on their filesystem survives termination.
But we don't want to log in every single run. A Persistent Volume is
workspace-scoped storage that outlives any one session, so we log in once,
save that to the volume, and every worker run afterward mounts it read-only."

Learning beat:

- This is the same primitive Tenki recommends for package caches / build
  caches — we're using it for durable auth state instead, which is a slightly
  unusual but legitimate use of the same tool.

## Segment 7: Capture the Test-Account Session

Target time: 11:00-13:30

Run locally:

```bash
npm install
npm run capture-auth -- x ./secrets/x.storageState.json
```

Narration, before running:

"This next part matters: I'm using a dedicated test account here, not
Frutero's or Dabl's real X account. Both platforms' terms generally restrict
automated access outside their official APIs, and a recurring automated
worker carries more risk than a one-off check. Using a burner account keeps
that risk away from the accounts that actually matter for the launch."

"This script opens a real, visible browser window. I log in by hand, like a
person — the script doesn't touch the login form at all. It only saves the
resulting session afterward, so everything automated from here on reuses a
session a human actually created."

Screen action: frame the browser window so the login form's password field
isn't legible on camera. Log in. Return to the terminal, press Enter.

Repeat for LinkedIn:

```bash
npm run capture-auth -- linkedin ./secrets/linkedin.storageState.json
```

Learning beat:

- This distinction — a human logs in, automation only reuses the session — is
  worth stating explicitly. It's the difference between "automating a login"
  (higher risk, more clearly against most platforms' terms) and "reusing a
  session a human created" (lower risk, still not risk-free).

## Segment 8: Seed the Volume

Target time: 13:30-14:30

Run locally:

```bash
tenki sandbox create --name fde-auth-seed --volume <volume-id>:/workspace/secrets
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/x.storageState.json --data-file ./secrets/x.storageState.json
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/linkedin.storageState.json --data-file ./secrets/linkedin.storageState.json
tenki sandbox terminate --session <seed-session-id>
```

Narration:

"One throwaway session, mounted read-write just this once, to get the two
session files onto the volume. Every worker session after this mounts the same
volume read-only."

**Flag for live debugging:** the LinkedIn comment selectors in `src/collect.ts`
were written from general knowledge of LinkedIn's DOM, not verified against a
live post. If this segment or the next one shows zero LinkedIn replies where
you expect some, that's the selectors needing a real fix, not the architecture
being wrong — a good, honest moment to show devtools and find the real
selector live.

## Segment 9: Notion and Nebius Setup

Target time: 14:30-16:00

Screen: Notion, then Nebius Token Factory console.

Narration:

"The `FDE Challenges` database schema is in the Week 1 service spec — I'm
creating it directly in Notion now, plus one extra `id` field the code uses
internally to avoid duplicate rows on re-runs."

Create the Notion database and integration, share it with the integration,
copy the API key and database ID.

```bash
# Nebius Token Factory key — same setup as the nebius webinar series
export NEBIUS_API_KEY=...   # from https://tokenfactory.nebius.com
```

Learning beat:

- Point out this is the exact same Token Factory pattern from the Nebius
  webinar series — same endpoint, same model choice — reused rather than
  re-derived. Worth a quick "if you've seen that series, this is familiar"
  callout.

## Segment 10: Run the Worker Locally

Target time: 16:00-18:30

Run locally:

```bash
cp .env.example .env
# fill in NEBIUS_API_KEY, NOTION_API_KEY, NOTION_DATABASE_ID,
# X_POST_URL and/or LINKEDIN_POST_URL,
# X_STORAGE_STATE_PATH / LINKEDIN_STORAGE_STATE_PATH -> ./secrets/*.json

npm run dev
```

Narration:

"This is the real test. Whatever happens here — replies collected, extracted,
scored, and landing in Notion, or an error we have to chase down — that's the
actual content. Don't cut around a failure here; show the fix."

Learning beat:

- This is the first true end-to-end run of this pipeline. Treat whatever
  happens as the payoff moment of the video, not a scripted beat.

## Segment 11: Wire GitHub Actions and Trigger

Target time: 18:30-20:30

Screen: https://github.com/fruteroclub/fde-challenges-social-intake settings
(secrets/variables), then the Actions tab.

Set:

- Secrets: `TENKI_API_KEY`, `TENKI_AUTH_VOLUME_ID`, `NEBIUS_API_KEY`,
  `NOTION_API_KEY`, `NOTION_DATABASE_ID`
- Variables: `TENKI_IMAGE` (e.g. `<your-workspace>/fde-intake-worker:latest`),
  `X_POST_URL`, `LINKEDIN_POST_URL`

Trigger manually instead of waiting for the cron:

```bash
gh workflow run refresh.yml
gh run watch
```

**Flag for live debugging:** `.github/workflows/refresh.yml` resolves the
sandbox session ID by tagging the session and reading it back via
`tenki sandbox list --json` — this was written from the CLI reference docs,
not verified against a real response. If the `jq` filter comes back empty,
that's the moment to run `tenki sandbox list --json | jq .` plain, look at the
actual field names, and fix the filter on camera.

Narration:

"This is the actual lesson of Week 1: a scheduled trigger that costs nothing
between runs, spinning up a sandbox that costs fractions of a cent per run,
doing one real job, and disappearing."

## Segment 12: Show the Results

Target time: 20:30-21:30

Screen: the Notion database, populated.

Narration:

"Here's what landed: each row is one reply, scored for feasibility and public
build value, with a filter status. Anything needing clarification stays out
of the shortlist for Week 1 — we're not building a back-and-forth
clarification loop yet, just filtering it out cleanly."

## Segment 13: Wrap, Recap, CTA

Target time: 21:30-22:30

Narration:

"Recap: a Tenki template with Chromium baked in, a persistent volume holding
an authenticated session, a scheduled GitHub Actions trigger spinning up
disposable workers, Nebius Token Factory doing the extraction, and Notion as
the human review surface. Total compute cost for a run: fractions of a cent —
Tenki's small instance is $0.17 an hour, and each run lasts a couple of
minutes at most."

"If you've got a real business or client workflow that needs an AI or tech
solution, reply to the launch post on X or LinkedIn — that's genuinely how
this pipeline finds its next challenge."

## Editing Notes

- Keep the edited video under 22 minutes; cut waiting time from template
  build, `npx playwright install --with-deps`, and any package installs.
- If Segments 8 or 11 turn into extended live-debugging, that's fine to keep
  in — it's the most honest FDE content in the video — but trim to the
  actual fix, not every dead end.
- Mask all API keys, the test account's password field, and any real personal
  info from the actual launch post repliers (anonymize per the spec's public
  safety scoring before showing real submitter text on screen, if the launch
  has already happened by recording time).
- Keep the architecture diagram visible early and briefly return to it in the
  wrap.

## Readiness Verdict

This script is ready to record from, but unlike the Nebius Webinar 1 script,
it has **not** been validated by a prior dry run. Segments 8 and 11 are named
explicitly as likely debugging moments. Budget real time for them rather than
assuming the raw recording matches the timeline above — a first live run of a
new pipeline typically runs long, and that's fine to cut down in editing.
