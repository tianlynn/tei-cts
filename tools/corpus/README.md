# Corpus tooling

Parse every text in canonical-greekLit, canonical-latinLit and First1KGreek — 3,503 files, 898 MB —
and reduce the results to a findings report. Seven fixtures cannot tell you how the parser behaves on
shapes you have not seen; this can.

```bash
npm run corpus          # build, fetch, run, report — about 4 minutes the first time
```

Or a step at a time:

```bash
npm run corpus:fetch    # download the three corpora into .corpus/  (~1.2 GB, once)
npm run build           # run.mjs parses with dist/, not src/
npm run corpus:run      # parse everything → .corpus/results.jsonl  (~30 s)
npm run corpus:report   # reduce it        → .corpus/report.md
```

## Two corpora

Upstream is mid-migration, so there are two, and they are parsed with **different options**:

| `CORPUS=`            | Branches                                                      | Options               | Output                                             |
| -------------------- | ------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| `released` (default) | `PerseusDL/*#master`, `OpenGreekAndLatin/First1KGreek#master` | as shipped            | `results.jsonl`, `report.md`                       |
| `normalized`         | `PerseusDLCode/*` — `editing`, `dev`, `editing`               | `citeStructure: true` | `results-normalized.jsonl`, `report-normalized.md` |

```bash
npm run corpus:normalized                    # the whole chain for the working branches
CORPUS=normalized node tools/corpus/run.mjs  # or one step
```

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

## The scripts

- **`fetch.mjs`** — downloads each corpus as a tarball rather than cloning it, keeping only `data/`.
  Idempotent: a corpus already extracted is skipped.
- **`run.mjs`** — walks the corpus and appends one JSON record per file. Records are written one line
  at a time with a synchronous write, so a process death preserves everything before it and names the
  file that caused it; re-running resumes past it. Delete `.corpus/results.jsonl` to start over.
- **`report.mjs`** — reduces the JSONL to error signatures, a citation-scheme census, an
  unknown-element census, invariant violations, and outliers ranked by coverage.

## Verify the harness before trusting it

Run it over the committed fixtures first. The unit counts must match what `src/corpus.test.ts` already
asserts — 40/40/40/60/10/17/17 — and coverage must read 1.0 for the Odyssey, which has nothing
droppable, and lower for Sophocles, whose speaker labels are dropped:

```bash
CORPUS_ROOT=fixtures CORPUS_OUT=.corpus/selftest.jsonl node tools/corpus/run.mjs
```

`edge-cite-structure.xml` is expected to **fail** that run and to parse under
`CORPUS=normalized`: it is a normalised document, and the option is what it tests. Every other
fixture parses identically either way, which is the check that the option changes only what it says
it changes.

## Reading the output

`docs/corpus-testing.md` records a full run, what it found, and which findings were acted on. Two
things there are worth knowing before you read a fresh report: the `pathLen` and `noMarkup` invariants
are **expected** to fail on real data — ragged editions cite above the deepest declared level, and
angle brackets are editorial notation, not leaked markup — and coverage is a heuristic for locating
suspicion, not a proof of correctness.

Environment overrides, if you want them: `CORPUS_WORK` (default `.corpus`), `CORPUS_ROOT`,
`CORPUS_OUT`, `CORPUS_REPORT`.
