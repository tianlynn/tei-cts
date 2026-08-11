# 12 — Measuring quality

> **Recap.** Chapter 11 built a machine that parses 3,503 files and records anything you ask it to.
> This chapter is the harder question: **what should it record?** Exceptions are easy. The dangerous
> failure is the one that does not throw.

## The failure that does not throw

Chapter 10 contained the example that should govern everything here. The normalised Odyssey cited its
cards on a `<milestone>` — an empty marker — and the parser returned **207 units containing no text at
all, with no error**.

Check that result against the obvious signals:

| Check                    | Verdict |
| ------------------------ | ------- |
| Did it throw?            | No      |
| Did it produce units?    | 207     |
| Was the scheme declared? | Yes     |
| Are citations unique?    | Yes     |

**Four green lights on a work that parsed as completely empty.** Any quality measure built from
exceptions and structural checks would have shipped it.

So the measurements have to be about _content_, and this chapter builds three, in the order they were
actually arrived at — including the one that turned out to be weak.

## Signal 1: coverage

The obvious measure. How much of the body's text ended up in units?

```
coverage = characters in units ÷ non-whitespace characters in <body>
```

Both counted with markup stripped. On the Odyssey fixture:

```
body characters   1504
unit characters   1504
coverage          1.0000
```

The 207-empty-units case would have scored near zero, so coverage catches it. Good.

**But coverage alone is nearly unusable as a quality bar**, for a reason Chapter 07 already supplied:
the policy _deliberately_ drops text. A commentary that is three-quarters apparatus should score 0.25
and be perfectly healthy. Sophocles drops speaker labels and scores 0.9885 — is that 1.15% a defect?

Look at the distribution across the corpus:

| Percentile | Coverage  |
| ---------- | --------- |
| p10        | 0.71      |
| p25        | 0.88      |
| **median** | **0.967** |
| p90        | 0.9996    |

Set a bar at 0.9 and you flag **839 texts** — a quarter of the corpus — most of them legitimately.
That is not a signal, it is noise with a threshold on it.

## Signal 2: unexplained loss

The fix is to subtract the loss you _asked for_.

```
droppedShare    = characters inside dropped elements ÷ body characters
unexplainedLoss = 1 − coverage − droppedShare
```

Now the arithmetic on Sophocles, in full:

```
body characters (non-whitespace)     1913
characters that reached units        1891
characters inside dropped elements     22
                                     ────
coverage        1891 / 1913  =  0.9885
droppedShare      22 / 1913  =  0.0115
unexplainedLoss   1 − 0.9885 − 0.0115  =  0.0000
```

**Zero.** Every character that did not reach a unit is accounted for by an element the policy was told
to drop — those 22 characters are the speaker labels. The 1.15% "loss" that coverage reported is fully
explained, and the metric says so exactly.

That is the whole idea: coverage asks _how much is missing_, and unexplained loss asks **how much is
missing that nobody asked for**.

The distribution is a different animal from coverage's:

|               | coverage    | unexplainedLoss |
| ------------- | ----------- | --------------- |
| Median        | 0.967       | **0**           |
| p90           | 0.9996      | **0.002**       |
| Texts flagged | 839 (< 0.9) | **60** (> 0.05) |

**81% of the corpus scores exactly 0.** When a distribution is that concentrated, its tail means
something — unlike a coverage percentile, where the tail is just the long slope of a normal spread.
Sixty texts is a list a person can actually read.

### Computing it honestly

Two implementation details matter, both about being wrong in the _safe_ direction.

**Measure by set difference, not by summing.** Prune every dropped subtree from a copy of the body,
then compare lengths. Summing each dropped element's text instead would double-count a `<note>` inside
a `<head>` — and **over-counting the explanation makes real loss disappear**, which is the one
direction a metric like this must never fail in.

**Measure the source with a regex, not with the parse.** The denominator is computed by stripping tags
from the raw XML rather than by walking the parsed tree. That is cruder, and it is deliberate: a
traversal bug that loses text would lose it from _both_ sides of a ratio computed from the parse, and
the metric would report everything was fine.

It is not perfectly precise — nested same-name elements are under-reported, so unexplained loss comes
out slightly **high**. Wrong in the direction of raising suspicion rather than hiding it.

## Signal 3: citation resolution

Both signals so far count characters. Here is a case they cannot see.

`tlg4102.tlg038` scores **coverage 0.9971** and **unexplained loss 0**. Every character arrived.
It emits **25 units** — against **3,899 numbered divisions in its body**.

Every word of the text is present, packed into 25 blobs by a scheme far coarser than the edition
supports. As a text it is complete. As a _citable_ text it is useless, and no character count will
ever notice, because **no characters were lost**.

So the third measurement is not about text at all:

```
resolution = units ÷ elements in <body> carrying an @n
```

The denominator is "how finely does this document say it can be addressed" — Chapter 02's `@n`,
counted. Corpus-wide:

- **138 texts emit under 5% of their numbered divisions.**
- **67 of them have coverage above 0.9** — invisible to every other check here.
- **52 are flagged by this and by nothing else**, all previously rated top-confidence.

### Reading it correctly

The denominator over-counts: `<pb n="12">` and `<milestone n="…">` carry `@n` and are not citable. So
**the absolute value is meaningless** — the Republic fixture legitimately reads 0.14 — and only the far
low tail signals. Exactly like coverage, and stated up front for the same reason.

## Two axes, not one score

The three signals are not three attempts at the same thing. They fall on two independent axes:

```
                    text retention
                          ▲
        complete text │   │   complete text
        coarse cites  │   │   fine cites
        ──────────────┼───┼──────────────►  citation resolution
        lost text     │   │   lost text
        coarse cites  │   │   fine cites
```

A document can be perfect on one and broken on the other. `tlg4102.tlg038` sits top-left: full text,
useless citation. The normalised Odyssey sat bottom-right: correct citation granularity, no text.

Which leads to the design conclusion worth taking away:

> **Do not combine them into a single quality score.**

A composite would average a retention failure against a resolution failure and hide which broke — and
they demand different responses. Low retention is usually the _parser's_ problem. Low resolution is
usually the _edition's declaration_ disagreeing with its own body. One is a bug report to file against
yourself; the other is a bug report to file upstream.

## What none of this establishes

Stated plainly, because it is easy to mistake a green dashboard for correctness:

This measures that the parser does not crash, does not contradict itself or the schemes it is given,
and extracts a plausible _quantity_ of text. It does **not** establish that the reading text is
scholarly correct. Nothing here compares output against a printed edition, and **a policy that dropped
the wrong element would look perfectly healthy in every metric above.**

Coverage, unexplained loss and resolution are heuristics for _locating suspicion_. They tell you where
to look. They are not proofs, and the moment they are treated as proofs they stop being useful.

## A signal not yet built

One measurement would be genuinely different in kind, and it is not implemented.

Every signal above is **self-referential** — it compares a document to itself. But Chapter 03
established that a work has multiple versions, and **826 works in this corpus have two or more**.
Where two versions of the same work in the same language disagree wildly, one of them is likely wrong,
and that judgement comes from outside the document.

It already shows results in a rough form: of 256 same-language multi-version groups, **74 disagree on
unit count by more than 5%**. One work yields 1,885 units in one version and **1** in another — and
coverage rated the broken one 0.75, comfortably above any floor.

Chapter 03 warned that unit counts across versions are not comparable by default — the Greek Iliad's
15,687 against the translations' 425. That is exactly the difficulty: the signal is real but noisy,
which is why it is documented as future work rather than shipped as a check.

## Check yourself

1. The normalised Odyssey returned 207 empty units. Which of coverage / unexplained loss / resolution
   catches it, and which of the _structural_ checks did not?
2. Why is a coverage of 0.25 not necessarily a problem?
3. Compute unexplained loss for a document with body 1000 chars, unit chars 700, dropped chars 250.
   What does the result suggest?
4. Why is `droppedShare` computed as a set difference rather than by summing dropped elements?
5. Why is the body measured with a regex over raw XML rather than from the parsed tree?
6. A text has coverage 0.997 and resolution 0.006. What is wrong with it, and whose bug is it likely
   to be?
7. Why not combine the three signals into one 0–100 quality score?

---

Next: [13 — Publishing what can be trusted](13-publishing-what-can-be-trusted.md) — turning
measurements into something another program can act on.
