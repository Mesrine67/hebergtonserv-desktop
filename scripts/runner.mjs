// HébergTonServ Runner Manager — Windows CLI / terminal dashboard.
// The official GitHub Actions runner is managed as an external process.
import { execFile, execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import readline from 'node:readline';

const execAsync = promisify(execFile);
const args = process.argv.slice(2);
const flag = (key, fallback) => {
  const index = args.indexOf(key);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const runnerDir = resolve(flag('--runner-dir', process.env.HTS_RUNNER_DIR || 'C:/actions-runner'));
const repo = flag('--repo', process.env.HTS_GITHUB_REPO || 'Mesrine67/hebergtonserv-desktop');
const command = args[0] || 'status';
const jsonMode = args.includes('--json');
const runCmd = join(runnerDir, 'run.cmd');
const color = (code, text) => process.stdout.isTTY ? '\x1b[' + code + 'm' + text + '\x1b[0m' : text;
const redact = (line) => String(line)
  .replace(/(Bearer\s+)[A-Za-z0-9._~-]+/ig, '$1[REDACTED]')
  .replace(/(Authorization\s*[:=]\s*)\S+/ig, '$1[REDACTED]')
  .replace(/((?:token|password|private_key)\s*[:=]\s*)\S+/ig, '$1[REDACTED]');

function isActive() {
  if (process.platform !== 'win32') return false;
  try {
    const output = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Runner.Listener.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 4500 });
    return output.toLowerCase().includes('runner.listener.exe');
  } catch { return false; }
}

async function ghJson(argv) {
  try {
    const { stdout } = await execAsync('gh', argv, { encoding: 'utf8', timeout: 12000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { data: JSON.parse(stdout), error: null };
  } catch (error) {
    return { data: null, error: String(error.message || error).slice(0, 240) };
  }
}

async function readStatus() {
  const local = isActive();
  const api = await ghJson(['api', 'repos/' + repo + '/actions/runners']);
  const runners = api.data?.runners || [];
  const github = runners.find((r) => r.name === 'hebergtonserv-runner') || runners.find((r) => r.labels?.some((label) => label.name === 'Windows')) || null;
  return { local, runnerDir, executableFound: existsSync(runCmd), github: github ? { name: github.name, status: github.status, busy: github.busy, labels: github.labels?.map((x) => x.name) || [] } : null, githubError: api.error };
}

async function readRuns(limit = 8) {
  const result = await ghJson(['run', 'list', '--repo', repo, '--limit', String(limit), '--json', 'databaseId,name,status,conclusion,headBranch,event,createdAt,url']);
  return result.data || [];
}

async function readIssues(kind, limit = 8) {
  const result = await ghJson([kind, 'list', '--repo', repo, '--state', 'open', '--limit', String(limit), '--json', 'number,title,url']);
  return result.data || [];
}

function latestRunnerLog() {
  const diagDir = join(runnerDir, '_diag');
  if (!existsSync(diagDir)) return null;
  const matches = readdirSync(diagDir)
    .filter((file) => /^Runner_.*\.log$/i.test(file))
    .map((file) => ({ file, time: statSync(join(diagDir, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return matches.length ? join(diagDir, matches[0].file) : null;
}

function showLogs(lines = 30) {
  const file = latestRunnerLog();
  if (!file) { console.log('Aucun journal runner trouvé.'); return; }
  console.log('Journal : ' + file);
  const rows = readFileSync(file, 'utf8').split(/\r?\n/).slice(-Math.min(Math.max(lines, 1), 250));
  console.log(rows.map(redact).join('\n'));
}

async function doctor() {
  const status = await readStatus();
  const rustBin = join(homedir(), '.rustup', 'toolchains', 'stable-x86_64-pc-windows-msvc', 'bin', 'cargo.exe');
  const rustProxy = join(homedir(), '.cargo', 'bin', 'cargo.exe');
  const rustProxyLength = existsSync(rustProxy) ? statSync(rustProxy).size : null;
  const diagnostics = {
    ...status,
    platform: process.platform,
    node: process.version,
    rustToolchainPresent: existsSync(rustBin),
    rustProxyBytes: rustProxyLength,
    rustProxyBroken: rustProxyLength === 0,
    notes: [
      'Éviter le code non fiable sur le runner de votre PC principal.',
      'Ne jamais exposer les jetons et clés privées dans les journaux.',
      'Un runner connecté ne garantit pas une CI réussie.'
    ]
  };
  if (jsonMode) console.log(JSON.stringify(diagnostics, null, 2));
  else {
    console.log(color('1;36', 'HébergTonServ — Runner Doctor'));
    console.log('Répertoire :', diagnostics.runnerDir);
    console.log('run.cmd :', diagnostics.executableFound ? 'présent' : 'absent');
    console.log('Processus :', diagnostics.local ? 'actif' : 'inactif');
    console.log('GitHub :', diagnostics.github?.status || diagnostics.githubError || 'indéterminé');
    console.log('Cargo réel :', diagnostics.rustToolchainPresent ? 'présent' : 'absent');
    console.log('Proxy Rustup :', diagnostics.rustProxyBroken ? 'endommagé (0 octet)' : 'présent ou non requis');
    diagnostics.notes.forEach((note) => console.log('  • ' + note));
  }
}

function printHelp() {
  console.log('HébergTonServ Runner Manager');
  console.log('Usage: node scripts/runner.mjs <status|doctor|jobs|prs|issues|logs|start|stop|tui> [options]');
  console.log('Options: --json, --repo OWNER/REPO, --runner-dir PATH, --limit N, --lines N');
  console.log('TUI: [R]afraîchir, [J]obs, [P]ull requests, [I]ssues, [L]ogs, [D]iagnostic, [Q]uitter');
  console.log('Les commandes stop/restart brutales sont volontairement désactivées.');
}

async function tui() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Le TUI requiert un terminal interactif (Windows Terminal).');
  }
  let page = 'jobs';
  let drawing = false;
  let stopping = false;
  let timer;
  const redraw = async () => {
    if (drawing || stopping) return;
    drawing = true;
    try {
      const state = await readStatus();
      let list = [];
      if (page === 'jobs') list = (await readRuns(8)).map((r) => (r.conclusion || r.status).padEnd(10) + ' ' + r.name + ' — ' + r.headBranch);
      if (page === 'prs') list = (await readIssues('pr', 12)).map((r) => '#' + r.number + ' ' + r.title);
      if (page === 'issues') list = (await readIssues('issue', 12)).map((r) => '#' + r.number + ' ' + r.title);
      if (page === 'logs') {
        const file = latestRunnerLog();
        list = file ? readFileSync(file, 'utf8').split(/\r?\n/).slice(-12).map(redact) : ['Aucun journal'];
      }
      if (page === 'doctor') {
        const realCargo = join(homedir(), '.rustup', 'toolchains', 'stable-x86_64-pc-windows-msvc', 'bin', 'cargo.exe');
        list = ['run.cmd : ' + (state.executableFound ? 'OK' : 'ABSENT'), 'Cargo MSVC : ' + (existsSync(realCargo) ? 'OK' : 'ABSENT'), 'Processus local : ' + (state.local ? 'ACTIVE' : 'INACTIF'), 'Statut GitHub : ' + (state.github?.status || 'inconnu')];
      }
      const width = Math.max(45, process.stdout.columns || 90);
      const cut = (s) => String(s).slice(0, width - 3);
      const heading = color('1;36', ' HÉBERGTONSERV  /  RUNNER MANAGER ');
      const meta = (state.local ? color('32', 'LOCAL ACTIF') : color('31', 'LOCAL INACTIF')) + '   GITHUB: ' + (state.github?.status || 'indisponible') + (state.github?.busy ? ' (busy)' : '');
      const lines = [heading, '═'.repeat(Math.min(width - 1, 72)), cut(meta), cut(repo), '', color('1', page.toUpperCase()), ...list.slice(0, Math.max(3, (process.stdout.rows || 24) - 11)).map(cut), '', ' [R] Refresh  [J] Jobs  [P] PR  [I] Issues  [L] Logs  [D] Doctor  [Q] Quit', ' Rafraîchissement toutes les 10 secondes — lecture seule'];
      process.stdout.write('\x1b[H\x1b[2J' + lines.join('\n') + '\n');
    } finally { drawing = false; }
  };
  const finish = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('keypress', onKey);
    process.stdout.write('\x1b[?25h\x1b[0m\n');
  };
  const onKey = (_str, key) => {
    if (key?.ctrl && key.name === 'c') { finish(); return; }
    const pressed = key?.name;
    if (pressed === 'q' || pressed === 'escape') return finish();
    if (pressed === 'j') page = 'jobs';
    else if (pressed === 'p') page = 'prs';
    else if (pressed === 'i') page = 'issues';
    else if (pressed === 'l') page = 'logs';
    else if (pressed === 'd') page = 'doctor';
    else if (pressed !== 'r') return;
    void redraw();
  };
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', onKey);
  process.stdout.write('\x1b[?25l');
  process.once('SIGINT', finish);
  timer = setInterval(() => void redraw(), 10000);
  await redraw();
}

async function main() {
  if (command === 'help' || command === '--help' || command === '-h') return printHelp();
  if (command === 'status') {
    const state = await readStatus();
    console.log(jsonMode ? JSON.stringify(state, null, 2) : 'Local : ' + (state.local ? 'actif' : 'inactif') + ' | GitHub : ' + (state.github?.status || state.githubError || 'inconnu') + ' | busy : ' + (state.github?.busy ?? 'n/a'));
    return;
  }
  if (command === 'doctor') return doctor();
  if (command === 'tui') return tui();
  if (command === 'jobs' || command === 'prs' || command === 'issues') {
    const limit = Math.min(50, Math.max(1, Number(flag('--limit', '10')) || 10));
    const data = command === 'jobs' ? await readRuns(limit) : await readIssues(command === 'prs' ? 'pr' : 'issue', limit);
    if (jsonMode) console.log(JSON.stringify(data, null, 2));
    else data.forEach((row) => console.log(command === 'jobs' ? (row.conclusion || row.status) + ' — ' + row.name + ' (' + row.headBranch + ')' : '#' + row.number + ' — ' + row.title));
    return;
  }
  if (command === 'logs') return showLogs(Number(flag('--lines', '30')) || 30);
  if (command === 'start') {
    if (!existsSync(runCmd)) throw new Error('run.cmd introuvable dans ' + runnerDir);
    if (isActive()) { console.log('Runner déjà actif, aucun double lancement.'); return; }
    const child = spawn('cmd.exe', ['/c', 'run.cmd'], { cwd: runnerDir, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    console.log('Runner démarré. Vérifiez le statut avec la commande status.');
    return;
  }
  if (command === 'stop' || command === 'restart') {
    console.error('Arrêt forcé désactivé. Dans le terminal du runner, utilisez Ctrl+C pour un arrêt propre.');
    process.exitCode = 2;
    return;
  }
  printHelp();
  process.exitCode = 2;
}
main().catch((error) => { console.error(redact(error.message || error)); process.exitCode = 1; });
