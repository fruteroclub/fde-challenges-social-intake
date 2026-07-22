// Run locally, not in the sandbox. Opens a real, visible browser window for
// a human to log in as the test/burner account by hand — this script never
// automates the login itself, only saves the resulting session so later
// automated runs can reuse it without re-authenticating.
//
// Usage: npm run capture-auth -- x ./secrets/x.storageState.json
import readline from "node:readline/promises";
import { chromium } from "playwright";

async function main() {
  const [, , platform, outPath] = process.argv;
  if ((platform !== "x" && platform !== "linkedin") || !outPath) {
    console.error("Usage: npm run capture-auth -- <x|linkedin> <output-path>");
    process.exit(1);
  }

  const startUrl = platform === "x" ? "https://x.com/login" : "https://www.linkedin.com/login";

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(startUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(
    `Log in as the ${platform} test/burner account in the opened window, then press Enter here...`,
  );
  rl.close();

  await context.storageState({ path: outPath });
  console.log(`Saved authenticated session to ${outPath}`);

  await browser.close();
}

main();
