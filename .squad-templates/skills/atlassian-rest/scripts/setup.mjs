#!/usr/bin/env node
// atlassian-rest — on-prem Jira setup
// Prompts for JIRA_BASE_URL and JIRA_PAT and writes them to .squad/.env (gitignored).
// Verifies the credentials by hitting /rest/api/2/myself.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const SQUAD_DIR = findSquadDir(process.cwd());
const ENV_FILE = path.join(SQUAD_DIR, '.env');
const GITIGNORE = path.join(SQUAD_DIR, '.gitignore');

function findSquadDir(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.squad');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('Could not find .squad/ directory walking up from cwd. Run from inside a squad-initialized project.');
}

function loadExistingEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnv(values) {
  const merged = { ...loadExistingEnv(), ...values };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
}

function ensureGitignored() {
  const want = '.env';
  let current = fs.existsSync(GITIGNORE) ? fs.readFileSync(GITIGNORE, 'utf8') : '';
  if (!current.split(/\r?\n/).includes(want)) {
    if (current && !current.endsWith('\n')) current += '\n';
    current += want + '\n';
    fs.writeFileSync(GITIGNORE, current);
  }
}

async function verify(baseUrl, pat) {
  const url = baseUrl.replace(/\/$/, '') + '/rest/api/2/myself';
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Verification failed: ${res.status} ${res.statusText}\n${body}`);
  }
  return await res.json();
}

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log('atlassian-rest — Jira on-prem setup');
  console.log(`Will write to: ${ENV_FILE}`);
  console.log('');

  const existing = loadExistingEnv();
  const baseUrlPrompt = existing.JIRA_BASE_URL
    ? `JIRA_BASE_URL [${existing.JIRA_BASE_URL}]: `
    : 'JIRA_BASE_URL (e.g. https://jira.example.com): ';
  let baseUrl = (await rl.question(baseUrlPrompt)).trim() || existing.JIRA_BASE_URL || '';
  baseUrl = baseUrl.replace(/\/$/, '');
  if (!/^https?:\/\//.test(baseUrl)) {
    rl.close();
    console.error('Base URL must start with http:// or https://');
    process.exit(1);
  }

  const patPrompt = existing.JIRA_PAT
    ? 'JIRA_PAT [keep existing — press Enter to reuse]: '
    : 'JIRA_PAT (Personal Access Token): ';
  let pat = (await rl.question(patPrompt)).trim();
  if (!pat) pat = existing.JIRA_PAT || '';
  if (!pat) {
    rl.close();
    console.error('JIRA_PAT is required.');
    process.exit(1);
  }
  rl.close();

  console.log('\nVerifying credentials against /rest/api/2/myself …');
  try {
    const me = await verify(baseUrl, pat);
    console.log(`✅ Authenticated as: ${me.displayName || me.name || me.key} (${me.emailAddress || 'no email'})`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.error('Not writing .env. Re-check the URL and PAT and try again.');
    process.exit(2);
  }

  writeEnv({ JIRA_BASE_URL: baseUrl, JIRA_PAT: pat });
  ensureGitignored();
  console.log(`\nWrote ${ENV_FILE} (chmod 600). Added .env to ${GITIGNORE} if it was missing.`);
  console.log('Done. JiraCom can now run jira.mjs commands.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
