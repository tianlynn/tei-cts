import { describe, expect, it } from 'vitest';
import { descendants, elementChildren, findElement, parseXml, TEI_NS } from './dom.js';

const wrap = (body: string) => `<TEI xmlns="${TEI_NS}"><text><body>${body}</body></text></TEI>`;

describe('parseXml', () => {
  it('keeps text and elements interleaved in source order', () => {
    const root = parseXml(wrap('<l>ἄνδρα <add>μοι</add> ἔννεπε</l>'));
    const line = findElement(root, 'l')!;

    expect(line.children.map((child) => (child.type === 'text' ? child.value : child.name))).toEqual([
      'ἄνδρα ',
      'add',
      ' ἔννεπε',
    ]);
  });

  it('strips the namespace prefix from element names', () => {
    const root = parseXml(`<tei:TEI xmlns:tei="${TEI_NS}"><tei:text/></tei:TEI>`);

    expect(root.name).toBe('TEI');
    expect(root.uri).toBe(TEI_NS);
    expect(elementChildren(root)[0]?.name).toBe('text');
  });

  it('exposes a prefixed attribute under both its local and prefixed name', () => {
    const root = parseXml(`<TEI xmlns="${TEI_NS}" xml:lang="grc" n="1"/>`);

    expect(root.attributes['xml:lang']).toBe('grc');
    expect(root.attributes['lang']).toBe('grc');
    expect(root.attributes['n']).toBe('1');
  });

  it('discards comments and processing instructions', () => {
    const root = parseXml(wrap('<!-- a note --><l>text</l><?target body?>'));
    const body = findElement(root, 'body')!;

    expect(elementChildren(body).map((element) => element.name)).toEqual(['l']);
  });

  it('reads CDATA as text', () => {
    const root = parseXml(wrap('<l><![CDATA[raw < text]]></l>'));

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: 'raw < text' }]);
  });

  it('walks descendants in document order', () => {
    const root = parseXml(wrap('<div><l>a</l><lg><l>b</l></lg></div>'));
    const div = findElement(root, 'div')!;

    expect(descendants(div).map((element) => element.name)).toEqual(['l', 'lg', 'l']);
  });

  it('links each element to its parent', () => {
    const root = parseXml(wrap('<div><l>a</l></div>'));
    const line = findElement(root, 'l')!;

    expect(line.parent?.name).toBe('div');
    expect(line.parent?.parent?.name).toBe('body');
    expect(root.parent).toBeNull();
  });

  it('reports the position of a well-formedness error', () => {
    expect(() => parseXml(wrap('<l>unclosed'))).toThrow(/not well-formed XML/);
  });

  it('rejects a document with no elements at all', () => {
    expect(() => parseXml('   ')).toThrow(/must contain a root element/);
  });
});

describe('entities', () => {
  it('resolves the corpus names XML does not predefine, in text and in attributes', () => {
    const root = parseXml(wrap('<l n="&mdash;">C&aelig;sar &eacute; &dagger;</l>'));
    const line = findElement(root, 'l')!;

    expect(line.children).toEqual([{ type: 'text', value: 'Cæsar é †' }]);
    expect(line.attributes['n']).toBe('—');
  });

  it('still resolves the five XML entities', () => {
    const root = parseXml(wrap('<l>a &amp; b &lt; c</l>'));

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: 'a & b < c' }]);
  });

  it('reads cdot as its DTD declares it, even where the edition meant otherwise', () => {
    // iso-lat2.ent says ċ. Pliny writes 87&cdot;9705 for a decimal point and so
    // means ·, but the declaration is the authority; overriding it is one option.
    const root = parseXml(wrap('<l>87&cdot;9705</l>'));
    const intended = parseXml(wrap('<l>87&cdot;9705</l>'), { entities: { cdot: '·' } });

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: '87ċ9705' }]);
    expect(findElement(intended, 'l')!.children).toEqual([{ type: 'text', value: '87·9705' }]);
  });

  it('rejects a name no table defines, rather than passing it through', () => {
    expect(() => parseXml(wrap('<l>&nosuchentity;</l>'))).toThrow(/undefined entity/);
  });

  it('parses strictly when the table is turned off', () => {
    expect(() => parseXml(wrap('<l>C&aelig;sar</l>'), { corpusEntities: false })).toThrow(/undefined entity/);
    expect(() => parseXml(wrap('<l>a &amp; b</l>'), { corpusEntities: false })).not.toThrow();
  });

  it('takes extra definitions, which win over the table', () => {
    const root = parseXml(wrap('<l>&agr; &mdash;</l>'), { entities: { agr: 'α', mdash: '--' } });

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: 'α --' }]);
  });

  it('supplies definitions even with the table off', () => {
    const root = parseXml(wrap('<l>&agr;</l>'), { corpusEntities: false, entities: { agr: 'α' } });

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: 'α' }]);
  });

  it('refuses to let a caller redefine an XML entity', () => {
    expect(() => parseXml(wrap('<l>&amp;</l>'), { entities: { amp: '!' } })).toThrow(
      /&amp; is defined by XML itself/,
    );
  });

  it('expands a markup macro into the element its DTD declares', () => {
    const root = parseXml(
      `<TEI xmlns="${TEI_NS}"><teiHeader>&Perseus.publish;</teiHeader><text><body/></text></TEI>`,
    );
    const statement = findElement(root, 'publicationStmt')!;

    expect(elementChildren(statement).map((child) => child.name)).toEqual([
      'publisher',
      'pubPlace',
      'authority',
    ]);
    expect(findElement(statement, 'authority')!.children).toEqual([
      { type: 'text', value: 'Perseus Project' },
    ]);
  });

  it('leaves a markup macro alone inside a comment', () => {
    // 27 corpus files mention &Perseus.OCR; in a comment and nowhere else.
    const root = parseXml(wrap('<!-- &Perseus.OCR; --><l>text</l>'));
    const body = findElement(root, 'body')!;

    expect(elementChildren(body).map((element) => element.name)).toEqual(['l']);
  });

  it('does not expand markup macros with the table turned off', () => {
    const xml = `<TEI xmlns="${TEI_NS}"><teiHeader>&Perseus.publish;</teiHeader></TEI>`;

    expect(() => parseXml(xml, { corpusEntities: false })).toThrow(/undefined entity/);
  });

  it('does not rescan replacement text for markup or further entities', () => {
    const root = parseXml(wrap('<l>&raw;</l>'), { entities: { raw: '<b>&amp;</b>' } });

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: '<b>&amp;</b>' }]);
  });
});
