# 03 — How to read a CTS URN

> **Recap.** Chapter 02: a TEI file holds the text under `<body>`, `@n` carries citation values, and
> the edition div's `@n` holds something different — a string beginning `urn:cts:`. This chapter is
> that string.

## First: what a URN is at all

Before anything specific to classics, the general web standard, because the CTS part only makes sense
on top of it.

You already know **URI**. It splits into two kinds:

| Kind    | Answers        | Example                         |
| ------- | -------------- | ------------------------------- |
| **URL** | _where_ is it? | `https://example.org/iliad.xml` |
| **URN** | _what_ is it?  | `urn:isbn:9780140275360`        |

A **URN** — Uniform Resource Name — is an identifier that is meant to be **persistent** and
**location-independent**. The syntax is three colon-separated parts:

```
urn : <namespace identifier> : <namespace-specific string>
```

Examples you may have met:

```
urn:isbn:9780140275360      a book, by its ISBN
urn:uuid:f81d4fae-7ced-11e0-b4a6-0800200c9a66
urn:ietf:rfc:8141           the RFC that defines all of this
```

The namespace identifier (`isbn`, `uuid`, `ietf`) says who governs the rest of the string. Everything
after it is that authority's business, and each one defines its own grammar.

### The question every programmer asks next

> Can I `GET` it?

**No.** Look at the string: there is no host in it, no scheme that a client knows how to connect to,
nothing to do a DNS lookup on. A URN is a _name_, and names do not tell you where anything lives.

To get from a URN to bytes you need a **resolver** — a service that knows the namespace and can map
a name to a location. This is exactly how an ISBN works: `urn:isbn:9780140275360` identifies a book
unambiguously and forever, and to actually obtain the book you take that number to a catalogue, a
shop, or a library, any of which may or may not have it.

That indirection is the _point_. A URL breaks when the server moves. A name does not, because it
never claimed to know where the thing was.

## What CTS adds

`cts` is the namespace identifier, and everything after it is grammar that CTS defines:

```
urn:cts:greekLit:tlg0012.tlg001.perseus-grc2
└┬┘ └┬┘ └───┬──┘ └──┬──┘ └──┬─┘ └─────┬────┘
 │   │      │       │       │         │
 │   │      │       │       │         └── version    this particular edition
 │   │      │       │       └──────────── work       the Iliad
 │   │      │       └──────────────────── textgroup  Homer
 │   │      └──────────────────────────── namespace  Greek literature
 │   └─────────────────────────────────── NID        "this is a CTS URN"
 └─────────────────────────────────────── URN scheme
```

Three dot-separated components, always in that order, narrowing from an author to a specific file.
Of the 3,241 texts in this corpus that declare a URN, `greekLit` accounts for 2,812, `latinLit` for
428, and `hebrewlit` for exactly one.

## The distinction that matters: work versus version

This is the reason the URN has layers instead of being one flat ID, and the reason one work is
several files.

- **`tlg0012.tlg001`** is _the Iliad_ — the abstract work. Not any particular copy of it. Not in any
  particular language.
- **`tlg0012.tlg001.perseus-grc2`** is _one edition_ of it: a specific Greek text, edited by specific
  people, published in a specific year.

Ask the corpus what it actually holds for that work and the point makes itself:

| URN                           | Language |      Units | Cited as    |
| ----------------------------- | -------- | ---------: | ----------- |
| `tlg0012.tlg001.perseus-grc2` | grc      | **15,687** | `book/line` |
| `tlg0012.tlg001.perseus-eng3` | eng      |        425 | `book/card` |
| `tlg0012.tlg001.perseus-eng4` | eng      |        190 | `book/card` |

Three files, one work. The Greek edition is cited by line; the two English translations are cited by
_card_ — Perseus's paging unit — so they yield hundreds of units where the Greek yields thousands.

Sit with that for a moment, because it disposes of an assumption that would otherwise cause trouble
later: **two versions of the same work do not have to be citable at the same granularity, and unit
counts across versions are not comparable by default.** Chapter 12 uses exactly this fact — when two
versions _should_ agree and don't, that disagreement is a quality signal.

Note also that `perseus-eng3` and `perseus-eng4` are different translations (Murray's of 1924 and
Butler's of 1898), not revisions of one. "Version" in CTS means _this witness to the work_, not a
release number.

## The opaque identifiers

`tlg0012` looks like a hash. It is not — it is a catalogue number, and the prefix tells you which
catalogue:

| Prefix | Catalogue                                                           | In this corpus |
| ------ | ------------------------------------------------------------------- | -------------: |
| `tlg`  | _Thesaurus Linguae Graecae_, the standard register of Greek authors |          2,805 |
| `phi`  | Packard Humanities Institute, the equivalent for Latin              |            328 |
| `stoa` | The Stoa Consortium                                                 |            105 |

So `tlg0012` is Homer, and always Homer, to anyone working in the field. Checked against the corpus:
`tlg0012` → Homer, `tlg0016` → Herodotus, `phi0474` → M. Tullius Cicero, `phi0690` → P. Vergilius
Maro.

The numbers are opaque _to you_, not arbitrary. They are stable third-party identifiers, which is
precisely what you want at the bottom of a naming scheme — CTS did not have to invent an authority
for "which author is this", so it borrowed ones that already existed.

## Addressing a passage

A CTS URN can go one level further, with a colon and a citation:

```
urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1
                                            └─┬─┘
                                       the citation from Chapter 01
```

That names Book 1, line 1 of that specific edition, and it is the point where this chapter's two
threads meet: the URN identifies _which text_, and the citation identifies _where in it_.

**One thing to be clear about: this library does not implement that.** CTS is also a network protocol
— a service you query with a passage URN and which returns the passage. This library is not a CTS
server and does not resolve passage URNs. It reads a TEI file and produces every citable unit in it,
which is a different and, for most purposes, more useful shape. Chapter 06 is about why.

## Where this came from

CTS is one part of the **CITE architecture** — Collections, Indices, Texts, Extensions — developed by
**Christopher Blackwell** and **Neel Smith** for the **Homer Multitext** project, which was conceived
by Casey Dué, Mary Ebbott and Gregory Nagy.

That project's premise explains the URN's shape better than any specification does. The Homer
Multitext set out to publish the _Iliad_ as a **multitext** rather than a critical edition — that is,
to present the many divergent witnesses to the poem side by side, rather than merging them into one
reconstructed "best" text with the disagreements exiled to footnotes.

If your entire purpose is that one work has _many_ legitimate, disagreeing versions, then a single
flat identifier per text is unusable. You need to be able to say "the Iliad" and "this witness to the
Iliad" as separate, related things — which is exactly what `tlg0012.tlg001` versus
`tlg0012.tlg001.perseus-grc2` gives you.

(A small piece of trivia that occasionally confuses searches: CTS originally stood for _Classical_
Text Services, and was renamed to _Canonical_ when it became clear the design was not specific to
classics.)

## Check yourself

1. What does a URL tell you that a URN does not?
2. Why can you not fetch `urn:cts:greekLit:tlg0012.tlg001.perseus-grc2` directly? What would you need?
3. Which part of that URN is the work, and which is the version?
4. The Greek Iliad has 15,687 units and the English one has 425. Is one of them broken?
5. `perseus-eng3` and `perseus-eng4` are both English. What is the relationship between them?
6. Where does the number in `tlg0012` come from, and why does it matter that Perseus did not invent it?

---

Next: [04 — Where the texts come from](04-where-the-texts-come-from.md) — the repositories these
files actually live in.
