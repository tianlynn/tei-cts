import { describe, expect, it } from 'vitest';
import { parseXPath } from './citation.js';

const xpath = (inner: string) => `#xpath(${inner})`;

describe('parseXPath', () => {
  it('reads the two-level pattern Homer and Vergil declare', () => {
    const steps = parseXPath(xpath("/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']//tei:l[@n='$2']"));

    expect(steps.map((step) => `${step.axis}:${step.name}`)).toEqual([
      'child:TEI',
      'child:text',
      'child:body',
      'child:div',
      'child:div',
      'descendant:l',
    ]);
    expect(steps[4]!.predicates).toEqual([{ attribute: 'n', kind: 'capture', group: 1 }]);
    expect(steps[5]!.predicates).toEqual([{ attribute: 'n', kind: 'capture', group: 2 }]);
  });

  it('reads the three-level pattern Caesar and Herodotus declare', () => {
    const steps = parseXPath(
      xpath("/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']/tei:div[@n='$2']/tei:div[@n='$3']"),
    );

    expect(steps).toHaveLength(7);
    expect(steps.at(-1)!.predicates).toEqual([{ attribute: 'n', kind: 'capture', group: 3 }]);
  });

  it('reads the single-level pattern Sophocles declares, anchored at the body', () => {
    const steps = parseXPath(xpath("/tei:body/tei:div//tei:l[@n='$1']"));

    expect(steps.map((step) => step.name)).toEqual(['body', 'div', 'l']);
    expect(steps[0]!.axis).toBe('child');
    expect(steps[2]!.axis).toBe('descendant');
  });

  it('reads a predicate that fixes a literal value', () => {
    const steps = parseXPath(xpath("/tei:div[@type='textpart']"));

    expect(steps[0]!.predicates).toEqual([{ attribute: 'type', kind: 'literal', value: 'textpart' }]);
  });

  it('reads two predicates joined by and, as First1KGreek writes them', () => {
    const steps = parseXPath(xpath("/tei:div[@type='textpart' and @subtype='book'][@n='$1']"));

    expect(steps[0]!.predicates).toEqual([
      { attribute: 'type', kind: 'literal', value: 'textpart' },
      { attribute: 'subtype', kind: 'literal', value: 'book' },
      { attribute: 'n', kind: 'capture', group: 1 },
    ]);
  });

  it('accepts an unprefixed pattern', () => {
    expect(parseXPath(xpath("/TEI/text/body/div[@n='$1']")).map((step) => step.name)).toEqual([
      'TEI',
      'text',
      'body',
      'div',
    ]);
  });

  it('accepts double quotes around a predicate value', () => {
    expect(parseXPath(xpath('/tei:div[@n="$1"]'))[0]!.predicates).toEqual([
      { attribute: 'n', kind: 'capture', group: 1 },
    ]);
  });

  it('reads a capture on an attribute other than n', () => {
    expect(parseXPath(xpath("/tei:div[@xml:id='$1']"))[0]!.predicates).toEqual([
      { attribute: 'xml:id', kind: 'capture', group: 1 },
    ]);
  });

  it('rejects a pattern that is not an xpath expression', () => {
    expect(() => parseXPath('/tei:body/tei:div')).toThrow(/not an #xpath/);
  });

  it('rejects an xpath function, naming what it could not read', () => {
    expect(() => parseXPath(xpath('/tei:div[position()=1]'))).toThrow(/does not support.*position/s);
  });

  it('rejects an axis it cannot walk', () => {
    expect(() => parseXPath(xpath('/tei:div/preceding-sibling::tei:l'))).toThrow(/does not support/);
  });

  it('rejects an unclosed predicate', () => {
    expect(() => parseXPath(xpath("/tei:div[@n='$1'"))).toThrow(/unclosed predicate/);
  });

  it('rejects a step that does not begin with a slash', () => {
    expect(() => parseXPath(xpath('tei:div'))).toThrow(/must begin with "\/"/);
  });

  it('rejects an empty expression', () => {
    expect(() => parseXPath(xpath(''))).toThrow(/selects nothing/);
  });

  it('rejects a step whose name is not a name', () => {
    expect(() => parseXPath(xpath('/tei:div/9lives'))).toThrow(/expects an element name/);
  });
});
