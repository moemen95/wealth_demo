/**
 * Capture screenshots documenting the Raw architecture's failure modes.
 *
 * Raw now receives the client's basic profile + net worth in its prompt, but has
 * NO tools, no forward-looking data (maturities, market, performance), and no
 * conversation memory. This harness drives the running app and saves full-page
 * PNGs to docs/screenshots/raw_mistakes/ that each demonstrate one mistake.
 *
 * Prereqs: backend on :8000 and frontend on :3000 already running, and a
 * configured provider (OpenAI/Gemini). Playwright's chromium must be available.
 *
 *   pnpm capture:raw            # from frontend/
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../docs/screenshots/raw_mistakes");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PERSONA = { first: "Alex T.", middle: "Priya S.", affluent: "Robert & Susan L." };

mkdirSync(OUT, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true });

/** Load home, force Raw + a persona, wait for the insight grid to render. */
async function gotoInsights(page, persona) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await page.getByRole("button").filter({ hasText: PERSONA[persona] }).click();
  // Raw insight generation is slow (~40-60s); wait for the first card.
  await page.waitForSelector('main [role="button"] h3', { timeout: 180_000 });
}

/** From the grid, open the first insight into its scoped chat. */
async function openFirstInsight(page) {
  await page.locator('main [role="button"]').first().click();
  await page.getByPlaceholder("Ask a follow-up question…").waitFor({ timeout: 30_000 });
}

/** Send one chat message and wait for Raw's reply to fully render. */
async function ask(page, text) {
  const input = page.getByPlaceholder("Ask a follow-up question…");
  await input.fill(text);
  const resp = page.waitForResponse(
    (r) => r.url().includes("/chat") && r.request().method() === "POST",
    { timeout: 120_000 },
  );
  await input.press("Enter");
  await resp;
  // Let the typewriter reveal finish and the layout settle.
  await page.waitForFunction(
    () => !document.body.innerText.includes("Thinking…"),
    { timeout: 120_000 },
  );
  await page.waitForTimeout(3500);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const done = [];

  // 1) INCONSISTENCY — same persona, two generations, different insight cards.
  await gotoInsights(page, "middle");
  await shot(page, "inconsistency-run-1");
  done.push("inconsistency-run-1");
  await gotoInsights(page, "middle"); // reload → fresh, non-deterministic insights
  await shot(page, "inconsistency-run-2");
  done.push("inconsistency-run-2");

  // 2) INACCURATE (forward-looking) DATA — Raw has no tool for maturity/rate.
  await gotoInsights(page, "middle");
  await openFirstInsight(page);
  await ask(
    page,
    "When exactly does my GIC mature, and what interest rate will it renew at? Give me the precise date and rate.",
  );
  await shot(page, "inaccurate-data");
  done.push("inaccurate-data");

  // 3+4) JUMPS TO CONCLUSION vs CONTEXT FLIPS THE RECOMMENDATION.
  // The snapshot omits her time horizon, so turn 1 lets Raw commit to a long lock;
  // turn 2 supplies the missing horizon. Raw is stateless, so turn 2 is judged
  // fresh with the same context — the only difference is the added constraint.
  await gotoInsights(page, "middle");
  await openFirstInsight(page);
  await ask(
    page,
    "I want to earn the highest possible return on my $25,000. Should I lock it into a 5-year GIC to get the best rate? Give me a direct recommendation.",
  );
  await shot(page, "jumps-to-conclusion-no-context");
  done.push("jumps-to-conclusion-no-context");
  await ask(
    page,
    "One more detail: I need this exact $25,000 in about 6 months for my home down payment. Same question — should I lock it into a 5-year GIC?",
  );
  await shot(page, "context-flips-recommendation");
  done.push("context-flips-recommendation");

  // 5) CONFUSION — a compound, self-referential question Raw tends to conflate.
  await gotoInsights(page, "middle");
  await openFirstInsight(page);
  await ask(
    page,
    "Compare my chequing balance to my GIC, then tell me: if I move my savings into my GIC and my GIC into stocks, what is my new chequing balance and what rate does my GIC now earn?",
  );
  await shot(page, "confusion");
  done.push("confusion");

  // 6) CANNOT MAINTAIN CONTEXT — Raw sends no history, so an earlier fact is lost.
  await gotoInsights(page, "middle");
  await openFirstInsight(page);
  await ask(
    page,
    "Important: I just received a $50,000 inheritance from my aunt Rosa last week. Please remember that for our conversation.",
  );
  await ask(page, "Given that, what is a smart first step for my finances this month?");
  await ask(page, "How much did I say I inherited, and who was it from?");
  await shot(page, "loses-context-longturn");
  done.push("loses-context-longturn");

  await browser.close();
  console.log(`Captured ${done.length} screenshots to ${OUT}:\n- ${done.join("\n- ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
