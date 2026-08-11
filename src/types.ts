/**
 * The whole public surface, in one file, so the API can be read in one screen.
 *
 * Absent values are `null` rather than optional properties. Every field is
 * always computed, so a consumer can destructure without guarding for the key's
 * existence, and the parser never has to build objects by conditional spread.
 */

/** One level of a citation scheme, outermost first. */
export type CitationLevel = {
  /** The label the edition gives this level: 'book', 'line', 'chapter'. Lowercased. */
  label: string;
  /** Local name of the element carrying this level's number: 'div', 'l'. */
  element: string;
};

export type CitationScheme = {
  /**
   * Where the scheme came from. `inferred` means the document declared none and
   * the structure was read instead — worth surfacing, because it is a guess.
   */
  source: 'refsDecl' | 'inferred';
  levels: CitationLevel[];
  /** What joins level values into `CitableUnit.citation`. */
  separator: string;
  /** The raw `replacementPattern`, kept verbatim for debugging. Null when inferred. */
  pattern: string | null;
};

export type UnitKind = 'line' | 'paragraph';

export type CitableUnit = {
  /** '1.1' — the level values joined by the scheme separator. */
  citation: string;
  /** ['1', '1'] — the same values unjoined, so a consumer never re-splits a string. */
  path: string[];
  kind: UnitKind;
  /** Local name of the element the citation resolved to: 'l', 'p', 'div'. */
  element: string;
  /** The reading text: markup resolved per policy, whitespace collapsed, NFC. */
  text: string;
  /** The nearest enclosing `<speaker>` in drama. Null everywhere else. */
  speaker: string | null;
};

export type TeiDocument = {
  /** From the edition div's `@n`. Null if the document declares no URN. */
  urn: string | null;
  /** The edition div's `@xml:lang`, raw. Latin editions say 'lat' or 'la'; not normalised. */
  language: string | null;
  title: string;
  author: string | null;
  editor: string | null;
  /** The version component of the URN, e.g. 'perseus-grc2'. */
  edition: string | null;
  /** From `publicationStmt`. Only some editions carry one. */
  license: string | null;
  citation: CitationScheme;
  units: CitableUnit[];
};

/**
 * What to do with one element when flattening a unit to reading text.
 *
 * `keep` renders its descendant text inline; `block` does the same but forces a
 * break either side; `drop` discards the element and everything under it;
 * `space` discards it but leaves one space, so removing an empty milestone
 * cannot fuse the words on either side of it.
 */
export type ElementAction = 'keep' | 'block' | 'drop' | 'space' | { replace: string };

/** Element local name to action. Merged over `defaultElementPolicy`. */
export type ElementPolicy = Record<string, ElementAction>;

export type ParseOptions = {
  /** Per-element overrides, merged over the defaults. */
  elements?: ElementPolicy;
  /**
   * What to do with an element the policy does not name. Defaults to `keep`.
   *
   * Failing open on text is deliberate: silently deleting words is the
   * dangerous direction, and unexpected text is visible and correctable.
   */
  unknownElement?: ElementAction;
  /** Which child of `<choice>` wins, best first. */
  choicePreference?: string[];
  /** Which child of `<app>` wins, best first. */
  appPreference?: string[];
  /** What joins block-level runs inside one unit. Defaults to '\n'. */
  blockSeparator?: string;
  /** Unicode normalisation applied to unit text. Defaults to 'NFC'. */
  normalize?: 'NFC' | 'NFD' | 'none';
  /** Override the separator that joins citation levels. Defaults to '.'. */
  citationSeparator?: string;
};
