import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A Vfs is the read surface both discover.ts and verify.ts actually need:
 * a list of paths and a way to read one. diskVfs backs it with node:fs (the
 * original behaviour); memVfs backs it with files already fetched over HTTP
 * (github.ts), so the rest of the pipeline never has to know or care whether
 * it's looking at a checkout or a GitHub API response.
 */

export type VirtualFile = { path: string; text: string };

export interface Vfs {
  list(): string[];
  read(path: string): string | null;
}

export function memVfs(files: VirtualFile[]): Vfs {
  const map = new Map(files.map((f) => [f.path, f.text]));
  return {
    list: () => [...map.keys()],
    read: (path) => map.get(path) ?? null,
  };
}

/** Identical walk to the one discover.ts used to own: .md only, skips
 *  node_modules/.git, max depth 4, rooted at CLAUDE.md / AGENTS.md / .claude. */
export function diskVfs(root: string): Vfs {
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

  const roots = [join(root, 'CLAUDE.md'), join(root, 'AGENTS.md'), join(root, '.claude')];
  const paths = new Set<string>();
  for (const r of roots) {
    if (!existsSync(r)) continue;
    if (statSync(r).isDirectory()) walk(r).forEach((p) => paths.add(p));
    else paths.add(r);
  }
  const rels = [...paths].map((p) => relative(root, p)).sort();

  return {
    list: () => rels,
    read: (path) => {
      const abs = join(root, path);
      if (!existsSync(abs)) return null;
      try {
        return readFileSync(abs, 'utf8');
      } catch {
        return null;
      }
    },
  };
}
