# Tenki template — fde-intake-worker

Pre-bakes Chromium + its system deps (the slow, apt-heavy part of a Playwright
install) so each worker session skips the cold-install tax. The app code
itself is *not* baked in here — it's shipped fresh on every run by the GitHub
Actions workflow (`.github/workflows/refresh.yml`), so the template only needs
to change when the browser/runtime version changes, not on every code change.

Commands below use the real `tenki` CLI syntax from
[the Templates doc](https://tenki.cloud/docs/sandbox/templates) and
[CLI reference](https://tenki.cloud/docs/sandbox/cli). Find `<your-workspace>`
with `tenki status`.

## Build once

```bash
tenki sandbox template create \
  --name fde-intake-worker \
  --setup-script "$(cat setup-script.sh)" \
  --tags fde-challenges-social-intake

tenki sandbox template build <template-id> --wait

tenki sandbox registry publish \
  --image <your-workspace>/fde-intake-worker:latest \
  --from-template <template-id> \
  --visibility private
```

## Rebuild after changing setup-script.sh (e.g. bumping the Playwright version)

```bash
tenki sandbox template update <template-id> --setup-script "$(cat setup-script.sh)"
tenki sandbox template build <template-id> --wait
tenki sandbox registry publish \
  --image <your-workspace>/fde-intake-worker:latest \
  --from-template <template-id> \
  --visibility private
```

The published `<your-workspace>/fde-intake-worker:latest` reference is what
`TENKI_IMAGE` should be set to in the GitHub Actions workflow's repo variables.

## One-time: create the auth-state volume

The worker needs the authenticated `storageState.json` files captured by
`npm run capture-auth` (see the top-level README) mounted read-only. Create
the volume once, then write the captured files into it via a throwaway
session:

```bash
tenki sandbox volume create --workspace <your-workspace> --name fde-auth-state --size 1GB

# Attach read-write once to seed it
tenki sandbox create --name fde-auth-seed --volume <volume-id>:/workspace/secrets
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/x.storageState.json --data-file ../secrets/x.storageState.json
tenki sandbox write --session <seed-session-id> --path /workspace/secrets/linkedin.storageState.json --data-file ../secrets/linkedin.storageState.json
tenki sandbox terminate --session <seed-session-id>
```

The volume's ID becomes `TENKI_AUTH_VOLUME_ID` in the GitHub Actions
workflow's secrets, mounted `:ro` on every worker run.
