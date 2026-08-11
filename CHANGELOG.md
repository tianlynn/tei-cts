# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
