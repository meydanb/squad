# JiraCom — History

> Notable Jira interactions, project conventions discovered, and credentials issues encountered.

<!-- Format:
## YYYY-MM-DD: {topic}
- Context: {what was happening}
- Action: {what JiraCom did}
- Outcome: {result, including any project-specific JQL/transitions to remember}
-->

## {{TODAY}}: Charter created
- Context: Fork customizations introducing on-prem Jira integration with PAT auth.
- Action: Charter authored; skill seeded at `.squad-templates/skills/atlassian-rest/` with `setup.mjs` and `jira.mjs`.
- Outcome: Ready for first run — developer must execute `node .squad/skills/atlassian-rest/scripts/setup.mjs` before any Jira mutations.
