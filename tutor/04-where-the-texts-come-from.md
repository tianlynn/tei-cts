# 04 — Where the texts come from

> **Recap.** Chapters 01–03 gave you the model: citations are paths through a work's structure, TEI is
> how that structure is written down, and a CTS URN names the work and the version. Everything so far
> has been one file at a time. This chapter is the pile.

## Perseus

The **Perseus Digital Library** is a digital library of Greco-Roman classical material, hosted by the
Department of Classical Studies at Tufts University. Its stated mission is to make the full record of
humanity available to everyone, and its founder's line is worth quoting because it explains why the
data is free to clone: _"access to the cultural heritage of humanity is a right, not a privilege."_

For our purposes it is something more specific: **the largest openly-licensed body of CTS-conformant
TEI in existence**, and the reason this library has 3,503 real documents to be tested against rather
than the twelve fixtures in `fixtures/`.

## Three repositories

The texts live in three GitHub repositories, and the split is historical rather than logical:

| Repository                       |     Texts |       Size | What it is                                            |
| -------------------------------- | --------: | ---------: | ----------------------------------------------------- |
| `PerseusDL/canonical-greekLit`   |     1,612 |     300 MB | Greek literature, the core Perseus collection         |
| `PerseusDL/canonical-latinLit`   |       687 |     174 MB | Latin literature, likewise                            |
| `OpenGreekAndLatin/First1KGreek` |     1,204 |     424 MB | "The First Thousand Years of Greek" — a later project |
| **Total**                        | **3,503** | **898 MB** |                                                       |

`First1KGreek` is a separate effort under a different GitHub organisation, aiming at Greek works from
the first millennium CE that the core collection never covered. It is the largest of the three by
bytes despite being second by file count, because its texts run longer.

Note what this means practically: **there is no single "the corpus"**. There are three repositories
with different maintainers, different conventions, and — as Part III will show — different failure
rates. The harness in Part IV keeps the `repo` on every record for exactly this reason.

## The directory layout

The path mirrors the URN. Here is everything under Homer in `canonical-greekLit`:

```
greekLit/data/tlg0012/__cts__.xml
greekLit/data/tlg0012/tlg001/__cts__.xml
greekLit/data/tlg0012/tlg001/tlg0012.tlg001.perseus-grc2.xml
greekLit/data/tlg0012/tlg001/tlg0012.tlg001.perseus-eng3.xml
greekLit/data/tlg0012/tlg001/tlg0012.tlg001.perseus-eng4.xml
greekLit/data/tlg0012/tlg002/__cts__.xml
greekLit/data/tlg0012/tlg002/tlg0012.tlg002.perseus-grc2.xml
                    └───┬──┘ └──┬─┘ └────────────┬───────────┘
                    textgroup  work         version
```

Read it against Chapter 03's diagram and it is the same three components: a directory per textgroup,
a directory per work, a file per version. `tlg001` is the _Iliad_, `tlg002` the _Odyssey_.

So **you can find any text from its URN by string manipulation alone**, with no index and no
database. That is not an accident; it is what makes a corpus of this size usable from a shell script.

## `__cts__.xml`, and why the harness skips it

Those `__cts__.xml` files are **not texts**. They are CapiTainS metadata — catalogue entries
describing what exists, in the CTS schema rather than TEI. Here is the one for the _Iliad_, trimmed:

```xml
<ti:work groupUrn="urn:cts:greekLit:tlg0012" urn="urn:cts:greekLit:tlg0012.tlg001" xml:lang="grc">
   <ti:title xml:lang="eng">Iliad</ti:title>

   <ti:edition urn="urn:cts:greekLit:tlg0012.tlg001.perseus-grc2" xml:lang="grc">
      <ti:label xml:lang="grc">Ἰλιάς</ti:label>
      <ti:description>Homer. Homeri Opera, Volumes 1-2. Monro, D. B., editor…</ti:description>
   </ti:edition>

   <ti:translation urn="urn:cts:greekLit:tlg0012.tlg001.perseus-eng4" xml:lang="eng">
      <ti:description>…rendered into English prose… Butler, Samuel, 1835-1902, translator…</ti:description>
   </ti:translation>
</ti:work>
```

This is Chapter 03's work/version distinction stated by the corpus itself. The `<ti:work>` element
_is_ the abstract work; each `<ti:edition>` or `<ti:translation>` inside it is one version. Note that
the corpus distinguishes an **edition** (in the original language) from a **translation**, a
distinction the URN grammar alone does not make.

There are **2,728** of these files — _more metadata files than there are texts_. So any code that
walks the corpus has to exclude them or it will try to parse catalogue records as literature and
generate 2,728 confusing failures. That is what the `texts()` helper does, in one line:

```js
else if (entry.name.endsWith('.xml') && entry.name !== '__cts__.xml') found.push(full);
```

— [`tools/corpus/paths.mjs`](../tools/corpus/paths.mjs)

## Scale, honestly

Numbers worth internalising before Part IV, all measured rather than estimated:

- **3,503 texts, 898 MB** of XML across the three repositories.
- **The largest single file is 17.3 MB.** One document. Any approach that holds several parsed
  documents in memory at once needs to know that.
- Downloading all three as **tarballs** takes about 90 seconds; cloning them takes far longer,
  because you would be fetching decades of history to get one snapshot of `data/`.

That last point is why `fetch.mjs` downloads tarballs and keeps only `data/`, and it is the first
place the corpus's _size_ changes a design decision rather than merely being a statistic.

## Licensing

Most of this material is **CC BY-SA 4.0** — 2,524 of the 3,241 texts that parse and declare a URN say
so in the file itself. Another 715 declare no licence at all, which is a gap in the data rather than a
claim of copyright; the repositories are licensed at the top level.

Two consequences for anyone working with it:

- **Attribution is required**, and share-alike propagates. This repo's own excerpted fixtures carry
  [`fixtures/ATTRIBUTION.md`](../fixtures/ATTRIBUTION.md) for that reason, and the fixtures are
  deliberately not shipped in the published npm package.
- **The text being ancient does not make the edition free.** The _Iliad_ is three thousand years old;
  the 1920 Oxford text of it is an edited scholarly work with its own rights. Perseus's translations
  are a mix — `perseus-eng4` is Samuel Butler's of 1898, long in the public domain, while others are
  twentieth-century work included under specific arrangements.

## Where this came from

Perseus was founded by **Gregory Crane in 1987**, then a junior faculty member in Classics at
**Harvard** — not Tufts, which is where the project moved with him in **1993**. Its original purpose
was narrower than what it became: helping students read the Greek poetry of **Pindar**, by linking
texts to maps, images and lexical tools.

The delivery history is a tour of four decades of computing. Perseus 1.0 shipped on **CD-ROM** —
before that, videodisc — and the web version arrived in **1995**, which made it one of the pioneering
digital libraries.

This matters for a practical reason, and it is the fact Chapter 08 needs:

> **The files in these repositories were encoded across nearly forty years, by different people,
> under different standards, and they all sit in the same directory today.**

Some were keyed in when TEI meant SGML and CTS did not exist. Chapter 02 dated TEI P5 to 2007 and CTS
to the 2000s — Perseus had already been encoding texts for twenty years by then. Those older
documents were converted to XML but were never re-encoded to declare a CTS citation scheme, because
nothing required them to be.

So when Part III reports that **223 documents fail to parse because they declare no citation scheme**,
the right reading is not "223 broken files". It is "223 files older than the standard that would have
told them what to declare" — and they are concentrated in `latinLit`, the collection with the deepest
history.

## Check yourself

1. Given `urn:cts:greekLit:tlg0012.tlg002.perseus-grc2`, what is the file path? Why can you answer
   without an index?
2. What is in a `__cts__.xml`, and why must a corpus walker skip it?
3. `__cts__.xml` distinguishes an _edition_ from a _translation_. Does the URN grammar of Chapter 03
   make that distinction?
4. Why does the harness download tarballs rather than `git clone`?
5. The _Iliad_ was composed around 750 BCE. Why might a particular file of it still be under copyright?
6. Why is "223 files declare no citation scheme" a statement about history rather than about quality?

---

That is Part I. You now have the model — citations, TEI, URNs, and the corpus they live in.

Next: [05 — How a document declares its citation scheme](05-how-a-document-declares-its-scheme.md),
which opens Part II by asking how any one of those 3,503 files says how it wants to be cited.
