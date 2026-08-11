# Test fixture attribution

These files are TEI editions from the [Perseus Digital Library](https://www.perseus.tufts.edu/) —
[`PerseusDL/canonical-greekLit`](https://github.com/PerseusDL/canonical-greekLit) and
[`PerseusDL/canonical-latinLit`](https://github.com/PerseusDL/canonical-latinLit) — and from
[`OpenGreekAndLatin/First1KGreek`](https://github.com/OpenGreekAndLatin/First1KGreek).

They are licensed **CC BY-SA 4.0** — <https://creativecommons.org/licenses/by-sa/4.0/> — and remain
under that licence here. **They are not part of the published npm package**: `fixtures/` is excluded
from the `files` allowlist in `package.json`, so the distributed tarball contains MIT-licensed code
only.

Each file is the opening of its work, trimmed to keep the test suite fast. **The `teiHeader` of every
file is complete and unmodified**, because the header is what the citation logic reads — truncating
it would mean testing a document that does not exist. The body was cut at an element boundary and
the remaining open elements closed; nothing within the retained text was altered.

## Corpus fixtures

| File                         | Work                          | Editor                | URN                                            |
| ---------------------------- | ----------------------------- | --------------------- | ---------------------------------------------- |
| `homer-odyssey.xml`          | Homer, _Odyssey_              | Augustus Taber Murray | `urn:cts:greekLit:tlg0012.tlg002.perseus-grc2` |
| `homer-iliad.xml`            | Homer, _Iliad_                | David B. Monro        | `urn:cts:greekLit:tlg0012.tlg001.perseus-grc2` |
| `vergil-aeneid.xml`          | Vergil, _Aeneid_              | J. B. Greenough       | `urn:cts:latinLit:phi0690.phi003.perseus-lat2` |
| `sophocles-oedipus.xml`      | Sophocles, _Oedipus Tyrannus_ | Francis Storr         | `urn:cts:greekLit:tlg0011.tlg004.perseus-grc2` |
| `plato-republic.xml`         | Plato, _Republic_             | John Burnet           | `urn:cts:greekLit:tlg0059.tlg030.perseus-grc2` |
| `herodotus-histories.xml`    | Herodotus, _Histories_        | A. D. Godley          | `urn:cts:greekLit:tlg0016.tlg001.perseus-grc2` |
| `caesar-bellum-gallicum.xml` | Caesar, _De Bello Gallico_    | T. Rice Holmes        | `urn:cts:latinLit:phi0448.phi001.perseus-lat2` |

Between them these cover every citation shape the parser handles: two-level verse (book + numbered
line), single-level drama (play-wide line numbers, no division), two-level prose (book + section) and
three-level prose (book + chapter + section), in both Greek and Latin.

## Edge-case fixtures

Derived from `homer-odyssey.xml` by the modification named, and used to test the fallback paths.

| File                             | Modification                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `edge-no-refs-decl.xml`          | `refsDecl` removed, so the scheme must be inferred from structure                                                 |
| `edge-unsupported-refs-decl.xml` | `replacementPattern` rewritten to use `position()` and `contains()`, which are outside the supported XPath subset |
| `edge-no-body.xml`               | everything from `<text>` onward removed, leaving a header with nothing citable                                    |

`edge-ragged-hierarchy.xml` is different in kind: a **complete, unmodified** work rather than a
derived edge case.

| File                        | Work                         | URN                                          |
| --------------------------- | ---------------------------- | -------------------------------------------- |
| `edge-ragged-hierarchy.xml` | Anonymi Logica et Quadrivium | `urn:cts:greekLit:tlg1799.tlg008.1st1K-grc1` |

It declares a `section/subsection` citation scheme but numbers subsections in only 2 of its 21
sections. It is kept as the regression guard for ragged hierarchies: before that case was handled,
this document yielded 2 units and lost nine tenths of its text.
