import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MapperOutput, SimulatorOutput, ArchitectOutput } from './contracts.js';
import type { VerifiedFinding } from './contracts.js';
import { scan } from './discover.js';
import { callStructured, MODELS } from './llm.js';
import { verifyFindings } from './verify.js';
import { renderHtml } from './render.js';

// Load .env without a dependency.
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
              properties: {
                file: { type: 'string' },
                line: { type: 'integer' },
                quote: { type: 'string' },
              },
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

/** Numbered corpus so the model can cite real line numbers instead of guessing. */
function corpus(root: string, files: { path: string }[], cap = 240) {
  return files
    .map((f) => {
      const lines = readFileSync(join(root, f.path), 'utf8').split('\n').slice(0, cap);
      return `===== ${f.path} =====\n${lines.map((l, i) => `${i + 1}: ${l}`).join('\n')}`;
    })
    .join('\n\n');
}

async function main() {
  const root = process.argv[2] ?? process.cwd();
  const task = process.argv[3] ?? 'add an authenticated API route with tests';
  const log: string[] = [];
  const t0 = Date.now();

  // ---- STAGE 1: deterministic scan -----------------------------------------
  const inv = scan(root);
  if (inv.files.length === 0) {
    console.error(`No agent context found in ${root} (looked for CLAUDE.md, AGENTS.md, .claude/).`);
    process.exit(1);
  }
  console.error(
    `[scan] ${inv.files.length} files · ${inv.totalTokens} est tokens · ${inv.alwaysOnTokens} always-on · ${inv.staleRefs.length} stale refs`,
  );
  log.push(`scan: ${inv.files.length} files, ${inv.staleRefs.length} stale refs (deterministic)`);

  const text = corpus(root, inv.files);

  // ---- STAGE 2 + 3 in parallel: two different model families ---------------
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
  });

  const simP = callStructured({
    model: MODELS.simulator,
    schemaName: 'simulation',
    jsonSchema: SIM_SCHEMA,
    validator: SimulatorOutput,
    maxTokens: 1500,
    system:
      'You simulate what an agentic coding tool would actually load into context for one concrete task. ' +
      'Given the inventory, decide which files genuinely inform the task and which always-on files are dead ' +
      'weight for it. Use exact paths from the inventory. Be strict: most always-on context is irrelevant to ' +
      'any single task.',
    user: `Task: "${task}"\n\nInventory:\n${inv.files.map((f) => `${f.path} [${f.kind}, ~${f.estTokens} tok]`).join('\n')}`,
  });

  const [mapper, sim] = await Promise.all([mapperP, simP]);
  console.error(`[mapper] ${MODELS.mapper} → ${mapper.value.findings.length} findings (${mapper.ms}ms${mapper.retried ? ', retried' : ''})`);
  console.error(`[simulator] ${MODELS.simulator} → ${sim.value.irrelevantAlwaysOn.length} irrelevant always-on (${sim.ms}ms${sim.retried ? ', retried' : ''})`);
  log.push(`mapper(${MODELS.mapper}): ${mapper.value.findings.length} raw findings${mapper.retried ? ' [retried after schema failure]' : ''}`);
  log.push(`simulator(${MODELS.simulator}): ${sim.value.irrelevantAlwaysOn.length} irrelevant always-on files${sim.retried ? ' [retried]' : ''}`);

  // ---- STAGE 4: THE GATE — deterministic citation verification -------------
  const verified: VerifiedFinding[] = verifyFindings(root, mapper.value.findings);
  const confirmed = verified.filter((f) => f.verdict === 'CONFIRMED');
  const killed = verified.filter((f) => f.verdict === 'KILLED');
  console.error(`[verify] ${confirmed.length} confirmed · ${killed.length} KILLED (hallucinated citations)`);
  log.push(`verify: ${confirmed.length} confirmed, ${killed.length} killed for unverifiable citations (deterministic)`);

  // ---- STAGE 5: architect, fed ONLY confirmed findings ---------------------
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
  console.error(`[architect] ${arch.value.actions.length} actions (${arch.ms}ms)`);
  log.push(`architect(${MODELS.architect}): ${arch.value.actions.length} cleanup actions`);

  // ---- Score: deterministic formula over measured inputs -------------------
  const wastePct = inv.alwaysOnTokens > 0 ? Math.round((wasted / inv.alwaysOnTokens) * 100) : 0;
  const penalty =
    confirmed.filter((f) => f.severity === 'high').length * 12 +
    confirmed.filter((f) => f.severity === 'medium').length * 6 +
    confirmed.filter((f) => f.severity === 'low').length * 2 +
    Math.min(20, inv.staleRefs.length * 4) +
    Math.round(wastePct / 4);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const report = {
    generatedAt: new Date().toISOString(),
    root,
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
  };

  writeFileSync('report.json', JSON.stringify(report, null, 2));
  writeFileSync('report.html', renderHtml(report));
  console.error(`\n  CONTEXT DEBT SCORE: ${score}/100 · ${inv.alwaysOnTokens} always-on tokens · ${wastePct}% waste on this task`);
  console.error(`  wrote report.json + report.html in ${Date.now() - t0}ms`);
}

main().catch((e) => {
  console.error('PIPELINE FAILED:', e);
  process.exit(1);
});
