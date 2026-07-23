# Tenki MCP fallback

This is the temporary execution path for the Week 1 video while `tenki` CLI
v1.0.0 cannot resolve a workspace/project after API-key login. It is not a
replacement for the CLI guide: it lets us complete the build, validate the
Sandbox API, and give Tenki DevRel a concrete reproduction and workaround.

It runs the community [`opencolin/tenki-mcp`](https://github.com/opencolin/tenki-mcp)
server as a local MCP subprocess. The source is pinned in the workflow to
commit `8278e81` (v2.0.0-alpha.0). Keep `TENKI_API_KEY` in your shell or GitHub
Actions secret; never put it in a config file or commit it.

## One-time local setup

```bash
git clone https://github.com/opencolin/tenki-mcp.git /tmp/tenki-mcp
git -C /tmp/tenki-mcp checkout 8278e81
npm --prefix /tmp/tenki-mcp ci
npm --prefix /tmp/tenki-mcp run build
npm ci

export TENKI_API_KEY=tk_your_api_key
export TENKI_MCP_SERVER=/tmp/tenki-mcp/dist/index.js
```

Run the smallest proof first. It calls `WhoAmI`, creates a disposable sandbox
with the resolved IDs, runs `uname -a` and `whoami`, then always terminates it.

```bash
npm run proof
```

## Provision the worker image

The MCP currently publishes an image from a running sandbox, not directly from
a Tenki Template. This alternate path creates a short-lived builder sandbox,
runs the existing `template/setup-script.sh`, publishes its disk privately,
then terminates it. The resulting worker image still has the same Playwright
and Chromium setup.

```bash
npm run provision-image -- --image <workspace>/fde-intake-worker:latest
```

That is the first concrete DevRel feedback: Template create/build tools exist,
but the MCP cannot pass a template as the source of `tenki_publish_image`.

## Persistent auth volume

Capture the dedicated test-account sessions through the main guide's Step 5,
then create and seed a volume. The state files contain live cookies: do not
print, commit, or upload them outside the encrypted Tenki volume.

```bash
npm run create-volume
# Copy the returned volumeId.
npm run seed-auth-volume -- \
  --volume <volume-id> \
  --x-state ../secrets/x.storageState.json \
  --linkedin-state ../secrets/linkedin.storageState.json
```

## Scheduled worker

`.github/workflows/refresh-mcp.yml` is the alternate Step 10 trigger. It
checks out this repository, builds the pinned MCP source, then runs
`src/run-worker.mjs`. That script creates a sandbox from `TENKI_IMAGE`, mounts
the auth volume read-only, clones the worker repository at `GITHUB_SHA`, runs
the worker, and terminates the session in `finally`.

Add the same secrets and variables described in the main guide. Enable its
schedule only after a manual `workflow_dispatch` succeeds. The workflow clones
the worker source in the sandbox because this MCP version transfers UTF-8 text
files only, not the existing `bundle.tar.gz` binary upload path.

## What to report back to Tenki

- API-key auth plus `WhoAmI` reliably supplies the missing workspace/project
  pair, so sandbox creation can proceed without CLI login state.
- MCP image publishing currently accepts a source sandbox, not a template ID.
- MCP file writes are text-only, so binary bundle uploads need an artifact
  transfer path or a source-clone alternative.

Delete this fallback once the official CLI accepts explicit scope or persists
scope correctly after `tenki login --api-key`.
