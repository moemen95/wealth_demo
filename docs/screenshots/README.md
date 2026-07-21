# Demo screenshots

Auto-captured from the running app (OpenAI provider, `gpt-5-nano`) with a
headless Playwright harness. Full-page, tool traces expanded.

Questions (used on both pages):

| Q | Question |
|---|---|
| q1 | Give me the total in my portfolio. |
| q2 | How much should I save from my monthly income? |
| q3 | Should I pay down debt or invest? |
| q4 | My GIC is maturing — what should I do? |
| q5 | Markets are down. Am I okay? |

Personas: `first` (Alex T.), `middle` (Priya S.), `affluent` (Robert & Susan L.).

## `homepage/` — the single-page experience (Agentic architecture)
- `{persona}-insights.png` — proactive Agentic insight cards + planning trace
  (affluent includes the allocation donut).
- `{persona}-{q}-{slug}.png` — the home chat answering each of the 5 questions,
  shown alongside the insights, with the answer's tool trace expanded.

15 chat + 3 insights = 18 files.

## `compare/` — Raw vs Skills vs Agentic, side-by-side
- `{persona}-{q}-{slug}.png` — one question sent to all three architectures at
  once (Raw hallucinates/deflects, Skills returns a grounded number, Agentic
  contextualises with a multi-agent tool trace).

3 personas × 5 questions = 15 files.
