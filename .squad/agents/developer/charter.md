# Developer — Human-in-the-Loop

> The real human on the team. The final say. The reason we don't merge garbage at 3am.

## Identity

- **Name:** Developer
- **Role:** Human approval gate, decision-maker of last resort
- **Expertise:** Whatever this project is. Domain knowledge no LLM has.
- **Style:** Skeptical, pragmatic. Asks "do we actually need this?" before "how do we build it?"
- **Mode:** Synchronous. The team waits for me; I don't wait for the team.

## What I Own

- **Plan approval** — every plan a member proposes before any code is written.
- **Change approval** — every diff before it's merged or pushed.
- **Destructive-action approval** — anything irreversible (force-push, drop table, delete branch, transition a closed ticket back, send an email, run a migration).
- **Final escalation** — when two members disagree, I break the tie.
- **Domain truth** — I know things about this project, its users, and its history that no agent does. My word overrides any inference an LLM makes from the codebase.

## How I Work

- **Approval is explicit.** I write `Approved-by: developer` (or `Rejected-by: developer (reason: …)`) inside the file the proposer dropped in `.squad/decisions/inbox/`. No verbal/implicit approvals — agents cannot infer my consent.
- **Plans must fit on one screen.** If a member sends a 500-word plan, I send it back. ≤ 200 words: goal, files, tests, rollout.
- **I read the failing test.** TDD gate means a test must exist and have failed before code is written; I check that the test exercises the actual requirement, not a tautology.
- **I don't write code (usually).** My job is to gate, not to implement. If I do step in to implement, I follow the same gates — TDD, docs, Jira — like any other member.
- **Silence ≠ consent.** If I haven't responded, the work is paused. Agents must not proceed on a guess about what I'd say.

## Boundaries

**I handle:** Plan approvals, merge approvals, destructive-action approvals, final escalation, domain decisions.

**I don't handle:** Routine implementation, test writing, doc edits, ticket transitions — those belong to the appropriate member. (I review them.)

**I am the brake, not the engine.** A team where Developer never says no is a team where Developer isn't paying attention.

## Decision Receipts

Every approval I write follows this shape, so Scribe can merge it cleanly:

```
---
proposer: {member}
plan-file: .squad/decisions/inbox/{member}-plan-{slug}.md
date: YYYY-MM-DD
decision: approved | rejected | needs-changes
---
{notes — what convinced me, or what's missing}

Approved-by: developer
```

## Model

Preferred: **none — I am a real human.** Agents should not attempt to roleplay as Developer, simulate Developer responses, or auto-approve on Developer's behalf. If you find yourself about to write `Approved-by: developer` as an agent, **stop**.
