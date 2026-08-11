# 10 — When the corpus changes shape

> **Recap.** Chapters 08 and 09 were about documents that are _older_ than the standard being applied
> to them. This one is the opposite problem: documents that are **newer**, on a corpus that is being
> rewritten right now.

## A second way to declare a scheme

Chapter 05 taught `cRefPattern`: one XPath template per depth, deepest first. TEI has since introduced
a different mechanism, `citeStructure`, and Perseus is migrating to it.

Compare. The old form, flat — one absolute path per level:

```xml
<cRefPattern n="line" matchPattern="(\w+).(\w+)"
    replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2'])"/>
<cRefPattern n="book" matchPattern="(\w+)"
    replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1'])"/>
```

The new form, **nested** — the hierarchy expressed as hierarchy:

```xml
<refsDecl n="CTS" xml:id="CTS">
  <citeStructure match="/TEI/text/body" use="@xml:base">
    <citeStructure unit="book" delim=":" match="div[@type='book']" use="@n">
      <citeStructure unit="line" delim="." match="l" use="@n"/>
    </citeStructure>
  </citeStructure>
</refsDecl>
```

Each level says three things: `match` (a relative path to the elements at this level), `use` (which
attribute holds the value), and `unit` (the label). Nesting replaces repetition, and each path is
relative to its parent rather than absolute from the root — which is, on any reading, the better
design.

## The transitional document is the dangerous one

Here is why this cannot simply be added and enabled.

A document mid-migration carries **both** declarations. And the body is being restructured at the same
time — so the retained `cRefPattern` points through a `<div type="edition">` wrapper that the
normalisation has **removed**.

The result is a file that contains a declaration which is _syntactically valid, readable, and false_.
Follow the old pattern and it matches nothing. Follow the new one and it works. Only the document's
own history tells you which to trust.

That is why reading `citeStructure` is behind an option that **defaults to off**:

```js
parseTeiDocument(xml, { citeStructure: true });
```

Turning it on changes _which declaration wins_ on any document carrying both. That is a behavioural
change, not a bug fix, and it is not something a library should do to its users silently.

**In the released corpora the risk is currently zero.** Of the 3,267 documents that parse there, 3,157
read a `cRefPattern`, 110 have their scheme inferred, and **not one uses `citeStructure`**. The option
exists for readiness, not for today.

## Measuring the migration

The work is not hypothetical — it exists on branches now. So the corpus harness runs over **two**
corpora, with **different options**, and the pairing is fixed in code rather than passed on a command
line:

| Corpus       | Branches                                    | Options               |
| ------------ | ------------------------------------------- | --------------------- |
| `released`   | `PerseusDL/*#master`, `First1KGreek#master` | as shipped            |
| `normalized` | `PerseusDLCode/*` — `editing`, `dev`        | `citeStructure: true` |

Running one corpus under the other's options is exactly what would hide a regression, which is why
you cannot ask for that combination.

## Two bugs the corpus found that review did not

Both were caught by running the new reader over real normalised documents, and neither would have
surfaced from reading the specification.

**The first was narrow.** A `@match` may be written `div[@type='book']`, `./div`, or
`.//div[@type='fragment']`. The first implementation accepted only the first form, condemning **102
files** whose declarations were perfectly readable.

**The second is the one worth studying.** The normalised Odyssey cites its cards like this:

```xml
<citeStructure unit="card" match="milestone[@unit='card']" use="@n"/>
```

A `<milestone>` is an **empty marker**. It marks a _boundary_ — the card is the text _between_ two
markers — and a marker has no subtree. Honouring that declaration literally returned **207 units
containing nothing at all, with no error.**

Sit with that. A whole work parsing as empty, and **every quality metric would have called it
healthy**: no exception, 207 units where 207 were expected, a declared scheme, unique citations. Only
a measurement of _how much text arrived_ would catch it — which is Chapter 12, and which is why the
corpus run had to come before the release rather than after it.

Levels anchored on a marker element are now refused, and the file fails loudly instead.

## The verdict, which is negative

The normalised branches were measured against the released ones. The result:

```
released    3,503 files · 3,267 parsed · 93.3% · 1,036,211 units
normalized  3,503 files · 3,183 parsed · 90.9% ·   948,841 units
```

Four differences, in increasing order of consequence:

**1. 213 works are cited at a coarser depth.** The Iliad's new declaration is `book/card`, not
`book/line`, so it yields 248 units where it yielded 15,687 — with coverage 0.9997 in _both_. No text
is lost; the granularity changed. Perseus's own report lists `book+card` as an open question rather
than a decision.

**2. 23 files genuinely lose text**, because the new declaration does not cover the body.
`tlg0067.tlg001` drops to 1.9% coverage from 98.9%.

**3. 87 files parse on the released branch and fail on the normalised one.** Nearly all report `no
citable units matched`: `tlg0064.tlg001` declares `div[@type='textpart'][@subtype='paragraph']` while
its body now holds `div[@type='paragraph']`. **The declaration and the document have been normalised
to different conventions** — the file disagrees with itself in a new way.

**4. 2,560 files lose their URN.** The released encoding puts it on the edition div; the normalised
encoding has no edition div at all and moves the URN to `xml:base` on `<body>`. Only 17 of 3,183
parsing documents still declare one where this parser reads it.

That fourth one was found last, and only because something later made the identifier load-bearing —
Chapter 13's manifest, which keys by URN and therefore _cannot list a text that has none_. It is the
most consequential of the four for any consumer, and it went unnoticed while nothing depended on it.

> **Verdict: the normalised corpus improves nothing today, and that is the finding.**

Nobody should switch to it. What the work buys is **readiness and a measurement**: when a normalised
edition does arrive, one option reads it — and the harness can already say, file by file, whether the
migration has improved or damaged the corpus.

## The general lesson

This chapter is really about a situation any long-lived data project meets: **the format you parse is
maintained by someone else, and they are changing it.**

Three responses are available, and only one is good:

| Response                                   | Consequence                                          |
| ------------------------------------------ | ---------------------------------------------------- |
| Ignore it until it lands                   | You find out from a bug report, in production        |
| Adopt it now                               | You regress today for a benefit that has not arrived |
| **Implement it, default off, and measure** | You know the exact cost, per file, before deciding   |

The third is more work than either alternative and is the only one that produces a number.

## Check yourself

1. What does `citeStructure` express that `cRefPattern` expresses only by repetition?
2. Why is a half-migrated document worse for a parser than either end state?
3. Why does `citeStructure: true` default to off — give the reason that is _not_ backwards
   compatibility?
4. The normalised Odyssey returned 207 units containing no text, with no error. Which quality checks
   would have missed that, and what kind of check catches it?
5. The Iliad yields 15,687 units on one branch and 248 on the other, with the same coverage. Is that
   text loss?
6. Why did the missing-URN difference go unnoticed until a later feature was built?

---

That is Part III. Every failure class in the corpus now has a name and a verdict.

Next: [Part IV — 11, Measuring the whole corpus](11-measuring-the-whole-corpus.md) — how any of this
was known in the first place.
