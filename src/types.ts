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
   * Where the scheme came from.
   *
   * `refsDecl` is a `cRefPattern` declaration; `citeStructure` is the newer
   * nested form, read only when `ParseOptions.citeStructure` is on; `inferred`
   * means the document declared neither and the structure was read instead —
   * worth surfacing, because it is a guess.
   */
  source: 'refsDecl' | 'citeStructure' | 'inferred';
  levels: CitationLevel[];
  /** What joins level values into `CitableUnit.citation`. */
  separator: string;
  /**
   * The `replacementPattern` this scheme resolved to, kept verbatim for
   * debugging. Null when inferred. A `citeStructure` scheme has no such string
   * of its own, so it reports the equivalent XPath, which makes a scheme read
   * from either declaration directly comparable with the other.
   */
  pattern: string | null;
};

export type UnitKind = 'line' | 'paragraph';

export type CitableUnit = {
  /** '1.1' — the level values joined by the scheme separator. */
  citation: string;
  /**
   * ['1', '1'] — the same values unjoined, so a consumer never re-splits a string.
   *
   * May be **shorter** than `citation.levels`. Editions are routinely ragged —
   * one section of a work has numbered subsections, the next does not — and a
   * division with nothing below it is cited by the levels it actually has. So
   * `path.length` tells you which level a unit sits at:
   * `citation.levels[unit.path.length - 1]`.
   */
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
  /**
   * Read a `citeStructure` declaration in preference to a `cRefPattern` one.
   * Defaults to `false`.
   *
   * `citeStructure` is TEI's newer way of declaring a citation scheme: nested
   * elements carrying `@match`, `@use` and `@unit` instead of one XPath template
   * per depth. Perseus is migrating to it, and its transitional documents carry
   * **both** declarations while the body is restructured underneath — at which
   * point the retained `cRefPattern` still names a wrapper element that has been
   * removed, so it matches nothing and only the `citeStructure` describes the
   * document as it now is.
   *
   * Off by default because no published edition uses it yet, and because turning
   * it on changes which declaration wins — a behavioural change, not a fix, on
   * any document carrying both. Turn it on to read a normalised edition; leave
   * it off for anything currently released.
   */
  citeStructure?: boolean;
  /**
   * Resolve the 48 named entities the Perseus corpora actually use — `&aelig;`,
   * `&mdash;`, `&eacute;` — which XML does not predefine. Defaults to `true`.
   *
   * Editions that use them declare them in an external DTD, which nothing here
   * fetches, so without the shipped table one `&aelig;` rejects a whole file as
   * malformed. Set `false` for strict XML: only `amp`, `lt`, `gt`, `quot` and
   * `apos`, plus whatever `entities` adds.
   */
  corpusEntities?: boolean;
  /**
   * Expand the known Perseus DTD macros — entities whose replacement is markup
   * rather than characters, such as `&Perseus.publish;`, the publication
   * statement shared by every Tufts edition. Defaults to `true`.
   *
   * This is the one thing that rewrites the document, by substituting the
   * declared markup before parsing, since an entity resolved to text can never
   * become an element. Set `false` to guarantee the parser sees your XML exactly
   * as you passed it; a document referencing a macro then fails as malformed,
   * which is what it is without its DTD.
   */
  corpusDtdMacro?: boolean;
  /**
   * Extra entity definitions, name (no `&` or `;`) to the text it stands for.
   * Merged over the shipped table, and the way to supply a name the table does
   * not carry — `{ agr: 'α' }` for the old convention for Greek letters.
   *
   * Replacement text is inserted as text and never rescanned, so it cannot
   * introduce markup or another entity. The five XML names are rejected.
   */
  entities?: Record<string, string>;
};
