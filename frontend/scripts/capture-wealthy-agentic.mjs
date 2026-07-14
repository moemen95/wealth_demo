/**
 * Capture the affluent persona (Robert & Susan L.) going through the Agentic
 * approach across several scenarios and conversations. Each scenario is saved to
 * its own folder under docs/screenshots/persona_wealthy_agentic_approach/.
 *
 * Prereqs: backend :8000 + frontend :3000 running, provider configured.
 *   cd frontend && pnpm capture:wealthy
 *
 * Note: the Agentic path is slow (discovery ~15s, save ~10s, insights ~60-90s),
 * so a full run takes ~8-12 minutes.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../docs/screenshots/persona_wealthy_agentic_approach");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const AFFLUENT = "Robert & Susan";

const dir = (name) => {
  const d = resolve(ROOT, name);
  mkdirSync(d, { recursive: true });
  return d;
};
const shot = (page, folder, name) =>
  page.screenshot({ path: resolve(dir(folder), `${name}.png`), fullPage: true });

/** Load home, select the affluent persona, then switch to Agentic. */
async function openAgentic(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button").filter({ hasText: AFFLUENT }).click();
  await page.getByRole("button", { name: "Agentic", exact: true }).click();
}

/** Wait for the discovery card (its question label) to appear. */
async function waitDiscovery(page) {
  await page.getByText("Before I tailor your insights").first().waitFor({ timeout: 180_000 });
}

/** Wait for the tailored insight cards to render. */
async function waitInsights(page) {
  await page.waitForSelector('main [role="button"] h3', { timeout: 330_000 });
  await page.waitForTimeout(1500);
}

/** Click the first discovery scenario chip (labels are LLM-generated). */
async function pickFirstOption(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("main button")];
    const opt = btns.find((b) => {
      const t = b.textContent.trim();
      return t.length > 12 && !t.includes("Skip") && !t.includes("Clear memory");
    });
    if (opt) opt.click();
  });
}

async function skip(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) =>
      x.textContent.includes("Skip"),
    );
    if (b) b.click();
  });
}

async function clearMemory(page) {
  await page.getByRole("button", { name: /Clear memory/ }).click();
}

/** Send one chat message in the drill-in conversation and await the reply. */
async function ask(page, text) {
  const input = page.getByPlaceholder("Ask a follow-up question…");
  await input.fill(text);
  const resp = page.waitForResponse(
    (r) => r.url().includes("/chat") && r.request().method() === "POST",
    { timeout: 180_000 },
  );
  await input.press("Enter");
  await resp;
  await page.waitForFunction(() => !document.body.innerText.includes("Thinking…"), {
    timeout: 180_000,
  });
  await page.waitForTimeout(3000);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  const done = [];

  // ── RUN 1: discovery → pick a goal → tailored insights → conversation
  //          (unified memory) → clear memory. ────────────────────────────────
  if (process.env.SKIP_RUN1) {
    // Resume mode: only capture the free-text + declined scenarios below.
  } else {
  await openAgentic(page);
  await waitDiscovery(page);
  await shot(page, "01_discovery", "discovery-card");
  done.push("01_discovery");

  await pickFirstOption(page);
  await waitInsights(page);
  await shot(page, "02_pick_goal_tailored_insights", "tailored-insights");
  done.push("02_pick_goal_tailored_insights");

  // Drill into the first insight and hold a short, memory-aware conversation.
  await page.locator('main [role="button"]').first().click();
  await page.getByPlaceholder("Ask a follow-up question…").waitFor({ timeout: 30_000 });
  await ask(page, "What is the single most important move I should make this year?");
  await shot(page, "03_conversation_memory", "turn-1");
  await ask(page, "How does that fit the goal I told you earlier?");
  await shot(page, "03_conversation_memory", "turn-2-recalls-goal");
  done.push("03_conversation_memory");

  // Back to the grid, then wipe the agentic memory → discovery restarts.
  await page.getByRole("button", { name: /Back to insights/ }).click();
  await page.waitForTimeout(1000);
  await clearMemory(page);
  await waitDiscovery(page);
  await shot(page, "04_clear_memory", "discovery-restarts");
  done.push("04_clear_memory");
  }

  // ── RUN 2: free-text goal → tailored insights. ─────────────────────────────
  await openAgentic(page);
  await waitDiscovery(page);
  await page
    .getByPlaceholder("…or describe your goal in your own words")
    .fill(
      "I want to retire within 2 years and draw a stable, tax-efficient income while protecting our estate for our children.",
    );
  await page.getByPlaceholder("…or describe your goal in your own words").press("Enter");
  await waitInsights(page);
  await shot(page, "05_freetext_goal", "tailored-insights");
  done.push("05_freetext_goal");

  // ── RUN 3: decline (Skip) → insights that state their assumptions. ─────────
  await openAgentic(page);
  await waitDiscovery(page);
  await skip(page);
  await waitInsights(page);
  await shot(page, "06_declined_assumptions", "assumptions-insights");
  done.push("06_declined_assumptions");

  await browser.close();
  console.log(`Captured ${done.length} scenarios to ${ROOT}:\n- ${done.join("\n- ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
