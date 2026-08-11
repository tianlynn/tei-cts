/**
 * The named entities this corpus actually uses, and nothing else.
 *
 * XML predefines five names — amp, lt, gt, quot, apos. Everything beyond them
 * must be declared, and TEI editions declare them by pointing a <!DOCTYPE> at a
 * DTD on a web server. Resolving that would mean fetching a URL chosen by the
 * document, so the names are compiled in here instead. Hardcoded rather than
 * read from JSON: one property lookup per entity, and the package still does no
 * I/O.
 *
 * This is a **measured** table, not the 2,120-name HTML set. Every name below
 * appears as live character data somewhere in canonical-greekLit,
 * canonical-latinLit or First1KGreek; the trailing number is how often. Shipping
 * the whole HTML set cost 43 KB to define 2,072 names no edition writes — and
 * got one of the 48 wrong (see cdot).
 *
 * Names outside this table still fail loudly, which is the right default: the
 * alternative is emitting the literal text `&aelig;` where the letter belongs.
 * A caller who meets one supplies it through `entities`.
 *
 * To regenerate, with the corpora on disk:
 *
 *   1. Scan every .xml except __cts__.xml for /&([A-Za-z_][\w.:-]*);/, minus the
 *      five XML names, and drop matches inside comments and the internal DTD
 *      subset — that is what separates live text from the three Perseus markup
 *      macros (&Perseus.OCR;, &Perseus.publish;, &prose.eng.encode;), which are
 *      elements rather than characters and cannot live in a table like this.
 *   2. Take each value from https://github.com/wooorm/character-entities (MIT),
 *      then re-read the overrides below.
 *
 * The five XML names are deliberately absent: they live on the prototype of the
 * parser's entity map, and an own property of the same name would shadow them.
 */

/**
 * Entity name, without `&` and `;`, to the text it stands for.
 *
 * `cdot` departs from HTML, which reads it as `ċ` (U+010B). In this corpus it
 * is the decimal point of a British printed table — `87&cdot;9705` — so it is
 * U+00B7 MIDDLE DOT. Twenty occurrences, all in one astronomical translation.
 */
export const corpusEntities: Readonly<Record<string, string>> = Object.freeze({
  aelig: 'æ', // 7,676
  mdash: '—', // 5,674
  eacute: 'é', // 1,710
  AElig: 'Æ', // 1,071
  oelig: 'œ', // 808
  euml: 'ë', // 190
  uuml: 'ü', // 109
  OElig: 'Œ', // 102
  iuml: 'ï', // 102
  dagger: '†', // 101
  ndash: '–', // 94
  acirc: 'â', // 88
  sect: '§', // 73
  aacute: 'á', // 65
  oacute: 'ó', // 49
  ouml: 'ö', // 47
  deg: '°', // 45
  iacute: 'í', // 43
  egrave: 'è', // 38
  uacute: 'ú', // 36
  prime: '′', // 30
  lsquo: '‘', // 28
  pound: '£', // 24
  rsquo: '’', // 24
  auml: 'ä', // 21
  cdot: '·', // 20
  ocirc: 'ô', // 17
  ccedil: 'ç', // 15
  icirc: 'î', // 13
  rdquo: '”', // 12
  agrave: 'à', // 9
  ecirc: 'ê', // 9
  Iuml: 'Ï', // 9
  ldquo: '“', // 8
  ucirc: 'û', // 7
  yuml: 'ÿ', // 7
  Iacute: 'Í', // 3
  ugrave: 'ù', // 3
  Ouml: 'Ö', // 3
  Uuml: 'Ü', // 2
  racute: 'ŕ', // 1
  yacute: 'ý', // 1
  igrave: 'ì', // 1
  ntilde: 'ñ', // 1
  ograve: 'ò', // 1
  emacr: 'ē', // 1
  Euml: 'Ë', // 1
  Aacute: 'Á', // 1
});

/** The five names XML defines itself. Callers may not redefine them. */
export const xmlEntityNames: readonly string[] = ['amp', 'lt', 'gt', 'quot', 'apos'];
