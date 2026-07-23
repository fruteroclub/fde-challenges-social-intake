# Collection design

Supports: README Step 9 and `src/collect.ts`. Why Playwright directly instead
of the gstack `/browse` tooling, how X and LinkedIn are actually scraped, and
what's most likely to break first.

## Why plain Playwright, not gstack `/browse`

Frutero's own tooling already includes a headless-browser skill
(`gstack`'s `/browse`), and it was the first thing tried when researching this
project's own Tenki/Nebius docs. It was explicitly rejected for the *worker*
itself: `/browse` runs as a persistent daemon with its own CLI, session state,
and telemetry — infrastructure built for QA/dogfooding a browser session
across many commands, not for a minimal, disposable microVM that boots, does
one job, and disappears. Installing that daemon into every ephemeral Tenki
session would undercut the entire "cheap, cost-efficient" framing this
project is built around.

Plain Playwright (`chromium.launch()`, a `BrowserContext`, a `Page`) does
exactly what's needed — load a `storageState`, navigate, read the DOM — with
nothing extra to install or run in the background. It's also officially
supported inside a Tenki Sandbox session: Playwright is one of the tools
explicitly called out as installable via the base image's `sudo apt`/`pip`/
`npm` access (see
[`tenki-sandbox-fundamentals.md`](tenki-sandbox-fundamentals.md)).

## Why a specific post URL, not search or a listening tool

Both `collectXReplies` and `collectLinkedInReplies` take one post URL and read
its reply thread — deliberately not a search query or a general "monitor this
account" tool. That scope match matters for two reasons: it's the only thing
the Week 1 spec actually asks for (replies to *the* launch post), and it's the
narrowest, lowest-exposure thing to do with an authenticated automated
session — see
[`auth-strategy-and-platform-tos.md`](auth-strategy-and-platform-tos.md) for
why that scope discipline is load-bearing, not incidental.

## X: `data-testid` attributes are the stable hook

X's reply-thread DOM exposes `data-testid` attributes
(`article`, `[data-testid="User-Name"]`, `[data-testid="tweetText"]`,
`[data-testid="like"]`) that are more stable across frontend redesigns than
CSS class names, since they're clearly intended as test/automation hooks. The
first `article` element on a post's detail page is the original post; every
`article` after it is a reply — that ordering assumption is what
`collectXReplies` relies on.

Engagement counts come back as display strings (`"1.2K"`, `"483"`) that
`parseEngagementCount` normalizes to a plain integer, including the `K`/`M`
suffix multiplication X uses for large numbers.

## LinkedIn: this is the fragile part

LinkedIn's comment DOM uses class names (`.comments-comment-item`,
`.comments-post-meta__name`, etc.) that shift more often than X's
`data-testid` attributes — these were written from general knowledge of
LinkedIn's markup patterns, **not verified against a live post** as of this
writing. If Step 9 or the video's Segment 8/10 shows zero LinkedIn replies
where you expect some, this is the first place to check: open devtools on a
real LinkedIn post, inspect the actual comment element structure, and update
the selectors in `collect.ts` to match.

`public_engagement_count` for LinkedIn is hardcoded to `0` for the same
reason — per-comment reaction counts aren't reliably exposed in LinkedIn's
comment DOM the way X exposes like counts on a tweet article.

## What to do when a selector breaks

This isn't a one-time fix-and-forget problem — both platforms redesign their
frontends periodically, and any DOM-based selector will eventually drift.
The pattern for fixing it: open the live post in a real browser, inspect the
element, find a stable-looking attribute (prefer `data-testid`, `aria-*`, or
`role` over class names, which churn more), update the corresponding
`.locator(...)` call in `collect.ts`, and re-run Step 9 to confirm.

## Sources

- Playwright locators guide: https://playwright.dev/docs/locators
- The login-wall findings this design responds to are documented in
  [`../../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md`](../../../workstreams/fde-challenges-social-intake/docs/week-1-implementation-plan.md)
  under "Confirmed risks."
