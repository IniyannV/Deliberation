#!/usr/bin/env node
/*
 * npm run demo
 *
 * One command that starts the entire Deliberation system for judges and evaluators:
 * 1. Checks and auto-seeds the fictional demo case & Court Admin data if not present.
 * 2. Checks and auto-builds client bundles if needed.
 * 3. Starts both the Jury Deliberation server (port 4000) and Court Admin server (port 4100).
 * 4. Prints direct URLs and demo credentials for all roles (Foreperson, Jurors, Bailiff, Display, Admin).
 * 5. Opens the browser to the Foreperson view with the interactive guided tour ready.
 */

import { execFileSync, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DATA = path.join(ROOT_DIR, 'server', 'data');
const ADMIN_DATA = path.join(ROOT_DIR, 'court-admin', 'server', 'data');

// Terminal color helpers
const c = {
  reset: '\x1b[0m',
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`
${c.bold('Deliberation Demo Launcher')}

Usage:
  npm run demo [options]

Options:
  --no-seed, --keep Keep existing database data without re-seeding
  --dev, -d         Run in Vite hot-reload development mode
  --build, -b       Force rebuild of client and admin websites before launch
  --no-open         Do not automatically open the browser
  --port <number>   Port for Jury Deliberation app (default: 4000)
  --admin-port <n>  Port for Court Admin portal (default: 4100)
  --help, -h        Show this help message
`);
  process.exit(0);
}

const noSeed = args.includes('--no-seed') || args.includes('--keep');
const isDev = args.includes('--dev') || args.includes('-d');
const isBuild = args.includes('--build') || args.includes('-b');
const noOpen = args.includes('--no-open') || process.env.NO_OPEN === '1' || !!process.env.CI;

function getPortArg(flag, envVar, fallback) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return Number(args[idx + 1]);
  return Number(process.env[envVar]) || fallback;
}

const JURY_PORT = getPortArg('--port', 'PORT', 4000);
const ADMIN_PORT = getPortArg('--admin-port', 'ADMIN_PORT', 4100);

// Check Node.js version
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 20) {
  console.error(`${c.red('Error:')} Node.js 20+ is required (found v${process.versions.node}). Please upgrade Node.`);
  process.exit(1);
}

// Check port availability
function checkPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect(port, host)
      .once('connect', () => { socket.destroy(); resolve(true); })
      .once('error', () => resolve(false));
  });
}

async function ensurePortAvailable(port, name) {
  const inUse = await checkPortInUse(port);
  if (inUse) {
    console.error(`\n${c.red('Error:')} Port ${port} (${name}) is already in use by another process.`);
    console.error(`Please stop the running process or change the port using ${name === 'Jury App' ? '--port' : '--admin-port'}.\n`);
    process.exit(1);
  }
}

await ensurePortAvailable(JURY_PORT, 'Jury App');
await ensurePortAvailable(ADMIN_PORT, 'Court Admin');

// 1. Database Seeding check
const adminDbExists = fs.existsSync(path.join(ADMIN_DATA, 'db.json'));
const juryDbExists = fs.existsSync(path.join(SERVER_DATA, 'db.json'));

if (!noSeed || !adminDbExists || !juryDbExists) {
  console.log(`\n${c.cyan('⚙️  Initializing Court Admin data & preparing clean jury server...')}`);

  // Seed Court Admin (accounts, ready case "People v. Dana Whitlock", exhibits, PINs)
  console.log(`   ${c.dim('• Seeding Court Admin trial case and staff accounts...')}`);
  execFileSync(process.execPath, [path.join(ROOT_DIR, 'court-admin', 'server', 'scripts', 'seed.js')], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  // Reset Jury Server to empty state ("No case loaded")
  console.log(`   ${c.dim('• Setting Jury App to empty state ("No case loaded")...')}`);
  fs.mkdirSync(SERVER_DATA, { recursive: true });
  fs.rmSync(path.join(SERVER_DATA, 'uploads'), { recursive: true, force: true });
  fs.mkdirSync(path.join(SERVER_DATA, 'uploads', 'exhibits'), { recursive: true });
  fs.rmSync(path.join(SERVER_DATA, 'demo-credentials.txt'), { force: true });
  const emptyJuryDb = {
    case: { caption: 'No case loaded', caseNumber: '', court: '', counts: [] },
    users: [],
    sessions: [],
    exhibits: [],
    transcriptLinks: [],
    imageNotes: [],
    personal: {},
    timeline: [],
    votes: [],
    requests: [],
    chats: {},
    menu: [],
    supplies: [],
    display: { view: 'idle', voteId: null, exhibitId: null, message: null },
  };
  fs.writeFileSync(path.join(SERVER_DATA, 'db.json'), JSON.stringify(emptyJuryDb, null, 2));

  console.log(`${c.green('✓')} Demo environment initialized.`);
}

// 2. Client Build check (if not running in dev mode)
if (!isDev) {
  const juryDistExists = fs.existsSync(path.join(ROOT_DIR, 'client', 'dist', 'index.html'));
  const adminDistExists = fs.existsSync(path.join(ROOT_DIR, 'court-admin', 'client', 'dist', 'index.html'));

  if (isBuild || !juryDistExists || !adminDistExists) {
    console.log(`\n${c.cyan('📦 Building frontend production bundles...')}`);
    if (isBuild || !juryDistExists) {
      console.log(`   ${c.dim('• Building Jury client...')}`);
      execSync('npm run build -w client', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
    if (isBuild || !adminDistExists) {
      console.log(`   ${c.dim('• Building Court Admin client...')}`);
      execSync('npm run build -w court-admin-client', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
    console.log(`${c.green('✓')} Frontend build complete.`);
  }
}

// 3. Load credentials for banner display from Court Admin
function loadCourtAdminLogins() {
  const txtFile = path.join(ADMIN_DATA, 'demo-credentials.txt');
  const adminLogins = [];
  if (fs.existsSync(txtFile)) {
    const text = fs.readFileSync(txtFile, 'utf8');
    for (const line of text.split('\n')) {
      if (line.includes('Jury-room PINs')) break;
      const match = line.match(/^\s*(.+?)\s{2,}(\S+)\s{2,}(\S+)\s*$/);
      if (match) {
        const [, who, signIn, secret] = match;
        if (who === 'Who' || signIn === 'Username' || who.startsWith('─')) continue;
        adminLogins.push({ who, signIn, password: secret, role: signIn === 'admin' ? 'admin' : 'clerk' });
      }
    }
  }
  return adminLogins;
}

const adminLogins = loadCourtAdminLogins();

const adminUser = adminLogins.find((u) => u.signIn === 'admin') || { signIn: 'admin', password: 'see txt' };
const clerkUser = adminLogins.find((u) => u.signIn === 'clerk') || { signIn: 'clerk', password: 'see txt' };

// Network addresses
function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}
const lanIps = getLanAddresses();

// 4. Launch servers
console.log(`\n${c.cyan('🚀 Starting Deliberation demo servers...')}`);

const childProcesses = [];

function killChildren() {
  for (const proc of childProcesses) {
    try { proc.kill('SIGINT'); } catch {}
  }
}

process.on('SIGINT', () => {
  console.log(`\n${c.yellow('Shutting down Deliberation demo servers...')}`);
  killChildren();
  setTimeout(() => process.exit(0), 500);
});
process.on('SIGTERM', () => {
  killChildren();
  process.exit(0);
});

if (isDev) {
  // Development mode: runs concurrently with Vite
  const proc = spawn(
    'npx',
    [
      'concurrently',
      '-k',
      '-n', 'jury-srv,jury-ui,admin-srv,admin-ui',
      '-c', 'blue,green,magenta,cyan',
      'npm run dev -w server',
      'npm run dev -w client',
      'npm run dev -w court-admin-server',
      'npm run dev -w court-admin-client',
    ],
    {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(JURY_PORT), ADMIN_PORT: String(ADMIN_PORT) },
    }
  );
  childProcesses.push(proc);
  proc.on('exit', (code) => process.exit(code || 0));
} else {
  // Production mode: high performance, single port per app with strict offline CSP
  const juryProc = spawn(process.execPath, [path.join(ROOT_DIR, 'server', 'index.js')], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(JURY_PORT), NODE_ENV: 'production' },
  });
  childProcesses.push(juryProc);

  const adminProc = spawn(process.execPath, [path.join(ROOT_DIR, 'court-admin', 'server', 'index.js')], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(ADMIN_PORT),
      NODE_ENV: 'production',
      JURY_SERVER_URL: `http://localhost:${JURY_PORT}`,
    },
  });
  childProcesses.push(adminProc);

  // Pipe server output cleanly
  juryProc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n').filter(Boolean);
    for (const l of lines) console.log(`${c.blue('[jury]')} ${l}`);
  });
  juryProc.stderr.on('data', (d) => process.stderr.write(`${c.red('[jury err]')} ${d}`));

  adminProc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n').filter(Boolean);
    for (const l of lines) console.log(`${c.magenta('[admin]')} ${l}`);
  });
  adminProc.stderr.on('data', (d) => process.stderr.write(`${c.red('[admin err]')} ${d}`));

  // Wait for both servers to be listening
  async function waitForServers() {
    const maxTries = 50;
    for (let i = 0; i < maxTries; i++) {
      const jUp = await checkPortInUse(JURY_PORT);
      const aUp = await checkPortInUse(ADMIN_PORT);
      if (jUp && aUp) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  const ready = await waitForServers();
  if (!ready) {
    console.error(c.red('\nServers took too long to start. Please check the logs above.'));
    process.exit(1);
  }
}

// 5. Print Demo Banner
const juryUrl = `http://localhost:${JURY_PORT}`;
const adminUrl = `http://localhost:${ADMIN_PORT}`;

console.log(`
${c.blue('═'.repeat(74))}
  ${c.bold('⚖️   DELIBERATION — OFFLINE JURY SYSTEM')}
${c.blue('═'.repeat(74))}

  ${c.bold('Court Admin Portal:')}     ${c.cyan(adminUrl)}
  ${c.bold('Jury Deliberation App:')}  ${c.cyan(juryUrl)}

${c.dim('─'.repeat(74))}
  ${c.bold('COURT OFFICE SIGN-IN')} (${c.cyan(adminUrl)})
${c.dim('─'.repeat(74))}

    ${c.dim('Role'.padEnd(24) + 'Username'.padEnd(12) + 'Password')}
    ${c.dim('─'.repeat(68))}
    ${'Administrator'.padEnd(24)}${adminUser.signIn.padEnd(12)}${c.yellow(adminUser.password)}
    ${'Deputy Clerk'.padEnd(24)}${clerkUser.signIn.padEnd(12)}${c.yellow(clerkUser.password)}
`);

if (lanIps.length) {
  console.log(`  ${c.bold('On iPad / LAN devices:')}`);
  for (const ip of lanIps) {
    console.log(`    → Court Admin:  ${c.cyan(`http://${ip}:${ADMIN_PORT}`)}`);
    console.log(`    → Jury App:     ${c.cyan(`http://${ip}:${JURY_PORT}`)}`);
  }
  console.log('');
}

console.log(`${c.yellow('  Press Ctrl+C to stop all servers.')}
${c.blue('═'.repeat(74))}
`);

// 6. Auto-open browser
if (!noOpen) {
  try {
    const opener = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start'
      : 'xdg-open';
    execSync(`${opener} ${adminUrl}`, { stdio: 'ignore' });
  } catch {}
}
