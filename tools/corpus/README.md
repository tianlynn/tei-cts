# Corpus tooling

Parse every text in canonical-greekLit, canonical-latinLit and First1KGreek — 3,503 files, 898 MB —
and reduce the results to two things: a findings report to read, and **a manifest of the texts that
parsed reliably, for downstream to pick up**. Seven fixtures cannot tell you how the parser behaves on
shapes you have not seen; this can.

```bash
npm run corpus          # build, fetch, run, report, manifest — about 4 minutes the first time
```

Or a step at a time:

```bash
npm run corpus:fetch     # download the three corpora into .corpus/  (~1.2 GB, once)
npm run build            # run.mjs parses with dist/, not src/
npm run corpus:run       # parse everything → .corpus/results.jsonl  (~30 s)
npm run corpus:report    # findings to read → .corpus/report.md
npm run corpus:manifest  # the deliverable  → .corpus/manifest.json
```

## Two corpora

Upstream is mid-migration, so there are two, and they are parsed with **different options**:

| `--corpus=`          | Branches                                                      | Options               | Output                                          |
| -------------------- | ------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `released` (default) | `PerseusDL/*#master`, `OpenGreekAndLatin/First1KGreek#master` | as shipped            | `results.jsonl`, `report.md`, `manifest.json`   |
| `normalized`         | `PerseusDLCode/*` — `editing`, `dev`, `editing`               | `citeStructure: true` | the same three, `-normalized` before the suffix |

```bash
npm run corpus:normalized                          # the whole chain for the working branches
npm run corpus:run -- --corpus=normalized          # or one step
node tools/corpus/run.mjs --corpus=normalized      # same thing without npm in the way
```

`CORPUS=normalized` still works as an environment variable; the flag wins over it, so a one-off run
does not have to fight a value exported in the shell. Note the `--` in the npm form: without it npm
eats the flag and you silently run the default corpus.

**Use `released` for anything downstream.** `normalized` is measured, not recommended — see below.

Running one corpus under the other's options is what would hide a regression, so the pairing is fixed
in `paths.mjs` rather than passed on the command line. The released corpus must keep parsing exactly
as it did with `citeStructure` off — a run over it is expected to be **identical** to the previous
one, record for record, whenever the option is not involved.

The normalisation branches are named explicitly. The forks' _default_ branches carry no work of their
own, so fetching those would quietly download a copy of upstream and report that nothing had changed;
check with GitHub's compare API before assuming a fresh fetch contains anything new.

**Everything lives in `.corpus/`, which is git-ignored.** Nothing is written anywhere else, so a clone
can fetch, parse and report without producing a single tracked change. `rm -rf .corpus` undoes all of
it, and both corpora together are ~2.4 GB. `tar` and network access are the only requirements beyond
Node.

## The result

`manifest.json` is the artifact downstream consumes. It is machine-readable and nothing else — the
prose about a run lives in `report.md`, which is a different job for a different reader.

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

`texts` and `excluded` together account for every file in the corpus, so "why is this text not in the
list?" always has an answer in the same file as the list.

A listed text carries its URN, its path relative to the corpus root, header metadata, the citation
scheme with its first and last citation, `units`, `coverage`, and `confidence`:

```js
const { texts } = JSON.parse(await readFile('.corpus/manifest.json', 'utf8'));

const byUrn = new Map(texts.map((text) => [text.urn, text])); // everything vouched for
const clean = texts.filter((text) => text.confidence === 'high'); // nothing attached at all
```

An excluded text carries the check it failed, and — for one that threw — the parser's **full**
exception message, not just the grouping signature, since that message names the line or the pattern
a bug report would need.

### What "reliably parsed" means

Defined in one place at the top of `manifest.mjs`, and copied verbatim into each manifest under
`criteria`, so a consumer can read what a run vouched for without reading the script.

**Blocking** — fail one and the text is not listed. It parsed without throwing, declares a URN,
produced at least one citable unit, gives no citation to two different units, has NFC and trimmed
text, and got at least 50% of its body's characters into units.

**Advisory** — fail one and the text is listed at `confidence: "review"` with the warning attached.
Each has a legitimate cause about as often as a suspicious one — a commentary really does drop most of
its body to apparatus, and a letter really is one unit long — which is why they qualify a text rather
than reject it.

| Warning            | Texts | Threshold                                          |
| ------------------ | ----: | -------------------------------------------------- |
| `low-coverage`     |   839 | coverage < 0.9                                     |
| `coarse-citation`  |   134 | units ÷ numbered divisions < 0.05                  |
| `single-unit`      |    92 | the work reduced to one unit                       |
| `inferred-scheme`  |    84 | no declaration; the scheme was read from structure |
| `unexplained-loss` |    60 | unexplained loss > 0.05                            |
| `empty-units`      |     9 | more than 5% of units carry no text                |

The top two by rank are not the top two by usefulness. **`unexplained-loss` and `coarse-citation` are
the discriminating ones**, and they measure different axes:

- **`unexplainedLoss`** = `1 − coverage − droppedShare`, where `droppedShare` is the fraction of body
  characters sitting inside elements the policy deliberately discards. It answers the question raw
  coverage cannot: coverage of 0.75 is alarming until you know the policy was _supposed_ to drop 25%.
  81% of the corpus scores exactly 0 and the 90th percentile is 0.002, so unlike a coverage
  percentile its tail is genuinely anomalous — 60 texts, against 839 for `low-coverage`.
- **`resolution`** = units ÷ divisions the body numbers with `@n`. This catches what no character
  count can: a scheme that keeps every character while emitting a fraction of the units the edition
  is numbered for. `tlg4102.tlg038` emits **25 units against 3,899 numbered divisions at 0.9971
  coverage** — perfect by every other measure and near-useless to cite. **52 texts are flagged by this
  and nothing else**, all of which were `high` confidence before it existed.

Both are also carried raw on every listed text, as `unexplainedLoss` and `resolution`, so a consumer
can set its own bar instead of inheriting this script's.

Two cautions. `resolution` over-counts its denominator — `<pb n="12">` and `<milestone>` carry `@n`
and are not citable — so its absolute value means nothing and only the far low tail is a signal; a
perfectly good Republic fixture reads 0.14. And `droppedShare` under-reports when an element of the
same name nests inside itself, which inflates unexplained loss rather than hiding it: the safe
direction for a metric whose job is to locate suspicion.

The thresholds are constants in the script rather than command-line options, because two runs have to
be comparable and a tunable bar is not a bar. Change them in a commit, where the change is reviewable.

### Reproducibility

A branch name is not a version — `master` means something different every week. `fetch.mjs` therefore
resolves each branch to a commit _before_ downloading it and writes `.source.json` beside the
extracted tree; the manifest copies that in under `corpus.sources`. A manifest names the exact commit
of the exact branch of the exact repository it was generated from, alongside the parser version and
the options.

A corpus downloaded before this existed reports `commit: null`, and the manifest step says so. The
commit cannot be recovered after the fact — a GitHub tarball's top-level directory carries the branch
name and nothing else — so capturing it means downloading again:

```bash
npm run corpus:fetch -- --refetch                      # released
npm run corpus:fetch -- --refetch --corpus=normalized  # the working branches
```

## The scripts

- **`fetch.mjs`** — downloads each corpus as a tarball rather than cloning it, keeping only `data/`,
  and records the commit it took. Idempotent: a corpus already extracted is skipped unless
  `--refetch`.
- **`run.mjs`** — walks the corpus and appends one JSON record per file. Records are written one line
  at a time with a synchronous write, so a process death preserves everything before it and names the
  file that caused it; re-running resumes past it. Delete `.corpus/results.jsonl` to start over.
- **`report.mjs`** — reduces the JSONL to error signatures, a citation-scheme census, an
  unknown-element census, invariant violations, and outliers ranked by coverage. For a human.
- **`manifest.mjs`** — reduces the same JSONL to the list downstream picks up, with every excluded
  text carrying its reason. For a program.

## Verify the harness before trusting it

Run it over the committed fixtures first. The unit counts must match what `src/corpus.test.ts` already
asserts — 40/40/40/60/10/17/17 — and coverage must read 1.0 for the Odyssey, which has nothing
droppable, and lower for Sophocles, whose speaker labels are dropped:

```bash
CORPUS_ROOT=fixtures CORPUS_OUT=.corpus/selftest.jsonl node tools/corpus/run.mjs
```

`edge-cite-structure.xml` is expected to **fail** that run and to parse under `--corpus=normalized`:
it is a normalised document, and the option is what it tests. Every other fixture parses identically
either way, which is the check that the option changes only what it says it changes.

## What a run currently produces

At `790c842` / `4620cf8` / `bfea9ac`, parsed by 0.2.0:

| Corpus       | Files | Listed |  high | review | Excluded | Units     |
| ------------ | ----: | -----: | ----: | -----: | -------: | --------- |
| `released`   | 3,503 |  3,166 | 2,124 |  1,042 |      337 | 1,023,030 |
| `normalized` | 3,503 |    589 |   372 |    217 |    2,914 | 351,081   |

The gap is not a parser regression, and the normalised run is the reason the released corpus is the
default. Beyond what finding 8 already records — 87 files that fail there and parse here, 213 cited
at a coarser depth, 23 losing text — the normalisation moves the CTS URN off the edition div's `@n`
and onto `xml:base` on `<body>`, so **2,560 texts that are addressable on the released branch have no
identifier on the normalised one**. A list keyed by URN cannot include them. That is upstream work in
progress, not something to work around here.

## Reading the output

`docs/corpus-testing.md` records a full run, what it found, and which findings were acted on. Two
things there are worth knowing before you read a fresh report: the `pathLen` and `noMarkup` invariants
are **expected** to fail on real data — ragged editions cite above the deepest declared level, and
angle brackets are editorial notation, not leaked markup — and coverage is a heuristic for locating
suspicion, not a proof of correctness. The manifest treats them accordingly: neither is a check, and
ragged citation is reported per text as a `ragged` flag, because it tells a consumer that `unit.path`
may be shorter than `citation.levels` in that text.

Environment overrides, if you want them: `CORPUS_WORK` (default `.corpus`), `CORPUS_ROOT`,
`CORPUS_OUT`, `CORPUS_REPORT`, `CORPUS_MANIFEST`.
