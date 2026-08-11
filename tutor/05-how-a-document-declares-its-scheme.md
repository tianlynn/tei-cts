# 05 — How a document declares its citation scheme

> **Recap.** Part I established that a citation is a path of labels, that TEI marks up the structure
> those labels address, that a URN names the text, and that there are 3,503 such texts. Chapter 01
> left one question open: **how does a program learn a particular work's levels?** This is the answer.

## The problem, restated precisely

There are 118 distinct citation shapes in this corpus. A program cannot know that the _Iliad_ is
`book/line` and Herodotus is `book/chapter/section` unless something tells it.

Something does. **A CTS-conformant TEI file declares its own citation scheme, in the header**, and
that declaration is machine-readable. This is the piece that turns a marked-up text into a _citable_
text, and it is the single most important thing in the file after the words themselves.

## Where it lives

Inside `<teiHeader>`, under `<encodingDesc>`, in an element called `<refsDecl>`. From
[`fixtures/homer-iliad.xml:62`](../fixtures/homer-iliad.xml):

```xml
<refsDecl n="CTS">
  <cRefPattern n="line" matchPattern="(\w+).(\w+)"
      replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2'])">
    <p>This pointer pattern extracts Book and Line</p>
  </cRefPattern>
  <cRefPattern n="book" matchPattern="(\w+)"
      replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1'])">
    <p>This pointer pattern extracts Book</p>
  </cRefPattern>
</refsDecl>
```

`n="CTS"` marks this as the CTS-conformant declaration — a file may carry others, and Chapter 08
covers what happens when it does.

## Anatomy of one `cRefPattern`

Take the first one apart. It has three parts that matter:

| Part                 | Value             | What it is                                    |
| -------------------- | ----------------- | --------------------------------------------- |
| `n`                  | `"line"`          | The **label** for this depth                  |
| `matchPattern`       | `(\w+).(\w+)`     | A **regex** matching a citation of this depth |
| `replacementPattern` | `#xpath(…$1…$2…)` | An **XPath template** to find it              |

Read together they say: _"a citation of the form `something.something` is resolved by taking the two
captured groups and substituting them into this XPath."_

The `#xpath(…)` wrapper is not XPath — it is a marker saying "what follows is an XPath expression".
The library strips it and parses the inside, in `parseXPath`
([`src/citation.ts:45`](../src/citation.ts)).

## Following `1.5` through it

Suppose someone asks for _Iliad_ 1.5. Here is the mechanism, step by step:

**1.** Match `1.5` against `matchPattern` — `(\w+).(\w+)` — capturing `$1 = "1"` and `$2 = "5"`.

**2.** Substitute into the `replacementPattern`:

```
/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2']
                                            ↓            ↓
/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='1' ]//tei:l[@n='5' ]
```

**3.** Evaluate that XPath against the document. Read it as a walk:

| Step                 | Means                                               |
| -------------------- | --------------------------------------------------- |
| `/tei:TEI`           | the root                                            |
| `/tei:text/tei:body` | into the body — the words, as Chapter 02 defined it |
| `/tei:div`           | the edition div (the one carrying the URN)          |
| `/tei:div[@n='1']`   | the child div whose `@n` is `1` — **Book 1**        |
| `//tei:l[@n='5']`    | any `<l>` beneath it whose `@n` is `5` — **line 5** |

That lands on exactly one element, and its text is the passage. `tei:` is the namespace prefix from
Chapter 02; `//` means "at any depth below", which matters because lines are not always immediate
children of a book.

**This is the whole idea.** A citation scheme is a template, and resolving a citation is filling it in
and following it.

## One pattern per depth, deepest first

Look again at the declaration: there are **two** `cRefPattern` elements, and the `line` one comes
_before_ the `book` one. That ordering is the convention, not an accident:

| Order | `n`    | Matches | Addresses |
| ----- | ------ | ------- | --------- |
| 1st   | `line` | `1.5`   | one line  |
| 2nd   | `book` | `1`     | one book  |

A CTS declaration lists **one pattern per citable depth, deepest first**. A three-level work like
Herodotus carries three; a play carries one.

The library only needs the deepest, because it describes the full path — and the shallower ones are
prefixes of it. What it extracts is a list of levels, each with a **label** (from `@n`) and the
**element** that carries it (from the last step of the XPath):

```json
{
  "source": "refsDecl",
  "levels": [
    { "label": "book", "element": "div" },
    { "label": "line", "element": "l" }
  ],
  "separator": ".",
  "pattern": "#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2'])"
}
```

That is real output from `parseTeiDocument` on the fixture. Note that `levels` is exactly Chapter 01's
`book, line` — recovered from the file rather than assumed. Note too that the original `pattern` is
kept verbatim: when a scheme misbehaves, the string the edition actually wrote is the first thing you
want to see.

## What the library supports, and what it refuses

The XPath in these declarations is not general XPath, and the library deliberately implements a
subset: a path of element steps, each optionally carrying attribute predicates of two kinds —

- **a capture**, `[@n='$1']`, which contributes a value to the citation, and
- **a filter**, `[@type='textpart']`, which only constrains what matches.

That covers the corpus. Anything outside it — a function call, a positional predicate, an axis other
than child or descendant — is **refused rather than approximated**, and the parser falls back as it
would for any unreadable scheme.

The scanning is hand-written rather than regex-matched over the whole string, for one reason worth
noting because it recurs throughout this codebase:

> A regex cannot report _where_ an unsupported construct began, and that message is the only thing
> that makes an unparseable edition debuggable.

— paraphrasing the comment on `parseXPath` ([`src/citation.ts:45`](../src/citation.ts))

Chapter 08 shows what the failures actually look like, and why "refuse loudly" beats "guess quietly".

## Check yourself

1. Which part of a `cRefPattern` gives a level its **name**, and which gives the **element** that
   carries it?
2. Walk `2.13` through the Iliad's declaration. What XPath results?
3. Why does the `line` pattern come before the `book` pattern?
4. Herodotus is cited `book/chapter/section`. How many `cRefPattern` elements would you expect, and
   what would the deepest `matchPattern` look like?
5. What is the difference between `[@n='$1']` and `[@type='textpart']` in a citation XPath?
6. Why does the library keep the raw `replacementPattern` string on the parsed scheme?

---

Next: [06 — From scheme to units](06-from-scheme-to-units.md) — where the library stops resolving
citations and starts enumerating them.
