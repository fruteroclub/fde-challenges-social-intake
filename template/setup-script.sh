#!/usr/bin/env bash
set -euo pipefail

# Pin to the same Playwright version as package.json ("playwright": "1.61.1",
# no caret) — the cached Chromium revision baked into this template has to
# match what the bundled node_modules/playwright expects at run time. Bump
# both together.
npm install -g playwright@1.61.1
npx playwright install --with-deps chromium
