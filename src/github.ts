import type { VirtualFile } from './vfs.js';

/**
 * Pulls just the agent-context files out of a GitHub repo over the REST API —
 * no clone, no disk. This is what lets the analyzer run against a repo the
 * server has never seen, straight from a web request.
 */

const MAX_FILES = 80;
const MAX_BYTES = 400 * 1024;
const CONCURRENCY = 8;

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();

  // "owner/repo"
  let m = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (m) return { owner: m[1]!, repo: m[2]! };

  // https://github.com/owner/repo(.git)?(/tree/...|/blob/...|?...|#...)?
  // git@github.com:owner/repo(.git)?
  m = trimmed.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/);
  if (m) return { owner: m[1]!, repo: m[2]! };

  return null;
}

function isWantedPath(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  if (base === 'CLAUDE.md' || base === 'AGENTS.md') return true;
  if (path.startsWith('.claude/') && path.endsWith('.md')) return true;
  return false;
}

export async function fetchRepoContext(owner: string, repo: string, token?: string): Promise<VirtualFile[]> {
  const apiHeaders: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) apiHeaders.Authorization = `Bearer ${token}`;

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
    headers: apiHeaders,
  });
  if (treeRes.status === 404) {
    throw new Error(`GitHub repo ${owner}/${repo} not found (or private — pass a token)`);
  }
  if (treeRes.status === 403) {
    throw new Error(`GitHub API rate limit hit while fetching ${owner}/${repo} — try again later or pass a token`);
  }
  if (!treeRes.ok) {
    throw new Error(`GitHub API error ${treeRes.status} fetching ${owner}/${repo} tree`);
  }

  const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
  const candidates = (tree.tree ?? [])
    .filter((e) => e.type === 'blob' && isWantedPath(e.path))
    .map((e) => e.path)
    .slice(0, MAX_FILES);

  const rawHeaders: Record<string, string> = {};
  if (token) rawHeaders.Authorization = `Bearer ${token}`;

  const files: VirtualFile[] = [];
  let totalBytes = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      if (files.length >= MAX_FILES || totalBytes >= MAX_BYTES) return;
      const path = candidates[cursor++]!;
      const rawRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`, {
        headers: rawHeaders,
      });
      if (!rawRes.ok) continue;
      const text = await rawRes.text();
      if (totalBytes + Buffer.byteLength(text) > MAX_BYTES) continue;
      files.push({ path, text });
      totalBytes += Buffer.byteLength(text);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return files;
}
