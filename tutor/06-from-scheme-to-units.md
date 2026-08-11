# 06 — From scheme to units

> **Recap.** Chapter 05: a document declares its citation scheme as one XPath template per depth, and
> resolving a citation means substituting values into the template and following it. This chapter
> turns that operation around, and the turn is what this library is.

## The inversion

CTS is designed around a question:

> **Given citation `1.5`, what text is there?**

That is a _lookup_. It is what a CTS server implements, it is what a passage URN expresses, and it is
the natural shape of the problem if you are building a reading interface where a user clicks a
reference.

It is the wrong shape for almost everything else. If you are indexing a corpus, training a model,
computing statistics, diffing two editions, or building a search index, you do not have a citation in
hand and want its text. You have **a document**, and you want **all of it, addressably**:

> **Given a document, what is every citation in it, and what text does each one hold?**

That is an _enumeration_, and it is what `parseTeiDocument` returns. The same declaration serves both:
Chapter 05's template, instead of being filled in with known values, is walked with its captures left
open, and every element that satisfies it becomes a result.

|            | Lookup (CTS server)    | Enumeration (this library)      |
| ---------- | ---------------------- | ------------------------------- |
| Input      | a citation             | a document                      |
| Output     | one passage            | every citable unit              |
| `$1`, `$2` | supplied by the caller | **collected from the document** |
| Good for   | reading interfaces     | indexing, analysis, pipelines   |

## What comes out

The result is flat. Not a tree — a **list**, in reading order:

```js
import { parseTeiDocument } from 'tei-cts';

const doc = parseTeiDocument(readFileSync('homer-iliad.xml', 'utf8'));

doc.units.length; // 40
doc.units[0];
```

```json
{
  "citation": "1.1",
  "path": ["1", "1"],
  "kind": "line",
  "element": "l",
  "text": "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος",
  "speaker": null
}
```

That is real output from the fixture. Every field earns its place:

| Field      | What it is                                                                          |
| ---------- | ----------------------------------------------------------------------------------- |
| `citation` | `"1.1"` — the address, levels joined by the scheme's separator                      |
| `path`     | `["1", "1"]` — the same values **unjoined**, so a consumer never re-splits a string |
| `kind`     | `line` or `paragraph` — verse or prose                                              |
| `element`  | the TEI element this resolved to, `l` here                                          |
| `text`     | the reading text, markup resolved — **Chapter 07**                                  |
| `speaker`  | the enclosing `<speaker>` in drama, `null` elsewhere                                |

The whole document, alongside:

```json
{
  "urn": "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2",
  "language": "grc",
  "title": "Ἰλιάς",
  "author": "Homer",
  "editor": "David B. Monro",
  "edition": "perseus-grc2",
  "license": null
}
```

Chapter 03's URN, Chapter 02's header fields, and Chapter 05's scheme, all in one object. **That is
the entire API.** One function, one result type — `src/types.ts` is the whole public surface and fits
on a screen.

## Why a flat list, and why in reading order

Two design decisions that look small and are not.

**Flat.** The document _is_ a tree, and the citation _is_ hierarchical, so a nested result would be
the obvious choice. It is rejected because every consumer would immediately flatten it. Indexing,
counting, filtering by language, computing coverage — all of them iterate. The hierarchy is not lost:
it is in `path`, which is an array precisely so the structure survives without the container being
nested.

**In reading order.** The traversal is depth-first in source order, so units come out in the order
they appear in the edition, with **no sort afterwards**. That is why `doc.units[0]` is Book 1 line 1
and `doc.units.at(-1)` is the last line of the last book, and it is only true because the XML tree
preserves document order. Sorting would be wrong anyway — Chapter 01 established that citation values
are labels, so `10` does not sort after `9` unless you know it is a number, and sometimes it is `10a`.

## Two `1`s and one rule

Here is a subtlety worth stopping on, because it is where a naive traversal goes wrong.

Chapter 02 pointed out that Book 1 and Book 2 both contain a line `n="1"`. The scheme's deepest step
is `//tei:l[@n='$2']` — _any_ `<l>` at any depth with an `@n`. So what stops the walk from collecting
every `<l>` in the document into one flat mess, losing which book each belonged to?

The steps are walked **in order, nested**: find the divs matching step one, and for each, search only
_within it_ for elements matching step two. Each match therefore carries the values collected along
the way — `["1", "1"]`, `["2", "1"]` — and the path is what disambiguates. This is `matchUnits`
([`src/traverse.ts:104`](../src/traverse.ts)).

There is a second rule doing quiet work, and the comment in the source states its purpose exactly:

> A step that captures a value only matches an element that actually carries that attribute. That is
> what stops Homer's `//tei:l[@n='$2']` from picking up the 151 unnumbered quotation lines embedded in
> Herodotus' prose.

— [`src/traverse.ts`](../src/traverse.ts)

Prose editions quote poetry. Those quoted lines are `<l>` elements, sitting inside prose sections,
with **no `@n`** — because they are not independently citable. A traversal that matched them would
invent citations the edition never claimed to have. Requiring the attribute to be _present_ is what
keeps the enumeration honest.

## The pipeline, end to end

Everything from Chapter 02 onward, in the order `parseTeiDocument` performs it
([`src/parse.ts:35`](../src/parse.ts)):

```
XML text
   │
   ├─ parseXml ─────────────► element tree                      src/dom.ts
   │
   ├─ readMetadata ─────────► title, author, urn, language      src/header.ts   (ch 02, 03)
   │
   ├─ schemeFromRefsDecl ───► levels + steps                    src/citation.ts (ch 05)
   │     └─ or inferScheme when nothing is declared                             (ch 08)
   │
   ├─ matchUnits ───────────► one match per citable element     src/traverse.ts (this chapter)
   │
   └─ flattenText ──────────► reading text per match            src/text.ts     (ch 07)
                                    │
                                    ▼
                              TeiDocument { …metadata, citation, units[] }
```

One property of that diagram is deliberate and worth naming: **the citation machinery never looks at
text, and the text flattener never looks at citations.** They meet only at the end. That makes
"changing the element policy cannot change the citations" true by construction rather than by care —
and the test suite asserts it, so it stays true.

## What this library does not do

Worth being explicit, since Chapter 03 raised it:

- **It is not a CTS server.** It does not resolve a passage URN, serve HTTP, or implement the CTS
  protocol. Give it a citation and it has no lookup method — you filter `units` yourself, which is a
  `Map` away if you need it repeatedly.
- **It does not fetch anything.** No network, no DTD retrieval, no file access beyond the string you
  hand it.
- **It does not validate TEI.** A document that is well-formed XML and declares a scheme it can read
  will parse, whether or not it is schema-valid.

## Check yourself

1. State the difference between what a CTS server does and what `parseTeiDocument` does, in terms of
   what is input and what is output.
2. Why is `path` an array when `citation` already contains the same information?
3. Why are units not sorted after traversal? Give two reasons.
4. Herodotus' prose contains `<l>` elements with no `@n`. Why does the Iliad-style pattern
   `//tei:l[@n='$2']` not collect them?
5. The element policy decides `<note>` is dropped. Can changing that policy change any unit's
   `citation`? Why not?
6. You need to look up citation `3.7` repeatedly in a parsed document. What do you build?

---

Next: [07 — From markup to reading text](07-from-markup-to-reading-text.md) — the `text` field, which
this chapter took for granted.
