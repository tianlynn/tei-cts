# 01 — How to cite a text

> **Before you start.** No XML and no code in this chapter. It establishes the convention everything
> else implements, and the convention is about two thousand years older than computing.

## The convention

To point at a passage of a classical text, you name its position in the **structure of the work**:

> Iliad 1.1

Book 1, line 1. That is a **canonical citation**, and it has one property that makes everything else
possible: it resolves in _any_ copy of the work. My 1920 Oxford edition in Greek, your 2011 English
paperback, a tenth-century manuscript, a database — all of them agree on which line is Book 1, line 1,
because the numbering belongs to the work rather than to any printing of it.

Read a citation as a coordinate:

```
Iliad        1        .        1
─────       ───              ───
 work       book             line
```

## Why structure, and not position

The obvious alternative is to say "page 42", and it fails immediately: your page 42 is not my page 42,
and on a phone there are no pages at all. "Page 42" describes a physical artifact rather than the
text, so reflowing the text destroys the reference.

Programmers meet this trade-off constantly, and always resolve it the same way:

| Fragile reference      | Why it breaks                              | Durable alternative  |
| ---------------------- | ------------------------------------------ | -------------------- |
| Byte offset in a file  | Any edit before it shifts everything after | A key, a name, an ID |
| Line 340 of `main.c`   | Someone adds an import at the top          | A function name      |
| Array index            | Insert at the front, everything moves      | A stable identifier  |
| Page 42 of _the Iliad_ | A different printing, a different language | A canonical citation |

Classicists picked the durable option long before there was anything to compute with.

## Every work has its own levels

Here is the first real complication. `book.line` is not _the_ citation scheme — it is the _Iliad_'s
citation scheme. Works are numbered according to how they are shaped:

| Work                    | Citation | Levels                 |
| ----------------------- | -------- | ---------------------- |
| Homer, _Iliad_          | `1.1`    | book, line             |
| Herodotus, _Histories_  | `1.23.2` | book, chapter, section |
| Sophocles, _Oedipus_    | `1`      | line                   |
| A collection of letters | `4.2`    | epistle, section       |
| A fragmentary author    | `17`     | fragment               |

A prose history divides into books, chapters and sections. A tragedy is a single run of numbered
lines — no books at all. An author whose works are lost survives only as passages quoted by _other_
authors, collected and numbered, so "fragment 17" is the entire address.

Note the range: **one level to three, with different names each time.** Across the corpora this
library targets there are **118 distinct citation shapes** — and that number is itself a moving
target, because the corpora are edited upstream every week. (Chapter 13 is about pinning down which
version of the data a result was measured against.) So the levels cannot be hardcoded, and a type
like this is wrong before you finish writing it:

```ts
type Citation = { book: number; line: number }; // wrong for almost everything
```

The levels have to be _read from each document_. That single constraint shapes most of the design in
Part II.

## The numbers are labels, not positions

This deserves stating on its own, because it is the assumption most likely to be made silently and
most expensive to unmake.

A citation value identifies a division; it does not count it. Consequences:

- **Values can skip.** An edition may go from line 12 to line 15 because three lines are judged
  spurious. Nothing is missing and nothing is wrong.
- **Values need not be numbers.** `327a` is a real citation value. So is `17b`.
- **The nth division is not division n.** Position in the file tells you nothing about the citation.

So a citation value is a **string**, and a citation is a **list of strings**. Any arithmetic on them
is a bug waiting for the right document.

## Two conventions that look like mistakes

You will meet both in the data, and both are worth knowing before they surprise you.

**Plato is cited by the page numbers of a book printed in 1578.** A publisher named Henri Estienne —
in Latin, _Stephanus_ — printed a complete Plato in three volumes. His page numbers became the
standard reference, and remain it. A modern edition of the _Republic_ prints numbers like `327a` in
the margin, pointing at a page of a book from 1578 that almost no living reader has handled.

**Aristotle is the same**, using an 1831 edition by August Bekker. Hence "Bekker numbers".

This is exactly the "page 42" reference this chapter opened by rejecting — with one difference that
rescues it: _everyone agreed to freeze one particular printing forever_. Freezing a physical position
converts it into a stable name. It is inelegant, and it works, and it has worked for four centuries.

The lesson for the code is the one from the previous section, now with a reason: a level is a
**label**. In this corpus `jebb_page` is a real level name, appearing in 54 files.

## What a program has to do

To make a digital text citable, software must answer two questions:

1. **What are this work's levels?** Read, never assumed.
2. **What does a given citation point at?** — and, less obviously and far more usefully, **what is
   every citation this document contains?**

The second half of question 2 is what this library does, and it inverts how the problem is usually
posed. Chapter 06 is about that inversion.

The remaining pieces, in the order Part I supplies them:

| Piece                                                             | Chapter |
| ----------------------------------------------------------------- | ------- |
| A **TEI file** holds the text with its structure marked up        | 02      |
| A **CTS URN** gives the work and the edition a stable identity    | 03      |
| **Perseus** is where 3,503 such files actually live               | 04      |
| A **citation scheme**, declared inside the file, names the levels | 05      |

## Check yourself

1. Why does `Iliad 1.1` survive translation into another language when "page 42" does not?
2. Sophocles is cited with one number, Herodotus with three. What does that rule out about the shape
   of a `Citation` type?
3. Give two reasons a citation value must be stored as a string rather than a number.
4. `327a` points at a page of a specific 1578 printing. By this chapter's definition that is a
   physical position — so why is it a usable canonical citation anyway?
5. An edition's lines run 12, 15, 16. Has something been lost from the file?

---

Next: [02 — How to read TEI markup](02-how-to-read-tei-markup.md) — how the structure gets written
down.
