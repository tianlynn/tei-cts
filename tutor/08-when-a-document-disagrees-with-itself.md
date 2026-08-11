# 08 — When a document disagrees with itself

> **Recap.** Parts I and II described a working system: a document declares a scheme, the scheme
> enumerates units, each unit carries clean text. Every example behaved. **This is where that stops.**

Chapter 04 planted the fact this chapter needs: these files were encoded across nearly forty years, by
different people, under standards that changed underneath them. What follows is not a list of bugs. It
is what a real corpus looks like when you point a strict reader at it, and the useful skill is telling
the four cases apart — because they call for four different responses.

Corpus-wide, of 3,503 texts: **3,267 parse and 236 fail.**

## Case 1 — The document declares nothing (223 failures)

By far the largest class, and the one most likely to be misread as a defect.

```
223  the document declares no citation scheme, and its body has no numbered
     divisions or lines to infer one from
```

These are **pre-CTS documents**. Perseus was encoding texts for twenty years before CTS existed, and
those files record their structure in an older TEI mechanism:

```xml
<refsDecl>
  <refState delim="." unit="book"/>
  <refState unit="line"/>
</refsDecl>
```

`<refState>` names the levels — book, then line — but says **nothing about how to find them**. There
is no XPath, no template, nothing to walk. It describes the shape of a citation string, not its
resolution. A program can learn that citations look like `book.line` and still have no way to locate
book 1.

So the correct verdict is not "broken":

> **These documents are out of scope, not defective.** The library does not support `refState`, cannot
> support it in general, and says so.

They are concentrated exactly where Chapter 04's history predicts — `latinLit`, the collection with
the deepest lineage:

| Repository     | Failures |    of |
| -------------- | -------: | ----: |
| `latinLit`     |      233 |   687 |
| `greekLit`     |        3 | 1,612 |
| `First1KGreek` |    **0** | 1,204 |

A 66% pass rate on `latinLit` looks alarming until you know that a third of that repository predates
the standard being applied to it. `First1KGreek`, the newest collection, is perfect.

## Case 2 — The document declares nothing, but the structure is legible (110 texts)

A milder version of case 1, and this one _succeeds_.

Some documents carry no citation declaration at all, yet their body is plainly numbered — divs with
`@n`, lines with `@n`, nested consistently. Rather than refuse, the library **infers** a scheme from
the structure (`inferScheme`, [`src/citation.ts:368`](../src/citation.ts)):

```
fixtures/edge-no-refs-decl.xml
  source: "inferred"
  levels: book(div)/line(l)
  units:  40
```

Identical to what the declared version produces. That is the point — the fixture exists to check that
inference independently reproduces a scheme the file also declares elsewhere.

**But inference is a guess**, and the result says so: `citation.source` is `"inferred"` rather than
`"refsDecl"`. That distinction is carried all the way through to the Chapter 13 manifest as an
advisory flag, because a consumer deserves to know that nobody declared this — a machine decided it.

110 texts in the corpus are inferred.

## Case 3 — Ragged hierarchies (73 texts)

Now a genuinely subtle one, and the only case in this chapter that was once a real bug in this library.

A document declares `section/subsection`. Most sections have numbered subsections. **Some do not** —
they hold their text directly, with nothing below them. Editions are like this constantly: one part of
a work was subdivided by its editor and the next was not.

The original implementation emitted a unit only where the _full_ chain of declared levels matched. So
a section with no subsections matched nothing, and its text **belonged to no unit at all — with no
error.** A corpus run found 21 files losing more than 20% of their text this way, and four losing more
than half.

The fix: a division with nothing at the next declared level becomes the citable unit _itself_. The
ragged fixture shows the result:

```
levels: section/subsection      units: 22
  path lengths: 20 units of length 1, 2 units of length 2
  ["1"]       -> "1"
  ["18","1"]  -> "18.1"
```

Twenty sections cite as `1`, `2`, `3`; two subdivided ones cite as `18.1`. **Both are correct**, and
this is why `CitableUnit.path` is an array whose length may be _shorter_ than `citation.levels`:

```ts
// path.length tells you which level a unit sits at:
citation.levels[unit.path.length - 1];
```

Across the corpus this recovered about 1,900 units, and the worst-affected files went from 9.5% /
15% / 30% / 39% text coverage to 75% / 86% / 94% / 99.8%.

**73 texts have ragged paths.** That is not a defect count — it is how many editions are ragged, which
is a property of scholarship, not of software. The Chapter 13 manifest reports it as a neutral
`ragged: true` flag rather than a warning, because a consumer needs to know `unit.path` varies in that
text.

## Case 4 — The scheme addresses more than exists (9 failures)

```
9  the citation scheme produced the same citation twice ("1"), so it addresses
   more than the edition makes citable
```

Two different elements resolved to the same citation. That is a contradiction: a citation must
identify one passage, or it identifies nothing.

The library **refuses the document** rather than emitting duplicates. This is the right call — a
consumer keying by citation would silently lose one of the two, and a silent loss is worse than a
loud refusal.

Five of the original twelve such rejections turned out to be **this library's fault**, not the
edition's: the inferred anchor was a bare `descendant div`, which also matched divisions _inside_ the
edition division, so the same subtree got walked from several starting points. Pinning the anchor to
the edition div fixed those. The remaining nine are genuine defects in the sources.

Worth dwelling on, because it is the general lesson of this chapter: **a strict checker finds bugs on
both sides of the interface.** Some of what looks like bad data is bad code, and only investigating
each class tells you which.

## Case 5 — The file is simply malformed (3 failures)

```
2  unmatched closing tag: body
1  unexpected close tag
```

Three files in 3,503 are not well-formed XML. Nothing to do about it here; the rejections are correct
and the fix belongs upstream.

These are worth reporting rather than working around, and `docs/corpus-testing.md` tracks them for
that purpose — including the observation that one of them, `phi0692.phi009.perseus-lat1`, appears
never to have been reported to Perseus at all.

## How to read a failure

The four-way discrimination this chapter teaches, as a table:

| What you see                  | What it means                      | What to do                   |
| ----------------------------- | ---------------------------------- | ---------------------------- |
| `declares no citation scheme` | Pre-CTS document, out of scope     | Nothing — expected           |
| `source: "inferred"`          | Nobody declared; a machine guessed | Use with awareness           |
| `path` shorter than `levels`  | Ragged edition, correctly handled  | Nothing — read `path.length` |
| `same citation twice`         | The edition contradicts itself     | Report upstream              |
| `not well-formed XML`         | The file is broken                 | Report upstream              |

Only two of those five are anybody's bug, and neither is the library's.

## Check yourself

1. `<refState>` names a document's citation levels. Why is that not enough to resolve a citation?
2. `latinLit` has a 66% pass rate and `First1KGreek` 100%. What does that difference measure?
3. What is the difference between `source: "refsDecl"` and `source: "inferred"`, and why does a
   consumer care?
4. A document declares `section/subsection` and a unit's `path` is `["7"]`. Is something missing?
5. Why does the library refuse a document with duplicate citations rather than emitting both units?
6. Of the 12 original duplicate-citation rejections, 5 were this library's fault. What does that
   suggest about interpreting a failure list?

---

Next: [09 — When entities have no DTD](09-when-entities-have-no-dtd.md) — a failure class that has
nothing to do with citations at all.
