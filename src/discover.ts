import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Inventory, ScannedFile, StaleRef, FileKind } from './contracts.js';
import { diskVfs, type Vfs } from './vfs.js';

/**
 * STAGE 1 — fully deterministic. No model touches this. Every number the report
 * prints about size comes from here, so it is reproducible by anyone who reruns
 * the tool against the same commit.
 */

/** Rough but honest. We label it "est." everywhere rather than pretending to
 *  run the real tokenizer — English prose sits around 4 chars/token. */
export const estTokens = (s: string) => Math.round(s.length / 4);

function classifyRel(rel: string): FileKind | null {
  const base = rel.split('/').pop() ?? '';
  if (base === 'CLAUDE.md' || base === 'AGENTS.md') return 'always-on';
  if (rel.includes('.claude/agents/')) return 'agent';
  // Commands and skills are both on-demand context: pulled in when invoked,
  // not resident every turn. Missing this bucket made any repo that organises
  // its context as slash-commands scan as completely empty.
  if (rel.includes('.claude/skills/') || rel.includes('.claude/commands/')) return 'skill';
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

/**
 * A sparse or partial checkout makes every unfetched path look deleted, which
 * turns the stale-ref check into a false-positive machine — it reported 9
 * "broken" refs against shapeshift/web that were all present in the real repo.
 * A deterministic check is only trustworthy if it knows when it's looking at an
 * incomplete tree, so refuse rather than report numbers we can't stand behind.
 */
export function assertFullCheckout(root: string): string | null {
  if (existsSync(join(root, '.git', 'info', 'sparse-checkout'))) {
    return 'sparse checkout detected — stale-ref detection needs a full tree';
  }
  return null;
}

/**
 * Vfs-flavoured stale-ref check: same rules as findStaleRefs, but "does this
 * path exist" means "is it in the vfs" rather than "does fs.existsSync say
 * yes". `~/`-rooted refs point outside anything a vfs could ever contain (a
 * GitHub fetch has no notion of the caller's home dir), so they're excluded
 * entirely rather than reported as broken — that would be a guaranteed false
 * positive, not a real finding.
 */
function findStaleRefsVfs(vfs: Vfs, file: string, text: string): StaleRef[] {
  const out: StaleRef[] = [];
  const known = new Set(vfs.list());
  const hasPath = (ref: string) =>
    ref.endsWith('/') ? [...known].some((p) => p.startsWith(ref)) : known.has(ref);

  text.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('>')) return; // quoted example, not a live ref
    for (const m of line.matchAll(PATH_RE)) {
      const ref = m[1];
      if (!ref || ref.includes('*')) continue;
      if (ref.startsWith('~/')) continue; // not checkable against a vfs — exclude, don't false-positive

      const resolved = ref.startsWith('.claude/')
        ? posix.normalize(ref)
        : posix.normalize(posix.join(posix.dirname(file), ref));

      if (!hasPath(resolved)) {
        out.push({
          file,
          line: i + 1,
          ref,
          reason: 'referenced path does not exist in scanned tree',
        });
      }
    }
  });
  return out;
}

export function scanVfs(vfs: Vfs, label: string): Inventory {
  const files: ScannedFile[] = [];
  const staleRefs: StaleRef[] = [];

  for (const p of [...vfs.list()].sort()) {
    const kind = classifyRel(p);
    if (!kind) continue;
    const text = vfs.read(p);
    if (text == null) continue;
    files.push({
      path: p,
      kind,
      bytes: Buffer.byteLength(text),
      estTokens: estTokens(text),
      lines: text.split('\n').length,
    });
    staleRefs.push(...findStaleRefsVfs(vfs, p, text));
  }

  const alwaysOnTokens = files
    .filter((f) => f.kind === 'always-on' || f.kind === 'rule')
    .reduce((a, f) => a + f.estTokens, 0);

  return {
    root: label,
    files,
    alwaysOnTokens,
    totalTokens: files.reduce((a, f) => a + f.estTokens, 0),
    staleRefs,
  };
}

export function readSnippetVfs(vfs: Vfs, file: string, line: number, span = 2): string[] {
  const text = vfs.read(file);
  if (text == null) return [];
  const lines = text.split('\n');
  return lines.slice(Math.max(0, line - 1 - span), line + span);
}

export function scan(root: string): Inventory {
  return scanVfs(diskVfs(root), root);
}

export function readSnippet(root: string, file: string, line: number, span = 2): string[] {
  return readSnippetVfs(diskVfs(root), file, line, span);
}
