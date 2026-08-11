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
