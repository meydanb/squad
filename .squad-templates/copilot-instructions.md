# Copilot Coding Agent — Squad Instructions

You are working on a project that uses **Squad**, an AI team framework. When picking up issues autonomously, follow these guidelines.

## Hard Gates (must hold before any work proceeds)

This fork enforces four non-negotiable gates on every task, in addition to the standard squad capability profile:

1. **🧑‍💻 Developer-in-the-loop** — A real human (the `developer` member, see `.squad/agents/developer/charter.md`) must explicitly approve every plan and every change before it is applied. No agent may execute a plan, merge a PR, push commits, transition a Jira issue, or run destructive commands without an explicit ✅ from the developer recorded in `.squad/decisions.md` (or the inbox). If you cannot find an approval, **stop and request one** instead of proceeding.
2. **🔴🟢🟦 TDD always** — Every code change follows red → green → refactor:
   - A failing test must exist and be committed (or staged) **before** any production code is written.
   - The PR / commit history must show the failing-test commit preceding the implementation commit (or the test must be in the same diff with proof it failed first — e.g., a CI run on the test-only commit, or a recorded local run).
   - Refactors without behavior changes still require existing tests to be green.
   - "I added tests after the fact" is a retrospective trigger.
3. **📚 Documentation always updated** — Every change that affects public behavior, APIs, configuration, or workflows must update the docs (and `.squad/agents/handbook/` knowledge base) in the same PR. The `handbook` member is always-on; if you skip docs, handbook will block the merge.
4. **🎫 Jira sync** — If a task is tracked in Jira (label, branch name, or referenced ticket), the `jiracom` member must add a comment on the ticket linking the PR before merge, and transition the ticket on close.

These four gates apply to **every** member, including @copilot.

## Team Context

Before starting work on any issue:

1. Read `.squad/team.md` for the team roster, member roles, and your capability profile.
2. Read `.squad/routing.md` for work routing rules.
3. If the issue has a `squad:{member}` label, read that member's charter at `.squad/agents/{member}/charter.md` to understand their domain expertise and coding style — work in their voice.
4. Check `.squad/decisions.md` for the latest developer approvals relevant to your task.

## Capability Self-Check

Before starting work, check your capability profile in `.squad/team.md` under the **Coding Agent → Capabilities** section.

- **🟢 Good fit** — proceed autonomously, **but still wait for developer approval on the plan before writing code**.
- **🟡 Needs review** — proceed, but note in the PR description that a squad member should review.
- **🔴 Not suitable** — do NOT start work. Instead, comment on the issue:
  ```
  🤖 This issue doesn't match my capability profile (reason: {why}). Suggesting reassignment to a squad member.
  ```

## Plan-Then-Approve Flow

Every non-trivial task follows this sequence:

1. **Draft a plan** (≤ 200 words): goal, files to touch, test strategy, rollout/rollback.
2. **Post the plan** as an inbox decision: `.squad/decisions/inbox/{member}-plan-{slug}.md`.
3. **Wait for the developer** to add `Approved-by: developer` (or `Rejected-by: developer` with reason) to the same file.
4. **Only after approval**, write the failing test (TDD step 1), then the implementation, then the docs update, then push.

If the developer is unavailable, the task waits. Do not proceed on assumed approval.

## Branch Naming

Use the squad branch convention:
```
squad/{issue-number}-{kebab-case-slug}
```
Example: `squad/42-fix-login-validation`

## PR Guidelines

When opening a PR:
- Reference the issue: `Closes #{issue-number}`
- If the issue had a `squad:{member}` label, mention the member: `Working as {member} ({role})`
- If this is a 🟡 needs-review task, add to the PR description: `⚠️ This task was flagged as "needs review" — please have a squad member review before merging.`
- Include in the PR body:
  - **Developer approval:** link to the approving entry in `.squad/decisions.md`.
  - **TDD evidence:** the failing-test commit SHA or a CI link showing the test failed before the fix.
  - **Docs touched:** list updated docs / handbook entries.
  - **Jira ticket:** key + transition state, if applicable.
- Follow any project conventions in `.squad/decisions.md`

## Decisions

If you make a decision that affects other team members, write it to:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
The Scribe will merge it into the shared decisions file.
