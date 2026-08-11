# 98 — A short history

> **Skippable.** Chapters 02, 03 and 04 each end with the history that explains _that chapter's_
> design. This page collects the timeline in one place, for anyone who wants it whole. Nothing here is
> needed to use the library.

## Timeline

| Year     | Event                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| 1986     | SGML becomes an ISO standard                                                            |
| **1987** | **TEI** — ACH convenes 30+ representatives at Vassar College, Poughkeepsie, in November |
| **1987** | **Perseus** — Gregory Crane begins the project at Harvard, to help students read Pindar |
| 1988     | TEI project starts in June on NEH funding, and adopts SGML                              |
| 1990     | TEI P1                                                                                  |
| 1992     | Perseus 1.0 ships on CD-ROM                                                             |
| 1993     | Perseus moves to Tufts with Crane                                                       |
| 1994     | TEI P3 — the mature SGML edition                                                        |
| 1995     | Perseus on the World Wide Web                                                           |
| 1997     | RFC 2141 defines URN syntax                                                             |
| 2002     | **TEI P4** — the Guidelines move to XML, keeping SGML backward compatibility            |
| **2007** | **TEI P5** (November) — XML only, backward compatibility dropped. Modern TEI            |
| 2000s    | **CTS** — Blackwell and Smith develop the CITE architecture for the Homer Multitext     |
| 2017     | RFC 8141 supersedes RFC 2141                                                            |
| 2010s–   | Open Greek and Latin begins First1KGreek                                                |
| now      | Perseus normalising to `citeStructure` on working branches (Chapter 10)                 |

## Three overlapping projects

The thing to notice is that these are **not a sequence**. They overlap, and each was well underway
before the next arrived.

**TEI** answers _how do you write a text down?_ Started 1987, still evolving. Its SGML origins are why
DTDs and named entities appear in these files at all — see [Chapter 09](09-when-entities-have-no-dtd.md).

**Perseus** answers _where do the texts come from?_ Started 1987 — the same year — and had been
encoding for two decades before CTS existed. That gap is why 223 documents declare their structure in
a pre-CTS mechanism this library cannot read; see [Chapter 08](08-when-a-document-disagrees-with-itself.md).

**CTS** answers _how do you name a text and address a passage?_ Developed in the 2000s, by which time
Perseus already held thousands of files encoded to older conventions. Retrofitting was partial, and
still is.

Laid out against each other:

```
1987 ──────────────────────────────────────────────────────────────► TEI
        SGML ──────────────► P4 (XML, 2002) ──► P5 (2007) ──────────►

1987 ──────────────────────────────────────────────────────────────► Perseus
        CD-ROM ──► web (1995) ──► GitHub ──► normalisation ────────►

                                    2000s ──────────────────────────► CTS
                                          CITE / Homer Multitext ───►
```

**A file encoded in 1994 and a file encoded in 2024 sit in the same directory today**, and both are
handed to the same parser. Almost every oddity in Part III follows from that one fact.

## Who the people are

**Gregory Crane** — founded Perseus in 1987 as a junior faculty member at Harvard; Editor-in-Chief
since. Also behind Open Greek and Latin, which produced First1KGreek. His line on the project's
purpose — _"access to the cultural heritage of humanity is a right, not a privilege"_ — is why this
data is on GitHub under CC BY-SA rather than behind a subscription.

**Christopher Blackwell** (Furman) and **Neel Smith** (College of the Holy Cross) — designed the CITE
architecture, of which CTS is the text-and-passage part.

**Casey Dué, Mary Ebbott and Gregory Nagy** — conceived the **Homer Multitext**, the project CTS was
built to serve. Its premise — publishing the _Iliad_ as many divergent witnesses rather than one
reconstructed text — is directly why a CTS URN separates the work from the version. See
[Chapter 03](03-how-to-read-a-cts-urn.md).

## Two naming curiosities

**CTS originally stood for _Classical_ Text Services**, renamed to _Canonical_ once it was clear the
design was not specific to classics. Older papers use the original, which occasionally confuses
searches.

**CITE** is an acronym — Collections, Indices, Texts, Extensions — and also, conveniently, the English
word.

## Sources

- [TEI history](https://tei-c.org/about/history/) and the [Poughkeepsie Principles](https://tei-c.org/Vault/ED/edp01.htm)
- [CTS URN specification](https://cite-architecture.github.io/ctsurn_spec/)
- [The CITE Architecture: Q&A](https://dlib.nyu.edu/awdl/isaw/isaw-papers/20-8/)
- [Perseus Digital Library](https://en.wikipedia.org/wiki/Perseus_Digital_Library)
- [RFC 8141](https://www.rfc-editor.org/rfc/rfc8141.html)

---

Back to the [index](README.md), or on to the [glossary](99-glossary.md).
