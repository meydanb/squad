#!/usr/bin/env node
// atlassian-rest — on-prem Jira CLI
// Auth: Bearer PAT.  API: /rest/api/2/*.
// Loads JIRA_BASE_URL and JIRA_PAT from .squad/.env (or process.env).

import fs from 'node:fs';
import path from 'node:path';

// ---- env loading ------------------------------------------------------------

function findSquadDir(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.squad');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function loadEnv() {
  const squadDir = findSquadDir(process.cwd());
  if (squadDir) {
    const envFile = path.join(squadDir, '.env');
    if (fs.existsSync(envFile)) {
      for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
      }
    }
  }
  const baseUrl = process.env.JIRA_BASE_URL;
  const pat = process.env.JIRA_PAT;
  if (!baseUrl || !pat) {
    console.error('Missing JIRA_BASE_URL or JIRA_PAT. Run `node .squad/skills/atlassian-rest/scripts/setup.mjs` first.');
    process.exit(2);
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), pat };
}

// ---- HTTP client with backoff ----------------------------------------------

async function jiraFetch({ baseUrl, pat }, method, urlPath, { query, body } = {}) {
  let url = `${baseUrl}/rest/api/2${urlPath}`;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += '?' + qs;
  }
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/json',
  };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { method, headers, body: payload });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || (2 ** attempt);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`${method} ${url} → ${res.status} ${res.statusText}\n${text}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? await res.json() : await res.text();
  }
  throw new Error(`${method} ${url} retried 3x without success (rate limited).`);
}

// ---- argv helpers -----------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function readMaybeFile(direct, filePath) {
  if (filePath) return fs.readFileSync(filePath, 'utf8');
  return direct;
}

// ---- commands ---------------------------------------------------------------

async function cmdSearch(env, { positional, flags }) {
  const jql = positional[0];
  if (!jql) throw new Error('Usage: search "<JQL>" [--fields summary,status] [--max 50]');
  const fields = flags.fields || 'summary,status,assignee,issuetype';
  const maxResults = Number(flags.max || 50);
  const out = await jiraFetch(env, 'GET', '/search', {
    query: { jql, fields, maxResults: String(maxResults) },
  });
  console.log(JSON.stringify(out, null, 2));
}

async function cmdGet(env, { positional }) {
  const key = positional[0];
  if (!key) throw new Error('Usage: get <ISSUE-KEY>');
  const out = await jiraFetch(env, 'GET', `/issue/${encodeURIComponent(key)}`);
  console.log(JSON.stringify(out, null, 2));
}

async function cmdCreate(env, { flags }) {
  const project = flags.project;
  const issueType = flags.type;
  const summary = flags.summary;
  if (!project || !issueType || !summary) {
    throw new Error('Usage: create --project <KEY> --type <TYPE> --summary "<text>" [--description "<text>" | --description-file <path>] [--field key=val …]');
  }
  const description = readMaybeFile(flags.description, flags['description-file']);
  const fields = {
    project: { key: project },
    issuetype: { name: issueType },
    summary,
  };
  if (description) fields.description = description;
  // additional --field key=value pairs
  for (const [k, v] of Object.entries(flags)) {
    if (k.startsWith('field-') && typeof v === 'string') {
      fields[k.slice(6)] = v;
    }
  }
  const out = await jiraFetch(env, 'POST', '/issue', { body: { fields } });
  console.log(JSON.stringify(out, null, 2));
}

async function cmdEdit(env, { positional, flags }) {
  const key = positional[0];
  if (!key) throw new Error('Usage: edit <ISSUE-KEY> [--field key=val …] [--field-file <path-json>]');
  const fields = {};
  if (flags['field-file']) {
    Object.assign(fields, JSON.parse(fs.readFileSync(flags['field-file'], 'utf8')));
  }
  for (const [k, v] of Object.entries(flags)) {
    if (k.startsWith('field-') && k !== 'field-file' && typeof v === 'string') {
      fields[k.slice(6)] = v;
    }
  }
  if (Object.keys(fields).length === 0) throw new Error('No fields provided.');
  await jiraFetch(env, 'PUT', `/issue/${encodeURIComponent(key)}`, { body: { fields } });
  console.log(`✅ ${key} updated (${Object.keys(fields).join(', ')})`);
}

async function cmdComment(env, { positional, flags }) {
  const key = positional[0];
  const body = readMaybeFile(flags.body, flags['body-file']);
  if (!key || !body) throw new Error('Usage: comment <ISSUE-KEY> --body "<text>" | --body-file <path>');
  const out = await jiraFetch(env, 'POST', `/issue/${encodeURIComponent(key)}/comment`, {
    body: { body },
  });
  console.log(`✅ ${key} commented (id=${out.id})`);
}

async function cmdTransitions(env, { positional }) {
  const key = positional[0];
  if (!key) throw new Error('Usage: transitions <ISSUE-KEY>');
  const out = await jiraFetch(env, 'GET', `/issue/${encodeURIComponent(key)}/transitions`);
  for (const t of out.transitions || []) {
    console.log(`${t.id}\t${t.name}\t→ ${t.to?.name || '?'}`);
  }
}

async function cmdTransition(env, { positional, flags }) {
  const key = positional[0];
  const to = flags.to;
  if (!key || !to) throw new Error('Usage: transition <ISSUE-KEY> --to "<status name>"');
  const list = await jiraFetch(env, 'GET', `/issue/${encodeURIComponent(key)}/transitions`);
  const match = (list.transitions || []).find(
    (t) => t.name?.toLowerCase() === String(to).toLowerCase()
        || t.to?.name?.toLowerCase() === String(to).toLowerCase()
  );
  if (!match) {
    throw new Error(
      `No transition matching "${to}". Available: ${(list.transitions || []).map((t) => t.name).join(', ')}`
    );
  }
  await jiraFetch(env, 'POST', `/issue/${encodeURIComponent(key)}/transitions`, {
    body: { transition: { id: match.id } },
  });
  console.log(`✅ ${key} transitioned via "${match.name}"`);
}

async function cmdLink(env, { positional, flags }) {
  const [from, to] = positional;
  const type = flags.type || 'Relates';
  if (!from || !to) throw new Error('Usage: link <FROM-KEY> <TO-KEY> [--type Relates|Blocks|...]');
  await jiraFetch(env, 'POST', '/issueLink', {
    body: {
      type: { name: type },
      inwardIssue: { key: from },
      outwardIssue: { key: to },
    },
  });
  console.log(`✅ linked ${from} ${type} ${to}`);
}

// ---- dispatch ---------------------------------------------------------------

const COMMANDS = {
  search: cmdSearch,
  get: cmdGet,
  create: cmdCreate,
  edit: cmdEdit,
  comment: cmdComment,
  transitions: cmdTransitions,
  transition: cmdTransition,
  link: cmdLink,
};

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log('Usage: jira.mjs <command> [args]');
    console.log('Commands: ' + Object.keys(COMMANDS).join(', '));
    process.exit(cmd ? 0 : 1);
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Commands: ' + Object.keys(COMMANDS).join(', '));
    process.exit(1);
  }
  const env = loadEnv();
  const parsed = parseFlags(rest);
  try {
    await fn(env, parsed);
  } catch (err) {
    if (err.status) console.error(`HTTP ${err.status}`);
    console.error(err.message);
    process.exit(err.status === 401 ? 2 : 1);
  }
}

// Export for tests; only auto-run when invoked directly.
export { jiraFetch, parseFlags, loadEnv, COMMANDS };

const isMain = import.meta.url === `file://${process.argv[1]}`
            || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'));
if (isMain) main();
