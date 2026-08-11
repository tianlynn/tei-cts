import { type CitationPredicate, type CitationStep } from './citation.js';
import { descendants, elementChildren, type TeiElement } from './dom.js';

/**
 * Execute a citation scheme's steps over the element tree.
 *
 * A depth-first walk in source order, which is why units come out in reading
 * order with no sort afterwards — and why the tree has to preserve order in the
 * first place.
 *
 * One rule does most of the work: a step that captures a value only matches an
 * element that actually carries that attribute. That is what stops Homer's
 * `//tei:l[@n='$2']` from picking up the 151 unnumbered quotation lines
 * embedded in Herodotus' prose. Without it, a scheme would happily cite things
 * the edition never meant to be citable.
 */

export type UnitMatch = {
  node: TeiElement;
  values: string[];
};

export type TraversalResult = {
  matches: UnitMatch[];
  /** How many elements each step matched, for the failure message. */
  reached: number[];
};

const satisfies = (element: TeiElement, predicate: CitationPredicate): boolean => {
  const value = element.attributes[predicate.attribute];
  if (value === undefined) return false;
  return predicate.kind === 'literal' ? value === predicate.value : true;
};

function run(root: TeiElement, steps: CitationStep[]): TraversalResult {
  const matches: UnitMatch[] = [];
  const reached = steps.map(() => 0);

  // A virtual parent gives step 0 the same shape as every other step.
  const start: TeiElement = {
    type: 'element',
    name: '#document',
    uri: '',
    attributes: {},
    children: [root],
    parent: null,
  };

  const visit = (node: TeiElement, index: number, values: string[]): void => {
    const step = steps[index];
    if (step === undefined) return;

    const candidates = step.axis === 'child' ? elementChildren(node) : descendants(node);
    for (const candidate of candidates) {
      if (candidate.name !== step.name) continue;
      if (!step.predicates.every((predicate) => satisfies(candidate, predicate))) continue;

      reached[index] = (reached[index] ?? 0) + 1;

      const next = values.slice();
      for (const predicate of step.predicates) {
        if (predicate.kind === 'capture') {
          next[predicate.group] = candidate.attributes[predicate.attribute] ?? '';
        }
      }

      if (index === steps.length - 1) {
        matches.push({ node: candidate, values: next });
      } else {
        visit(candidate, index + 1, next);
      }
    }
  };

  visit(start, 0, []);
  return { matches, reached };
}

/**
 * Match units, tolerating where the pattern is anchored.
 *
 * Homer's pattern starts `/tei:TEI/tei:text/tei:body/…` while Sophocles' starts
 * `/tei:body/…`. Rather than hardcode a prefix, match strictly first and, if
 * that finds nothing, retry with the first step allowed to appear at any depth.
 * One deterministic retry covers every anchoring convention in the corpus
 * without guessing at which one a file uses.
 */
export function matchUnits(root: TeiElement, steps: CitationStep[]): TraversalResult {
  const strict = run(root, steps);
  if (strict.matches.length > 0 || steps.length === 0) return strict;

  const first = steps[0];
  if (first === undefined || first.axis === 'descendant') return strict;

  const relaxed = run(root, [{ ...first, axis: 'descendant' }, ...steps.slice(1)]);
  return relaxed.matches.length > 0 ? relaxed : strict;
}

/**
 * Explain a traversal that matched nothing, by naming the step that failed and
 * what was actually there instead.
 */
export function describeFailure(
  root: TeiElement,
  steps: CitationStep[],
  reached: number[],
  pattern: string | null,
): string {
  const failedAt = reached.findIndex((count) => count === 0);
  const index = failedAt === -1 ? steps.length - 1 : failedAt;
  const step = steps[index];
  const present = new Set((index === 0 ? [root] : descendants(root)).map((element) => element.name));

  const wanted =
    step === undefined
      ? 'unknown'
      : `${step.axis === 'child' ? 'child' : 'descendant'} <${step.name}>` +
        step.predicates
          .map((p) => (p.kind === 'capture' ? `[@${p.attribute}]` : `[@${p.attribute}='${p.value}']`))
          .join('');

  return [
    "no citable units matched the document's citation scheme.",
    pattern === null ? '' : `pattern: ${pattern}`,
    `step ${String(index + 1)} of ${String(steps.length)} (${wanted}) matched nothing.`,
    `elements present in the document: ${[...present].sort().slice(0, 20).join(', ')}.`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
