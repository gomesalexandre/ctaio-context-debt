import type { Finding, VerifiedFinding } from './contracts.js';
import { readSnippet } from './discover.js';

/**
 * STAGE 3 — THE GATE. Deterministic, no model.
 *
 * This is the load-bearing idea of the whole pipeline. The mapper is a language
 * model, so it can invent a contradiction that reads perfectly and cites a line
 * that says nothing of the sort. Rather than trusting it — or asking a second
 * model whether to trust it — we go back to the filesystem and check.
 *
 * A finding survives only if its quoted text actually appears near the line it
 * cites. Everything else is KILLED and reported as killed, because the kill list
 * is evidence that the gate is real and not decoration.
 */

/** Loose containment: models paraphrase whitespace and casing, but they should
 *  not be able to invent the words themselves. */
function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[`*_"']/g, '').trim();
}

function quoteAppearsNear(root: string, file: string, line: number, quote: string): boolean {
  const q = norm(quote);
  if (q.length < 8) return false; // too short to be evidence of anything
  // Widen progressively: exact line, then a window, to tolerate off-by-a-few
  // line numbers without tolerating an invented quote.
  for (const span of [2, 8, 25]) {
    const hay = norm(readSnippet(root, file, line, span).join(' '));
    if (hay.includes(q)) return true;
    // also accept a strong partial: the first 40 normalized chars
    if (q.length > 40 && hay.includes(q.slice(0, 40))) return true;
  }
  return false;
}

export function verifyFindings(root: string, findings: Finding[]): VerifiedFinding[] {
  return findings.map((f) => {
    const bad: string[] = [];
    for (const c of f.citations) {
      if (!quoteAppearsNear(root, c.file, c.line, c.quote)) {
        bad.push(`${c.file}:${c.line} — quoted text not found on disk`);
      }
    }
    if (bad.length === f.citations.length) {
      return { ...f, verdict: 'KILLED', killReason: bad[0] };
    }
    if (bad.length > 0) {
      return {
        ...f,
        verdict: 'CONFIRMED',
        killReason: `${bad.length}/${f.citations.length} citations unverified`,
      };
    }
    return { ...f, verdict: 'CONFIRMED' };
  });
}
