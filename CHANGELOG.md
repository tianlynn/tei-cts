# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — unreleased

### Added

- **Named entities resolve without a DTD.** Documents declaring `&aelig;`, `&mdash;`, `&eacute;` and
  friends in an external DTD were rejected whole as malformed XML, because the DTD is never fetched —
  27 of the 3,503 texts in the corpus run failed that way. The **48 entity names that appear as live
  text anywhere in the three corpora** now ship compiled into the package (`src/entities.ts`,
  generated from a census of them) and are installed on the parser before it reads a document. Still
  no network and no file access. Re-running the corpus measured the effect honestly: **no additional
  file parses**. 26 of the 27 are TEI P4 documents that predate CTS citation, so they now fail with
  that diagnosis rather than a well-formedness error — which is how one genuinely malformed file,
  previously masked, came to light. The gain is accurate errors here, and readable documents outside
  this corpus.
- **Markup macros expand.** Perseus keeps shared boilerplate in its DTD as entities whose replacement
  is markup — `&Perseus.publish;` is the publication statement common to every Tufts edition. An
  entity resolved to text can never become an element, so these are expanded into the document before
  it is parsed, stepping over comments and CDATA. With this, **no document in the three corpora fails
  at the XML layer any more**: the undefined-entity class is empty, and the last file in it joined the
  pre-CTS class it truly belongs to.
- **`corpusEntities` and `entities` options.** `corpusEntities: false` restores strict XML — the five
  names XML defines, no shipped table and no macro expansion. `entities: { agr: 'α' }` supplies names
  the table does not carry, such as the older convention for Greek letters, and wins over it.
  Replacement text is inserted as text and never rescanned, and the five XML names cannot be
  redefined.
- **Entity values verified against the editions' own DTDs.** All 48 names are declared in the chain
  from `PersProse.dtd` to the OASIS `iso-*.ent` sets, and all 48 values agree with it. That check
  reversed one earlier decision: `&cdot;` ships as `ċ`, its declared value, not the `·` that Pliny's
  astronomical tables evidently intend — the declaration is the authority, and
  `entities: { cdot: '·' }` is the override.

### Fixed

- **Silent text loss on ragged hierarchies.** Units were emitted only where a document's full chain of
  declared citation levels matched, so a division that stopped short of the deepest level had its text
  belong to no unit at all — with no error. A run over all 3,503 texts in canonical-greekLit,
  canonical-latinLit and First1KGreek found 21 files losing more than 20% of their text this way and
  four losing more than 50%; one returned 2 units for a work of 21 sections. A division with nothing
  at the next declared level is now itself the citable unit. Across the corpus this recovered ~1,900
  units, and the worst-affected files went from 9.5%/15%/30%/39% text coverage to 75%/86%/94%/99.8%.
- **Inferred schemes no longer cite a subtree more than once.** The inferred anchor was a bare
  `descendant div`, which also matched divisions inside the edition division, so the same subtree
  could be walked from several starting points. It is now pinned to the edition division. This removed
  5 of the 12 corpus-wide duplicate-citation rejections.

### Changed

- **`CitableUnit.path` may now be shorter than `citation.levels`** — a unit above the deepest declared
  level is cited by the levels it actually has (`18` rather than `18.1`). `path.length` identifies the
  level: `citation.levels[unit.path.length - 1]`. Code assuming a fixed-length path needs updating.

### Known limitation

- A division holding both deeper divisions and its own loose text emits the deeper divisions only; the
  loose text is not emitted, since emitting the parent too would duplicate its children. Usually zero,
  but a few percent in editions that set poetry beside numbered prose verses.

## [0.1.0] — unreleased

First release. The API is expected to move while it meets its first real consumers, hence `0.x`.

### Added

- `parseTeiDocument(xml, options?)` — CTS/CapiTainS TEI XML to citable text units, synchronous, no I/O.
- Citation schemes read from `refsDecl/cRefPattern`, by parsing the declared XPath into traversal
  steps. Handles two-level verse, single-level drama, and two- and three-level prose, in Greek and
  Latin, from one implementation.
- Structural inference as a fallback when a document declares no scheme or declares one written with
  unsupported XPath. Reported as `citation.source === 'inferred'`.
- A documented, fully overridable element policy for flattening markup to reading text, including
  selection among the children of `<choice>` and `<app>`.
- Speaker attribution for drama, surfaced on the unit rather than mixed into its text.
- Test corpus of seven real Perseus excerpts covering every citation shape, with invariants asserted
  across all of them.
