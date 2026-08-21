import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import type { Inventory, ScannedFile, StaleRef, FileKind } from './contracts.js';

/**
 * STAGE 1 — fully deterministic. No model touches this. Every number the report
 * prints about size comes from here, so it is reproducible by anyone who reruns
 * the tool against the same commit.
 */

/** Rough but honest. We label it "est." everywhere rather than pretending to
 *  run the real tokenizer — English prose sits around 4 chars/token. */
export const estTokens = (s: string) => Math.round(s.length / 4);

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 4 || !existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out, depth + 1);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

function classify(root: string, path: string): FileKind | null {
  const rel = relative(root, path);
  const base = rel.split('/').pop() ?? '';
  if (base === 'CLAUDE.md' || base === 'AGENTS.md') return 'always-on';
  if (rel.includes('.claude/agents/')) return 'agent';
  if (rel.includes('.claude/skills/')) return 'skill';
  if (rel.includes('.claude/rules/') || rel.includes('rules/')) return 'rule';
  return null;
}

/**
 * Stale-reference detection is deterministic and therefore unfakeable: an
 * instruction file that points at a path is either pointing at something that
 * exists or it isn't. This is the check that catches a `.claude/` folder which
 * has drifted from the repo it's supposed to describe.
 */
const PATH_RE = /(?:^|[\s`'"(])((?:~\/|\.\/|\.claude\/|src\/|scripts\/)[A-Za-z0-9._/*-]+\.[A-Za-z0-9]+|(?:~\/|\.claude\/)[A-Za-z0-9._/-]+\/)/g;

function findStaleRefs(root: string, file: string, text: string): StaleRef[] {
  const out: StaleRef[] = [];
  const home = process.env.HOME ?? '';
  text.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('>')) return; // quoted example, not a live ref
    for (const m of line.matchAll(PATH_RE)) {
      const ref = m[1];
      if (!ref || ref.includes('*')) continue;
      const abs = ref.startsWith('~/')
        ? join(home, ref.slice(2))
        : resolve(ref.startsWith('.claude/') ? root : dirname(file), ref);
      if (!existsSync(abs)) {
        out.push({
          file: relative(root, file),
          line: i + 1,
          ref,
          reason: 'referenced path does not exist on disk',
        });
      }
    }
  });
  return out;
}

export function scan(root: string): Inventory {
  const roots = [join(root, 'CLAUDE.md'), join(root, 'AGENTS.md'), join(root, '.claude')];
  const paths = new Set<string>();
  for (const r of roots) {
    if (!existsSync(r)) continue;
    if (statSync(r).isDirectory()) walk(r).forEach((p) => paths.add(p));
    else paths.add(r);
  }

  const files: ScannedFile[] = [];
  const staleRefs: StaleRef[] = [];

  for (const p of [...paths].sort()) {
    const kind = classify(root, p);
    if (!kind) continue;
    const text = readFileSync(p, 'utf8');
    files.push({
      path: relative(root, p),
      kind,
      bytes: Buffer.byteLength(text),
      estTokens: estTokens(text),
      lines: text.split('\n').length,
    });
    staleRefs.push(...findStaleRefs(root, p, text));
  }

  const alwaysOnTokens = files
    .filter((f) => f.kind === 'always-on' || f.kind === 'rule')
    .reduce((a, f) => a + f.estTokens, 0);

  return {
    root,
    files,
    alwaysOnTokens,
    totalTokens: files.reduce((a, f) => a + f.estTokens, 0),
    staleRefs,
  };
}

export function readSnippet(root: string, file: string, line: number, span = 2): string[] {
  const abs = join(root, file);
  if (!existsSync(abs)) return [];
  const lines = readFileSync(abs, 'utf8').split('\n');
  return lines.slice(Math.max(0, line - 1 - span), line + span);
}
