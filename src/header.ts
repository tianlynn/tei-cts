import { descendants, findElement, isElement, type TeiElement } from './dom.js';

/**
 * Document metadata, read from `teiHeader` and the edition division.
 *
 * Nothing here is normalised. A Latin edition may declare `lat` or `la`, and
 * the parser reports whichever it found: a library that quietly rewrites
 * metadata is one you cannot debug when a citation fails to match.
 */

export type Metadata = {
  urn: string | null;
  language: string | null;
  title: string;
  author: string | null;
  editor: string | null;
  edition: string | null;
  license: string | null;
};

/** Direct text content of an element, ignoring nested markup. */
function shallowText(element: TeiElement | null): string | null {
  if (element === null) return null;
  const text = element.children
    .map((child) => (isElement(child) ? (shallowText(child) ?? '') : child.value))
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
  return text === '' ? null : text;
}

/**
 * The division holding the text itself.
 *
 * Identified by `type="edition"` and never by position: the Aeneid puts
 * `subtype="book"` on the edition div, so "the outermost div" is not a safe
 * way to recognise it.
 */
export function findEditionDiv(root: TeiElement): TeiElement | null {
  const body = findElement(root, 'body');
  if (body === null) return null;
  const divisions = descendants(body).filter((element) => element.name === 'div');
  return divisions.find((division) => division.attributes['type'] === 'edition') ?? divisions[0] ?? body;
}

export function readMetadata(root: TeiElement): Metadata {
  const header = findElement(root, 'teiHeader');
  const titleStmt = header === null ? null : findElement(header, 'titleStmt');
  const edition = findEditionDiv(root);

  const urn = edition?.attributes['n'] ?? null;
  const isCtsUrn = urn !== null && urn.startsWith('urn:cts:');

  return {
    urn: isCtsUrn ? urn : null,
    language: edition?.attributes['xml:lang'] ?? null,
    title: (titleStmt === null ? null : shallowText(findElement(titleStmt, 'title'))) ?? 'untitled',
    author: titleStmt === null ? null : shallowText(findElement(titleStmt, 'author')),
    editor: titleStmt === null ? null : shallowText(findElement(titleStmt, 'editor')),
    // 'urn:cts:greekLit:tlg0012.tlg002.perseus-grc2' -> 'perseus-grc2'
    edition: isCtsUrn ? (urn.split(':').pop()?.split('.').slice(2).join('.') ?? null) || null : null,
    license: readLicense(header),
  };
}

function readLicense(header: TeiElement | null): string | null {
  if (header === null) return null;
  const licence = findElement(header, 'licence') ?? findElement(header, 'license');
  if (licence === null) return null;
  return licence.attributes['target'] ?? shallowText(licence);
}
