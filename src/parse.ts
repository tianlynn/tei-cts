import { inferScheme, schemeFromRefsDecl, type ResolvedScheme } from './citation.js';
import { findElement, parseXml, type TeiElement } from './dom.js';
import { findEditionDiv, readMetadata } from './header.js';
import { flattenSettings, flattenText } from './text.js';
import { describeFailure, matchUnits, type UnitMatch } from './traverse.js';
import { type CitableUnit, type ParseOptions, type TeiDocument, type UnitKind } from './types.js';

/**
 * Turn a CTS/CapiTainS TEI document into its citable units.
 *
 * The stages are deliberately separable: the citation machinery never looks at
 * text, and the text flattener never looks at citations. That makes "changing
 * the element policy cannot change the citations" true by construction rather
 * than by care, and it is asserted as a test.
 */

/** Verse elements cite as lines; everything else is a block of prose. */
const kindFor = (element: string): UnitKind => (element === 'l' || element === 'lg' ? 'line' : 'paragraph');

/** The nearest enclosing `<speaker>`, which drama puts outside the spoken lines. */
function speakerFor(node: TeiElement): string | null {
  for (let at: TeiElement | null = node; at !== null; at = at.parent) {
    if (at.name !== 'sp') continue;
    const speaker = findElement(at, 'speaker');
    if (speaker === null) continue;
    const text = speaker.children
      .map((child) => (child.type === 'text' ? child.value : ''))
      .join('')
      .replace(/\s+/gu, ' ')
      .trim();
    if (text !== '') return text;
  }
  return null;
}

export function parseTeiDocument(xml: string, options: ParseOptions = {}): TeiDocument {
  const root = parseXml(xml, options);
  const separator = options.citationSeparator ?? '.';
  const metadata = readMetadata(root);

  const edition = findEditionDiv(root);
  if (edition === null) {
    throw new Error('the document has no <body>, so it contains no text to cite');
  }

  const declared = schemeFromRefsDecl(root, separator, options.citeStructure ?? false);
  const resolved = resolveUnits(root, edition, declared, separator);
  const settings = flattenSettings(options);

  const units: CitableUnit[] = resolved.matches.map((match) => ({
    citation: citationOf(match, resolved.scheme.levels.length, separator),
    path: pathOf(match, resolved.scheme.levels.length),
    kind: kindFor(match.node.name),
    element: match.node.name,
    text: flattenText(match.node, settings),
    speaker: speakerFor(match.node),
  }));

  assertUniqueCitations(units);

  return {
    urn: metadata.urn,
    language: metadata.language,
    title: metadata.title,
    author: metadata.author,
    editor: metadata.editor,
    edition: metadata.edition,
    license: metadata.license,
    citation: resolved.scheme,
    units,
  };
}

/**
 * Resolve the scheme, falling back to inference.
 *
 * A declared scheme that matches nothing is treated the same as no declaration
 * at all — some editions declare a structure they do not actually follow, and
 * refusing to read such a file helps nobody when the body is plainly citable.
 */
function resolveUnits(
  root: TeiElement,
  edition: TeiElement,
  declared: ResolvedScheme | null,
  separator: string,
): ResolvedScheme & { matches: UnitMatch[] } {
  if (declared !== null) {
    const result = matchUnits(root, declared.steps);
    if (result.matches.length > 0) return { ...declared, matches: result.matches };
  }

  const inferred = inferScheme(edition, separator);
  // A scheme with no levels would cite the whole text as the empty string. That
  // is not a citation, so a document with no citable structure is an error
  // rather than a document of one nameless unit.
  if (inferred.scheme.levels.length > 0) {
    const result = matchUnits(root, inferred.steps);
    if (result.matches.length > 0) return { ...inferred, matches: result.matches };
  }

  if (declared === null) {
    throw new Error(
      'the document declares no citation scheme, and its body has no numbered divisions or lines to infer one from',
    );
  }
  const failure = matchUnits(root, declared.steps);
  throw new Error(describeFailure(root, declared.steps, failure.reached, declared.scheme.pattern));
}

/**
 * Capture groups are 1-based, so level *k* is `values[k]`.
 *
 * The path stops at the first level the match did not reach. A unit that sits
 * above the deepest declared level — a section in an edition where only some
 * sections have numbered subsections — is cited by the levels it actually has,
 * so it reads `1` rather than `1.` or `1.0`.
 */
function pathOf(match: UnitMatch, depth: number): string[] {
  const path: string[] = [];
  for (let level = 1; level <= depth; level += 1) {
    const value = match.values[level];
    if (value === undefined) break;
    path.push(value);
  }
  return path;
}

const citationOf = (match: UnitMatch, depth: number, separator: string): string =>
  pathOf(match, depth).join(separator);

/**
 * Two units with one citation means the traversal matched more than the edition
 * meant to be citable. That is the check most likely to catch a wrong scheme,
 * and it is worth more than any single unit test.
 */
function assertUniqueCitations(units: CitableUnit[]): void {
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.citation)) {
      throw new Error(
        `the citation scheme produced the same citation twice ("${unit.citation}"), so it addresses more than the edition makes citable`,
      );
    }
    seen.add(unit.citation);
  }
}
