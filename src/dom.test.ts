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

  it('reads cdot as the decimal point the corpus uses it for, not HTML’s ċ', () => {
    // 87·9705 in an astronomical table. HTML says U+010B; the edition means U+00B7.
    const root = parseXml(wrap('<l>87&cdot;9705</l>'));

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: '87·9705' }]);
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

  it('does not rescan replacement text for markup or further entities', () => {
    const root = parseXml(wrap('<l>&raw;</l>'), { entities: { raw: '<b>&amp;</b>' } });

    expect(findElement(root, 'l')!.children).toEqual([{ type: 'text', value: '<b>&amp;</b>' }]);
  });
});
