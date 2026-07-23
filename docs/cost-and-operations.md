# Cost and operations

Supports: README's cost model section. The actual per-run cost, why the
refresh cadence is conservative, and what "as an FDE would use it" means in
practice.

## Tenki Sandbox pricing

Tenki bills sessions per second, not per hour — you only pay while a session
is actually running. Published hourly-equivalent rates by instance size:

| Instance | vCPU / RAM | Rate |
|---|---|---|
| Nano | — | $0.08/hr |
| Small (default) | 2 vCPU / 4 GiB | $0.17/hr |
| Medium | — | $0.33/hr |
| Large | — | $0.66/hr |
| XLarge | — | $1.32/hr |

This project uses the default Small instance. A worker run — boot from
template (already has Chromium installed, so no install wait), scrape a
handful of replies, call Token Factory once per reply, upsert to Notion,
terminate — takes on the order of a couple of minutes. At $0.17/hr, two
minutes costs roughly $0.0057 — fractions of a cent, exactly the "cheap,
disposable, run-a-specific-workflow" framing this series is built around,
not a fixed-cost server running 24/7 for an occasional job.

## Why the refresh cadence starts at every 6 hours

`refresh.yml`'s cron (`0 */6 * * *`) is deliberately conservative, for two
independent reasons:

1. **Notion API rate limits.** Every worker run queries Notion once per
   collected reply to check for an existing row (the upsert lookup in
   `notion.ts`), plus a create-or-update call. Running that on a tight
   interval (every few minutes) risks hitting Notion's per-integration rate
   limits for no real benefit — the underlying data (social replies,
   engagement counts) doesn't change fast enough to justify it.
2. **This hasn't been dry-run tested end to end yet.** Starting conservative
   and tightening the cadence later, once the pipeline has actually run
   successfully a few times, is a safer default than guessing at an
   aggressive interval up front.

Six hours is a starting point, not a fixed requirement — revisit once the
pipeline has run for real and you have a sense of how often engagement counts
meaningfully change.

## "As an FDE would use it," concretely

The distinction this project draws (see the original decision in
[`../../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../../workstreams/fde-challenges-social-intake/DECISIONS.md))
is between using Tenki Sandbox as a **throwaway dev/build box** — spin one up,
write code inside it, throw it away when done — versus using it as **the
execution environment for a specific, recurring, real workflow**. This
project does the second: the sandbox never holds source code permanently
(that lives in the GitHub repo and gets shipped fresh each run), never holds
long-lived state (that lives in the Notion database and the auth-state
volume), and only exists for the minutes it takes to do one real job.

That's also why the template only bakes in the browser dependency, not the
application code — see
[`tenki-sandbox-fundamentals.md`](tenki-sandbox-fundamentals.md#templates)
for why that split keeps the template stable while the actual pipeline logic
can change on every run.

## Sources

- Tenki pricing: https://tenki.cloud/docs/pricing — publishes the granular
  per-resource rates (`$0.000014/vCPU-sec`, `$0.0000045/GiB-sec` memory, 5 GiB
  storage free). Cross-checked: 2 vCPU + 4 GiB at those rates works out to
  ~$0.166/hr, matching the $0.17/hr Small-instance figure in `tenki.cloud/llms.txt`.
