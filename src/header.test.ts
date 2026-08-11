import { describe, expect, it } from 'vitest';
import { parseXml, TEI_NS } from './dom.js';
import { findEditionDiv, readMetadata } from './header.js';

const metadata = (inner: string) => readMetadata(parseXml(`<TEI xmlns="${TEI_NS}">${inner}</TEI>`));

const header = (titleStmt: string, publication = '') =>
  `<teiHeader><fileDesc><titleStmt>${titleStmt}</titleStmt>${publication}</fileDesc></teiHeader>`;

describe('readMetadata', () => {
  it('reads the title, author and editor', () => {
    const meta = metadata(
      header('<title>Odyssey</title><author>Homer</author><editor>A. T. Murray</editor>'),
    );

    expect(meta.title).toBe('Odyssey');
    expect(meta.author).toBe('Homer');
    expect(meta.editor).toBe('A. T. Murray');
  });

  it('flattens markup inside a title', () => {
    expect(metadata(header('<title>The <hi>Odyssey</hi> of Homer</title>')).title).toBe(
      'The Odyssey of Homer',
    );
  });

  it('falls back to a placeholder title rather than throwing', () => {
    // A header this sparse is malformed, but the body may still be citable.
    expect(metadata('<text><body><div n="1"/></body></text>').title).toBe('untitled');
  });

  it('leaves author and editor null when the header omits them', () => {
    const meta = metadata(header('<title>Anonymous</title>'));

    expect(meta.author).toBeNull();
    expect(meta.editor).toBeNull();
  });

  it('prefers the licence target over its prose', () => {
    const meta = metadata(
      header(
        '<title>W</title>',
        '<publicationStmt><availability><licence target="https://example.org/by-sa">Available under CC BY-SA</licence></availability></publicationStmt>',
      ),
    );

    expect(meta.license).toBe('https://example.org/by-sa');
  });

  it('falls back to the licence prose when there is no target', () => {
    const meta = metadata(
      header(
        '<title>W</title>',
        '<publicationStmt><availability><licence>Public domain</licence></availability></publicationStmt>',
      ),
    );

    expect(meta.license).toBe('Public domain');
  });

  it('derives the edition from the URN', () => {
    const meta = metadata(
      '<text><body><div type="edition" n="urn:cts:greekLit:tlg0012.tlg002.perseus-grc2" xml:lang="grc"/></body></text>',
    );

    expect(meta.urn).toBe('urn:cts:greekLit:tlg0012.tlg002.perseus-grc2');
    expect(meta.edition).toBe('perseus-grc2');
    expect(meta.language).toBe('grc');
  });

  it('ignores an @n that is not a CTS URN', () => {
    const meta = metadata('<text><body><div type="edition" n="1"/></body></text>');

    expect(meta.urn).toBeNull();
    expect(meta.edition).toBeNull();
  });
});

describe('findEditionDiv', () => {
  it('prefers the division marked as the edition', () => {
    const root = parseXml(
      `<TEI xmlns="${TEI_NS}"><text><body><div type="translation" n="x"/><div type="edition" n="urn:cts:greekLit:a.b.c"/></body></text></TEI>`,
    );

    expect(findEditionDiv(root)?.attributes['type']).toBe('edition');
  });

  it('falls back to the first division when none is marked', () => {
    const root = parseXml(`<TEI xmlns="${TEI_NS}"><text><body><div n="1"/></body></text></TEI>`);

    expect(findEditionDiv(root)?.attributes['n']).toBe('1');
  });

  it('falls back to the body when it holds no divisions at all', () => {
    const root = parseXml(`<TEI xmlns="${TEI_NS}"><text><body><p>text</p></body></text></TEI>`);

    expect(findEditionDiv(root)?.name).toBe('body');
  });

  it('returns null when there is no body', () => {
    expect(findEditionDiv(parseXml(`<TEI xmlns="${TEI_NS}"><teiHeader/></TEI>`))).toBeNull();
  });
});
