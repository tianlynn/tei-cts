# 07 — From markup to reading text

> **Recap.** Chapter 06 produced a flat list of units, each with a `text` field, and took that field
> for granted. Chapter 02 showed why it cannot be taken for granted: `<speaker>` sits inside the
> markup and is not part of the line. This chapter is that field.

## The question, and why it has no automatic answer

A unit is an element. Its text is everything under it — except the parts that are not text.

```xml
<l n="1">
  ὦ τέκνα<note>Editorial note on the address.</note>, Κάδμου τοῦ πάλαι νέα τροφή,
</l>
```

Should the note's words appear in the reading text? Obviously not. Should the words inside `<q>`?
Obviously yes — a quotation is text the reader reads. Between those two poles sit sixty-odd elements
where the answer is a judgement, and **no algorithm can derive it**, because the question is not
structural. It is editorial.

So the library states the judgement explicitly, as data, in one file you can read and override:
`defaultElementPolicy` ([`src/policy.ts:15`](../src/policy.ts)). The organising principle is one
sentence from the top of that file:

> Would an educated reader see this on the page of the printed edition?

Apparatus, commentary and print furniture go. The text and the editor's accepted restorations stay.

## The five actions

Every element gets one of five verdicts:

| Action             | Meaning                                  | Count | Examples                                   |
| ------------------ | ---------------------------------------- | ----: | ------------------------------------------ |
| `keep`             | render its text inline                   |    36 | `q` `quote` `said` `persName` `hi` `add`   |
| `block`            | same, but force a line break either side |     8 | `p` `l` `lg` `div` `list` `item`           |
| `drop`             | discard it and everything under it       |    30 | `note` `del` `rdg` `bibl` `head` `speaker` |
| `space`            | discard it but leave one space           |     — | _(available; used by callers)_             |
| `{ replace: '…' }` | substitute fixed text                    |     2 | `gap` → `[…]`, `space` → `" "`             |

Four groups explain most of the assignments:

**Speech and quotation are text.** `q`, `quote`, `said`, `cit`, `sp` — all `keep`. Plato's dialogue
and the Odyssey's speeches are the work, not markup about it.

**The editor's accepted text stays.** `add`, `supplied`, `corr`, `expan`, `reg` — the readings the
editor decided were right. These are what gets printed.

**Apparatus and commentary go.** `note`, `rdg` (a rejected variant reading), `bibl`, `witness` — all
about the text rather than being it.

**Print furniture goes.** `head`, `label`, `figure`, `pb` (page break), `lb` (line beginning), and —
the one Chapter 02 flagged — `speaker`.

## Why `gap` is not simply dropped

Two entries in the table are `replace`, and the reason is a good illustration of the principle
deciding cases rather than being decided by them.

```
gap: { replace: '[…]' }
```

A `<gap>` marks a **lacuna** — a place where the text is physically lost, damaged, or illegible.
Dropping it silently would close the hole and present a continuous text where the edition says there
is a hole. That misrepresents the edition. So the loss is rendered, as `[…]`, which is roughly what a
printed edition does.

```
space: { replace: ' ' }
```

Likewise `<space>` records deliberate blank space in the source, so it becomes one space.

This has a measurable side effect worth knowing before Chapter 12: **`replace` inserts characters
that were not in the source.** A document with many `<gap/>` markers can therefore end up with more
extracted characters than its body contains, and its coverage reads slightly above 1.0. Thirty-seven
documents in the corpus do exactly that, the highest at 1.0166.

## The elements that choose among their children

Three elements cannot be handled by any per-element verdict, because they do not _contain_ text —
they present **alternatives** and expect a reader to pick one.

```xml
<choice>
  <sic>teh</sic>
  <corr>the</corr>
</choice>
```

`<sic>` is what the manuscript says; `<corr>` is the editor's correction. You want one of them, not
both concatenated into `tehthe`. Same shape for `<app>` (an apparatus entry, with `<lem>` the accepted
reading and `<rdg>` the rejected ones) and `<subst>` (a substitution).

These are handled by a **preference list**, best first:

```js
defaultChoicePreference = ['corr', 'reg', 'expan', 'ex', 'sic', 'orig', 'abbr', 'am'];
defaultAppPreference = ['lem', 'rdg'];
```

The first child present wins. Note that `sic` and `orig` appear in the list _after_ their corrected
counterparts — so a `<choice>` with both yields the correction, but a **standalone** `<sic>` with no
`<corr>` beside it still yields its text, because then it is all there is.

That is precisely why this cannot be expressed as `sic: 'drop'`. The comment in the source is blunt
about it:

> No per-element action can express this: dropping `sic` unconditionally would also delete a
> standalone `sic` that has no `corr` to replace it.

— [`src/policy.ts`](../src/policy.ts)

## A worked example

Sophocles, from the fixture. The markup:

```xml
<sp>
  <speaker>Οἰδίπους</speaker>
  <l n="1">ὦ τέκνα, Κάδμου τοῦ πάλαι νέα τροφή,</l>
</sp>
```

The unit:

```json
{
  "citation": "1",
  "kind": "line",
  "element": "l",
  "text": "ὦ τέκνα, Κάδμου τοῦ πάλαι νέα τροφή,",
  "speaker": "Οἰδίπους"
}
```

The speaker is **dropped from the text and surfaced as a field**. That is the pattern to notice: the
information is not discarded, it is _relocated_ to where it belongs. A consumer who wants to render
the play has the speaker; a consumer computing word frequencies does not get `Οἰδίπους` counted as
part of line 1.

Across the whole fixture, the arithmetic:

```
body characters (non-whitespace)   1913
characters in units                1891
characters inside dropped elements   22
```

Twenty-two characters removed — the speaker labels — out of 1,913. Hold on to those three numbers;
Chapter 12 builds its main quality signal directly out of them.

By contrast the Odyssey fixture, which has no drama and no apparatus, extracts **1,504 of 1,504**.

## Whitespace, normalisation, and the guarantees

The flattener does more than select elements. What comes out of `flattenText`
([`src/text.ts:66`](../src/text.ts)) is guaranteed to be:

- **whitespace-collapsed** — runs of space, tab and newline become one space, and the result is
  trimmed. XML indentation is formatting, not content.
- **NFC-normalised** — Unicode composed form by default, so `ά` is one code point and not two. This
  matters enormously for Greek, where the same visible letter has several encodings, and string
  equality would otherwise fail unpredictably.
- **block-separated** — `block` elements are joined with `\n`, so paragraphs of a prose section do not
  run together into one line.

All three are configurable through `ParseOptions`, and all three are asserted per document by the
corpus harness of Chapter 11.

## Overriding the policy

The defaults are exported, so a caller extends rather than reconstructs:

```js
import { parseTeiDocument, defaultElementPolicy } from 'tei-cts';

parseTeiDocument(xml, {
  elements: { note: 'keep', speaker: 'keep' }, // merged over the defaults
  unknownElement: 'drop', // default is 'keep'
});
```

That last option deserves a note, because the default is a deliberate asymmetry. An element the policy
has never seen is **kept** by default, not dropped. The reasoning:

> Failing open on text is deliberate: silently deleting words is the dangerous direction, and
> unexpected text is visible and correctable.

— [`src/types.ts`](../src/types.ts)

A stray element that should have been dropped shows up as odd words in the output, where a human
notices. A stray element that _was_ dropped shows up as nothing at all. One of those is a bug you find;
the other is a bug you ship.

It is not hypothetical: a corpus run finds **20 element names the policy has never been told about**,
led by `docAuthor` in 69 files and a group of dramatis-personae elements — `listPerson`, `person`,
`roleName` — which fail-open currently admits into the reading text. Chapter 11 is how that is known.

## Check yourself

1. What single question decides whether an element is kept or dropped?
2. Why is `<gap>` replaced with `[…]` rather than dropped?
3. Why can `<sic>` not be handled with `sic: 'drop'`?
4. `<speaker>` is dropped from `text`. Is the information lost?
5. The Sophocles fixture extracts 1,891 characters from a body of 1,913. Where did the other 22 go,
   and is that a defect?
6. An unknown element defaults to `keep`. Argue for that default in one sentence.

---

That is Part II: a document declares a scheme, the scheme enumerates units, and each unit carries
reading text. **The model is now complete — and every document in this chapter behaved.**

Next: [Part III — 08, When a document disagrees with itself](08-when-a-document-disagrees-with-itself.md).
