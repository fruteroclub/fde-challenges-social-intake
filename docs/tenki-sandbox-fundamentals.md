# Tenki Sandbox fundamentals

Supports: README Steps 1-4. Deeper context on the three Tenki primitives this
project uses — sessions, templates, and persistent volumes — and why each one
was chosen the way it was.

## What a session actually is

A Tenki Sandbox session is a disposable Linux microVM: Ubuntu 24.04, boots in
under 2 seconds, billed per second while it's running. Nothing on its
filesystem survives termination — that's the whole point. It exists to run
one job and disappear, which is why the base image ships Python 3.12, Node
24, and common CLI tools out of the box, but *not* Playwright's Chromium —
that's a per-project addition, not something every session needs.

Three verbs cover almost everything: `create`, `exec`, `terminate`. Everything
this project does is those three verbs wired to a real pipeline instead of
`uname -a`.

## Templates

A template solves one specific problem: without it, every worker session
would spend a minute or two downloading and installing Chromium's system
dependencies before doing any real work — for a job that itself takes only a
few seconds. That install cost doesn't belong on every run; it belongs exactly
once, at build time.

The lifecycle is: **define** (a setup script + optional start command) ->
**build** (Tenki runs the script once and captures a snapshot) -> **publish**
(gives it a versioned registry reference, `<workspace>/<name>:<tag>`) ->
**create** (any session can boot from that reference with zero install step).

This project's template (`template/setup-script.sh`) only installs Playwright
+ Chromium — deliberately minimal. The actual worker code is *not* baked into
the template; it's shipped fresh on every GitHub Actions run instead (see
[`recurring-trigger-design.md`](recurring-trigger-design.md)). That split
matters: the template only needs rebuilding when the browser/runtime version
changes, not on every code change.

One coupling to watch: the Playwright version pinned in the template's
`setup-script.sh` (`npm install -g playwright@1.61.1`) has to match the
version in `package.json` — the cached Chromium revision baked into the
template needs to line up with what the bundled `node_modules/playwright`
expects at run time. Bump both together.

## Persistent Volumes

Volumes are workspace-scoped block storage that survives session termination
— the opposite of a session's own disk. Tenki's own docs frame them as build
caches and package caches; this project uses the same primitive for something
slightly different: durable auth state. The authenticated browser session
captured in Step 5 needs to exist somewhere a disposable worker can read it
without re-logging-in every run, and a volume is exactly that "durable data
that isn't code" slot.

Mounted `:ro` (read-only) on every worker session, `:rw` only during the
one-time seed step (Step 6) — the worker never needs to write to it, so it
doesn't get write access.

## Sources

- Quickstart: https://tenki.cloud/docs/sandbox/quick-start-sandbox
- Base image (what ships by default): https://tenki.cloud/docs/sandbox/base-image
- Templates: https://tenki.cloud/docs/sandbox/templates
- Persistent Volumes: https://tenki.cloud/docs/sandbox/volumes
- CLI reference: https://tenki.cloud/docs/sandbox/cli
