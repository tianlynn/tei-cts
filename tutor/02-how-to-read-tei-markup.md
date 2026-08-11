# 02 — How to read TEI markup

> **Recap.** Chapter 01: a citation is a path through a work's own structure (`Iliad 1.1`), the levels
> differ per work, and the values are labels rather than positions. This chapter is how that structure
> gets written into a file.

## What TEI is

**TEI** — the **Text Encoding Initiative** — is both a consortium and the XML vocabulary it maintains.
It is what scholars use to encode texts for research, and it has been the standard for that since the
late 1980s.

One comparison carries most of the way:

> **HTML markup says how something should look. TEI markup says what something _is_.**

In HTML you write `<i>` because you want italics. In TEI you write `<foreign>`, `<emph>` or `<title>`
— three things a printer might set identically in italics, but which _mean_ different things. TEI
records the meaning and leaves the appearance to whoever displays it.

That is why TEI is large: it has over 500 elements, because it distinguishes things that look alike.
**This library cares about roughly sixty of them.**

## The smallest useful example

Three verse lines, with no header and no namespace — the first three lines of the _Iliad_, exactly as
they appear in [`fixtures/homer-iliad.xml`](../fixtures/homer-iliad.xml):

```xml
<l n="1">μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος</l>
<l n="2">οὐλομένην, ἣ μυρίʼ Ἀχαιοῖς ἄλγεʼ ἔθηκε,</l>
<l n="3">πολλὰς δʼ ἰφθίμους ψυχὰς Ἄϊδι προΐαψεν</l>
```

_(Roughly: "Sing, goddess, of the wrath of Achilles son of Peleus — the destructive wrath, which put
countless pains on the Achaeans, and hurled many mighty souls down to Hades." A gloss, not the
fixture's content; the fixture is Greek only.)_

`<l>` is a verse line. The important part is the attribute.

**`n="1"` is the citation value from Chapter 01.** It is not an array index, and the parser does not
assign it — it is a label written into the file by whoever encoded the text. When Chapter 01 said
`Iliad 1.1` addresses Book 1 line 1, the second `1` is this `n`.

Everything Chapter 01 said about labels applies to `@n` specifically: it may skip, it may be `327a`,
and the third `<l>` in the file need not be line 3.

## Adding the level above

The _Iliad_ is cited `book.line`, so lines sit inside books. A structural division in TEI is `<div>`:

```xml
<div type="textpart" subtype="Book" n="1">
  <l n="1">μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος</l>
  <l n="2">οὐλομένην, ἣ μυρίʼ Ἀχαιοῖς ἄλγεʼ ἔθηκε,</l>
</div>
<div type="textpart" subtype="Book" n="2">
  <l n="1">…</l>
</div>
```

Look at what just happened: **both books contain a line `n="1"`.** Neither `@n` is unique in the
document. What identifies a line is the _path_ — `1.1` versus `2.1` — precisely the coordinate
Chapter 01 drew.

`<div>` carries two descriptive attributes here:

- `type="textpart"` — a Perseus convention marking a citable division, as opposed to front matter or
  apparatus.
- `subtype="Book"` — what kind of division it is.

Note them, but do not build on them. Chapter 05 shows that what is citable is **not** decided by
reading `type` and `subtype`; it is decided by the scheme the document declares. Different corpora
use these attributes differently, and one of Part III's failures is exactly a document whose
declaration and whose `subtype` no longer agree.

## The document skeleton

Every TEI file has the same outer shape:

```xml
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <!-- everything ABOUT the text: title, author, source, encoding decisions -->
  </teiHeader>
  <text>
    <body>
      <!-- the text ITSELF -->
    </body>
  </text>
</TEI>
```

Two halves, strictly separated. When this tutor says **"the body"** it means everything under
`<body>` — the actual words. That distinction becomes a measurement in Chapter 12, where "how much of
the body reached a unit" is the main quality signal.

The `xmlns` puts every element in the TEI namespace. That is why the XPath in Chapter 05 is written
`tei:div` rather than `div`.

## The real file

Now the actual fixture, at [`fixtures/homer-iliad.xml:99`](../fixtures/homer-iliad.xml):

```xml
<div type="edition" n="urn:cts:greekLit:tlg0012.tlg001.perseus-grc2" xml:lang="grc">
  <div type="textpart" subtype="Book" n="1">
    <l n="1">μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος</l>
```

This is the structure just built, plus one wrapper — `<div type="edition">` — carrying two attributes
that matter:

- **`n="urn:cts:greekLit:tlg0012.tlg001.perseus-grc2"`** — the identity of this edition. Note that
  here `@n` is _not_ a citation value; on the edition div it holds a URN. Chapter 03 takes that string
  apart.
- **`xml:lang="grc"`** — Ancient Greek. The same work exists in this corpus as `perseus-eng3`, an
  English translation, in a different file.

The library locates this element with `findEditionDiv` ([`src/header.ts:39`](../src/header.ts)) and
reads both attributes into `TeiDocument.urn` and `TeiDocument.language`.

## The header

Above the body sits `<teiHeader>`, about ninety lines in this fixture. Most of it is provenance no
program touches — who keyed the text in, which foundation funded it. The library reads five things,
in `readMetadata` ([`src/header.ts:46`](../src/header.ts)):

```xml
<titleStmt>
  <title xml:lang="grc">Ἰλιάς</title>
  <author>Homer</author>
  <editor>David B. Monro</editor>
```

→ `title`, `author`, `editor`, plus `license` from the publication statement.

The header also holds something far more important than metadata: **the document's declaration of how
it is cited**, in `<refsDecl>`. That is the whole of Chapter 05, and it is the piece that makes a TEI
file machine-citable rather than merely machine-readable.

## Why extracting text is not just concatenation

Every `<l>` so far has held plain text. Real editions do not. Here is Sophocles, at
[`fixtures/sophocles-oedipus.xml:109`](../fixtures/sophocles-oedipus.xml):

```xml
<sp>
  <speaker>Οἰδίπους</speaker>
  <l n="1">ὦ τέκνα, Κάδμου τοῦ πάλαι νέα τροφή,</l>
</sp>
```

`<sp>` is a speech; `<speaker>` names who is speaking. Now the question: **when you extract the
reading text of line 1, does the speaker's name belong to it?**

No. The label is apparatus _around_ the line, not part of it. But it sits inside the same markup, so
the obvious implementation — concatenate all descendant text — yields `Οἰδίπους ὦ τέκνα…` and
silently corrupts every line of every play in the corpus.

Now multiply by editorial notes, competing manuscript readings, page-break markers, stage directions,
line-beginning markers and lacuna markers, all of them interleaved with the words. **Deciding which
elements are text and which are apparatus is a judgement call, per element, and it cannot be
avoided.** Chapter 07 is that judgement, written down.

## Where this came from

TEI's history explains two things that otherwise look arbitrary.

In **November 1987**, the Association for Computers and the Humanities convened a meeting at Vassar
College in **Poughkeepsie**, New York — over thirty representatives of archives, humanities computing
centres and scholarly associations. They agreed the principles that still bear the town's name, and
the project proper began in **June 1988** on funding from the NEH.

The format they adopted was **SGML**, then about a year old as an ISO standard — because XML would
not exist for another decade. TEI stayed on SGML through P3. **P4 (2002)** moved the Guidelines to
XML while keeping backward compatibility; **P5 (November 2007)** dropped that compatibility and is
what modern TEI means.

Two consequences you will meet later:

- **SGML's document model is why DTDs and named entities exist in these files at all.** A file that
  writes `&aelig;` and declares it in an external DTD is behaving exactly as SGML intended. It is also
  unreadable by a plain XML parser, which is [Chapter 09](09-when-entities-have-no-dtd.md).
- **Perseus began encoding in this period**, so its oldest files predate not only P5 but CTS itself.
  Those documents are not broken; they are older than the standard that replaced them. That is
  [Chapter 08](08-when-a-document-disagrees-with-itself.md), and it accounts for 223 of the 236
  parse failures in a full corpus run.

## Check yourself

1. Both `<i>` in HTML and `<foreign>` in TEI might render as italics. What is the difference?
2. In the two-book example, why does `n="1"` fail to identify a line?
3. On `<l>`, `@n` is a citation value. On `<div type="edition">`, `@n` is something else. What?
4. Which half of a TEI document holds the words of the work, and which holds the citation
   declaration?
5. Why does concatenating all descendant text of `<sp>` give the wrong reading text?
6. TEI adopted SGML in 1988. Which later chapter's problem does that decision cause?

---

Next: [03 — How to read a CTS URN](03-how-to-read-a-cts-urn.md) — taking
`urn:cts:greekLit:tlg0012.tlg001.perseus-grc2` apart.
