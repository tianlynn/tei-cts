import { describe, expect, it } from 'vitest';
import { parseXPath } from './citation.js';
import { parseXml, TEI_NS } from './dom.js';
import { describeFailure, matchUnits } from './traverse.js';

const tree = (body: string) => parseXml(`<TEI xmlns="${TEI_NS}"><text><body>${body}</body></text></TEI>`);

const steps = (inner: string) => parseXPath(`#xpath(${inner})`);

const run = (body: string, inner: string) => matchUnits(tree(body), steps(inner));

describe('matchUnits', () => {
  it('returns matches in document order', () => {
    const result = run(
      '<div n="1"><l n="1">a</l><l n="2">b</l></div><div n="2"><l n="1">c</l></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']//tei:l[@n='$2']",
    );

    expect(result.matches.map((match) => match.values.slice(1).join('.'))).toEqual(['1.1', '1.2', '2.1']);
  });

  it('skips an element that cannot supply a captured value', () => {
    // This is what keeps unnumbered verse quoted inside prose from being cited.
    const result = run(
      '<div n="1"><l n="1">cited</l><l>quoted, uncited</l></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']//tei:l[@n='$2']",
    );

    expect(result.matches).toHaveLength(1);
  });

  it('honours a literal predicate', () => {
    const result = run(
      '<div type="translation" n="1"><l n="1">a</l></div><div type="edition" n="2"><l n="1">b</l></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@type='edition' and @n='$1']//tei:l[@n='$2']",
    );

    expect(result.matches.map((match) => match.values.slice(1).join('.'))).toEqual(['2.1']);
  });

  it('walks a descendant step through intervening elements', () => {
    const result = run(
      '<div n="1"><sp><speaker>X</speaker><l n="1">a</l></sp></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']//tei:l[@n='$2']",
    );

    expect(result.matches).toHaveLength(1);
  });

  it('retries from any depth when a pattern is anchored at the body', () => {
    // Sophocles writes /tei:body/... where Homer writes /tei:TEI/tei:text/...
    const result = run('<div><l n="1">a</l><l n="2">b</l></div>', "/tei:body/tei:div//tei:l[@n='$1']");

    expect(result.matches).toHaveLength(2);
  });

  it('emits a division that contains nothing at the next declared level', () => {
    // Without this the section's text belongs to no unit at all, which is how
    // real editions silently lost most of their content.
    const result = run(
      '<div n="1"><div n="1"><p>deep</p></div></div><div n="2"><p>no subsection here</p></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']/tei:div[@n='$2']",
    );

    expect(result.matches.map((match) => match.values.slice(1).join('.'))).toEqual(['1.1', '2']);
  });

  it('does not also emit a division that has matches below it', () => {
    // Emitting both parent and child would count the child's text twice.
    const result = run(
      '<div n="1"><div n="1"><p>a</p></div><div n="2"><p>b</p></div></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']/tei:div[@n='$2']",
    );

    expect(result.matches.map((match) => match.values.slice(1).join('.'))).toEqual(['1.1', '1.2']);
  });

  it('never falls back onto a step that captures nothing', () => {
    // /tei:TEI and /tei:text are structural. Emitting one of those as a unit
    // would be a worse failure than the one the fallback exists to fix.
    const result = run('<p>nothing numbered at all</p>', "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']");

    expect(result.matches).toHaveLength(0);
  });

  it('falls back at more than one depth in the same document', () => {
    const result = run(
      '<div n="1"><div n="1"><div n="1"><p>full depth</p></div></div><div n="2"><p>stops at two</p></div></div>' +
        '<div n="2"><p>stops at one</p></div>',
      "/tei:TEI/tei:text/tei:body/tei:div[@n='$1']/tei:div[@n='$2']/tei:div[@n='$3']",
    );

    expect(result.matches.map((match) => match.values.slice(1).join('.'))).toEqual(['1.1.1', '1.2', '2']);
  });

  it('reports how far a failing traversal got', () => {
    const result = run('<div n="1"><l n="1">a</l></div>', '/tei:TEI/tei:text/tei:body/tei:absent');

    expect(result.matches).toHaveLength(0);
    expect(result.reached).toEqual([1, 1, 1, 0]);
  });
});

describe('describeFailure', () => {
  it('names the step that matched nothing and what was there instead', () => {
    const root = tree('<div n="1"><l n="1">a</l></div>');
    const path = steps('/tei:TEI/tei:text/tei:body/tei:absent');
    const result = matchUnits(root, path);

    const message = describeFailure(root, path, result.reached, '#xpath(...)');

    expect(message).toMatch(/step 4 of 4 \(child <absent>\)/);
    expect(message).toMatch(/elements present in the document: body, div, l, text/);
  });

  it('shows a captured predicate in the step it names', () => {
    const root = tree('<p>no divisions here</p>');
    const path = steps("/tei:TEI/tei:text/tei:body/tei:div[@n='$1']");
    const result = matchUnits(root, path);

    expect(describeFailure(root, path, result.reached, null)).toMatch(/child <div>\[@n\]/);
  });
});
