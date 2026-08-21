import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { MapperOutput, SimulatorOutput, ArchitectOutput } from './contracts.js';
import type { VerifiedFinding, StaleRef } from './contracts.js';
import { scan } from './discover.js';
import { callStructured, MODELS } from './llm.js';
import { verifyFindings } from './verify.js';
import { PAGE } from './ui.js';

// Load .env without a dependency (same loader as the CLI).
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim();
  }
}

const MAPPER_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['contradiction', 'duplication', 'scope-leak', 'overlap'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: { file: { type: 'string' }, line: { type: 'integer' }, quote: { type: 'string' } },
              required: ['file', 'line', 'quote'],
              additionalProperties: false,
            },
          },
        },
        required: ['type', 'severity', 'title', 'detail', 'citations'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
};

const SIM_SCHEMA = {
  type: 'object',
  properties: {
    task: { type: 'string' },
    relevantFiles: { type: 'array', items: { type: 'string' } },
    irrelevantAlwaysOn: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
  required: ['task', 'relevantFiles', 'irrelevantAlwaysOn', 'rationale'],
  additionalProperties: false,
};

const ARCH_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['DELETE', 'MOVE', 'SCOPE', 'MERGE', 'KEEP'] },
          target: { type: 'string' },
          rationale: { type: 'string' },
          estTokensSaved: { type: 'integer' },
        },
        required: ['op', 'target', 'rationale', 'estTokensSaved'],
        additionalProperties: false,
      },
    },
  },
  required: ['actions'],
  additionalProperties: false,
};

class UserFacing extends Error {
  constructor(public title: string, msg: string) {
    super(msg);
  }
}

export function parseRepo(input: string): { owner: string; repo: string } {
  const s = input.trim().replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) throw new UserFacing('Bad repo', `Use owner/repo, e.g. shapeshift/web. Got "${input}".`);
  return { owner: parts[0]!, repo: parts[1]! };
}

const GH_HEADERS: Record<string, string> = {
  accept: 'application/vnd.github+json',
  'user-agent': 'ctaio-context-debt',
};
if (process.env.GITHUB_TOKEN) GH_HEADERS.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

/** Is this path agent-facing context we care about? */
function isContextPath(p: string): boolean {
  if (p === 'CLAUDE.md' || p === 'AGENTS.md') return true;
  return p.startsWith('.claude/') && p.endsWith('.md');
}

const MAX_FILES = 80;

/**
 * Fetch the repo's FULL tree (one API call) plus the contents of just the
 * agent-context markdown. The full tree matters: stale-ref detection is only
 * honest if it can distinguish "this path is gone" from "I never fetched it".
 */
async function fetchRepoContext(owner: string, repo: string) {
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: GH_HEADERS });
  if (metaRes.status === 404) {
    throw new UserFacing('Repo not found', `${owner}/${repo} does not exist or is private. This tool reads public repos only.`);
  }
  if (metaRes.status === 403 || metaRes.status === 429) {
    throw new UserFacing('Rate limited', 'GitHub rate-limited this request. Set GITHUB_TOKEN in .env to raise the limit, or retry shortly.');
  }
  if (!metaRes.ok) throw new UserFacing('GitHub error', `repos API returned HTTP ${metaRes.status}.`);
  const meta = (await metaRes.json()) as { default_branch?: string };
  const branch = meta.default_branch ?? 'main';

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: GH_HEADERS },
  );
  if (treeRes.status === 403 || treeRes.status === 429) {
    throw new UserFacing('Rate limited', 'GitHub rate-limited the tree request. Set GITHUB_TOKEN in .env, or retry shortly.');
  }
  if (!treeRes.ok) throw new UserFacing('GitHub error', `git/trees returned HTTP ${treeRes.status}.`);
  const tree = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }>; truncated?: boolean };
  const entries = tree.tree ?? [];

  // Every path in the repo, so the stale-ref check has ground truth.
  const treeSet = new Set(entries.map((e) => e.path));
  // Directories aren't listed as their own prefix for `dir/` style refs, so
  // record those too.
  for (const e of entries) {
    if (e.type === 'tree') treeSet.add(e.path + '/');
  }

  const wanted = entries.filter((e) => e.type === 'blob' && isContextPath(e.path)).map((e) => e.path);
  if (wanted.length === 0) {
    throw new UserFacing(
      'No agent context found',
      `${owner}/${repo} has no CLAUDE.md, AGENTS.md or .claude/**.md on ${branch}. Nothing to measure.`,
    );
  }
  const picked = wanted.slice(0, MAX_FILES);

  // raw.githubusercontent is a different host, so these don't burn API quota.
  const files: Array<{ path: string; text: string }> = [];
  const CONC = 12;
  for (let i = 0; i < picked.length; i += CONC) {
    const batch = picked.slice(i, i + CONC);
    const got = await Promise.all(
      batch.map(async (p) => {
        const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`);
        return r.ok ? { path: p, text: await r.text() } : null;
      }),
    );
    for (const g of got) if (g) files.push(g);
  }

  return { branch, treeSet, files, truncatedTree: !!tree.truncated, skipped: wanted.length - picked.length };
}

/**
 * Materialize the fetched markdown into a temp dir so scan() and
 * verifyFindings() work unmodified against real files on disk.
 */
function materialize(files: Array<{ path: string; text: string }>): string {
  const root = mkdtempSync(join(tmpdir(), 'ctxdebt-'));
  for (const f of files) {
    const abs = join(root, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.text);
  }
  return root;
}

/**
 * THE FIX THAT MATTERS: we only fetched .md, so the on-disk existsSync check
 * calls every other referenced path "missing". Re-judge each candidate against
 * the repo's real tree instead. Refs outside the repo (~/…) are dropped rather
 * than reported, because this tool cannot see the user's machine.
 */
function filterStaleRefs(refs: StaleRef[], treeSet: Set<string>): StaleRef[] {
  const out: StaleRef[] = [];
  for (const r of refs) {
    if (r.ref.startsWith('~/')) continue; // user-machine path, not a repo claim

    // A `./foo` in .claude/commands/x.md almost always means "foo from the repo
    // root", because that's the cwd the command runs in — not a sibling of the
    // markdown file. Resolving it file-relative reported all 28 refs in
    // anthropics/claude-code as broken when `scripts/gh.sh` was sitting right
    // there in the tree. Try both readings and only call it stale if NEITHER
    // resolves: a checker that cries wolf is worse than no checker at all.
    const bare = posix.normalize(r.ref.replace(/^\.\//, ''));
    const candidates = [bare, posix.normalize(posix.join(posix.dirname(r.file), bare))];

    const hit = candidates.some(
      (p) => treeSet.has(p) || treeSet.has(p + '/') || treeSet.has(p.replace(/\/$/, '')),
    );
    if (hit) continue;
    out.push({ ...r, reason: 'referenced path is not in the repository tree' });
  }
  return out;
}

function corpus(root: string, files: { path: string }[], cap = 240) {
  return files
    .map((f) => {
      const lines = readFileSync(join(root, f.path), 'utf8').split('\n').slice(0, cap);
      return `===== ${f.path} =====\n${lines.map((l, i) => `${i + 1}: ${l}`).join('\n')}`;
    })
    .join('\n\n');
}

async function runPipeline(repoInput: string, task: string, emit: (o: unknown) => void) {
  const { owner, repo } = parseRepo(repoInput);
  const t0 = Date.now();
  const log: string[] = [];
  let tmp: string | null = null;

  try {
    // ---- STAGE 1 -----------------------------------------------------------
    emit({ stage: 'scan', status: 'running', meta: `fetching ${owner}/${repo}` });
    const gh = await fetchRepoContext(owner, repo);
    tmp = materialize(gh.files);

    const raw = scan(tmp);
    const staleRefs = filterStaleRefs(raw.staleRefs, gh.treeSet);
    const inv = { ...raw, root: `${owner}/${repo}`, staleRefs };

    if (inv.files.length === 0) {
      throw new UserFacing('No agent context found', `Nothing readable in ${owner}/${repo}.`);
    }
    emit({
      stage: 'scan',
      status: 'done',
      meta: `${inv.files.length} files · ${inv.totalTokens.toLocaleString()} est tokens · ${staleRefs.length} stale refs`,
    });
    log.push(`scan: ${inv.files.length} files, ${inv.totalTokens} est tokens, ${staleRefs.length} stale refs (deterministic, checked vs full GitHub tree)`);
    if (gh.skipped > 0) log.push(`scan: capped at ${MAX_FILES} files, ${gh.skipped} not fetched`);
    if (gh.truncatedTree) log.push('scan: GitHub truncated the tree listing, stale-ref check may under-report');

    const text = corpus(tmp, inv.files);

    // ---- STAGE 2 + 3, two vendors, in parallel ------------------------------
    emit({ stage: 'mapper', status: 'running', meta: MODELS.mapper });
    emit({ stage: 'simulator', status: 'running', meta: MODELS.simulator });

    const mapperP = callStructured({
      model: MODELS.mapper,
      schemaName: 'findings',
      jsonSchema: MAPPER_SCHEMA,
      validator: MapperOutput,
      maxTokens: 4000,
      system:
        'You audit agentic-coding context files (CLAUDE.md, .claude/agents, .claude/skills) for CONTEXT DEBT. ' +
        'Report only: contradiction (two instructions that cannot both be followed), duplication (same instruction ' +
        'stated in multiple files), scope-leak (narrow tech-specific rules loaded for every task), overlap (two ' +
        'agents/skills with the same remit). ' +
        'EVERY finding MUST cite file + the exact line number shown in the numbered corpus + a VERBATIM quote copied ' +
        'character-for-character from that line. Your citations are machine-verified against the real files and any ' +
        'finding whose quote is not found is discarded, so never paraphrase a quote or guess a line number. ' +
        'Prefer 4-8 high-quality findings over many weak ones.',
      user: `Audit this agent context.\n\n${text}`,
    }).then((r) => {
      emit({
        stage: 'mapper',
        status: 'done',
        meta: `${r.value.findings.length} raw findings · ${r.ms}ms${r.retried ? ' · retried' : ''}`,
      });
      return r;
    });

    const simP = callStructured({
      model: MODELS.simulator,
      schemaName: 'simulation',
      jsonSchema: SIM_SCHEMA,
      validator: SimulatorOutput,
      // A big repo means a long file list, and the simulator echoes paths back.
      // At 1500 the JSON was truncated mid-object on shapeshift/web (68 files),
      // failing the schema twice and killing the run — the retry re-hit the same
      // ceiling, so a cap looked exactly like a misbehaving model.
      maxTokens: 6000,
      system:
        'You simulate what an agentic coding tool would actually load into context for one concrete task. ' +
        'Given the inventory, decide which files genuinely inform the task and which always-on files are dead ' +
        'weight for it. Use exact paths from the inventory. Be strict: most always-on context is irrelevant to ' +
        'any single task.',
      user: `Task: "${task}"\n\nInventory:\n${inv.files.map((f) => `${f.path} [${f.kind}, ~${f.estTokens} tok]`).join('\n')}`,
    }).then((r) => {
      emit({
        stage: 'simulator',
        status: 'done',
        meta: `${r.value.irrelevantAlwaysOn.length} irrelevant always-on · ${r.ms}ms${r.retried ? ' · retried' : ''}`,
      });
      return r;
    });

    const [mapper, sim] = await Promise.all([mapperP, simP]);
    log.push(`mapper(${MODELS.mapper}): ${mapper.value.findings.length} raw findings${mapper.retried ? ' [retried after schema failure]' : ''}`);
    log.push(`simulator(${MODELS.simulator}): ${sim.value.irrelevantAlwaysOn.length} irrelevant always-on files${sim.retried ? ' [retried]' : ''}`);

    // ---- STAGE 4: THE GATE --------------------------------------------------
    emit({ stage: 'verify', status: 'running', meta: 'reopening cited files' });
    const verified: VerifiedFinding[] = verifyFindings(tmp, mapper.value.findings);
    const confirmed = verified.filter((f) => f.verdict === 'CONFIRMED');
    const killed = verified.filter((f) => f.verdict === 'KILLED');
    emit({ stage: 'verify', status: 'done', meta: `${confirmed.length} confirmed · ${killed.length} killed` });
    log.push(`verify: ${confirmed.length} confirmed, ${killed.length} killed for unverifiable citations (deterministic)`);

    // ---- STAGE 5 ------------------------------------------------------------
    emit({ stage: 'architect', status: 'running', meta: MODELS.architect });
    const wasted = sim.value.irrelevantAlwaysOn.reduce(
      (a, p) => a + (inv.files.find((f) => f.path === p)?.estTokens ?? 0),
      0,
    );
    const arch = await callStructured({
      model: MODELS.architect,
      schemaName: 'plan',
      jsonSchema: ARCH_SCHEMA,
      validator: ArchitectOutput,
      maxTokens: 2000,
      system:
        'You propose a concrete cleanup plan for an agentic-coding context setup. One action per target file. ' +
        'DELETE (dead), MOVE (always-on → on-demand skill), SCOPE (restrict to a subtree/task type), MERGE ' +
        '(fold duplicate/overlapping files together), KEEP (genuinely earns always-on cost). Be specific and ' +
        'conservative with estTokensSaved — use the real token counts given.',
      user:
        `Inventory:\n${inv.files.map((f) => `${f.path} [${f.kind}, ~${f.estTokens} tok]`).join('\n')}\n\n` +
        `VERIFIED findings (hallucinated ones already removed):\n${confirmed.map((f) => `- [${f.type}/${f.severity}] ${f.title}: ${f.detail}`).join('\n') || '(none)'}\n\n` +
        `Stale refs (deterministic):\n${inv.staleRefs.slice(0, 20).map((s) => `- ${s.file}:${s.line} → ${s.ref}`).join('\n') || '(none)'}\n\n` +
        `For task "${task}" these always-on files were judged irrelevant: ${sim.value.irrelevantAlwaysOn.join(', ') || '(none)'}`,
    });
    emit({ stage: 'architect', status: 'done', meta: `${arch.value.actions.length} actions · ${arch.ms}ms` });
    log.push(`architect(${MODELS.architect}): ${arch.value.actions.length} cleanup actions`);

    const wastePct = inv.alwaysOnTokens > 0 ? Math.round((wasted / inv.alwaysOnTokens) * 100) : 0;
    const penalty =
      confirmed.filter((f) => f.severity === 'high').length * 12 +
      confirmed.filter((f) => f.severity === 'medium').length * 6 +
      confirmed.filter((f) => f.severity === 'low').length * 2 +
      Math.min(20, inv.staleRefs.length * 4) +
      Math.round(wastePct / 4);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    emit({
      stage: 'done',
      data: {
        generatedAt: new Date().toISOString(),
        root: `${owner}/${repo}`,
        branch: gh.branch,
        task,
        score,
        wastePct,
        wastedTokens: wasted,
        inventory: inv,
        simulation: sim.value,
        findings: verified,
        actions: arch.value.actions,
        pipeline: log,
        models: MODELS,
        elapsedMs: Date.now() - t0,
      },
    });
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      let body: { repo?: string; task?: string };
      try {
        body = (await req.json()) as { repo?: string; task?: string };
      } catch {
        return new Response(JSON.stringify({ stage: 'error', title: 'Bad request', message: 'Body must be JSON.' }), {
          status: 400,
          headers: { 'content-type': 'application/x-ndjson' },
        });
      }
      const repo = String(body.repo ?? '');
      const task = String(body.task ?? 'add a new feature with tests');

      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const emit = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
          try {
            await runPipeline(repo, task, emit);
          } catch (e) {
            // Never leak the key or a raw stack to the client.
            if (e instanceof UserFacing) {
              emit({ stage: 'error', title: e.title, message: e.message });
            } else {
              console.error('[pipeline]', e);
              emit({ stage: 'error', title: 'Analysis failed', message: 'The pipeline errored. Check server logs.' });
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.error(`context-debt server on http://localhost:${port}`);
