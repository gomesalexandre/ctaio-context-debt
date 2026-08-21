import { z } from 'zod';

/**
 * Every agent hop in this pipeline is a typed contract. Nothing crosses a stage
 * boundary as free text — if a model can't produce this shape, the stage fails
 * loudly rather than passing prose downstream.
 */

export const FileKind = z.enum([
  'always-on', // loaded into every single turn (CLAUDE.md, AGENTS.md)
  'agent', // .claude/agents/*.md — loaded when that subagent is spawned
  'skill', // .claude/skills/*/SKILL.md — description always-on, body on demand
  'rule', // linked rules files pulled in by an always-on file
]);
export type FileKind = z.infer<typeof FileKind>;

/** Deterministic output of the scanner. No model involved — this is measured. */
export const ScannedFile = z.object({
  path: z.string(),
  kind: FileKind,
  bytes: z.number(),
  estTokens: z.number(),
  lines: z.number(),
});
export type ScannedFile = z.infer<typeof ScannedFile>;

export const StaleRef = z.object({
  file: z.string(),
  line: z.number(),
  ref: z.string(),
  reason: z.string(),
});
export type StaleRef = z.infer<typeof StaleRef>;

export const Inventory = z.object({
  root: z.string(),
  files: z.array(ScannedFile),
  alwaysOnTokens: z.number(),
  totalTokens: z.number(),
  staleRefs: z.array(StaleRef),
});
export type Inventory = z.infer<typeof Inventory>;

/**
 * Findings carry a mandatory citation. The citation is what makes the finding
 * falsifiable: verify.ts re-reads the cited span and kills the finding if the
 * quoted text isn't actually there. A model that invents a conflict gets caught.
 */
export const Finding = z.object({
  type: z.enum(['contradiction', 'duplication', 'scope-leak', 'overlap']),
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  detail: z.string(),
  citations: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        quote: z.string(),
      }),
    )
    .min(1),
});
export type Finding = z.infer<typeof Finding>;

export const MapperOutput = z.object({ findings: z.array(Finding) });
export type MapperOutput = z.infer<typeof MapperOutput>;

/** What an agent would actually SEE for a concrete task. */
export const SimulatorOutput = z.object({
  task: z.string(),
  relevantFiles: z.array(z.string()),
  irrelevantAlwaysOn: z.array(z.string()),
  rationale: z.string(),
});
export type SimulatorOutput = z.infer<typeof SimulatorOutput>;

export const Action = z.object({
  op: z.enum(['DELETE', 'MOVE', 'SCOPE', 'MERGE', 'KEEP']),
  target: z.string(),
  rationale: z.string(),
  estTokensSaved: z.number(),
});
export const ArchitectOutput = z.object({ actions: z.array(Action) });
export type ArchitectOutput = z.infer<typeof ArchitectOutput>;

/** Verified finding = survived the deterministic citation check. */
export type VerifiedFinding = Finding & {
  verdict: 'CONFIRMED' | 'KILLED';
  killReason?: string;
};
