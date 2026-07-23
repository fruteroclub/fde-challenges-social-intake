# Recurring trigger design

Supports: README Step 10 and `.github/workflows/refresh.yml`. Why GitHub
Actions cron and not Tenki Runners, and the one part of this workflow that's
still unverified.

## Why this needs a recurring trigger at all

The Week 1 decision was to make engagement-count refresh recurring rather
than a one-time manual snapshot — not because the data strictly demands it,
but because this is the actual teaching point of the series: launching Tenki
Sandboxes programmatically as scheduled workers, not just as one-off manual
sessions. See "Week 1 spec's open implementation choices resolved" in
[`../../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../../workstreams/fde-challenges-social-intake/DECISIONS.md).

## Why GitHub Actions `schedule: cron`, not Tenki Runners

Tenki sells two separate products that are easy to conflate: **Tenki
Runners** and **Tenki Sandbox**. Runners is a drop-in replacement for
GitHub-hosted CI runners — you still use GitHub Actions' own `schedule: cron`
trigger, Runners just changes *where* that job's compute executes
(`runs-on: tenki-standard-*` instead of `ubuntu-latest`), and it requires
connecting the GitHub org to a Tenki workspace (one workspace, one org).

The trigger job in `refresh.yml` does almost nothing computationally — it
builds the worker bundle, then makes a handful of `tenki` CLI calls
(`create`, `write`, `exec`, `terminate`). There's no build workload here for
Tenki Runners' bare-metal performance/cost advantage to apply to; GitHub's
free hosted-runner tier handles it fine. So this workflow runs on
`ubuntu-latest`, and Tenki Runners is deliberately not used — see "Recurring
trigger uses GitHub Actions cron, not Tenki Runners" in the same DECISIONS.md
for the full reasoning.

## What the workflow actually does

1. Checks out the repo, builds it (`npm run build`), then bundles the
   production `dist/` + `node_modules` (installed with `--omit=dev`) into a
   single tarball — because Tenki's `write` command moves individual files
   into a session, not directories, so bundling is the simplest way to get a
   built app onto a fresh sandbox.
2. Installs the Tenki CLI, authenticates with `TENKI_API_KEY`.
3. Creates a sandbox session from the published template image
   (`TENKI_IMAGE`), with the auth-state volume mounted `:ro` and all the
   worker's required env vars passed via `--env`.
4. Writes the bundle into the session, extracts it, runs the worker
   (`node dist/index.js`), then terminates the session.

## The unverified part: resolving the session ID

Tenki's `sandbox create` CLI command doesn't document a `--json` flag in the
CLI reference (`list`, `get`, and a few others do). Rather than guess at
`create`'s exact stdout format, the workflow tags the session with a unique
value (`gha-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`) and resolves its ID
afterward via `tenki sandbox list --json | jq`, filtering on that tag.

This is built entirely from documented, real commands (`create --tags`,
`list --json`), but the exact JSON field names it assumes — `.id` and
`.tags` — were inferred from context, not confirmed against a real
`tenki sandbox list --json` response. **Before trusting this in production
CI**, run `tenki sandbox list --json | jq .` once by hand and confirm those
field names actually match; if they don't, `refresh.yml`'s `jq` filter needs
a one-line fix.

## Sources

- Tenki CLI reference (session lifecycle, `--json`, `--tags`, `--env`,
  `--volume`): https://tenki.cloud/docs/sandbox/cli
- Tenki Runners quickstart (confirms it's a `runs-on:` swap, requires the
  GitHub App + org connection): https://tenki.cloud/docs/runners/quick-start-runners
- GitHub Actions scheduled events: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
