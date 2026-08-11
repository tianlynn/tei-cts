import { describe, expect, it } from 'vitest';
import { TEI_NS } from './dom.js';
import { readFixture } from './fixtures.js';
import { parseTeiDocument } from './parse.js';

/** A minimal CTS-shaped document, for cases no real fixture exhibits. */
const document = ({
  refsDecl = '',
  body = '',
}: {
  refsDecl?: string;
  body?: string;
}): string => `<TEI xmlns="${TEI_NS}">
  <teiHeader><fileDesc><titleStmt><title>A Work</title><author>Nobody</author></titleStmt></fileDesc>
  <encodingDesc>${refsDecl}</encodingDesc></teiHeader>
  <text><body><div type="edition" n="urn:cts:greekLit:tlg0000.tlg000.test" xml:lang="grc">${body}</div></body></text>
</TEI>`;

const citations = (xml: string): string[] => parseTeiDocument(xml).units.map((unit) => unit.citation);

describe('parseTeiDocument', () => {
  it('infers a scheme when the document declares none', () => {
    const doc = parseTeiDocument(readFixture('edge-no-refs-decl.xml'));

    expect(doc.citation.source).toBe('inferred');
    expect(doc.citation.pattern).toBeNull();
    expect(doc.citation.levels.map((level) => level.label)).toEqual(['book', 'line']);
  });

  it('infers the same citations the document would have declared', () => {
    // The fallback is a second implementation of the same answer, so agreeing
    // with the declared path is the strongest check either one can get.
    expect(citations(readFixture('edge-no-refs-decl.xml'))).toEqual(
      citations(readFixture('homer-odyssey.xml')),
    );
  });

  it('falls back to inference when the declared scheme uses xpath it cannot read', () => {
    const doc = parseTeiDocument(readFixture('edge-unsupported-refs-decl.xml'));

    expect(doc.citation.source).toBe('inferred');
    expect(doc.units.map((unit) => unit.citation)).toEqual(citations(readFixture('homer-odyssey.xml')));
  });

  it('reads a scheme anchored at the body rather than the document root', () => {
    // Sophocles writes /tei:body/... where Homer writes /tei:TEI/tei:text/...
    const doc = parseTeiDocument(readFixture('sophocles-oedipus.xml'));

    expect(doc.citation.source).toBe('refsDecl');
    expect(doc.units[0]!.citation).toBe('1');
  });

  it('does not cite unnumbered verse quoted inside prose', () => {
    // Herodotus embeds <l> with no @n. A capture only matches an element that
    // can supply its value, so those lines are not units.
    const doc = parseTeiDocument(readFixture('herodotus-histories.xml'));

    expect(doc.units.every((unit) => unit.element === 'div')).toBe(true);
  });

  it('surfaces the speaker of a dramatic line without putting it in the text', () => {
    const doc = parseTeiDocument(readFixture('sophocles-oedipus.xml'));

    expect(doc.units[0]!.speaker).toBe('Οἰδίπους');
    expect(doc.units[0]!.text).not.toMatch(/Οἰδίπους/u);
  });

  it('leaves speaker null for a text that has none', () => {
    expect(parseTeiDocument(readFixture('homer-odyssey.xml')).units[0]!.speaker).toBeNull();
  });

  it('honours a caller override of the citation separator', () => {
    const doc = parseTeiDocument(readFixture('homer-odyssey.xml'), { citationSeparator: ':' });

    expect(doc.units[0]!.citation).toBe('1:1');
    expect(doc.units[0]!.path).toEqual(['1', '1']);
  });

  it('reads a refsDecl that is not labelled as the CTS one', () => {
    const xml = document({
      refsDecl: `<refsDecl><cRefPattern n="line" matchPattern="(\\w+)"
        replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div//tei:l[@n='$1'])"/></refsDecl>`,
      body: '<l n="1">alpha</l><l n="2">beta</l>',
    });
    const doc = parseTeiDocument(xml);

    expect(doc.citation.source).toBe('refsDecl');
    expect(doc.units.map((unit) => unit.citation)).toEqual(['1', '2']);
  });

  it('rejects a document with no body', () => {
    expect(() => parseTeiDocument(readFixture('edge-no-body.xml'))).toThrow(/no <body>/);
  });

  it('rejects XML that is not well-formed', () => {
    expect(() => parseTeiDocument('<TEI><text><body></TEI>')).toThrow(/not well-formed XML/);
  });

  it('rejects a body with nothing citable in it', () => {
    const xml = document({ body: '<p>text with no numbered division anywhere</p>' });

    expect(() => parseTeiDocument(xml)).toThrow(/no numbered divisions or lines/);
  });

  it('explains which step of a declared scheme found nothing', () => {
    const xml = document({
      refsDecl: `<refsDecl n="CTS"><cRefPattern n="line" matchPattern="(\\w+)"
        replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:absent[@n='$1'])"/></refsDecl>`,
      body: '<p>nothing numbered here either</p>',
    });

    expect(() => parseTeiDocument(xml)).toThrow(/step 4 of 4 \(child <absent>\[@n\]\)/);
  });

  it('rejects a scheme that cites two units the same way', () => {
    const xml = document({
      refsDecl: `<refsDecl n="CTS"><cRefPattern n="line" matchPattern="(\\w+)"
        replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div//tei:l[@n='$1'])"/></refsDecl>`,
      body: '<div n="1" type="textpart"><l n="1">alpha</l></div><div n="2" type="textpart"><l n="1">beta</l></div>',
    });

    expect(() => parseTeiDocument(xml)).toThrow(/same citation twice \("1"\)/);
  });
});

describe('ragged hierarchies', () => {
  const twoLevel = (body: string) =>
    document({
      refsDecl: `<refsDecl n="CTS">
        <cRefPattern n="subsection" matchPattern="(\\w+).(\\w+)"
          replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']/tei:div[@n='$2'])"/>
        <cRefPattern n="section" matchPattern="(\\w+)"
          replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1'])"/>
      </refsDecl>`,
      body,
    });

  it('cites a division that has no deeper level at the level it does have', () => {
    const doc = parseTeiDocument(
      twoLevel('<div n="1"><div n="1"><p>deep</p></div></div><div n="2"><p>shallow</p></div>'),
    );

    expect(doc.units.map((unit) => unit.citation)).toEqual(['1.1', '2']);
    expect(doc.units.map((unit) => unit.path)).toEqual([['1', '1'], ['2']]);
  });

  it('keeps the text that the deepest-level-only traversal used to drop', () => {
    const doc = parseTeiDocument(
      twoLevel('<div n="1"><div n="1"><p>deep</p></div></div><div n="2"><p>shallow</p></div>'),
    );

    expect(doc.units.map((unit) => unit.text)).toEqual(['deep', 'shallow']);
  });

  it('lets path length name the level a unit sits at', () => {
    const doc = parseTeiDocument(
      twoLevel('<div n="1"><div n="1"><p>deep</p></div></div><div n="2"><p>shallow</p></div>'),
    );
    const levelOf = (unit: (typeof doc.units)[number]) => doc.citation.levels[unit.path.length - 1]?.label;

    expect(doc.units.map(levelOf)).toEqual(['subsection', 'section']);
  });

  it('gives a shallower unit the kind of the element it resolved to', () => {
    const doc = parseTeiDocument(twoLevel('<div n="1"><p>shallow</p></div>'));

    expect(doc.units[0]!.kind).toBe('paragraph');
    expect(doc.units[0]!.element).toBe('div');
  });

  it('introduces no duplicate citations', () => {
    const doc = parseTeiDocument(
      twoLevel(
        '<div n="1"><div n="1"><p>a</p></div><div n="2"><p>b</p></div></div>' +
          '<div n="2"><p>c</p></div><div n="3"><p>d</p></div>',
      ),
    );
    const citations = doc.units.map((unit) => unit.citation);

    expect(citations).toEqual(['1.1', '1.2', '2', '3']);
    expect(new Set(citations).size).toBe(citations.length);
  });

  it('falls back at several depths at once', () => {
    const doc = parseTeiDocument(
      document({
        refsDecl: `<refsDecl n="CTS">
          <cRefPattern n="section" matchPattern="(\\w+).(\\w+).(\\w+)"
            replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']/tei:div[@n='$2']/tei:div[@n='$3'])"/>
          <cRefPattern n="chapter" matchPattern="(\\w+).(\\w+)"
            replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1']/tei:div[@n='$2'])"/>
          <cRefPattern n="book" matchPattern="(\\w+)"
            replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:div/tei:div[@n='$1'])"/>
        </refsDecl>`,
        body:
          '<div n="1"><div n="1"><div n="1"><p>full</p></div></div><div n="2"><p>two</p></div></div>' +
          '<div n="2"><p>one</p></div>',
      }),
    );

    expect(doc.units.map((unit) => unit.citation)).toEqual(['1.1.1', '1.2', '2']);
    expect(doc.units.map((unit) => unit.path.length)).toEqual([3, 2, 1]);
  });

  it('leaves loose text beside a deeper division unemitted, which is the known limitation', () => {
    // A division holding BOTH deeper divisions and its own text cannot be
    // emitted without duplicating its children, so the loose text is dropped.
    // Measured at under 0.1% of any affected file in the corpus run; pinned
    // here so the gap stays a recorded decision.
    const doc = parseTeiDocument(twoLevel('<div n="1"><p>loose intro</p><div n="1"><p>deep</p></div></div>'));

    expect(doc.units.map((unit) => unit.citation)).toEqual(['1.1']);
    expect(doc.units[0]!.text).toBe('deep');
  });

  it('still throws when nothing matches at any level', () => {
    const xml = document({
      refsDecl: `<refsDecl n="CTS"><cRefPattern n="line" matchPattern="(\\w+)"
        replacementPattern="#xpath(/tei:TEI/tei:text/tei:body/tei:absent[@n='$1'])"/></refsDecl>`,
      body: '<p>nothing numbered here</p>',
    });

    expect(() => parseTeiDocument(xml)).toThrow(/step 4 of 4 \(child <absent>\[@n\]\)/);
  });
});

describe('the ragged-hierarchy fixture', () => {
  // Anonymi Logica et Quadrivium: 21 sections, only 2 with a numbered
  // subsection. Before the per-division fallback this yielded 2 units and lost
  // nine tenths of the work.
  const doc = parseTeiDocument(readFixture('edge-ragged-hierarchy.xml'));

  it('reads its declared two-level scheme', () => {
    expect(doc.citation.source).toBe('refsDecl');
    expect(doc.citation.levels.map((level) => level.label)).toEqual(['section', 'subsection']);
  });

  it('cites every section, not only the two with subsections', () => {
    expect(doc.units.length).toBeGreaterThan(20);
    expect(doc.units.filter((unit) => unit.path.length === 2)).toHaveLength(2);
  });

  it('recovers the text that used to be dropped', () => {
    const chars = doc.units.reduce((total, unit) => total + unit.text.length, 0);

    expect(chars).toBeGreaterThan(15000);
  });
});

describe('inferring a scheme from structure', () => {
  it('names levels from the divisions subtype, whatever its casing', () => {
    // The Iliad writes subtype="Book" where the Odyssey writes "book".
    const doc = parseTeiDocument(
      document({
        body: '<div n="1" type="textpart" subtype="Book"><l n="1">alpha</l></div>',
      }),
    );

    expect(doc.citation.levels.map((level) => level.label)).toEqual(['book', 'line']);
  });

  it('numbers a level it cannot name', () => {
    const doc = parseTeiDocument(document({ body: '<div n="1"><l n="1">alpha</l></div>' }));

    expect(doc.citation.levels.map((level) => level.label)).toEqual(['level1', 'line']);
  });

  it('stops at the divisions when no numbered lines lie below them', () => {
    const doc = parseTeiDocument(document({ body: '<div n="1"><div n="2"><p>prose</p></div></div>' }));

    expect(doc.citation.levels.map((level) => `${level.label}:${level.element}`)).toEqual([
      'level1:div',
      'level2:div',
    ]);
    expect(doc.units.map((unit) => unit.citation)).toEqual(['1.2']);
  });

  it('treats a numbered line group as the leaf when there are no numbered lines', () => {
    const doc = parseTeiDocument(document({ body: '<div n="1"><lg n="1"><l>a</l><l>b</l></lg></div>' }));

    expect(doc.citation.levels.at(-1)?.element).toBe('lg');
    expect(doc.units[0]!.kind).toBe('line');
    expect(doc.units[0]!.text).toBe('a\nb');
  });
});

describe('document metadata', () => {
  it('reads the header of a Greek edition', () => {
    const doc = parseTeiDocument(readFixture('homer-odyssey.xml'));

    expect(doc.urn).toBe('urn:cts:greekLit:tlg0012.tlg002.perseus-grc2');
    expect(doc.edition).toBe('perseus-grc2');
    expect(doc.language).toBe('grc');
    expect(doc.title).toBe('Ὀδύσσεια');
    expect(doc.author).toBe('Homer');
  });

  it('reads the licence when the edition states one', () => {
    expect(parseTeiDocument(readFixture('caesar-bellum-gallicum.xml')).license).toBe(
      'https://creativecommons.org/licenses/by-sa/4.0/',
    );
  });

  it('returns a null licence rather than inventing one', () => {
    // Only one of the seven profiled editions carries a <licence> at all.
    expect(parseTeiDocument(readFixture('homer-odyssey.xml')).license).toBeNull();
  });

  it('reports a Latin language code exactly as the edition writes it', () => {
    expect(parseTeiDocument(readFixture('vergil-aeneid.xml')).language).toBe('lat');
  });

  it('finds the edition division even when it carries extra attributes', () => {
    // The Aeneid puts subtype="book" on the edition div itself, so "the
    // outermost div" is not a safe way to recognise it.
    expect(parseTeiDocument(readFixture('vergil-aeneid.xml')).urn).toBe(
      'urn:cts:latinLit:phi0690.phi003.perseus-lat2',
    );
  });
});
