# 13 — Publishing what can be trusted

> **Recap.** Chapter 11 built the measuring machine and Chapter 12 decided what to measure. Both serve
> the person maintaining the parser. This chapter serves a different person: **someone who wants to
> use these texts and does not care how the parser is doing.**

## A different question

`report.md` ranks failures and outliers so a maintainer knows where to look. It is prose, meant to be
read by a human, and it answers:

> How is the parser doing?

A consumer asks something narrower and more practical:

> **Which of these 3,503 files can I pick up and rely on?**

That question has a different shape. It wants an answer that is **machine-readable**, keyed by
something addressable, complete enough to act on without re-deriving anything — and, crucially, it
wants to know what was _excluded_ and why, so "my text isn't here" has an answer.

That is `manifest.json`.

## What it looks like

```json
{
  "schema": "tei-cts/corpus-manifest@1",
  "generated": "2026-08-11T18:51:41.444Z",
  "parser": { "package": "tei-cts", "version": "0.2.0", "options": {} },
  "corpus": {
    "name": "released",
    "sources": [
      {
        "name": "greekLit",
        "repo": "PerseusDL/canonical-greekLit",
        "branch": "master",
        "commit": "790c84289edbdbe289dd7b752bfea29f0af4299d",
        "committed": "2026-08-03T21:01:46Z",
        "fetched": "2026-08-11T18:50:06.149Z"
      }
    ],
    "partial": false
  },
  "criteria": { "blocking": {}, "advisory": {}, "thresholds": {} },
  "totals": { "files": 3503, "included": 3166, "high": 2124, "review": 1042, "excluded": 337 },
  "texts": [],
  "excluded": []
}
```

One listed text:

```json
{
  "urn": "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2",
  "path": "greekLit/data/tlg0012/tlg001/tlg0012.tlg001.perseus-grc2.xml",
  "language": "grc",
  "title": "Ἰλιάς",
  "author": "Homer",
  "citation": { "source": "refsDecl", "levels": ["book", "line"], "first": "1.1", "last": "24.804" },
  "units": 15687,
  "coverage": 0.9997,
  "unexplainedLoss": 0,
  "resolution": 0.9721,
  "ragged": false,
  "confidence": "high",
  "warnings": []
}
```

Everything Parts I–III taught, in one object: Chapter 03's URN, Chapter 05's scheme, Chapter 08's
`ragged` flag, Chapter 12's two signals.

## Three properties that make it usable

**`texts` and `excluded` together account for every file.** 3,166 + 337 = 3,503. So "why is this text
not in the list?" always has an answer _in the same file as the list_ — no cross-referencing a
separate report.

**Excluded texts carry the full exception**, not the grouping signature:

```json
{
  "path": "greekLit/data/tlg0027/tlg001/tlg0027.tlg001.perseus-eng2.xml",
  "check": "parsed",
  "error": {
    "message": "the citation scheme produced the same citation twice (\"1\"), …",
    "signature": "the citation scheme produced the same citation twice (\"X\"), …"
  }
}
```

The signature exists to _group_ causes into a taxonomy; the message names the specific value, line or
pattern a bug report would need. Both are kept because they do different jobs.

**Output is deterministic.** Sorted by URN, so two runs diff meaningfully and a change in the manifest
is a change in the data rather than in iteration order.

## The bar: blocking versus advisory

The whole artifact is only as trustworthy as its criteria are explicit, so they live in one place at
the top of `manifest.mjs` and are **copied verbatim into every manifest** under `criteria`. A consumer
can read what a run vouched for without reading the script.

**Blocking** — fail one and the text is not listed, because it cannot be used at all:

| Check             | Requirement                                    | Excluded |
| ----------------- | ---------------------------------------------- | -------: |
| `parsed`          | returned without throwing                      |      236 |
| `coverageFloor`   | at least 50% of body characters reached a unit |       75 |
| `identified`      | declares a URN                                 |       26 |
| `citable`         | at least one unit                              |        0 |
| `uniqueCitations` | no citation addresses two units                |        0 |
| `normalisedText`  | text is NFC and trimmed                        |        0 |

**Advisory** — fail one and the text _is_ listed, at `confidence: "review"` with the warning attached:

| Warning            | Texts | Threshold                      |
| ------------------ | ----: | ------------------------------ |
| `low-coverage`     |   839 | coverage < 0.9                 |
| `coarse-citation`  |   134 | resolution < 0.05              |
| `single-unit`      |    92 | the work reduced to one unit   |
| `inferred-scheme`  |    84 | scheme guessed, not declared   |
| `unexplained-loss` |    60 | unexplained loss > 0.05        |
| `empty-units`      |     9 | over 5% of units carry no text |

**2,124 texts trip none of them.**

The distinction is the important part. Advisory checks are advisory because **each has a legitimate
cause about as often as a suspicious one** — a commentary really does drop most of its body to
apparatus, and a letter really is one unit long. Rejecting on them would discard good texts; ignoring
them would hand over questionable ones silently. Flagging is the honest middle.

Note which two are _not_ checks at all. Chapter 08's ragged hierarchies and Chapter 07's angle brackets
in editorial notation both fail naive invariants and are both _correct behaviour_, so `ragged` is
reported as a neutral field and markup-looking text is not checked. **A quality bar that flags correct
behaviour trains its users to ignore it.**

## Thresholds are constants, not options

There is no `--coverage-floor` flag, and that is deliberate:

> Two runs of this script must be comparable, and a tunable bar is not a bar.

Change them in a commit, where the change is reviewable and dated. A consumer who wants a different
bar has the raw `coverage`, `unexplainedLoss` and `resolution` on every entry and can apply their own
— which is why those are carried raw rather than reduced to the flag.

## Provenance: why a branch name is not a version

This is the part most easily skipped and most expensive to skip.

A result generated from "canonical-greekLit, master" is **not reproducible**, because `master` means
something different every week. The corpus is edited upstream continuously — Chapter 01 already showed
one consequence, when the count of distinct citation shapes moved from 117 to 118 between two runs.

So `fetch.mjs` resolves each branch to a **commit** before downloading, and records it beside the
extracted tree. The manifest copies it in:

```json
{
  "repo": "PerseusDL/canonical-greekLit",
  "branch": "master",
  "commit": "790c842…",
  "committed": "2026-08-03T21:01:46Z"
}
```

Now a manifest names the exact commit, of the exact branch, of the exact repository, alongside the
parser version and its options. Everything needed to produce the file again.

**This cannot be backfilled.** A GitHub tarball's top-level directory carries the branch name and
nothing else, so a corpus downloaded before provenance was recorded can never be told which commit it
is — the honest report is `commit: null`, and re-downloading is the only fix. Which is the general
lesson: **provenance has to be captured at the moment of acquisition, because afterwards the
information no longer exists.**

## Using it

```js
const { texts } = JSON.parse(await readFile('.corpus/manifest.json', 'utf8'));

const byUrn = new Map(texts.map((text) => [text.urn, text])); // everything vouched for
const clean = texts.filter((text) => text.confidence === 'high'); // nothing attached at all
const verse = texts.filter((t) => t.citation.levels.includes('line'));
```

## What building this found

Worth ending Part IV on, because it is the argument for building such a thing at all.

The manifest keys by URN. That made the URN **load-bearing** for the first time — and immediately
surfaced Chapter 10's fourth normalisation difference: **2,560 texts on the normalised branches have
no URN where this parser reads it.** The migration had moved it to `xml:base` on `<body>`.

Nothing was wrong with the measurements before. The difference simply had no consequence, so nobody
looked. It became visible the moment something depended on it.

> **A consumer-shaped artifact finds consumer-shaped bugs**, and it finds them before a consumer does.

That is the case for building the manifest even in a project where nobody had asked for one yet.

## Check yourself

1. What question does `manifest.json` answer that `report.md` does not?
2. Why do `texts` and `excluded` both live in the same file?
3. Why keep both the full exception message and its signature?
4. Why is `low-coverage` advisory rather than blocking, when `coverageFloor` is blocking?
5. Why is `ragged` a plain field rather than a warning?
6. Why are the thresholds not command-line options?
7. Why can a corpus downloaded last year never report which commit it is?
8. What did keying by URN reveal, and why had nobody noticed it before?

---

That is Part IV, and the tutor's argument is complete: a document declares a scheme, the scheme
enumerates units, the units carry text, real documents break in nameable ways, and the only way to
know which is to measure all of them and publish what survives.

Reference: [98 — A short history](98-a-short-history.md) · [99 — Glossary](99-glossary.md)
