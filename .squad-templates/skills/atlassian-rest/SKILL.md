---
name: "atlassian-rest"
description: "Interact with Jira on-prem (Server / Data Center) via REST API v2 using a Personal Access Token. Activate for ticket searches, creation, comments, transitions, and linkage. Confluence is intentionally out of scope in this fork."
domain: "integration"
confidence: "medium"
source: "ported-from-bmad-labs/skills (atlassian-rest), modified for on-prem PAT auth and Jira-only scope"
auth: "PAT (Bearer)"
target: "Jira Server / Data Center — /rest/api/2/*"
---

# Skill: atlassian-rest (on-prem, PAT)

> Interact with **Jira on-prem** using REST API v2 and a **Personal Access Token** (Bearer auth). Owned by the `jiracom` member.

## What It Does

Provides a small CLI surface (`scripts/jira.mjs`) for Jira reads and writes:

- Search issues by JQL
- Get an issue by key
- Create new issues
- Edit issue fields
- Add comments (file-backed for long bodies)
- Transition issues between statuses
- Link issues
- Lookup users / transitions / project metadata

Plus a one-time `scripts/setup.mjs` that prompts for the PAT and base URL and writes them to `.squad/.env`.

## How It's Different From the Cloud Variant

The original `atlassian-rest` skill from [bmad-labs/skills](https://github.com/bmad-labs/skills/blob/main/skills/atlassian-rest/SKILL.md) targets Atlassian Cloud (`*.atlassian.net`) with Basic auth (email + API token) and `/rest/api/3/*` (which uses ADF JSON for descriptions). This fork targets **on-prem only**:

| Aspect | Cloud (original) | On-prem (this fork) |
|--------|------------------|---------------------|
| Auth header | `Authorization: Basic base64(email:token)` | `Authorization: Bearer <PAT>` |
| Base URL | `https://<site>.atlassian.net` | `https://jira.<your-domain>` |
| API version | `/rest/api/3/...` | `/rest/api/2/...` |
| Description format | ADF JSON | wiki markup or plain text |
| Env vars | `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `ATLASSIAN_DOMAIN` | `JIRA_PAT`, `JIRA_BASE_URL` |
| Confluence | included | **not included** in this fork |

## Setup

The recommended entry point is the `squad jira auth` command (modeled after `gh auth login`):

```
squad jira auth login
```

It prompts for:
- `JIRA_BASE_URL` — full URL of your Jira instance (e.g., `https://jira.example.com`, no trailing slash)
- `JIRA_PAT` — Personal Access Token from your Jira profile (`Profile → Personal Access Tokens → Create token`)

…verifies the credentials by calling `/rest/api/2/myself`, and writes them to `.squad/.env` (chmod 600, gitignored). The skill loads `.squad/.env` automatically before each call.

**Non-interactive use** (CI, scripts):

```
echo "$JIRA_PAT" | squad jira auth login --base-url https://jira.example.com --token-stdin
# or, if you must:
squad jira auth login --base-url https://jira.example.com --with-token "$JIRA_PAT"
```

`--with-token` is convenient but the PAT will be visible in the process list — prefer `--token-stdin`.

**Other auth subcommands:**

```
squad jira auth status    # show current auth, ping /myself, mask the token
squad jira auth logout    # remove JIRA_BASE_URL and JIRA_PAT from .squad/.env
```

**Fallback (no squad CLI available):**

```
node .squad/skills/atlassian-rest/scripts/setup.mjs
```

The standalone script does the same prompt+verify+write flow and is kept for environments where the squad CLI isn't on PATH.

> **Token scope:** the PAT must have `read` for the projects you care about and `write` for any project where JiraCom will create/edit/transition tickets. Verify with your Jira admin.

## Operating Principles

1. **Resolve ambiguity first.** Search for projects, issue types, transitions, and required fields *before* mutating. Workflows on on-prem are heavily customized and the cloud defaults rarely apply.
2. **Confirm mutations.** Show the proposed change and request developer approval via `.squad/decisions/inbox/jiracom-{slug}.md` before executing.
3. **Never delete.** Use the Jira UI for deletions. This is intentional.
4. **No PAT in commits.** `.squad/.env` is gitignored; never echo the PAT in logs, decisions, or PR bodies.
5. **File-back long content.** For descriptions or comments > 200 chars, use `--description-file` / `--body-file`.
6. **Wiki markup, not ADF.** On-prem v2 takes wiki markup or plain text in description/comment bodies. ADF JSON will be silently truncated.

## CLI Surface

```bash
# read
node .squad/skills/atlassian-rest/scripts/jira.mjs search 'project = PROJ AND status = "In Progress"'
node .squad/skills/atlassian-rest/scripts/jira.mjs get PROJ-123

# write (require developer approval per `jiracom` charter)
node .squad/skills/atlassian-rest/scripts/jira.mjs create --project PROJ --type Task --summary "..." [--description-file path]
node .squad/skills/atlassian-rest/scripts/jira.mjs edit PROJ-123 --field labels=foo,bar
node .squad/skills/atlassian-rest/scripts/jira.mjs comment PROJ-123 --body-file path
node .squad/skills/atlassian-rest/scripts/jira.mjs transitions PROJ-123              # list valid transitions
node .squad/skills/atlassian-rest/scripts/jira.mjs transition PROJ-123 --to "In Progress"
node .squad/skills/atlassian-rest/scripts/jira.mjs link PROJ-123 PROJ-456 --type Relates
```

All commands exit non-zero on HTTP error and print the response body to stderr.

## Confidence

medium — Ported from the bmad-labs cloud skill; on-prem path is implemented and unit-tested for auth header, URL composition, and basic CRUD shapes. Project-specific transitions and required fields will need to be discovered per-instance and recorded in `.squad/decisions.md`.

## Error Handling

- **401 Unauthorized** — PAT expired or revoked; re-run `setup.mjs`.
- **403 Forbidden** — Account lacks project permission; surface to developer.
- **404 Not Found** — Wrong key, wrong base URL, or project moved; verify with developer.
- **429 Too Many Requests** — Back off, retry with exponential delay (max 3 attempts; the script implements this).
