# Corpus testing

The test suite runs against seven files. They were chosen because they covered the citation shapes I
already knew about, which makes them a poor witness to how the parser behaves on shapes I did not.
This document records a run over **every text in all three corpora — 3,503 files, 898 MB** — what it
found, and how to repeat it.

The run itself changed nothing: it was a measurement exercise, and its findings were recorded as
recommendations. Findings **1 and 2 have since been applied and the corpus re-run** — the blockquote on
each carries the measured effect, which for finding 2 was not the effect predicted.

## Method

### Corpora

Downloaded as tarballs from `codeload.github.com` rather than cloned, so no history is fetched:

| Corpus                           |     Texts |       Size |
| -------------------------------- | --------: | ---------: |
| `PerseusDL/canonical-greekLit`   |     1,612 |     300 MB |
| `PerseusDL/canonical-latinLit`   |       687 |     174 MB |
| `OpenGreekAndLatin/First1KGreek` |     1,204 |     424 MB |
| **Total**                        | **3,503** | **898 MB** |

Every `.xml` file under `data/` counts as a text **except `__cts__.xml`** — those 2,728 files are
CapiTainS metadata describing works, not editions of them. Translations were deliberately included
(913 English, 11 German, and others): they use the same citation schemes but far heavier markup, so
they exercise the element policy harder than the Greek and Latin do.

### The harness

Three scripts, committed at [`tools/corpus/`](../tools/corpus/). They were throwaway when this run was
made; keeping them was the point of the run being repeatable:

- **fetch** — download and extract the three tarballs, keeping only `data/`. Idempotent.
- **run** — walk the corpus, parse each file, append one JSON record per file to a JSONL. It imports
  the built `dist/`, not `src/`, so it exercises what a consumer installs. Records are written one
  line at a time with a synchronous write, so a process death (out-of-memory on a large document
  being the plausible cause) preserves everything before it and identifies the file that caused it.
  A re-run skips paths already recorded.
- **report** — reduce the JSONL to a findings report.

Each record carries the outcome, timing, resident memory, the resolved citation scheme, unit count,
empty-unit count, per-document invariant results, coverage, and the element names the default policy
does not mention.

### The metrics, and why

Exceptions are the easy half. A parser can also return a well-formed, plausible-looking result that
is quietly missing most of the text, and nothing throws. Four measurements target that:

**Coverage** — characters of unit text over non-whitespace character data inside `<body>`. It is
always below 1, because the policy drops apparatus by design, so the absolute number means little.
The distribution is the signal.

**Unexplained loss** — `1 − coverage − (characters inside dropped elements ÷ body characters)`. This
is the metric that actually works. Coverage alone cannot separate "correctly dropped 88% because this
edition is mostly commentary" from "silently lost 65% through a traversal bug"; subtracting the
policy's own share does.

**Scheme source** — the share of documents falling back to `inferred`. These corpora are largely
CTS-conformant, so a high inferred rate would indicate the `refsDecl` reader is too strict rather
than that the documents are deficient.

**Per-document invariants** — the same properties the unit tests assert.

### Verifying the harness before trusting it

1. Run over the seven committed fixtures first: unit counts and citations must match the values
   already asserted in `src/corpus.test.ts`. They did (40/40/40/60/10/17/17).
2. Coverage must read 1.0 for the Odyssey fixture, which has nothing droppable, and lower for
   Sophocles, whose speaker labels are dropped. It read 1.0 and 0.9885.
3. Parse twice and diff, ignoring timings. Identical.

## Results

```
3,503 files · 3,262 parsed · 241 failed · 93.1% · 1,034,297 units
898 MB in 27s wall · peak RSS 648 MB · slowest file 487 ms (13.2 MB)
```

| Corpus       | Files | Parsed | Failed |  Pass rate |
| ------------ | ----: | -----: | -----: | ---------: |
| greekLit     | 1,612 |  1,605 |      7 |      99.6% |
| First1KGreek | 1,204 |  1,204 |      0 | **100.0%** |
| latinLit     |   687 |    453 |    234 |  **65.9%** |

All 241 failures reduce to **five** causes:

|   n | Cause                                                      | Verdict                             |
| --: | ---------------------------------------------------------- | ----------------------------------- |
| 199 | no citation scheme, and nothing numbered to infer one from | correct rejection, out of scope     |
|  27 | undefined entity                                           | **limitation**                      |
|  12 | the same citation twice                                    | correct rejection, source defect    |
|   2 | unmatched closing tag                                      | correct rejection, malformed source |
|   1 | declared scheme matched nothing                            | correct rejection, malformed source |

### Citation schemes

| Corpus       | refsDecl | inferred | inferred % |
| ------------ | -------: | -------: | ---------: |
| greekLit     |    1,538 |       67 |       4.2% |
| latinLit     |      414 |       39 |       8.6% |
| First1KGreek |    1,204 |        0 |       0.0% |

**117 distinct level shapes** appear across the corpus. The seven fixtures cover four of them
(`book/line`, `line`, `book/section`, `book/chapter/section`), which account for 470 files — **14.4%**.
The other **85.6% parsed correctly in shapes no test exercises**: `chapter/verse`, `jebb_page`,
`poem/line`, `epistle/section`, `fragment`, `sentence`, `book/card`, and a hundred more. That is the
single strongest piece of evidence that reading the declared scheme, rather than hardcoding
structures, was the right design.

## Findings

### 1. Silent text loss on ragged hierarchies — a real defect — **fixed in 0.2.0**

> **Fixed.** A division with nothing at the next declared level is now the citable unit itself. After
> the fix, files losing more than 50% of their text fell from **4 to 0**, and those losing more than
> 20% from **21 to 13**; the corpus gained ~1,900 units and total failures fell from 241 to 236. The
> four worst files went from 9.5% / 15.1% / 29.7% / 39.2% coverage to **74.7% / 86.1% / 94.5% / 99.8%**.
>
> The 13 that remain are a different and milder thing: the mixed-division limitation below, plus
> imprecision in the heuristic. In `tlg0527.tlg057` — the largest remaining — 6.4% of the chapter text
> is poetry set beside numbered prose verses, which no unit claims. The original diagnosis that mixed
> divisions are negligible held for the five files sampled for it, but not for the Septuagint volumes,
> where it reaches a few percent.
>
> The fix also exposed a second bug it then fixed: the inferred-scheme anchor was a bare
> `descendant div`, matching divisions inside the edition division as well as the division itself, so
> one subtree could be walked from several starting points. Pinning the anchor removed 5 of the 12
> duplicate-citation rejections.

The description below is of the defect as found.

**21 files (0.6%) lose more than 20% of their text with no error; 4 lose more than 50%.**

When a document declares several `cRefPattern` depths, the parser takes the deepest and emits units
only there. Where the hierarchy is ragged — some divisions have the deepest level, some do not — the
text in the shallower divisions belongs to no unit and vanishes.

The mechanism, from the three worst cases:

| File                            | Structure                               | Units | Coverage | Unexplained |
| ------------------------------- | --------------------------------------- | ----: | -------: | ----------: |
| `tlg2023.tlg002.1st1K-grc1`     | 22 chapters, 42 sections                |    42 |    0.151 |         71% |
| `stoa0045.stoa003.perseus-lat2` | 10 sections + 1 `praeface`              |     1 |    0.297 |         69% |
| `tlg1799.tlg008.1st1K-grc1`     | 21 sections, 2 subsections              |     2 |    0.095 |         65% |
| `tlg0627.tlg006.1st1K-grc1`     | 7 books, 335 chapters, **318** sections |   318 |    0.392 |         61% |

`tlg1799.tlg008` is the clearest: its scheme is `section/subsection`, but only 2 of its 21 sections
contain a numbered subsection, so the parser emits 2 units and drops nine tenths of the work. In
`tlg0627.tlg006`, 17 of 335 chapters have no section beneath them, and those chapters disappear.

This is the only unambiguous correctness defect the run found, and no exception reports it.

### 2. Undefined entities — a real limitation — **fixed in 0.2.0**

> **Fixed — and it recovers nothing. Measured, not predicted.** The entity names this corpus actually
> uses now ship compiled into the package as `src/entities.ts` and are installed on the parser before
> it reads a document, so 26 of the 27 files below get past the entity barrier with no DTD and no
> network. Not one of them parses.
>
> The table is **48 names**, from a census of every `&name;` appearing as live character data across
> the three corpora — not the 2,120-name HTML set, which was the first attempt and cost 43 KB to
> define 2,072 names no edition writes. Swapping one for the other was verified by re-running the
> corpus: **zero differences** across all 3,503 files. 43 KB became 3.4 KB.
>
> **The values were then checked against the editions' own DTDs**, which are still served: the chain
> from `PersProse.dtd` through `PersTeiCommon.dtd` to the OASIS `iso-*.ent` files declares 612
> entities. All 48 names appear in it and all 48 values match. That check also reversed a decision
> made here earlier: `&cdot;` was shipped as `·` on the reasoning that HTML's `ċ` could not be what
> `87&cdot;9705` means in Pliny's astronomical tables. The DTD says `ċ` too — so the edition
> contradicts its own declaration, and the declaration is what this parser follows, for entities as
> for citations. `entities: { cdot: '·' }` is the override for anyone who wants the intent.
>
> **Markup macros.** Three names in the census are not characters: `&Perseus.publish;`,
> `&Perseus.OCR;` and `&prose.eng.encode;` are boilerplate _markup_ from Perseus's DTD —
> `&Perseus.publish;` is the publication statement shared by every Tufts edition. A character table
> cannot hold an element, so these are expanded into the document before parsing, stepping over
> comments and CDATA (the last two appear only in comments). With that, the undefined-entity class is
> **empty**: `stoa0058.stoa025.perseus-eng1` joined the pre-CTS class where it belongs, and **no
> document in the three corpora fails at the XML layer any more**. All 236 remaining failures are
> about citation, not markup.
>
> The two behaviours switch off separately — `corpusEntities` configures the parser, `corpusDtdMacro`
> rewrites the document — and running the corpus under each combination shows they partition the
> problem exactly:
>
> | Setting                 | Entity failures |
> | ----------------------- | --------------: |
> | both on (default)       |           **0** |
> | `corpusEntities: false` |              26 |
> | `corpusDtdMacro: false` |               1 |
> | both off                |          **27** |
>
> 26 + 1 = the original 27, and parsed count and unit total are identical in all four rows: the
> switches change which error a file reports, not what this corpus yields.
>
> Re-running the whole corpus: **3,503 files, 3,267 parsed, 236 failed** — the same counts as before
> the change, the same 1,036,211 units, and byte-identical coverage and invariants on every file that
> already parsed. The 26 simply moved to a different rejection:
>
> |   n | Where the 26 went                                                                   |
> | --: | ----------------------------------------------------------------------------------- |
> |  23 | no citation scheme — the pre-CTS class of finding 3                                 |
> |   2 | the same citation twice — finding 4                                                 |
> |   1 | genuinely malformed XML (`unexpected close tag`), which the entity error had hidden |
>
> The cause is a population overlap the original run could not see. **26 of the 27 are TEI P4
> documents** — `<TEI.2>` root, `<refsDecl doctype="TEI.2">` with `<state/>` children — and **all 57
> P4 documents in the corpus fail, entities or not**. The editions old enough to write `&aelig;` are
> the same editions old enough to predate CTS citation. Reading them is finding 3's problem, not this
> one.
>
> What the change does buy: those 26 now report why they are actually unusable instead of blaming
> well-formedness, which is how the masked malformed file surfaced. And a CTS-conformant document that
> merely uses `&mdash;` — which exists outside this corpus — now reads.
>
> The 27th was a different animal: `stoa0058.stoa025.perseus-eng1` failed on `&Perseus.publish;`,
> reached through a parameter entity in the document's own internal subset. That is what the markup
> expansion above was written for, and it now reads — as far as the citation scheme, where it fails
> with the other 222.
>
> The description below is of the limitation as found.

27 files fail to parse at all. 26 of them declare an **external DTD** and use HTML/ISO entities that
the DTD would define: `&aelig;` (7,676 occurrences), `&mdash;` (5,674), `&eacute;` (1,710), `&AElig;`,
`&oelig;`, `&dagger;`. All 27 are in latinLit. `saxes` refuses an undefined entity, and the package
neither ships an entity table nor fetches the DTD.

Failing loudly is the right behaviour — the alternative, passing `&aelig;` through as literal text,
silently corrupts the edition. But 27 unreadable files is a gap worth closing.

### 3. The largest failure class is out of scope, and the README overclaims

> Now **222**, after the entity table of finding 2 let 23 more documents through to their real
> rejection. The class grew; nothing about it changed.

199 failures — 82% of all failures, and the entire reason latinLit scores 65.9% — are documents with
no citable structure this parser can see. Of those, **170 use the pre-CTS `<refsDecl><refState>`
form** and carry their citation in `<milestone unit="chapter"/>` markers; 29 declare nothing at all.
**None has a `cRefPattern`.**

Milestone-anchored citation addresses the text _between_ two markers, which the step machine cannot
express, and the README already says so. So each rejection is correct. What is not correct is the
README's unqualified claim to handle "canonical-latinLit": a third of that corpus is legacy
non-CTS material.

### 4. Duplicate citations catch defects in the editions

12 files are rejected for citing two units identically. Examining `tlg0013.tlg003.perseus-grc2`, the
Homeric _Hymn to Apollo_: it contains two unnumbered `<div type="textpart">` — the Delian and Pythian
hymns — each numbering its lines from 1, under a declared scheme of `//tei:l[@n='$1']`, a single
level. The edition's own scheme cannot distinguish Delian line 1 from Pythian line 1.

The guard is doing exactly what it was written for, on real data.

### 5. A test invariant that does not generalise — and 308 false alarms

The harness initially reported 308 documents whose unit text contained `<` or `>`, which would mean
markup leaking into the reading text. **All 308 are false positives**, and the metric was wrong, not
the parser.

Angle brackets are standard editorial notation in classical texts, marking an editor's supplement:
`πρὸς τὸ <μὴ> ἀδιάκριτόν`. The source encodes them as `&lt;`/`&gt;`, and preserving them is correct.
The argument is airtight in one step: an unescaped `<` in character data is not well-formed XML and
would have been consumed as markup, so any `<` reaching the output _must_ have come from an entity —
that is, from content.

`src/corpus.test.ts` asserts this same `noMarkup` property. It passes only because none of the seven
fixtures uses editorial brackets. Generalised, it would be a false-positive generator.

### 6. Twenty elements the policy has never seen

Unknown elements fall back to `keep`, so their text enters the reading text. Ranked by files:

| Element      | Files |     | Element   | Files |
| ------------ | ----: | --- | --------- | ----: |
| `docAuthor`  |    69 |     | `delSpan` |    16 |
| `surname`    |    42 |     | `fw`      |     4 |
| `listPerson` |    35 |     | `desc`    |     4 |
| `person`     |    35 |     | `surplus` |     2 |
| `roleName`   |    32 |     | `addSpan` |     1 |

Most occur in English translations. Several look wrong under the current fail-open default:
`listPerson`/`person`/`surname`/`roleName` are a dramatis-personae list, and `docAuthor` is front
matter — all currently folded into the reading text. `delSpan`/`addSpan` are the ranged forms of
`del`/`add`, whose unranged forms the policy already handles asymmetrically.

### 7. Performance is a non-issue

898 MB in 27 seconds, 63 MB/s of parser time. The largest document (17.3 MB) parses in 259 ms. Peak
resident memory reached 648 MB on the largest files, which is worth knowing for a memory-limited
environment but caused no failure.

## Limitations

This exercise establishes that the parser does not crash, contradicts neither itself nor the schemes
it is given, and extracts a plausible quantity of text. It does **not** establish that the reading
text is scholarly correct: nothing here compares output against a printed edition, and a policy that
drops the wrong element would look perfectly healthy in every metric above.

Coverage and unexplained loss are heuristics for locating suspicion, not proofs. The dropped-element
share is computed with a regular expression over the raw XML, which does not handle nesting exactly,
so the figures are indicative rather than precise. And the corpus is not ground truth — some editions
are genuinely malformed, which is why every failure class above was read and classified by hand
rather than counted.

## Recommendations

In rough order of value, as recorded at the time of the run. **1 and 2 have since been applied** — see
the notes on those findings above; the rest are not:

1. **Emit units at the shallower level when the deepest is absent** (finding 1). Falling back per
   division rather than per document would recover the lost text in all 21 affected files. This is
   the only true correctness bug found.
2. **Ship a default HTML/ISO entity table, and an option to extend it** (finding 2). Would recover 27
   files that cannot currently be read at all.
3. **Qualify the README's latinLit claim** (finding 3) — say plainly that pre-CTS `refState`
   documents are not supported, and that they are a third of that corpus.
4. **Reconsider `noMarkup` in `src/corpus.test.ts`** (finding 5). It is sound for the fixtures and
   unsound in general; at minimum it deserves a comment saying why.
5. **Classify the twenty unknown elements** (finding 6), starting with the dramatis-personae group,
   which fail-open currently admits into the reading text.
6. **Consider adopting a handful of the 117 shapes as fixtures** — `chapter/verse`, `poem/line` and a
   ragged hierarchy would each cover a path nothing tests today.

## Repeating this

```bash
npm run corpus
```

That builds the package, downloads the three corpora, parses all 3,503 texts and writes the report —
about four minutes the first time, half a minute per run after, since the download is the slow part
and is skipped once it is on disk. Everything it touches lives in `.corpus/`, which is git-ignored, so
a fresh clone can do this without producing a tracked change and `rm -rf .corpus` undoes it.
[`tools/corpus/README.md`](../tools/corpus/README.md) documents the individual steps, the self-test
against the committed fixtures, and the environment overrides.

What matters more than the scripts is the shape: parse everything, record one JSON line per file, and
reduce that to error signatures, a scheme census, an unknown-element census, and outliers ranked by
unexplained loss. It is cheap enough to repeat after any change to the citation logic or the element
policy — which is how the entity table of finding 2 was shown to recover nothing.
