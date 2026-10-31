import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execFile);
const safeRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function syncProject({
  repo,
  projectNumber,
  apply = false,
  offline = false,
  gh = async (params) => {
    const { stdout } = await execAsync('gh', params, {
      timeout: 18000, windowsHide: true, maxBuffer: 2 * 1024 * 1024
    });
    return JSON.parse(stdout);
  },
  addItem = async (params) => {
    await execAsync('gh', params, { timeout: 18000, windowsHide: true });
  },
} = {}) {
  if (!safeRepo.test(repo || '') || !Number.isInteger(projectNumber) || projectNumber < 1) {
    throw new Error('Dépôt ou numéro de projet invalide.');
  }
  if (offline) throw new Error('Synchronisation GitHub indisponible en mode --offline.');
  const owner = repo.split('/')[0];
  const [project, issueRows] = await Promise.all([
    gh(['project', 'item-list', String(projectNumber), '--owner', owner,
      '--limit', '500', '--format', 'json']),
    gh(['issue', 'list', '--repo', repo, '--state', 'all',
      '--limit', '500', '--json', 'number,title,url'])
  ]);
  if (!Array.isArray(project?.items) || !Array.isArray(issueRows)) {
    throw new Error('Réponse GitHub Projects illisible : aucune mutation effectuée.');
  }
  const existing = new Set(project.items.map((item) =>
    item.content?.url || item.content?.repositoryUrl || item.url
  ).filter(Boolean));
  const missing = issueRows.filter((issue) => issue.url && !existing.has(issue.url));
  if (apply) {
    for (const issue of missing) {
      await addItem(['project', 'item-add', String(projectNumber), '--owner', owner, '--url', issue.url]);
    }
  }
  return {
    project: projectNumber,
    totalIssues: issueRows.length,
    existing: issueRows.length - missing.length,
    missing: missing.map(({ number, url }) => ({ number, url })),
    applied: apply ? missing.length : 0,
    dryRun: !apply
  };
}
