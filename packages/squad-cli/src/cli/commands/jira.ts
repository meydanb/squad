/**
 * squad jira — Jira on-prem authentication, modeled after `gh auth login`.
 *
 * Subcommands:
 *   squad jira auth login    Capture JIRA_BASE_URL + JIRA_PAT, verify, write .squad/.env
 *   squad jira auth status   Show current auth state (verifies, masks the token)
 *   squad jira auth logout   Remove JIRA_BASE_URL + JIRA_PAT from .squad/.env
 *
 * The same skill at .squad/skills/atlassian-rest/scripts/setup.mjs remains as a
 * fallback for environments without the squad CLI. This command is the
 * recommended entry point.
 *
 * @module cli/commands/jira
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const ENV_KEYS = ['JIRA_BASE_URL', 'JIRA_PAT'] as const;

interface EnvFile {
  path: string;
  values: Record<string, string>;
}

function findSquadDir(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.squad');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error(
    `No .squad/ directory found walking up from ${start}. Run "squad init" first.`
  );
}

function loadEnv(squadDir: string): EnvFile {
  const envPath = path.join(squadDir, '.env');
  const values: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) values[m[1]!] = m[2]!;
    }
  }
  return { path: envPath, values };
}

function writeEnv(envFile: EnvFile, updates: Record<string, string | undefined>): void {
  const merged: Record<string, string> = { ...envFile.values };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  const content = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(envFile.path, content, { mode: 0o600 });
}

function ensureGitignored(squadDir: string): void {
  const gitignore = path.join(squadDir, '.gitignore');
  const want = '.env';
  let current = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  if (!current.split(/\r?\n/).includes(want)) {
    if (current && !current.endsWith('\n')) current += '\n';
    current += want + '\n';
    fs.writeFileSync(gitignore, current);
  }
}

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '*'.repeat(token.length);
  return `${token.slice(0, 4)}…${token.slice(-4)} (${token.length} chars)`;
}

async function verifyCredentials(baseUrl: string, pat: string): Promise<{
  ok: true;
  user: { name: string; email: string };
} | { ok: false; status: number; body: string }> {
  const url = baseUrl.replace(/\/$/, '') + '/rest/api/2/myself';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  const j = await res.json() as { displayName?: string; name?: string; key?: string; emailAddress?: string };
  return {
    ok: true,
    user: {
      name: j.displayName || j.name || j.key || '(unknown)',
      email: j.emailAddress || '(no email)',
    },
  };
}

// ── argv parsing ────────────────────────────────────────────────────────────

interface AuthLoginFlags {
  baseUrl?: string;
  withToken?: string;
  tokenStdin: boolean;
  hostname?: string; // alias for --base-url, mirrors gh's --hostname
  skipVerify: boolean;
}

function parseLoginFlags(args: string[]): AuthLoginFlags {
  const flags: AuthLoginFlags = { tokenStdin: false, skipVerify: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const next = args[i + 1];
    if (a === '--base-url' && next) { flags.baseUrl = next; i++; }
    else if (a === '--hostname' && next) { flags.hostname = next; i++; }
    else if (a === '--with-token' && next) { flags.withToken = next; i++; }
    else if (a === '--token-stdin') { flags.tokenStdin = true; }
    else if (a === '--skip-verify') { flags.skipVerify = true; }
  }
  return flags;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(trimmed)) {
    throw new Error('Base URL must start with http:// or https://');
  }
  return trimmed;
}

// ── subcommand: login ───────────────────────────────────────────────────────

export interface LoginOptions {
  cwd?: string;
  args: string[];
}

export async function runJiraAuthLogin(opts: LoginOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const squadDir = findSquadDir(cwd);
  const envFile = loadEnv(squadDir);
  const flags = parseLoginFlags(opts.args);

  // Resolve base URL: --base-url, --hostname, env var, existing .env, or prompt.
  let baseUrl = flags.baseUrl
    || flags.hostname
    || process.env['JIRA_BASE_URL']
    || envFile.values['JIRA_BASE_URL']
    || '';

  // Resolve PAT: --with-token, --token-stdin, env var, existing .env, or prompt.
  let pat = flags.withToken
    || (flags.tokenStdin ? await readStdin() : '')
    || process.env['JIRA_PAT']
    || '';

  const interactive = !baseUrl || !pat;

  if (interactive) {
    if (!process.stdin.isTTY) {
      throw new Error(
        'Interactive prompts require a TTY. Provide --base-url and --with-token / --token-stdin for non-interactive use.'
      );
    }
    const rl = readline.createInterface({ input, output });
    try {
      console.log(`\n${BOLD}squad jira auth login${RESET}\n`);
      console.log(`Will write to: ${DIM}${envFile.path}${RESET}\n`);

      if (!baseUrl) {
        const existing = envFile.values['JIRA_BASE_URL'];
        const prompt = existing
          ? `JIRA_BASE_URL [${existing}]: `
          : 'JIRA_BASE_URL (e.g. https://jira.example.com): ';
        const answer = (await rl.question(prompt)).trim();
        baseUrl = answer || existing || '';
      }
      if (!pat) {
        const existing = envFile.values['JIRA_PAT'];
        const prompt = existing
          ? 'JIRA_PAT [keep existing — press Enter to reuse]: '
          : 'JIRA_PAT (Personal Access Token): ';
        const answer = (await rl.question(prompt)).trim();
        pat = answer || existing || '';
      }
    } finally {
      rl.close();
    }
  }

  if (!baseUrl) throw new Error('JIRA_BASE_URL is required.');
  if (!pat) throw new Error('JIRA_PAT is required.');
  baseUrl = normalizeBaseUrl(baseUrl);

  if (flags.skipVerify) {
    console.log(`${YELLOW}⚠${RESET} --skip-verify set; not contacting ${baseUrl}/rest/api/2/myself.`);
  } else {
    process.stdout.write(`Verifying credentials against ${DIM}${baseUrl}/rest/api/2/myself${RESET} … `);
    const result = await verifyCredentials(baseUrl, pat);
    if (!result.ok) {
      console.log(`${RED}failed${RESET}`);
      console.error(`HTTP ${result.status}\n${result.body}`);
      throw new Error('Verification failed. Not writing .env. Re-run with corrected URL/PAT.');
    }
    console.log(`${GREEN}✓${RESET}`);
    console.log(`  Authenticated as: ${BOLD}${result.user.name}${RESET} (${result.user.email})`);
  }

  writeEnv(envFile, { JIRA_BASE_URL: baseUrl, JIRA_PAT: pat });
  ensureGitignored(squadDir);
  console.log(`\n${GREEN}✓${RESET} Wrote ${envFile.path} (chmod 600).`);
  console.log(`  ${DIM}.env is gitignored inside ${squadDir}.${RESET}`);
  console.log(`\nDone. JiraCom can now run jira.mjs commands.`);
}

// ── subcommand: status ──────────────────────────────────────────────────────

export async function runJiraAuthStatus(opts: { cwd?: string; args: string[] }): Promise<number> {
  const cwd = opts.cwd || process.cwd();
  const squadDir = findSquadDir(cwd);
  const envFile = loadEnv(squadDir);
  const baseUrl = envFile.values['JIRA_BASE_URL'] || process.env['JIRA_BASE_URL'];
  const pat = envFile.values['JIRA_PAT'] || process.env['JIRA_PAT'];

  console.log(`\n${BOLD}squad jira auth status${RESET}\n`);
  console.log(`Env file: ${DIM}${envFile.path}${RESET}`);
  if (!baseUrl || !pat) {
    console.log(`${RED}✗${RESET} Not authenticated.`);
    if (!baseUrl) console.log(`  Missing: JIRA_BASE_URL`);
    if (!pat) console.log(`  Missing: JIRA_PAT`);
    console.log(`\n  Run: ${BOLD}squad jira auth login${RESET}`);
    return 1;
  }

  console.log(`  JIRA_BASE_URL: ${baseUrl}`);
  console.log(`  JIRA_PAT:      ${maskToken(pat)}`);

  const skipVerify = opts.args.includes('--skip-verify');
  if (skipVerify) {
    console.log(`\n${YELLOW}⚠${RESET} --skip-verify set; not contacting Jira.`);
    return 0;
  }
  process.stdout.write(`\nPinging ${DIM}${baseUrl}/rest/api/2/myself${RESET} … `);
  const result = await verifyCredentials(baseUrl, pat);
  if (!result.ok) {
    console.log(`${RED}failed (HTTP ${result.status})${RESET}`);
    console.error(result.body);
    return 1;
  }
  console.log(`${GREEN}✓${RESET}`);
  console.log(`  Authenticated as: ${BOLD}${result.user.name}${RESET} (${result.user.email})`);
  return 0;
}

// ── subcommand: logout ──────────────────────────────────────────────────────

export async function runJiraAuthLogout(opts: { cwd?: string; args: string[] }): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const squadDir = findSquadDir(cwd);
  const envFile = loadEnv(squadDir);
  const had = ENV_KEYS.some((k) => envFile.values[k]);
  if (!had) {
    console.log(`Already logged out (no Jira credentials in ${envFile.path}).`);
    return;
  }
  const updates: Record<string, undefined> = {};
  for (const k of ENV_KEYS) updates[k] = undefined;
  writeEnv(envFile, updates);
  console.log(`${GREEN}✓${RESET} Removed JIRA_BASE_URL and JIRA_PAT from ${envFile.path}.`);
}

// ── dispatcher ─────────────────────────────────────────────────────────────

export async function runJira(args: string[]): Promise<number> {
  const [sub, action, ...rest] = args;
  if (!sub) {
    printJiraHelp();
    return 1;
  }
  if (sub === 'help' || sub === '--help' || sub === '-h') {
    printJiraHelp();
    return 0;
  }
  if (sub === 'auth') {
    if (!action || action === 'help' || action === '--help' || action === '-h') {
      printJiraAuthHelp();
      return action ? 0 : 1;
    }
    if (action === 'login') {
      await runJiraAuthLogin({ args: rest });
      return 0;
    }
    if (action === 'status') {
      return await runJiraAuthStatus({ args: rest });
    }
    if (action === 'logout') {
      await runJiraAuthLogout({ args: rest });
      return 0;
    }
    console.error(`Unknown auth subcommand: ${action}`);
    printJiraAuthHelp();
    return 2;
  }
  console.error(`Unknown jira subcommand: ${sub}`);
  printJiraHelp();
  return 2;
}

function printJiraHelp(): void {
  console.log(`\n${BOLD}squad jira${RESET} — Jira on-prem integration\n`);
  console.log(`Usage: squad jira <subcommand>\n`);
  console.log(`Subcommands:`);
  console.log(`  ${BOLD}auth login${RESET}    Authenticate with Jira on-prem (PAT)`);
  console.log(`  ${BOLD}auth status${RESET}   Show current authentication state`);
  console.log(`  ${BOLD}auth logout${RESET}   Remove Jira credentials from .squad/.env\n`);
  console.log(`Run 'squad jira auth --help' for auth-specific options.\n`);
}

function printJiraAuthHelp(): void {
  console.log(`\n${BOLD}squad jira auth${RESET} — Authentication for Jira on-prem (PAT)\n`);
  console.log(`Usage: squad jira auth <login|status|logout> [flags]\n`);
  console.log(`${BOLD}login${RESET} flags:`);
  console.log(`  --base-url <url>     Jira base URL (e.g. https://jira.example.com)`);
  console.log(`  --hostname <url>     Alias for --base-url`);
  console.log(`  --with-token <PAT>   Pass the PAT inline (avoid; visible in process list)`);
  console.log(`  --token-stdin        Read the PAT from stdin (recommended for scripts)`);
  console.log(`  --skip-verify        Don't ping /rest/api/2/myself before writing .env`);
  console.log(``);
  console.log(`${BOLD}status${RESET} flags:`);
  console.log(`  --skip-verify        Don't ping Jira; just show what's configured`);
  console.log(``);
  console.log(`Interactive (no flags): prompts for the URL and PAT, hides nothing — use a TTY.`);
  console.log(`Non-interactive example:`);
  console.log(`  ${DIM}cat my-pat.txt | squad jira auth login --base-url https://jira.example.com --token-stdin${RESET}\n`);
}
