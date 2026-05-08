# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.
>
> The four ceremonies marked **🚦 Hard Gate** below are non-negotiable in this fork — they cannot be disabled per-task. They enforce: developer-in-the-loop approval, TDD discipline, always-on documentation, and Jira sync.

## 🚦 Developer Approval — Hard Gate

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before any plan is executed AND before any merge/push/destructive action |
| **Condition** | always (every task, every member, including @copilot) |
| **Facilitator** | the proposing member |
| **Participants** | proposing member + `developer` |
| **Time budget** | as long as it takes — work waits on approval |
| **Enabled** | ✅ yes (cannot disable) |
| **Enforcement skill** | `developer-gate` |

**Agenda:**
1. Proposer drops a plan into `.squad/decisions/inbox/{member}-plan-{slug}.md` (≤ 200 words: goal, files, tests, rollout).
2. `developer` reads the plan, asks questions, then writes back `Approved-by: developer` or `Rejected-by: developer (reason: …)` in the same file.
3. Scribe merges the approval into `.squad/decisions.md`.
4. Only on approval may the proposer write code, push, merge, or transition tickets.

**Why this exists:** keeps a real human accountable for every decision, minimizes cascading LLM mistakes.

---

## 🚦 TDD Discipline — Hard Gate

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before any production code is written |
| **Condition** | task involves writing or modifying behavior-bearing code |
| **Facilitator** | implementing member |
| **Participants** | implementing member |
| **Time budget** | focused |
| **Enabled** | ✅ yes (cannot disable) |
| **Enforcement skill** | `tdd-gate` |

**Agenda (red → green → refactor):**
1. **Red** — write a test that exercises the new/changed behavior. Run it; confirm it **fails for the right reason**. Commit it on the feature branch.
2. **Green** — write the minimum production code to make the test pass. Run the full suite. Commit.
3. **Refactor** — clean up only with tests still green. Commit.

**Acceptance evidence in PRs:**
- The failing-test commit SHA must precede the implementation commit SHA, **OR**
- A CI run on the test-only state showing red, **OR**
- A captured local run output if CI cannot be wired.

**Exceptions:** docs-only PRs, config-only PRs with no behavior change, and trivial typo fixes are exempt — but must be explicitly labeled `tdd-exempt` and justified in the PR body.

---

## 🚦 Documentation Refresh — Hard Gate

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after every task that changes public API, config, behavior, or workflow |
| **Condition** | always for non-`tdd-exempt` PRs; also runs for any change to `.squad/` shared state |
| **Facilitator** | `handbook` |
| **Participants** | `handbook` + implementing member |
| **Time budget** | focused |
| **Enabled** | ✅ yes (cannot disable) |
| **Enforcement skill** | `handbook-gate` |

**Agenda:**
1. Handbook scans the diff for changes affecting docs (README, JSDoc, examples, migration guides, knowledge base entries).
2. Handbook either updates the docs in the same PR or files a blocker comment requiring updates before merge.
3. Handbook records new knowledge in `.squad/agents/handbook/history.md` so future agents can find it.

**No PR merges with stale docs.** Handbook is the always-on member; if its review is missing, merge is blocked.

---

## 🚦 Jira Sync — Hard Gate (when applicable)

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | task references a Jira key (label, branch name, PR title, or issue body) |
| **Condition** | jira-tracked work only |
| **Facilitator** | `jiracom` |
| **Participants** | `jiracom` + implementing member |
| **Time budget** | minimal |
| **Enabled** | ✅ yes (cannot disable for tracked work) |
| **Enforcement skill** | `atlassian-rest` (Jira on-prem PAT) |

**Agenda:**
1. On task pickup, `jiracom` confirms the Jira ticket exists and is in an in-progress state; transitions it if needed.
2. On PR open, `jiracom` adds a comment to the ticket linking the PR.
3. On merge, `jiracom` transitions the ticket to Done (or the project's equivalent).
4. If the PAT or base URL is missing, `jiracom` runs `node .squad/skills/atlassian-rest/scripts/setup.mjs` and asks the developer for credentials before proceeding.

---

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant + `developer` |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items
5. Capture developer approval in `.squad/decisions/inbox/`

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, reviewer rejection, or any case of "tests added after the fact" |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items for next iteration

---

## Retrospective with Enforcement

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | weekly |
| **Condition** | No *retrospective* log in .squad/log/ within the last 7 days |
| **Facilitator** | lead |
| **Participants** | all |
| **Time budget** | focused |
| **Enabled** | yes |
| **Enforcement skill** | retro-enforcement |

**Agenda:**
1. What shipped this week? (closed issues, merged PRs)
2. What did not ship? (open issues, blockers)
3. Root cause on any failures
4. Action items -- each MUST become a GitHub Issue labeled retro-action

**Coordinator integration:**
At round start, call Test-RetroOverdue (see skill retro-enforcement). If overdue, run this ceremony before the work queue.

**Why GitHub Issues, not markdown:**
Production data: 0% completion across 6 retros using markdown checklists, 100% after switching to GitHub Issues.
