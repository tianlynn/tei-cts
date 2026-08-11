import { describe, expect, it } from 'vitest';
import { findElement, parseXml, TEI_NS } from './dom.js';
import { flattenSettings, flattenText } from './text.js';
import { type ParseOptions } from './types.js';

/** Flatten the first `<body>` child of a tiny document. */
const flatten = (body: string, options: ParseOptions = {}): string => {
  const root = parseXml(`<TEI xmlns="${TEI_NS}"><text><body>${body}</body></text></TEI>`);
  return flattenText(findElement(root, 'body')!, flattenSettings(options));
};

describe('flattenText', () => {
  it('keeps text interleaved with inline elements in order', () => {
    expect(flatten('<p>est <add>oppidum</add> citerioris</p>')).toBe('est oppidum citerioris');
  });

  it('collapses the indentation TEI is pretty-printed with', () => {
    expect(flatten('<p>\n      ἄνδρα   μοι\n      ἔννεπε\n    </p>')).toBe('ἄνδρα μοι ἔννεπε');
  });

  it('separates block elements instead of running them together', () => {
    expect(flatten('<div><l>ἄνδρα μοι</l><l>πλάγχθη</l></div>')).toBe('ἄνδρα μοι\nπλάγχθη');
  });

  it('drops apparatus without leaving a gap in the words around it', () => {
    // Herodotus writes a note between spaces, so dropping it must not add another.
    expect(flatten('<p>βάρβαρα <note resp="ed">1</note> οἰκηιεῦνται</p>')).toBe('βάρβαρα οἰκηιεῦνται');
  });

  it('drops an empty position marker without fusing the words around it', () => {
    expect(flatten('<l>ἔννεπε<milestone unit="para"/>, μοῦσα</l>')).toBe('ἔννεπε, μοῦσα');
  });

  it('prefers the correction inside a choice', () => {
    expect(flatten('<p>τῶν <choice><sic>αἱ</sic><corr>οἱ</corr></choice> Ἀγυλλαῖοι</p>')).toBe(
      'τῶν οἱ Ἀγυλλαῖοι',
    );
  });

  it('keeps a standalone sic, which has no correction to stand in for it', () => {
    expect(flatten('<p>ut <sic>coicerent</sic> tela</p>')).toBe('ut coicerent tela');
  });

  it('prefers the lemma inside an apparatus entry', () => {
    expect(flatten('<p>arma <app><lem>virumque</lem><rdg>virum</rdg></app> cano</p>')).toBe(
      'arma virumque cano',
    );
  });

  it('renders every child when nothing matches the preference order', () => {
    expect(flatten('<p>a <choice><unlisted>x</unlisted></choice> b</p>')).toBe('a x b');
  });

  it('marks a lacuna rather than closing it up silently', () => {
    expect(flatten('<p>Contendit <gap reason="lost"/></p>')).toBe('Contendit […]');
  });

  it('leaves an athetized line empty, because that is what the edition says', () => {
    expect(flatten('<l><del>Iura magistratusque legunt</del></l>')).toBe('');
  });

  it('keeps text from an element the policy does not name', () => {
    expect(flatten('<p>a <undreamt>b</undreamt> c</p>')).toBe('a b c');
  });

  it('normalizes to NFC by default', () => {
    // ά as alpha + combining acute, which NFC composes into one code point.
    const decomposed = flatten('<p>ά</p>');
    expect(decomposed).toBe('ά');
    expect(flatten('<p>ά</p>', { normalize: 'none' })).toBe('ά');
  });

  it('honours a caller override of a default action', () => {
    expect(flatten('<l><del>Iura</del></l>', { elements: { del: 'keep' } })).toBe('Iura');
    expect(flatten('<p>a<note>x</note>b</p>', { elements: { note: 'keep' } })).toBe('axb');
  });

  it('honours a caller override of the choice preference', () => {
    const diplomatic = { choicePreference: ['sic', 'orig', 'abbr'] };
    expect(flatten('<p><choice><sic>αἱ</sic><corr>οἱ</corr></choice></p>', diplomatic)).toBe('αἱ');
  });

  it('can drop an element but leave a space where it stood', () => {
    // The `space` action exists for sources that do not separate their own
    // markup, where dropping outright would fuse the words either side.
    expect(flatten('<p>alpha<note>x</note>beta</p>', { elements: { note: 'space' } })).toBe('alpha beta');
  });

  it('honours a caller override of the block separator', () => {
    expect(flatten('<div><l>a</l><l>b</l></div>', { blockSeparator: ' / ' })).toBe('a / b');
  });
});
