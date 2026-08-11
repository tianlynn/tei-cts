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
  return scanSteps(inner, pattern);
}

/**
 * Scan a location path into steps.
 *
 * Shared by both declaration forms: a `cRefPattern` holds one absolute path
 * wrapped in `#xpath(...)`, a `citeStructure` holds one path per level in
 * `@match`. `pattern` appears in errors and is whatever the caller was reading,
 * so a message names the attribute the reader can go and look at.
 */
function scanSteps(inner: string, pattern: string): CitationStep[] {
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
export function schemeFromRefsDecl(
  root: TeiElement,
  separator: string,
  citeStructure = false,
): ResolvedScheme | null {
  // A transitional document carries both forms, and only the citeStructure
  // describes the body as it now stands — the cRefPattern beside it was written
  // against a structure the normalisation has already changed.
  if (citeStructure) {
    const declared = schemeFromCiteStructure(root, separator);
    if (declared !== null) return declared;
  }

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

/** `@use` this parser can execute: one attribute, which is all any edition writes. */
const USE_ATTRIBUTE = /^@([A-Za-z_][\w.:-]*)$/u;

/**
 * A `citeStructure` `@match` is relative to the level above it unless it is
 * anchored, which is exactly how the traversal already descends — so a relative
 * path needs no special case, only a leading separator to scan it with.
 *
 * All three spellings of "relative" appear in the normalised corpus:
 * `div[@type='book']`, `./div` and `.//div[@type='fragment']`. The leading `.`
 * is the context node these steps already start from, so dropping it is exact,
 * and `.//` becomes the descendant axis it means.
 */
function parseMatch(match: string): CitationStep[] {
  const trimmed = match.trim().replace(/^\./u, '');
  return scanSteps(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, match);
}

/**
 * TEI's empty markers, which delimit text rather than contain it.
 *
 * A `citeStructure` may anchor a level on one — the normalised Odyssey cites its
 * cards as `milestone[@unit='card']` — and mean the text *between* one marker and
 * the next. These steps resolve a citation to one element and read its subtree,
 * and a marker has no subtree, so honouring such a level yields the right number
 * of units with nothing in any of them: a full document that reads as empty, with
 * no error anywhere. Refusing it is the same position the parser already takes on
 * milestone-anchored `cRefPattern` schemes.
 */
const MARKER_ELEMENTS = new Set(['milestone', 'lb', 'pb', 'cb', 'gb', 'anchor', 'ptr']);

/**
 * Read a `citeStructure` declaration: TEI's newer citation scheme, nested
 * elements rather than one XPath template per depth.
 *
 * ```xml
 * <citeStructure match="/TEI/text/body" use="@xml:base">
 *   <citeStructure unit="book" match="div[@type='book']" use="@n">
 *     <citeStructure unit="line" match="l" use="@n"/>
 * ```
 *
 * It carries the same information as a chain of `cRefPattern`s and compiles to
 * the same steps, so everything downstream is unchanged. `@unit` is what marks a
 * level as citable: the outermost element above anchors the path and names no
 * unit, and treating it as a level would put the edition's URN in every citation.
 *
 * A document may declare **several**, one per depth — Thucydides declares
 * `book/chapter/section` and `book/chapter` side by side — which is the same
 * arrangement as several `cRefPattern`s, and the deepest wins for the same
 * reason: it is the granularity the edition actually makes citable.
 *
 * Returns null — so the caller falls back — when the document declares none, and
 * whenever any declaration cannot be executed exactly. Two cases are worth
 * naming. A level whose `@use` is not a plain attribute is not expressible here.
 * And a level with several `citeStructure` children declares alternatives at one
 * depth, which these steps cannot represent. A level anchored on a marker element
 * is refused too — see `MARKER_ELEMENTS`. Any of them condemns the whole reading
 * rather than just its own declaration: retreating to a shallower one that did
 * compile would cite whole books where the edition cites sections, which looks
 * perfectly healthy and is wrong.
 */
export function schemeFromCiteStructure(root: TeiElement, separator: string): ResolvedScheme | null {
  const anchors = findElements(root, 'refsDecl').flatMap((declaration) =>
    elementChildren(declaration).filter((child) => child.name === 'citeStructure'),
  );

  let deepest: ResolvedScheme | null = null;
  for (const anchor of anchors) {
    const compiled = compileCiteStructure(anchor, separator);
    if (compiled === null) return null;
    if (deepest === null || compiled.scheme.levels.length > deepest.scheme.levels.length) {
      deepest = compiled;
    }
  }
  return deepest;
}

/** Compile one `citeStructure` chain, outermost element in. */
function compileCiteStructure(anchor: TeiElement, separator: string): ResolvedScheme | null {
  const steps: CitationStep[] = [];
  const levels: CitationLevel[] = [];
  let group = 0;

  for (let node: TeiElement | undefined = anchor; node !== undefined;) {
    const match = node.attributes['match'];
    if (match === undefined) return null;

    let matchSteps: CitationStep[];
    try {
      matchSteps = parseMatch(match);
    } catch {
      return null;
    }

    const unit = node.attributes['unit'];
    if (unit !== undefined) {
      const attribute = USE_ATTRIBUTE.exec(node.attributes['use'] ?? '')?.[1];
      const last = matchSteps.at(-1);
      if (attribute === undefined || last === undefined) return null;
      if (MARKER_ELEMENTS.has(last.name)) return null;
      group += 1;
      // The capture goes on the last step of this level's own path, so a level
      // matched several elements deep still stands in for itself when the level
      // below it is absent.
      last.predicates.push({ attribute, kind: 'capture', group });
      levels.push({ label: unit.toLowerCase(), element: last.name });
    }

    steps.push(...matchSteps);

    const children: TeiElement[] = elementChildren(node).filter((child) => child.name === 'citeStructure');
    if (children.length > 1) return null;
    node = children[0];
  }

  // An anchor with no unit below it addresses the whole text and nothing in it.
  if (levels.length === 0) return null;

  return {
    scheme: { source: 'citeStructure', levels, separator, pattern: asXPath(steps) },
    steps,
  };
}

/**
 * Render steps as the `cRefPattern` that would have produced them.
 *
 * A `citeStructure` has no pattern string of its own, and reporting null would
 * make the two declaration forms incomparable in exactly the runs meant to
 * compare them.
 */
function asXPath(steps: CitationStep[]): string {
  const path = steps
    .map((step) => {
      const predicates = step.predicates
        .map((predicate) =>
          predicate.kind === 'capture'
            ? `[@${predicate.attribute}='$${String(predicate.group)}']`
            : `[@${predicate.attribute}='${predicate.value}']`,
        )
        .join('');
      return `${step.axis === 'descendant' ? '//' : '/'}${step.name}${predicates}`;
    })
    .join('');
  return `#xpath(${path})`;
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
