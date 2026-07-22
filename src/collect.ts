import { chromium, type BrowserContext, type Page } from "playwright";

export interface RawReply {
  platform: "x" | "linkedin";
  postUrl: string;
  authorHandle: string;
  text: string;
  timestamp: string | null;
  engagementCount: number;
  replyUrl: string | null;
}

async function withAuthenticatedPage<T>(
  storageStatePath: string,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    storageState: storageStatePath,
  });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

function parseEngagementCount(text: string): number {
  const match = text.match(/[\d.,]+[KkMm]?/);
  if (!match) return 0;
  let raw = match[0].replace(/,/g, "");
  let multiplier = 1;
  if (/[Kk]$/.test(raw)) {
    multiplier = 1_000;
    raw = raw.slice(0, -1);
  } else if (/[Mm]$/.test(raw)) {
    multiplier = 1_000_000;
    raw = raw.slice(0, -1);
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * multiplier) : 0;
}

// Scoped to a single post's reply thread only, not search or broad listening.
// Requires an authenticated storageState — confirmed 2026-07-22 that logged-out
// access shows only a "Read N reply" teaser with no actual content.
export async function collectXReplies(
  postUrl: string,
  storageStatePath: string,
): Promise<RawReply[]> {
  return withAuthenticatedPage(storageStatePath, async (page) => {
    await page.goto(postUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 15_000 });

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(800);
    }

    const articles = await page.locator("article").all();
    const replies: RawReply[] = [];

    // The first article is the original post; everything after it is a reply.
    for (const article of articles.slice(1)) {
      const authorHandle = await article
        .locator('[data-testid="User-Name"] a')
        .last()
        .innerText()
        .catch(() => "");
      const text = await article
        .locator('[data-testid="tweetText"]')
        .innerText()
        .catch(() => "");
      if (!text) continue;

      const timeEl = article.locator("time").first();
      const timestamp = await timeEl.getAttribute("datetime").catch(() => null);
      const replyLinkHref = await timeEl
        .locator("..")
        .getAttribute("href")
        .catch(() => null);
      const likeCountText = await article
        .locator('[data-testid="like"]')
        .innerText()
        .catch(() => "0");

      replies.push({
        platform: "x",
        postUrl,
        authorHandle: authorHandle.startsWith("@") ? authorHandle : `@${authorHandle}`,
        text,
        timestamp,
        engagementCount: parseEngagementCount(likeCountText),
        replyUrl: replyLinkHref ? new URL(replyLinkHref, "https://x.com").toString() : null,
      });
    }

    return replies;
  });
}

// LinkedIn's comment DOM uses class names that shift more often than X's
// data-testid attributes — verify these selectors against a live post before
// relying on them, and expect to adjust them.
export async function collectLinkedInReplies(
  postUrl: string,
  storageStatePath: string,
): Promise<RawReply[]> {
  return withAuthenticatedPage(storageStatePath, async (page) => {
    await page.goto(postUrl, { waitUntil: "domcontentloaded" });
    const commentSelector = ".comments-comment-item, .comments-comment-entity";
    await page.waitForSelector(commentSelector, { timeout: 15_000 }).catch(() => {});

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(800);
    }
    for (let i = 0; i < 3; i++) {
      const more = page.getByText(/load more comments/i).first();
      if (await more.isVisible().catch(() => false)) {
        await more.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    const items = await page.locator(commentSelector).all();
    const replies: RawReply[] = [];

    for (const item of items) {
      const authorHandle = await item
        .locator(".comments-post-meta__name, .comments-comment-meta__name")
        .innerText()
        .catch(() => "");
      const text = await item
        .locator(".comments-comment-item__main-content, .comments-comment-item-content-body")
        .innerText()
        .catch(() => "");
      if (!text.trim()) continue;

      const timestamp = await item.locator("time").getAttribute("datetime").catch(() => null);

      replies.push({
        platform: "linkedin",
        postUrl,
        authorHandle: authorHandle.trim(),
        text: text.trim(),
        timestamp,
        // LinkedIn does not reliably expose per-comment reaction counts in
        // the DOM — left at 0 for Week 1, revisit if this matters later.
        engagementCount: 0,
        replyUrl: null,
      });
    }

    return replies;
  });
}
