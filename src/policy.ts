import { type ElementAction, type ElementPolicy } from './types.js';

/**
 * What each TEI element contributes to a reading text.
 *
 * The organising principle is one question: would an educated reader see this
 * on the page of the printed edition? Apparatus, commentary and print furniture
 * go; the text and the editor's accepted restorations stay.
 *
 * Dropped elements do not insert whitespace, because in practice the source
 * already separates them — Herodotus writes `βάρβαρα <note>1</note> οἰκηιεῦνται`
 * with spaces either side, and inserting another would only produce a space
 * before the next comma. Callers who need the opposite have the `space` action.
 */
export const defaultElementPolicy: ElementPolicy = {
  // Structure. `block` forces a break either side, so paragraphs of a prose
  // section do not run together into one line.
  p: 'block',
  l: 'block',
  lg: 'block',
  ab: 'block',
  div: 'block',
  list: 'block',
  item: 'block',
  row: 'block',
  cell: 'keep',

  // Speech and quotation are the text, not markup about it. Plato's 278 `said`
  // and the Odyssey's 674 `q` are dialogue.
  q: 'keep',
  quote: 'keep',
  said: 'keep',
  cit: 'keep',
  sp: 'keep',

  // Segmentation and presentation carry no meaning a reader sees as separate.
  seg: 'keep',
  w: 'keep',
  pc: 'keep',
  phr: 'keep',
  hi: 'keep',
  emph: 'keep',
  foreign: 'keep',

  // Named things are ordinary words in running text.
  name: 'keep',
  persName: 'keep',
  placeName: 'keep',
  orgName: 'keep',
  rs: 'keep',
  date: 'keep',
  num: 'keep',
  title: 'keep',
  term: 'keep',
  gloss: 'keep',
  ref: 'keep',

  // The editor's accepted text. These are what gets printed.
  add: 'keep',
  supplied: 'keep',
  unclear: 'keep',
  lem: 'keep',
  corr: 'keep',
  reg: 'keep',
  expan: 'keep',
  ex: 'keep',

  // Superseded readings. Standalone they are all there is, so they are kept;
  // inside `<choice>` the preference list drops them in favour of the correction.
  sic: 'keep',
  orig: 'keep',
  abbr: 'keep',
  am: 'keep',

  // Apparatus and commentary: about the text, not the text.
  note: 'drop',
  del: 'drop',
  rdg: 'drop',
  bibl: 'drop',
  biblScope: 'drop',
  witness: 'drop',
  witDetail: 'drop',

  // Print and editorial furniture. Dropping `head` is what stops a prose unit's
  // text beginning with the chapter heading.
  head: 'drop',
  label: 'drop',
  trailer: 'drop',
  opener: 'drop',
  closer: 'drop',
  salute: 'drop',
  dateline: 'drop',
  argument: 'drop',
  figure: 'drop',
  figDesc: 'drop',
  graphic: 'drop',

  // Drama furniture. `speaker` is surfaced separately on the unit instead.
  speaker: 'drop',
  stage: 'drop',
  castList: 'drop',
  castItem: 'drop',
  role: 'drop',
  roleDesc: 'drop',

  // Position markers, empty of text.
  milestone: 'drop',
  lb: 'drop',
  pb: 'drop',
  cb: 'drop',
  anchor: 'drop',
  ptr: 'drop',

  // A lacuna is information. Closing it up silently misrepresents the edition.
  gap: { replace: '[…]' },
  space: { replace: ' ' },
};

/** Which child of `<choice>` wins, best first. */
export const defaultChoicePreference = ['corr', 'reg', 'expan', 'ex', 'sic', 'orig', 'abbr', 'am'];

/** Which child of `<app>` wins, best first. */
export const defaultAppPreference = ['lem', 'rdg'];

/**
 * Elements that select among their children rather than rendering all of them.
 *
 * No per-element action can express this: dropping `sic` unconditionally would
 * also delete a standalone `sic` that has no `corr` to replace it.
 */
export const SELECTING_ELEMENTS = new Set(['choice', 'app', 'subst']);

export const resolveAction = (policy: ElementPolicy, name: string, fallback: ElementAction): ElementAction =>
  policy[name] ?? fallback;
