# Repowise and agent handoff

Repowise (https://repowise.dev) indexes this repository (code graph, git history, docs, decisions) and serves it to agents over MCP. It re-indexes from GitHub; it is read-only for agents, so **everything an agent should remember must be committed to this repository**.

## Where project memory lives (in order of use)
1. `docs/AGENT-HANDOFF.md`: task queue, session log, rules. Read first, update last.
2. `docs/decisions/ADR-*.md`: one file per decision (context, decision, consequences). Add a new numbered ADR whenever a choice would be expensive to reverse.
3. Commit messages: first line says what, the body says **why** (Repowise mines git history for intent).
4. `AGENTS.md`: pointer for any agent opening the repo.

## Starting a session (any model)
1. Read `AGENTS.md` and `docs/AGENT-HANDOFF.md`.
2. If Repowise tools are available: `get_overview` (orientation and next actions), `get_why` with the file you will touch (past decisions), `get_risk` before editing widely imported files such as `src/components/Layout.tsx` or `scripts/lib/seo.mjs`, `get_health` for what to tidy.
3. Check `git log -5` and `git status`; another agent may have pushed.

## Ending a session
1. `npm run build && npm run verify:dist` must pass.
2. Commit with a "why" in the body, push to `main`.
3. Tick finished tasks in `docs/AGENT-HANDOFF.md`, add a session-log entry (what was done, what is unfinished, where you stopped).
4. Add an ADR if you made a lasting decision.

## Known limits
- The index describes the last pushed commit (`_meta.indexed_commit`); unpushed work is invisible to it.
- Repowise does not store task state; the handoff file does.
- Decision extraction rules are not documented publicly. After the next push, call `get_why` with no arguments: if the ADRs show up under "decisions", the format works; if not, adjust the format and note it here.
