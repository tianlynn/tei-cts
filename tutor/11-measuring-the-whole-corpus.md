# 11 — Measuring the whole corpus

> **Recap.** Part III named five failure classes and quoted numbers for each: 223 pre-CTS documents,
> 110 inferred schemes, 73 ragged hierarchies, 2,560 lost URNs. **Where did those numbers come from?**
> This chapter is the machinery that produces them.

## Why the test suite is not enough

This library has 150 tests over twelve fixtures. They are good tests. They are also structurally
incapable of telling you how the parser behaves on the corpus, and the reason is arithmetic:

> The fixtures cover **five** citation shapes. The corpus contains **118**.

Those five account for 475 files — about **14.5%**. The other 85% are shapes nothing in the test suite
has ever seen: `chapter/verse`, `jebb_page`, `poem/line`, `epistle/section`, `fragment`, `sentence`,
`book/card`, and a hundred more.

The deeper problem is that **the fixtures were chosen by the person who wrote the parser**, which
makes them a record of what he already knew. A fixture cannot witness a case its author failed to
imagine. Every finding in Part III — the ragged hierarchies, the marker-element bug, the missing URNs
— was found by running over data nobody curated, and none of them would have been found by writing
more tests.

So: parse all 3,503, record everything, and reduce.

## Two audiences, two outputs

The harness deliberately produces two different things from one run, because two different people are
asking:

| Reader                       | Wants                           | Gets            |
| ---------------------------- | ------------------------------- | --------------- |
| Whoever maintains the parser | "Where should I look?"          | `report.md`     |
| Whoever consumes the texts   | "Which of these can I rely on?" | `manifest.json` |

This chapter is about producing the raw material both are built from. Chapter 12 is the measurements,
Chapter 13 is the manifest.

## Four scripts

```bash
npm run corpus        # the whole chain, about 4 minutes the first time
```

| Script         | Does                                                 |
| -------------- | ---------------------------------------------------- |
| `fetch.mjs`    | Download the corpora into `.corpus/`                 |
| `run.mjs`      | Parse everything → one JSON record per file          |
| `report.mjs`   | Reduce that to findings, for a human                 |
| `manifest.mjs` | Reduce that to a list of usable texts, for a program |

Everything lands in `.corpus/`, which is git-ignored — **a clone can fetch, parse and report without
producing a single tracked change**, and `rm -rf .corpus` undoes all of it.

## Five design decisions worth stealing

The harness is 500 lines of unglamorous script, and almost every decision in it exists because of
something that went wrong. They generalise well beyond this project.

### 1. Parse the built package, not the source

```js
const { parseTeiDocument } = await import(DIST); // dist/index.js, not src/
```

The measurement is of **what a consumer installs**. Running against `src/` would test a version of the
library nobody uses, and would silently miss anything the build does wrong — a bad export map, a
missing file, a broken type. It has to be `npm run build` first, which the script enforces with a
message rather than a stack trace.

### 2. One JSON line per file, written synchronously, immediately

```js
writeSync(fd, JSON.stringify(record) + '\n');
```

Not accumulated and written at the end. The reasoning is failure-shaped: the plausible catastrophe here
is running out of memory on a 17 MB document, and a process that dies mid-run should not take the
results with it. Writing a line at a time means everything before the crash survives, **and the crash
itself becomes a finding**, because the last record names the file that caused it.

A re-run skips paths already recorded, so a crash can be resumed past rather than restarted.

### 3. JSONL rather than JSON

One object per line, no enclosing array. It streams, it appends, `wc -l` counts it, `grep` works on it,
and a truncated final line from a crash costs you one record instead of the file.

### 4. Record measurements, not verdicts

Each record carries the outcome, timing, resident memory, the resolved scheme, unit count, empty-unit
count, per-document invariants, coverage, unexplained loss, citation resolution, and the elements the
policy has no opinion about.

Notice what is _not_ in that list: any judgement about whether the file is good. The record is
evidence; the interpretation happens in `report.mjs` and `manifest.mjs`, which can be re-run over an
existing JSONL in a second. **Changing your mind about what "good" means should not require reparsing
898 MB** — and in this project it changed several times.

### 5. Every record says how it was produced

```js
const record = { corpus: CORPUS.name, path, repo, bytes, … };
```

Two runs cannot be compared without noticing that they were parsed differently — which matters
enormously given Chapter 10's two corpora parsed under two different option sets.

## Verify the harness before trusting it

A measuring instrument that is itself untested will report whatever it reports, confidently. So the
harness is run over the **committed fixtures** first, where the right answers are already known:

```bash
CORPUS_ROOT=fixtures CORPUS_OUT=.corpus/selftest.jsonl node tools/corpus/run.mjs
```

Three checks:

1. **Unit counts must match what `src/corpus.test.ts` already asserts** — 40/40/40/60/10/17/17.
2. **Coverage must read 1.0 for the Odyssey**, which has nothing droppable, and lower for Sophocles,
   whose speaker labels are dropped. It reads 1.0 and 0.9885.
3. **Parse twice and diff**, ignoring timings. Identical.

Plus one that tests Chapter 10's option specifically: `edge-cite-structure.xml` is expected to **fail**
that run and to parse under `--corpus=normalized`. Every other fixture parses identically either way —
which is the check that the option changes only what it claims to change.

## What a run costs

|                   |                                           |
| ----------------- | ----------------------------------------- |
| Download          | ~90 seconds, once (~1.2 GB per corpus)    |
| Parse             | **34.6 seconds** for 3,503 files / 898 MB |
| Peak memory       | 413 MB, on the 17.3 MB document           |
| Report + manifest | about a second each                       |

Cheap enough to repeat after any change to citation logic or the element policy — which is the entire
point. It is how the entity table of Chapter 09 was shown to recover nothing, and how the released
corpus was proved unchanged when `citeStructure` was added: **3,503 files compared field by field, 0
differences.**

A worked example of the cost being wrong, and why measuring it mattered: the first implementation of
Chapter 12's `unexplainedLoss` took the run from 27 seconds to **191**. The cause was that
self-closing `<lb/>` and `<pb/>` have no closing tag, so a non-greedy regex scanned to end-of-document
hunting one, once per occurrence — quadratic on large files. Skipping names with no closing tag
restored it to 34.6 seconds **with zero differences in output**. Neither the problem nor the fix would
have been visible without a repeatable timed run.

## When the corpus is missing

Every step names the command that produces its input, and exits with a message rather than a stack
trace:

```
No released corpus found at /home/…/.corpus/corpus.

  Nothing has been downloaded there yet.

Download it (about 1.2 GB, once):

  npm run corpus:fetch
```

Small thing, but it is what makes the harness usable by someone who did not write it — which is the
difference between a repeatable measurement and a script that only works on one laptop.

## Check yourself

1. The test suite covers 4 citation shapes and the corpus has 118. Why does writing more fixtures not
   fix this?
2. Why does `run.mjs` import `dist/` rather than `src/`?
3. Why is each record written immediately rather than at the end of the run?
4. Why do the records carry measurements rather than a pass/fail judgement?
5. What are the three self-tests against the fixtures, and what would you conclude if the Odyssey
   read 0.94?
6. A change makes the run take 7× longer but produces identical output. How would you know?

---

Next: [12 — Measuring quality](12-measuring-quality.md) — what to actually measure, once you can
measure anything.
