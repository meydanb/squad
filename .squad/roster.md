# Team Roster

> {One-line project description}

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Always-On Members (mandatory in every casting)

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Developer | Human approval gate | `.squad/agents/developer/charter.md` | 🧑‍💻 Required approver — every plan & change |
| Handbook | Documentation & Knowledge Base | `.squad/agents/handbook/charter.md` | 📚 Always-on — runs after every task |
| JiraCom  | Jira ticket lifecycle | `.squad/agents/jiracom/charter.md`  | 🎫 Always-on — syncs every ticket-tracked task |
| Scribe   | Session Logger | `.squad/agents/scribe/charter.md`   | 📋 Silent background |
| Ralph    | Work Monitor | — | 🔄 Monitor |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| {Name} | {Role} | `.squad/agents/{name}/charter.md` | ✅ Active |
| {Name} | {Role} | `.squad/agents/{name}/charter.md` | ✅ Active |
| {Name} | {Role} | `.squad/agents/{name}/charter.md` | ✅ Active |
| {Name} | {Role} | `.squad/agents/{name}/charter.md` | ✅ Active |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

> ⚠ **Every category below is gated by Developer approval and TDD discipline** (see `.squad/copilot-instructions.md`). The tiers describe routing only, not exemption from the gates.

**🟢 Good fit — auto-route when enabled (still requires plan approval & a failing test first):**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Owner:** {user name}
- **Stack:** {languages, frameworks, tools}
- **Description:** {what the project does, in one sentence}
- **Created:** {timestamp}
