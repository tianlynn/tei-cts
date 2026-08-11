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
 * the whole HTML set cost 43 KB to define 2,072 names no edition writes.
 *
 * Every value has since been checked against the DTDs the documents themselves
 * point at — PersProse.dtd through PersTeiCommon.dtd to the OASIS iso-*.ent
 * files, 612 declarations in all. All 48 names are declared there and all 48
 * values match. This table is what the editions say they mean, not a guess.
 *
 * Names outside this table still fail loudly, which is the right default: the
 * alternative is emitting the literal text `&aelig;` where the letter belongs.
 * A caller who meets one supplies it through `entities`.
 *
 * To regenerate, with the corpora on disk:
 *
 *   1. Scan every .xml except __cts__.xml for /&([A-Za-z_][\w.:-]*);/, minus the
 *      five XML names, and drop matches inside comments and the internal DTD
 *      subset — that is what separates live text from the Perseus markup macros
 *      below.
 *   2. Read each value out of the DTD chain rooted at
 *      http://www.perseus.tufts.edu/DTD/1.0/PersProse.dtd, following the
 *      parameter entities that pull in the OASIS character sets.
 *
 * The five XML names are deliberately absent: they live on the prototype of the
 * parser's entity map, and an own property of the same name would shadow them.
 */

/**
 * Entity name, without `&` and `;`, to the text it stands for.
 *
 * One name is worth knowing about. `cdot` is `ċ` — that is what iso-lat2.ent
 * declares and what this table therefore says. But `phi0978.phi001.perseus-eng1`
 * writes `87&cdot;9705` in Pliny's astronomical tables, where the printed source
 * has a British decimal point, so that edition means `·` and its own DTD does
 * not agree. The declaration is the authority here, as it is for citations: the
 * text comes out as the edition declared it, and a caller who would rather read
 * the intent passes `entities: { cdot: '·' }`.
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
  cdot: 'ċ', // 20
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

/**
 * Entities whose replacement is markup rather than characters.
 *
 * Perseus's DTD carries boilerplate as entities — `&Perseus.publish;` is the
 * publication statement every Tufts edition shares, written once and referenced
 * from each file. They cannot go in the table above, because replacement text
 * there is inserted as text: `<publicationStmt>` would arrive as eighteen
 * literal characters rather than an element. So these are expanded into the
 * document before it is parsed, which is the one place markup can still become
 * markup.
 *
 * Values are the declarations themselves, read from PersTeiHead.dtd. Whitespace
 * is normalised; nothing else is touched.
 */
export const markupEntities: Readonly<Record<string, string>> = Object.freeze({
  'Perseus.publish':
    '<publicationStmt>' +
    '<publisher>Trustees of Tufts University</publisher>' +
    '<pubPlace>Medford, MA</pubPlace>' +
    '<authority>Perseus Project</authority>' +
    '</publicationStmt>',
  'Perseus.OCR': '<p>optical character recognition</p>',
});

/** The five names XML defines itself. Callers may not redefine them. */
export const xmlEntityNames: readonly string[] = ['amp', 'lt', 'gt', 'quot', 'apos'];
