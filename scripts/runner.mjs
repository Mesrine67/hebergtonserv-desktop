// scripts/runner.mjs — gestion du self-hosted runner GitHub (hebergtonserv-runner)
// Usage: node scripts/runner.mjs <start|stop|status>
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const RUNNER_DIR = 'C:/actions-runner';
const RUN_CMD = `${RUNNER_DIR}/run.cmd`;
const action = process.argv[2] || 'status';

function status() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Runner.Listener.exe" /NH', { encoding: 'utf8' });
    if (out.includes('Runner.Listener')) console.log('Runner actif.');
    else console.log('Runner inactif.');
  } catch { console.log('Runner inactif.'); }
}

if (action === 'status') { status(); process.exit(0); }
if (action === 'start') {
  if (!existsSync(RUN_CMD)) { console.error('run.cmd introuvable'); process.exit(1); }
  const child = spawn('cmd.exe', ['/c', RUN_CMD], { cwd: RUNNER_DIR, detached: true, stdio: 'ignore' });
  child.unref();
  console.log('Runner demarre (detached).');
  process.exit(0);
}
if (action === 'stop') {
  try { execSync('taskkill /F /IM Runner.Listener.exe /IM Runner.Worker.exe', { stdio: 'ignore' }); } catch {}
  console.log('Runner arrete.');
  process.exit(0);
}
console.error('Action inconnue: ' + action);
process.exit(1);
