# Tutor: from classical texts to iterable units

A guided introduction to what this library does and why the problem is shaped the way it is.

**Who this is for.** Programmers. It assumes you read code, know XML exists, and have never heard of
TEI, CTS, or Perseus. It assumes nothing about Greek, Latin, or classical scholarship — where a
convention only makes sense with historical context, the context is given.

**What you will be able to do at the end.** Read a Perseus TEI file and predict what
`parseTeiDocument` will return from it; explain why a given text fails; and judge whether a text is
good enough to use, using the same measurements the corpus harness applies.

## How to read this

In order. Each chapter builds one example forward rather than starting a new one, and later chapters
assume the vocabulary earlier ones define.

The material is deliberately staged: **Parts I–II teach the model as if the world were tidy**, and
**Part III is where the world stops being tidy**. Real editions contradict their own declarations,
lose their identifiers, and reference DTDs that no longer exist. None of that is mentioned early,
because a rule and its exceptions learned together are two facts learned badly. If you find yourself
thinking "but surely some document breaks this" — yes, and that is Part III.

Every chapter ends with **Check yourself**: a few questions answerable from the chapter alone.

## The chapters

Each part has one grammatical shape, so the title tells you what kind of chapter you are in.
**`How to…`** is a skill you acquire; **`From X to Y`** is a transformation the library performs;
**`When…`** is an exception to something you already believe; **`Measuring…`** is verification.

### Part I — The model

_Status: complete._

| #                                     | Chapter                   | What it covers                                                                                                                                        |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01](01-how-to-cite-a-text.md)        | How to cite a text        | Canonical citations, why every work has different levels, why citation values are labels rather than numbers, and why Plato is cited by a 1578 book.  |
| [02](02-how-to-read-tei-markup.md)    | How to read TEI markup    | Built from three verse lines up to the real fixture. `@n`, `<div>`, the header, and why extracting text is not concatenation. TEI's SGML origins.     |
| [03](03-how-to-read-a-cts-urn.md)     | How to read a CTS URN     | What a URN is at all (`urn:isbn:`, `urn:uuid:`), why you cannot fetch one, then the CTS grammar. Work versus version, and why one work is many files. |
| [04](04-where-the-texts-come-from.md) | Where the texts come from | Perseus, the three repositories, the directory layout, `__cts__.xml`, and the real scale: 3,503 texts, 898 MB, forty years of accumulated encoding.   |

### Part II — The pipeline

| #                                              | Chapter                                     | What it covers                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [05](05-how-a-document-declares-its-scheme.md) | How a document declares its citation scheme | `<refsDecl>` and `<cRefPattern>`. Following `1.5` through an XPath template to one specific `<l>`. One pattern per depth, deepest first.           |
| [06](06-from-scheme-to-units.md)               | From scheme to units                        | **The hinge.** Inverting "resolve one citation" into "enumerate every citation". What a `CitableUnit` is, and real output from the fixtures.       |
| [07](07-from-markup-to-reading-text.md)        | From markup to reading text                 | The element policy: why `<note>` must go and `<q>` must stay. `keep` / `block` / `drop` / `space` / `replace`, worked through a page of Sophocles. |

### Part III — Reality

| #                                                 | Chapter                               | What it covers                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [08](08-when-a-document-disagrees-with-itself.md) | When a document disagrees with itself | Ragged hierarchies, duplicate citations, documents that declare nothing, and `refState` — 223 failures that are out of scope rather than broken. |
| [09](09-when-entities-have-no-dtd.md)             | When entities have no DTD             | Why one `&aelig;` rejects an entire file, the 48-name table, and macro entities whose replacement is markup rather than characters.              |
| [10](10-when-the-corpus-changes-shape.md)         | When the corpus changes shape         | `citeStructure`, a second way to declare a scheme; why it is off by default; and what measuring Perseus's migration branches actually showed.    |

### Part IV — Verification

| #                                          | Chapter                        | What it covers                                                                                                                                  |
| ------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [11](11-measuring-the-whole-corpus.md)     | Measuring the whole corpus     | Twelve fixtures cannot witness 118 citation shapes. One JSON record per file, why it is written a line at a time, and what a run costs.         |
| [12](12-measuring-quality.md)              | Measuring quality              | Coverage, why it is weak on its own, unexplained loss, and citation resolution — the two axes a parse fails on independently.                   |
| [13](13-publishing-what-can-be-trusted.md) | Publishing what can be trusted | Turning a measurement run into a list downstream can consume. Blocking versus advisory checks, and why provenance needs a commit, not a branch. |

### Reference

| #                           | Chapter         | What it covers                                                                                        |
| --------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| [98](98-a-short-history.md) | A short history | The timeline in one place: TEI from 1987, Perseus from 1987, CTS from the Homer Multitext. Skippable. |
| [99](99-glossary.md)        | Glossary        | Every term used anywhere in this tutor, defined in one place.                                         |

## Where the code lives

The tutor points at real code rather than paraphrasing it. The map:

| File              | What it does                                                                          |
| ----------------- | ------------------------------------------------------------------------------------- |
| `src/parse.ts`    | `parseTeiDocument` — the entry point, and the only thing a consumer calls             |
| `src/citation.ts` | Reading a citation scheme, from `refsDecl`, `citeStructure`, or structure             |
| `src/traverse.ts` | Walking the document to find what a scheme addresses                                  |
| `src/text.ts`     | Flattening markup into reading text                                                   |
| `src/policy.ts`   | Which elements are text and which are apparatus                                       |
| `src/header.ts`   | Title, author, URN, language                                                          |
| `src/dom.ts`      | A small XML tree, built on `saxes`                                                    |
| `src/types.ts`    | The entire public API, in one readable file                                           |
| `fixtures/`       | Twelve documents the tutor draws on — seven real Perseus excerpts and five edge cases |
| `tools/corpus/`   | The harness of Part IV                                                                |

Two documents complement this one and are written for a different reader — someone who already has
the vocabulary: [`../docs/corpus-testing.md`](../docs/corpus-testing.md) records what a full corpus
run found, and [`../tools/corpus/README.md`](../tools/corpus/README.md) documents the harness.
