import { descendants, elementChildren, findElement, findElements, type TeiElement } from './dom.js';
import { type CitationLevel, type CitationScheme } from './types.js';

/**
 * How a document says its own text should be cited.
 *
 * Every CTS-conformant edition declares this in `teiHeader/encodingDesc/refsDecl`,
 * as one `cRefPattern` per depth whose `replacementPattern` is an XPath into the
 * body. Reading that declaration, rather than hardcoding a structure, is what
 * lets one parser handle Homer (book + numbered line), Caesar (three levels of
 * nested div), and Sophocles (bare line numbers, no division) without knowing
 * anything about those works.
 *
 * The XPath in these declarations is drawn from a tiny, regular subset, and the
 * subset maps one-to-one onto a stack machine over the element tree — see
 * `traverse.ts`. Anything outside the subset is rejected here rather than
 * half-understood, and the caller falls back to structural inference.
 */

export type CitationPredicate =
  | { attribute: string; kind: 'literal'; value: string }
  | { attribute: string; kind: 'capture'; group: number };

export type CitationStep = {
  axis: 'child' | 'descendant';
  /** Local name, prefix stripped. */
  name: string;
  predicates: CitationPredicate[];
};

export type ResolvedScheme = {
  scheme: CitationScheme;
  steps: CitationStep[];
};

const XPATH_WRAPPER = /^#xpath\((.*)\)$/su;

/**
 * Parse one `replacementPattern` into steps.
 *
 * Hand-scanned rather than regex-matched over the whole string: a regex cannot
 * report *where* an unsupported construct began, and that message is the only
 * thing that makes an unparseable edition debuggable.
 */
export function parseXPath(pattern: string): CitationStep[] {
  const inner = XPATH_WRAPPER.exec(pattern.trim())?.[1];
  if (inner === undefined) {
    throw new Error(`citation pattern is not an #xpath(...) expression: "${pattern}"`);
  }

  const steps: CitationStep[] = [];
  let at = 0;

  while (at < inner.length) {
    if (inner[at] !== '/') {
      throw new Error(
        `citation pattern step must begin with "/" at offset ${String(at)}: "${inner.slice(at)}"`,
      );
    }
    let axis: 'child' | 'descendant' = 'child';
    at += 1;
    if (inner[at] === '/') {
      axis = 'descendant';
      at += 1;
    }

    const nameMatch = /^(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/u.exec(inner.slice(at));
    if (nameMatch?.[1] === undefined) {
      throw new Error(
        `citation pattern expects an element name at offset ${String(at)}: "${inner.slice(at)}"`,
      );
    }
    const name = nameMatch[1];
    at += nameMatch[0].length;

    if (inner.startsWith('::', at)) {
      throw new Error(
        `citation pattern uses an axis this parser does not support ("${name}::") in "${pattern}"`,
      );
    }

    const predicates: CitationPredicate[] = [];
    while (inner[at] === '[') {
      const end = inner.indexOf(']', at);
      if (end === -1) {
        throw new Error(`citation pattern has an unclosed predicate: "${inner.slice(at)}"`);
      }
      predicates.push(...parsePredicate(inner.slice(at + 1, end), pattern));
      at = end + 1;
    }

    steps.push({ axis, name, predicates });
  }

  if (steps.length === 0) {
    throw new Error(`citation pattern selects nothing: "${pattern}"`);
  }
  return steps;
}

const PREDICATE_TERM = /^@([A-Za-z_][\w.:-]*)\s*=\s*(['"])(.*?)\2$/su;

function parsePredicate(body: string, pattern: string): CitationPredicate[] {
  return body.split(/\s+and\s+/u).map((term) => {
    const match = PREDICATE_TERM.exec(term.trim());
    if (match === null) {
      throw new Error(
        `citation pattern uses a predicate this parser does not support ("${term.trim()}") in "${pattern}"`,
      );
    }
    const [, attribute = '', , value = ''] = match;
    const capture = /^\$(\d+)$/u.exec(value);
    return capture?.[1] !== undefined
      ? { attribute, kind: 'capture' as const, group: Number(capture[1]) }
      : { attribute, kind: 'literal' as const, value };
  });
}

const captureCount = (steps: CitationStep[]): number =>
  steps.reduce((total, step) => total + step.predicates.filter((p) => p.kind === 'capture').length, 0);

/**
 * Read the citation scheme a document declares.
 *
 * Returns null when there is no usable declaration, so the caller can fall back
 * to inference. A missing `refsDecl` is not an error: plenty of real editions
 * omit it, and a readable body is still worth reading.
 */
export function schemeFromRefsDecl(root: TeiElement, separator: string): ResolvedScheme | null {
  const declarations = findElements(root, 'refsDecl');
  const preferred =
    declarations.find((declaration) => declaration.attributes['n'] === 'CTS') ??
    declarations.find((declaration) => findElement(declaration, 'cRefPattern') !== null);
  if (preferred === undefined) return null;

  // Label per depth: a pattern with k captures names level k.
  const labels = new Map<number, string>();
  let deepest: { steps: CitationStep[]; pattern: string; depth: number } | null = null;

  for (const declared of findElements(preferred, 'cRefPattern')) {
    const pattern = declared.attributes['replacementPattern'];
    if (pattern === undefined) continue;
    let steps: CitationStep[];
    try {
      steps = parseXPath(pattern);
    } catch {
      // One unreadable pattern condemns the whole declaration. The depths of a
      // CTS refsDecl form a chain, so falling back to the deepest *readable*
      // one would silently cite whole books where the edition cites lines —
      // a plausible-looking result at the wrong granularity. Inference, which
      // reads the structure itself, is the safer answer.
      return null;
    }
    const depth = captureCount(steps);
    if (depth === 0) continue;

    const label = declared.attributes['n'];
    if (label !== undefined) labels.set(depth, label.toLowerCase());
    if (deepest === null || depth > deepest.depth) deepest = { steps, pattern, depth };
  }

  if (deepest === null) return null;

  return {
    scheme: {
      source: 'refsDecl',
      levels: levelsFor(deepest.steps, labels),
      separator,
      pattern: deepest.pattern,
    },
    steps: deepest.steps,
  };
}

/** Name each capture group's level, outermost first. */
function levelsFor(steps: CitationStep[], labels: Map<number, string>): CitationLevel[] {
  const levels: CitationLevel[] = [];
  for (const step of steps) {
    for (const predicate of step.predicates) {
      if (predicate.kind !== 'capture') continue;
      levels.push({
        label: labels.get(predicate.group) ?? `level${String(predicate.group)}`,
        element: step.name,
      });
    }
  }
  // Steps are in document order, so captures already come out outermost first.
  return levels;
}

/**
 * Work out a citation scheme from the shape of the body.
 *
 * Used when a document declares none, or declares one this parser cannot read.
 * It reproduces the declared scheme of every profiled edition independently,
 * which is why it doubles as a cross-check on the declared path in the tests.
 */
export function inferScheme(edition: TeiElement, separator: string): ResolvedScheme {
  // Pin the anchor to the edition division. A bare `descendant div` would also
  // match the divisions *inside* it, so the same subtree would be walked from
  // several starting points and cited more than once.
  const anchor: CitationPredicate[] = [];
  for (const attribute of ['type', 'n']) {
    const value = edition.attributes[attribute];
    if (value !== undefined) {
      anchor.push({ attribute, kind: 'literal', value });
      break;
    }
  }

  const steps: CitationStep[] = [{ axis: 'descendant', name: edition.name, predicates: anchor }];
  const levels: CitationLevel[] = [];
  let group = 0;
  let current = edition;

  // Descend while the divisions below carry numbers.
  for (;;) {
    const [first] = elementChildren(current).filter(
      (child) => child.name === 'div' && child.attributes['n'] !== undefined,
    );
    if (first === undefined) break;
    group += 1;
    steps.push({
      axis: 'child',
      name: 'div',
      predicates: [{ attribute: 'n', kind: 'capture', group }],
    });
    levels.push({ label: labelFor(first, group), element: 'div' });
    current = first;
  }

  // One further level if the innermost division holds numbered verse lines.
  for (const leaf of ['l', 'lg', 'ab']) {
    const numbered = descendants(current).filter(
      (child) => child.name === leaf && child.attributes['n'] !== undefined,
    );
    if (numbered.length === 0) continue;
    group += 1;
    steps.push({
      axis: 'descendant',
      name: leaf,
      predicates: [{ attribute: 'n', kind: 'capture', group }],
    });
    levels.push({ label: 'line', element: leaf });
    break;
  }

  return {
    scheme: { source: 'inferred', levels, separator, pattern: null },
    steps,
  };
}

const labelFor = (division: TeiElement | undefined, group: number): string => {
  const subtype = division?.attributes['subtype'] ?? division?.attributes['type'];
  // `subtype` casing is inconsistent across editions — the Iliad writes "Book"
  // where the Odyssey writes "book" — so it is only ever read lowercased.
  return subtype !== undefined && subtype !== 'textpart' ? subtype.toLowerCase() : `level${String(group)}`;
};
