# 99 — Glossary

Every term the tutor uses, with the chapter that introduces it.

## The domain

**Canonical citation** — A reference to a passage by its position in the _structure of a work_
(`Iliad 1.1`), rather than in a physical copy. Resolves in any edition, translation or format. → [01]

**Citation value** — One component of a citation. A **label, not an index**: it may skip (`12`, `15`),
may not be numeric (`327a`), and does not indicate position in the file. → [01]

**Level** — One depth of a citation scheme, with a name: `book`, `line`, `chapter`, `fragment`,
`jebb_page`. Works differ; there are **118 distinct shapes** in this corpus. → [01]

**Stephanus / Bekker numbers** — Citation systems that freeze the page numbers of one historical
printing — Plato's from 1578, Aristotle's from 1831. Physical positions converted into stable names by
universal agreement. → [01]

**Textgroup / work / version** — The three layers of CTS identity. A _textgroup_ is roughly an author
(`tlg0012` = Homer); a _work_ is the abstract text (`tlg0012.tlg001` = the _Iliad_); a _version_ is one
edition or translation of it (`…perseus-grc2`). One work, many files. → [03]

**Edition vs translation** — Both are versions. An edition is in the original language; a translation
is not. The `__cts__.xml` catalogue distinguishes them; the URN grammar does not. → [04]

**Witness** — One surviving testimony to a text: a manuscript, an edition. The Homer Multitext's
premise that a work has many divergent witnesses is why CTS separates work from version. → [03]

## The formats

**TEI** — Text Encoding Initiative: a consortium, and the XML vocabulary it maintains for encoding
texts. 500+ elements; this library cares about ~60. **TEI markup says what something _is_, where HTML
markup says how it looks.** → [02]

**`@n`** — The attribute carrying a citation value on a `<div>`, `<l>`, or similar. The hinge the whole
library turns on. On the _edition div_ it holds a URN instead. → [02]

**`<body>`** — The half of a TEI document holding the words of the work, as opposed to `<teiHeader>`,
which holds metadata. "Body characters" is the denominator of coverage. → [02]

**Edition div** — `<div type="edition">`, the wrapper carrying the document's URN in `@n` and its
language in `@xml:lang`. → [02]

**`__cts__.xml`** — CapiTainS catalogue metadata describing works and their versions. **Not a text.**
There are 2,728 of them, more than there are texts, and corpus walkers must exclude them. → [04]

**URI / URL / URN** — A URL says _where_ something is; a URN says _what_ it is. A URN is persistent and
location-independent, has no host, and **cannot be fetched** — it needs a resolver, exactly as an ISBN
needs a catalogue. → [03]

**CTS** — Canonical Text Services (originally _Classical_). Part of the CITE architecture. Both a URN
grammar and a network protocol; **this library implements neither the protocol nor passage lookup.** → [03]

**SGML** — The 1986 standard TEI was built on before XML existed. Its document model is why DTDs and
named entities appear in these files. → [02], [09]

## The declaration

**Citation scheme** — A document's machine-readable statement of its own levels and how to find them.
Read, never assumed. → [05]

**`<refsDecl>`** — The header element holding the declaration. `n="CTS"` marks the CTS-conformant one.
→ [05]

**`cRefPattern`** — One declaration per citable depth, deepest first. Carries `@n` (the level's label),
`matchPattern` (a regex over a citation string), and `replacementPattern` (an XPath template with
`$1`, `$2` placeholders). → [05]

**`#xpath(…)`** — The wrapper marking a `replacementPattern`'s contents as an XPath expression. Not
itself XPath. → [05]

**Capture vs filter** — In a citation XPath, `[@n='$1']` _captures_ a value into the citation;
`[@type='textpart']` merely _filters_ what matches. → [05]

**`refState`** — A pre-CTS mechanism naming a document's levels but **not how to find them**. Not
supported, and not supportable in general. **223 corpus failures.** → [08]

**`citeStructure`** — TEI's newer, nested declaration form. Read only when `citeStructure: true`, which
defaults to **off** because turning it on changes which declaration wins on documents carrying both.
→ [10]

**Inferred scheme** — What the library derives from a document's structure when nothing is declared.
Marked `source: "inferred"` because **it is a guess**. 110 corpus texts. → [08]

## The output

**Citable unit** (`CitableUnit`) — One addressable piece of a text: its `citation`, `path`, `kind`,
`element`, `text`, and `speaker`. The thing this library produces. → [06]

**`path` vs `citation`** — `["1","1"]` and `"1.1"`: the same values unjoined and joined. `path` **may
be shorter** than `citation.levels` in a ragged edition, and `path.length` tells you which level a unit
sits at. → [06], [08]

**Enumeration vs lookup** — CTS resolves _one_ citation to a passage; this library enumerates _every_
citation in a document into a flat list. The inversion is the point of the library. → [06]

**Reading text** — The words a reader would see on the printed page: markup resolved per policy,
whitespace collapsed, NFC-normalised. → [07]

**Element policy** — The per-element judgement of what becomes reading text. Five actions: `keep`,
`block`, `drop`, `space`, `{ replace }`. Decided by one question: _would an educated reader see this on
the page?_ → [07]

**Fail open** — The default that an unknown element is **kept**. Silently deleting words is the
dangerous direction; unexpected text is visible and correctable. → [07]

**Preference list** — How `<choice>`, `<app>` and `<subst>` are resolved: they present alternatives, so
the first child in a best-first list wins. Cannot be expressed as a per-element action. → [07]

## The failures

**Ragged hierarchy** — An edition where some divisions stop short of the deepest declared level. The
shallower division becomes the unit; `path` is shorter there. **Correct behaviour**, not a defect. 73
texts. → [08]

**Duplicate citation** — Two elements resolving to the same citation. The document is **refused**,
because a consumer keying by citation would silently lose one. 9 texts. → [08]

**Marker element** — An empty element like `<milestone>` or `<lb/>` marking a boundary rather than
containing anything. A citation level anchored on one is refused — honouring it returned 207 units
containing no text, with no error. → [10]

**Named entity** — `&aelig;`, `&mdash;`. XML predefines only five; the rest need a DTD. One undefined
name **rejects the whole file**. 48 names are shipped compiled in, measured from the corpus rather
than taken from the HTML set. → [09]

**Macro entity** — An entity whose replacement is _markup_ rather than characters, such as
`&Perseus.publish;`. Must be expanded into the document **before** parsing, because an entity resolved
to text can never become an element. → [09]

## The measurements

**Coverage** — Characters in units ÷ non-whitespace body characters. Weak alone: the policy drops text
_by design_, so a low value is often correct. Flags 839 texts at < 0.9. → [12]

**Dropped share** — The fraction of body characters inside elements the policy deliberately discards.
Computed by **set difference**, so a `<note>` inside a `<head>` is not counted twice. → [12]

**Unexplained loss** — `1 − coverage − droppedShare`. Text that went missing that nobody asked to lose.
**81% of the corpus scores exactly 0**, so its tail is meaningful. Flags 60 texts at > 0.05. → [12]

**Citation resolution** — Units ÷ body elements carrying `@n`. The one measure not about characters:
catches a scheme that keeps every character while citing far more coarsely than the edition allows. Its
absolute value is meaningless; only the low tail signals. **52 texts flagged by this and nothing
else.** → [12]

**The two axes** — Text retention and citation resolution fail _independently_, which is why they are
kept as separate named checks rather than combined into one score. → [12]

## The artifacts

**Corpus harness** — `tools/corpus/`: fetch, run, report, manifest. Parses `dist/` rather than `src/`,
writes one JSON line per file immediately, and records **measurements rather than verdicts** so
interpretation can change without reparsing 898 MB. → [11]

**JSONL** — One JSON object per line. Streams, appends, greps, and survives truncation. → [11]

**`report.md`** — The findings document, for **a human** maintaining the parser. → [11]

**`manifest.json`** — The list of usable texts, for **a program** consuming them. `texts` and
`excluded` together account for every file. → [13]

**Blocking vs advisory** — A blocking check means the text cannot be used and is excluded (337).
An advisory check means it is listed at `confidence: "review"` with a warning (1,042), because each
warning has a legitimate cause about as often as a suspicious one. **2,124 texts trip none.** → [13]

**Provenance** — The commit, branch and repository a result was measured from. **A branch name is not a
version**, and this cannot be backfilled: a tarball carries only the branch name, so provenance must be
captured at download time. → [13]

---

Back to the [index](README.md), or the [short history](98-a-short-history.md).
