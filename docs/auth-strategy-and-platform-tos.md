# Auth strategy and platform ToS

Supports: README Step 5. Why collection needs an authenticated session at
all, why it's a test/burner account, and what "automated" actually means
here.

## The logged-out reality (confirmed, not assumed)

On 2026-07-22, before writing any collection code, this was checked directly
against live posts:

- **X**: a specific post's detail page
  (`x.com/TenkiCloud/status/2077122118215774461`) renders only a
  `Read 1 reply` teaser when logged out — no reply text, no author handle, no
  data at all.
- **LinkedIn**: a company posts page
  (`linkedin.com/company/tenki-cloud/posts/`) redirects immediately to an
  authwall (HTTP 999) — zero content, not even a teaser.

So an authenticated session isn't a nice-to-have for better data quality —
without one, this pipeline collects nothing.

## Why a test/burner account, not the real brand accounts

Both platforms' terms generally restrict automated access to what their
official APIs provide. Running a *recurring, automated* worker logged into an
account carries meaningfully more exposure than a one-off manual check — the
kind of thing that can get an account rate-limited or suspended. Frutero and
Dabl's real X/LinkedIn accounts are the ones that actually matter for the
launch and shouldn't carry that exposure.

A dedicated test account isolates that risk. If it gets limited or banned,
nothing about the brand's real presence is affected — worst case, collection
pauses until a fallback is wired up (see below).

This is an accepted risk, not an eliminated one. The scope stays narrow —
reading replies on Frutero/Dabl's own launch post only, at low volume — which
is a materially different risk profile than broad scraping or third-party
content collection, but it's still outside what either platform's terms
technically permit for automated access.

## What "automated" actually means in this build

There's a meaningful difference between "the script logs in automatically"
and "a human logs in once, the script reuses that session." This project does
the second, deliberately:

`src/capture-auth-state.ts` opens a real, visible Chromium window and waits —
it never touches the login form, never submits credentials, never solves a
CAPTCHA programmatically. A human logs in, by hand, as the test account. Only
*after* that, the script calls Playwright's `context.storageState()` to save
the resulting cookies/session to disk. Every automated run afterward — inside
the Tenki Sandbox, on a schedule — loads that pre-existing session rather than
performing a login.

This doesn't eliminate the ToS exposure (the account is still being used by
automation to read content, repeatedly, on a schedule), but it does mean the
higher-risk action — the login itself, the part most likely to trip bot
detection or violate an explicit "no automated login" clause — is the one part
a human actually does.

## Fallback plan if the test account gets blocked

- **X**: fall back to the official X API for collection.
- **LinkedIn**: no equivalent cheap fallback identified. Official LinkedIn API
  access for this kind of read requires a paid/partner tier. If the test
  account gets blocked on LinkedIn specifically, Week 1 scope may need to drop
  LinkedIn collection or fall back to manual capture for that platform. This
  is a known, open gap — not solved, flagged deliberately instead of papered
  over.

## Sources

- The reasoning above traces to two decisions in
  [`../../../workstreams/fde-challenges-social-intake/DECISIONS.md`](../../../workstreams/fde-challenges-social-intake/DECISIONS.md):
  "Week 1 spec's open implementation choices resolved" and "Login-wall risk
  confirmed; collection uses a test/burner account."
- Playwright's `storageState`/authentication guide:
  https://playwright.dev/docs/auth — also explicitly warns that a
  `storageState` file "may contain sensitive cookies and headers that could
  be used to impersonate you" and recommends never committing it, which is
  why `*.storageState.json` and `secrets/` are gitignored in this repo.
