# Affluent persona × Agentic approach — scenario walkthrough

Captured from the running app for the **affluent** persona (Robert & Susan L.,
net worth $2,715,000) using the **Agentic** architecture, with
`frontend/scripts/capture-wealthy-agentic.mjs` (`pnpm capture:wealthy`).

The Agentic approach gathers context *before* advising: a **context subagent** asks a
clarifying question, the answer is saved to the agent's **memory**, and insights are
tailored to it. Declining makes it state its assumptions instead. Memory is unified
across discovery, insights, and the drill-in chat; a **Clear memory** button resets it.

Each folder is one scenario:

| Folder | What it shows |
|---|---|
| `01_discovery/` | The opening step — the subagent asks "which goal matters most?" with persona-tailored scenario chips, a free-text box, and a Skip option. Insights are *not* shown yet. |
| `02_pick_goal_tailored_insights/` | After picking a scenario chip, the answer is saved to memory and the insights regenerate **tailored to that goal**, with a follow-up "refine" question above the grid. |
| `03_conversation_memory/` | Drilling into an insight and chatting. `turn-1` asks for the top priority; `turn-2-recalls-goal` shows the chat **recalling the goal** stated during discovery (unified memory). |
| `04_clear_memory/` | After clicking **Clear memory**, the stored goal is wiped and the discovery step restarts from scratch. |
| `05_freetext_goal/` | Instead of a chip, a goal typed in free text ("retire within 2 years, tax-efficient income, protect the estate") — insights tailor to the typed goal. |
| `06_declined_assumptions/` | Choosing **Skip** — the agent records the decline, assumes reasonable scenarios from the profile, and every insight card opens with an amber **"Assuming"** block stating what it assumed. |

Regenerate: with backend :8000 + frontend :3000 running, `cd frontend && pnpm capture:wealthy`.
Note: the Agentic path is slow (discovery ~15s, save ~10s, insights ~60-120s), so a full
run takes ~10 minutes.
