# tei-cts

[![CI](https://github.com/tianlynn/tei-cts/actions/workflows/ci.yml/badge.svg)](https://github.com/tianlynn/tei-cts/actions/workflows/ci.yml)

Parse CTS/CapiTainS TEI XML into citable text units.

Feed it a Perseus edition, get back the reading text with a canonical citation on every line or
paragraph. It reads the citation scheme the document declares rather than assuming a structure, so
one parser handles Homer, Sophocles, Plato, Herodotus and Caesar — Greek and Latin, verse, drama and
prose — without special cases.

```bash
npm install tei-cts
```

## Use

```ts
import { readFile } from 'node:fs/promises';
import { parseTeiDocument } from 'tei-cts';

const doc = parseTeiDocument(await readFile('tlg0012.tlg002.perseus-grc2.xml', 'utf8'));

doc.title; // 'Ὀδύσσεια'
doc.urn; // 'urn:cts:greekLit:tlg0012.tlg002.perseus-grc2'
doc.citation.levels; // [{ label: 'book', element: 'div' }, { label: 'line', element: 'l' }]

doc.units[0];
// {
//   citation: '1.1',
//   path: ['1', '1'],
//   kind: 'line',
//   element: 'l',
//   text: 'ἄνδρα μοι ἔννεπε, μοῦσα, πολύτροπον, ὃς μάλα πολλὰ',
//   speaker: null,
// }
```

One function, synchronous, a string in. It does no file or network I/O — fetching the document is
yours to control, and the parser stays usable in a browser and trivial to test.

## How citations are worked out

Every CTS-conformant edition declares its own scheme in `teiHeader/encodingDesc/refsDecl`:

```xml
<cRefPattern n="line" matchPattern="(\w+).(\w+)"
  replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2'])"/>
```

`tei-cts` parses that XPath into traversal steps and walks the tree with them. The declaration is the
authority, which is why the same code produces all of these:

| Work              | Levels                 | Leaf                       | Citation |
| ----------------- | ---------------------- | -------------------------- | -------- |
| Homer, Vergil     | book, line             | `<l>` with `@n`            | `1.1`    |
| Sophocles         | line                   | `<l>` with `@n`, play-wide | `1`      |
| Plato             | book, section          | `<div>`                    | `1.327`  |
| Herodotus, Caesar | book, chapter, section | `<div>`                    | `1.1.1`  |

Note the asymmetry, which is why hardcoding fails: **prose `<p>` never carries a number**. In Caesar,
Herodotus and Plato not one paragraph has an `@n` — the citation comes entirely from the nesting of
`<div>`s. Only verse lines number themselves.

One rule does the rest of the work: **a step that captures a value only matches an element that
actually has that attribute.** That is what stops Homer's `//tei:l[@n='$2']` from picking up the 151
unnumbered verse quotations embedded in Herodotus's prose. They are quoted poetry, not citable lines,
and the edition says so by leaving them unnumbered.

### Ragged hierarchies

Editions do not always fill in every level they declare. A work may declare `section/subsection` and
then number subsections in only a few of its sections. **A division with nothing below it is cited by
the levels it actually has**, so it comes back as `18` rather than being skipped:

```ts
doc.citation.levels.map((l) => l.label); // ['section', 'subsection']
doc.units.map((u) => u.citation); //        ['1', …, '18.1', '18.2', '19', …]
doc.units.map((u) => u.path.length); //     [ 1,  …,  2,      2,      1,  …]
```

`path.length` therefore tells you which level a unit sits at —
`citation.levels[unit.path.length - 1]` names it. Emitting these units is not optional politeness:
before this behaviour existed, a work whose sections mostly lacked subsections returned only the few
deepest units and silently dropped the rest of its text.

One case remains unhandled. A division holding **both** deeper divisions and its own loose text emits
the deeper divisions only; the loose text belongs to no unit, because emitting the parent as well
would duplicate its children. This is rare — usually zero — but reaches a few percent in some
editions that set poetry beside numbered prose verses.

When a document declares no scheme, or declares one written with XPath outside the supported subset,
the structure is read instead and `citation.source` is `'inferred'` rather than `'refsDecl'`. The
inference independently reproduces the declared scheme of every edition in the test corpus, which is
also how the two paths check each other.

### `citeStructure`, for editions that have been normalised

TEI's newer way of declaring the same thing is `citeStructure`: nested elements carrying `@match`,
`@use` and `@unit` instead of one XPath template per depth. Perseus is
[migrating to it](https://github.com/PerseusDLCode/MinimumViablePerseus/discussions/56), and its
working branches restructure the body at the same time — the `<div type="edition">` wrapper is
removed, so the `cRefPattern` those files still carry points through an element that is no longer
there. It matches nothing, and only the `citeStructure` describes the document as it now stands.

```ts
parseTeiDocument(xml, { citeStructure: true }); // citation.source === 'citeStructure'
```

**Off by default.** No published edition uses `citeStructure` yet — 0 of the 3,503 texts in the three
released corpora — and turning it on changes which declaration wins on any document carrying both.
That is a behavioural change, not a fix, so it is yours to opt into. Turn it on to read a normalised
edition; leave it off for anything currently released.

The declaration is refused, and the parser falls back as it would to any unreadable scheme, when a
level's `@use` is not a plain attribute, when a level offers several alternatives at one depth, or
when a level is anchored on a **marker element** — `milestone`, `lb`, `pb`. That last one matters:
the normalised Odyssey cites its cards as `milestone[@unit='card']`, meaning the text _between_ two
markers, and honouring it literally would return 207 units containing nothing at all.

## Reading text

Units contain the text a reader would see in the printed edition. Apparatus, commentary and print
furniture are removed; the editor's accepted restorations are kept.

| Action                  | Elements                                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kept inline             | `q` `quote` `said` `cit` `sp` `seg` `w` `pc` `phr` `hi` `emph` `foreign` `name` `persName` `placeName` `orgName` `rs` `date` `num` `title` `term` `gloss` `ref` `add` `supplied` `unclear` `lem` `corr` `reg` `expan` `ex` `sic` `orig` `abbr` `am`                    |
| kept, with a line break | `p` `l` `lg` `ab` `div` `list` `item` `row`                                                                                                                                                                                                                            |
| dropped                 | `note` `del` `rdg` `bibl` `biblScope` `witness` `witDetail` `head` `label` `trailer` `opener` `closer` `salute` `dateline` `argument` `figure` `figDesc` `graphic` `speaker` `stage` `castList` `castItem` `role` `roleDesc` `milestone` `lb` `pb` `cb` `anchor` `ptr` |
| replaced                | `gap` → `[…]`, `space` → a space                                                                                                                                                                                                                                       |

`<choice>` and `<app>` select among their children rather than rendering all of them: `corr` beats
`sic`, `reg` beats `orig`, `expan` beats `abbr`, and `lem` beats `rdg`. A standalone `sic` with no
correction to stand in for it is still kept — there is nothing better to show.

An element the table does not name is **kept**. Failing open on text is deliberate: unexpected words
are visible and correctable, silently deleted ones are not.

Two defaults are worth knowing because they change what you read:

- **`del` is dropped.** In the Aeneid this empties 61 lines that the editor athetized — `<l n="426">`
  exists and its text is `''`. That is faithful to the edition, but if you want those lines, override it.
- **`head` and `label` are dropped**, which is what stops a prose unit beginning with its chapter heading.

Everything is overridable:

```ts
parseTeiDocument(xml, {
  elements: { del: 'keep', note: 'keep', gap: { replace: '' } },
  choicePreference: ['sic', 'orig', 'abbr'], // diplomatic rather than edited text
  blockSeparator: ' ',
});
```

`defaultElementPolicy`, `defaultChoicePreference` and `defaultAppPreference` are exported, so you can
build a policy from them instead of restating one.

## Text is preserved, not tidied

Unit text is normalised to NFC and has its whitespace collapsed. Nothing else is touched — no accent
stripping, no final-sigma conversion, no modernisation.

**If you tokenize Greek, read this.** Perseus writes elision with **U+02BC MODIFIER LETTER
APOSTROPHE**, not U+2019 or U+0027. Its Unicode category is `Lm`, which means **it matches `\p{L}`**:
a word-boundary check built on that regex will treat `δʼ` as a single word rather than `δ` followed
by punctuation. It is not rare — 11,158 occurrences in the Iliad, 8,941 in the Odyssey, 2,752 in
Plato. Latin editions use U+0027 instead, and sparingly. `tei-cts` passes the character through
untouched, deliberately; handling it is a decision only you can make.

## Entities

XML predefines five named escapes — `&amp;` `&lt;` `&gt;` `&quot;` `&apos;` — and nothing else. A
document using `&aelig;`, `&mdash;` or `&eacute;` has to declare them, and TEI editions declare them
in a DTD sitting on a web server, which nothing here fetches. Left alone, an XML parser treats the
first such name as malformed and rejects the file whole.

So the names are compiled into the package and handed to the parser before it reads anything. No
network, no file access, one property lookup per entity. The table is **48 names, measured** — every
entity appearing as live text anywhere in canonical-greekLit, canonical-latinLit and First1KGreek, and
nothing else. Every value is checked against the DTDs the documents themselves point at, from
`PersProse.dtd` down to the OASIS `iso-*.ent` sets: all 48 are declared there and all 48 values match.
Shipping the full HTML set instead would have cost 43 KB to define 2,072 names no edition writes.

A few Perseus entities are markup rather than characters — `&Perseus.publish;` is the publication
statement every Tufts edition shares, written once in the DTD. An entity resolved to text can never
become an element, so those are expanded into the document before it is parsed. Between the two,
**no document in the three corpora now fails at the XML layer.**

Do not expect this to rescue old Perseus files. 27 texts failed on an entity, and resolving them
recovers **none**: they are TEI P4 documents that predate CTS citation, so they now fail for that
reason instead — accurately, rather than by blaming well-formedness. See
[`docs/corpus-testing.md`](docs/corpus-testing.md).

One oddity worth knowing. `&cdot;` is `ċ`, which is what `iso-lat2.ent` declares — but Pliny's
astronomical tables write `87&cdot;9705`, meaning a decimal point. The declaration is the authority
here, as it is for citations; pass `entities: { cdot: '·' }` if you would rather read the intent.

Names outside the table are rejected, loudly — including the older convention that spells Greek
letters `&agr;`, `&bgr;`. Supply those yourself, or turn the table off for strict XML:

```ts
parseTeiDocument(xml, { entities: { agr: 'α', bgr: 'β' } }); // merged over the table
parseTeiDocument(xml, { corpusEntities: false }); // no shipped names
parseTeiDocument(xml, { corpusDtdMacro: false }); // no macro expansion
```

The two switches are independent, because they do different things. `corpusEntities` configures the
parser and leaves your document alone; `corpusDtdMacro` rewrites the document before parsing, which is
the only place this package touches its input — turn it off and the parser sees exactly the bytes you
passed. With both off nothing is special-cased at all: the five XML names, plus whatever `entities`
adds, and any document relying on its DTD fails as malformed, which without that DTD is what it is.

Replacement text is inserted as text and never rescanned, so it can introduce neither markup nor
another entity, and the five XML names cannot be redefined.

## What this does not do

- **Not a general TEI parser.** It targets the CTS/CapiTainS profile. TEI has some 600 elements and no
  fixed structure; outside that profile, "what is a citable unit" has no defined answer.
- **No tokenization, lemmatization or sentence segmentation.** Those are language problems, not markup
  problems.
- **No CTS range resolution.** Every unit in the document comes back; slicing `1.1-1.10` is one `filter`.
- **No network and no file access.** Which means **no DTD processing at all**: a `<!DOCTYPE>` is not
  read, an external DTD is never fetched, and a document's own internal subset is not interpreted.
  What the DTDs declare arrives here as the two compiled-in tables above, sourced offline and
  switchable, not as anything the parser does at runtime.
- **Milestone-anchored citation** — schemes that cite the text _between_ two markers, as some Plato and
  Aristotle editions do — is not supported, in either declaration form. Such a scheme is detected and
  falls back to inference rather than producing subtly wrong units.

## Development

```bash
npm ci
npm run build && npm run typecheck && npm run lint && npm test -- --coverage
```

Fixtures cannot tell you how the parser behaves on shapes they do not contain, so the repo also
carries the harness that runs it over every text in canonical-greekLit, canonical-latinLit and
First1KGreek — 3,503 files, 898 MB. It runs over **two** corpora, because upstream is mid-migration:
the released branches, parsed as shipped, and Perseus's working branches, parsed with
`citeStructure: true`. Each must hold on its own.

```bash
npm run corpus              # released branches, options as shipped
npm run corpus:normalized   # working branches, citeStructure on
```

It downloads the corpora and writes its output to `.corpus/`, which is git-ignored; `rm -rf .corpus`
undoes it. See [`tools/corpus/README.md`](tools/corpus/README.md), and
[`docs/corpus-testing.md`](docs/corpus-testing.md) for what a full run found.

Besides the findings report, a run writes **`.corpus/manifest.json`** — the 3,166 released texts that
parse reliably, keyed by URN, with metadata, citation scheme and quality measurements for each, and
every excluded text carrying the exception or measurement that disqualified it. Quality is measured on
two axes rather than one: `unexplainedLoss` (coverage with the policy's own deliberate deletions
subtracted, so 0 means nothing went missing unaccounted for) and `resolution` (units over the
divisions the body numbers, which catches a scheme that keeps every character while citing far more
coarsely than the edition allows). It names the commit of each corpus
repository it was generated from, so a downstream consumer can say exactly which corpus a list came
from. That is the file to pick up; build it alone with `npm run corpus:manifest`.

The test corpus is seven real Perseus excerpts covering every citation shape above, plus invariants
asserted across all of them — citations unique and one value per level, no markup reaching the text,
NFC stability, elision preserved, and citations provably independent of the element policy. Fixtures
are CC BY-SA 4.0 and are not shipped in the package; see [`fixtures/ATTRIBUTION.md`](fixtures/ATTRIBUTION.md).

## Licence

MIT. The test fixtures are separately licensed — see above.
