# 09 — When entities have no DTD

> **Recap.** Chapter 08's failures were all about citation — schemes missing, contradictory, or too
> old. This chapter's failure class happens **before any of that**, at the XML layer, and it is the
> place where Chapter 02's history section pays off.

## One character, one dead file

A document contains this:

```xml
<l n="14">Ipse Iovem sequitur, cui Cæsar ær&aelig;us</l>
```

`&aelig;` is a named entity — the ligature **æ**. Feed that file to a plain XML parser and you do not
get a warning about one character. You get:

```
undefined entity "aelig"
```

and **the entire file is rejected**. Not the line. The file. Well-formedness in XML is
all-or-nothing, so one undeclared name three hundred lines in kills a document of fifteen thousand.

**27 of the 3,503 texts failed exactly this way**, before this was addressed.

## Why the name is undefined

XML predefines exactly **five** entities: `&amp;` `&lt;` `&gt;` `&quot;` `&apos;`. That is the whole
list. HTML's familiar hundreds — `&aelig;`, `&mdash;`, `&eacute;` — are defined by _HTML_, and XML
inherits none of them.

Any other name must be declared in the document's **DTD**, and TEI editions do declare them, like
this:

```xml
<!DOCTYPE TEI.2 SYSTEM "http://www.perseus.tufts.edu/DTD/1.0/PersProse.dtd">
```

The declarations are in that file, on a web server, at a URL the document chose.

**Now Chapter 02's history matters.** TEI was built on SGML in 1988, and DTDs with named entities are
SGML's document model working exactly as designed. A file that writes `&aelig;` and points at
`PersProse.dtd` is not malformed and not lazy — it is a correct SGML-era document, behaving the way
its format intended. XML kept the syntax and dropped the assumption that anyone would fetch the DTD.

So the file is right, the parser is right, and the document still will not open. That is the whole
problem.

## Why not just fetch the DTD?

The obvious fix is the wrong one.

Resolving that `<!DOCTYPE>` means **issuing an HTTP request to a URL chosen by the document you are
parsing.** For a library, that is disqualifying on several grounds at once: it turns a pure function
into a network call, makes parsing fail when a twenty-year-old server is down, makes it slow, makes it
non-deterministic, and hands the input control over what your process connects to.

It is also unnecessary, once you notice a fact about the actual data.

## The measured table

The corpus was scanned for every named entity appearing as **live character data** — excluding
comments and the internal DTD subset, which is what separates text from markup macros.

The answer: **48 names**, in the entire 898 MB.

```
The names this corpus actually uses, and nothing else.
```

Those 48 ship compiled into the package ([`src/entities.ts`](../src/entities.ts)) and are installed on
the parser before it reads anything. Still no network, no file access, no DTD.

The alternative — shipping the full HTML entity set — was measured and rejected: **43 KB to define
2,072 names no edition ever writes.** A table derived from the data beats a table derived from a
standard, when you have the data.

Two details of that table are worth more than they look:

**The values were verified against the DTDs, not assumed.** All 48 names were traced through the real
declaration chain — `PersProse.dtd` → `PersTeiCommon.dtd` → the OASIS `iso-*.ent` sets, 612
declarations in all. All 48 are declared there and all 48 values match.

**That check reversed a decision.** `&cdot;` had been given the value `·` (a middle dot), because
that is evidently what Pliny's astronomical tables intend. The DTD declares it as `ċ` — a c with a dot
above. The table now ships `ċ`, the declared value, and a caller who wants the other supplies
`entities: { cdot: '·' }`. **The declaration is the authority, even when it appears to be wrong**,
because the alternative is a library quietly disagreeing with the documents it reads.

## Names outside the table still fail

Deliberately. Meeting an unknown entity, the parser throws rather than emitting the literal text
`&aelig;` where a letter belongs — which would be a silent corruption of exactly the kind Chapter 07
argued against. A caller who meets one supplies it:

```js
parseTeiDocument(xml, { entities: { agr: 'α' } }); // an older convention for Greek letters
```

## The second kind of entity: macros

Everything so far assumed an entity stands for **characters**. Some do not.

Perseus keeps shared boilerplate in its DTD as entities whose replacement is **markup**:

```xml
&Perseus.publish;
```

That single name expands to a whole publication statement — elements, attributes, structure — shared
by every Tufts edition rather than repeated in each.

This cannot be handled like `&aelig;`, and the reason is worth stating precisely:

> An entity resolved to _text_ can never become an _element_.

If you substitute a string, you get a string. Getting elements requires substituting the markup **into
the document before it is parsed**. So that is what happens: the known macros are expanded into the
source text first, stepping over comments and CDATA sections so it cannot corrupt content that merely
looks like a reference.

**This is the one thing in the library that rewrites the document you gave it**, which is why it has
its own switch:

| Option                  | Default | What turning it off does                                           |
| ----------------------- | ------: | ------------------------------------------------------------------ |
| `corpusEntities: false` |  `true` | Drops the 48-name table. Configures the parser; document untouched |
| `corpusDtdMacro: false` |  `true` | Drops macro expansion. **The parser sees your exact bytes**        |
| `entities: {…}`         |    `{}` | Adds names, merged over the table, wins over it                    |

Two switches rather than one, because the two behaviours differ in kind — one configures a parser, the
other rewrites input. With both off, nothing is special-cased: five XML names and whatever you supply.

## What it actually bought

Here is the honest part, and it is not the result you would predict.

After shipping the entity table, the corpus was re-run to measure the gain. **No additional files
parsed.**

Not zero value — but not the value expected. What happened is that **26 of the 27 files are pre-CTS
`refState` documents** from Chapter 08's case 1. The entity error was simply the _first_ error they
hit. Fixing it let them fail on their real problem instead: they now report "declares no citation
scheme", which is the accurate diagnosis and which is why Chapter 08's count is 223 rather than 197.

The 27th turned out to be genuinely malformed XML, previously masked by the entity failure — a defect
that could not be seen until the error in front of it was cleared.

Two lessons, and the second is the one worth carrying:

1. **The gain is accurate errors here, and readable documents outside this corpus.** Nothing forced
   the change to look better than it was.
2. **Fixing one failure class does not necessarily reduce the failure count; it can just reclassify
   it.** If the corpus run had not been re-run and compared, the natural assumption would have been
   "27 files recovered". The measurement said otherwise. Chapter 11 is about why that measurement
   exists.

After the macro work, **no document in the three corpora fails at the XML layer any more.** The
undefined-entity class is empty.

## Check yourself

1. Why does one `&aelig;` reject a whole file rather than one line?
2. How many entities does XML predefine? Where do all the others come from?
3. Give two reasons a parsing library should not fetch the DTD the document names.
4. Why 48 names rather than the full HTML set?
5. `&cdot;` is shipped as `ċ` even though `·` is evidently intended. Why?
6. Why must `&Perseus.publish;` be handled by rewriting the document, when `&aelig;` need not be?
7. The entity table recovered zero additional parsing files. Was it worthless?

---

Next: [10 — When the corpus changes shape](10-when-the-corpus-changes-shape.md) — the ground moving
under all of this.
