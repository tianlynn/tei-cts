import { describe, expect, it } from 'vitest';
import { readFixture } from './fixtures.js';
import { parseTeiDocument } from './parse.js';
import { defaultElementPolicy, SELECTING_ELEMENTS } from './policy.js';
import { type TeiDocument } from './types.js';

/**
 * The regression matrix. Every distinct citation shape in the corpus is
 * represented, with literal expectations rather than snapshots — a reviewer can
 * read these and judge whether they are right, which a snapshot never allows.
 */
const shapes = [
  {
    file: 'homer-odyssey.xml',
    levels: ['book:div', 'line:l'],
    units: 40,
    first: '1.1',
    last: '1.40',
    kind: 'line',
    text: 'ἄνδρα μοι ἔννεπε, μοῦσα, πολύτροπον, ὃς μάλα πολλὰ',
  },
  {
    file: 'homer-iliad.xml',
    levels: ['book:div', 'line:l'],
    units: 40,
    first: '1.1',
    last: '1.40',
    kind: 'line',
    text: 'μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος',
  },
  {
    file: 'vergil-aeneid.xml',
    levels: ['book:div', 'line:l'],
    units: 40,
    first: '1.1',
    last: '1.40',
    kind: 'line',
    text: 'Arma virumque cano, Troiae qui primus ab oris',
  },
  {
    file: 'sophocles-oedipus.xml',
    levels: ['line:l'],
    units: 60,
    first: '1',
    last: '60',
    kind: 'line',
    text: 'ὦ τέκνα, Κάδμου τοῦ πάλαι νέα τροφή,',
  },
  {
    file: 'plato-republic.xml',
    levels: ['book:div', 'section:div'],
    units: 10,
    first: '1.327',
    last: '1.336',
    kind: 'paragraph',
    text: 'κατέβην χθὲς εἰς Πειραιᾶ μετὰ Γλαύκωνος τοῦ Ἀρίστωνος',
  },
  {
    file: 'herodotus-histories.xml',
    levels: ['book:div', 'chapter:div', 'section:div'],
    units: 17,
    first: '1.1.0',
    last: '1.5.3',
    kind: 'paragraph',
    text: 'Ἡροδότου Ἁλικαρνησσέος ἱστορίης ἀπόδεξις ἥδε',
  },
  {
    file: 'caesar-bellum-gallicum.xml',
    levels: ['book:div', 'chapter:div', 'section:div'],
    units: 17,
    first: '1.1.1',
    last: '1.3.4',
    kind: 'paragraph',
    text: 'Gallia est omnis divisa in partes tres',
  },
] as const;

const parsed = new Map<string, TeiDocument>(
  shapes.map((shape) => [shape.file, parseTeiDocument(readFixture(shape.file))]),
);

const documents = (): [string, TeiDocument][] => [...parsed.entries()];

describe('parseTeiDocument over the corpus', () => {
  it.each(shapes)('reads the citation shape of $file', (shape) => {
    const doc = parsed.get(shape.file)!;

    expect(doc.citation.source).toBe('refsDecl');
    expect(doc.citation.levels.map((level) => `${level.label}:${level.element}`)).toEqual([...shape.levels]);
    expect(doc.units).toHaveLength(shape.units);
    expect(doc.units[0]!.citation).toBe(shape.first);
    expect(doc.units.at(-1)!.citation).toBe(shape.last);
    expect(doc.units[0]!.kind).toBe(shape.kind);
    expect(doc.units[0]!.text.startsWith(shape.text)).toBe(true);
  });
});

describe('corpus invariants', () => {
  it('gives every unit one value per declared level', () => {
    for (const [file, doc] of documents()) {
      for (const unit of doc.units) {
        expect(unit.path, file).toHaveLength(doc.citation.levels.length);
        expect(
          unit.path.every((part) => part !== ''),
          file,
        ).toBe(true);
      }
    }
  });

  it('joins the path into the citation with the scheme separator', () => {
    for (const [file, doc] of documents()) {
      for (const unit of doc.units) {
        expect(unit.path.join(doc.citation.separator), file).toBe(unit.citation);
      }
    }
  });

  it('cites each unit exactly once', () => {
    for (const [file, doc] of documents()) {
      const citations = doc.units.map((unit) => unit.citation);
      expect(new Set(citations).size, file).toBe(citations.length);
    }
  });

  it('lets no markup reach the reading text', () => {
    for (const [file, doc] of documents()) {
      for (const unit of doc.units) {
        expect(unit.text, `${file} ${unit.citation}`).not.toMatch(/[<>]|&[a-z]+;|#text/u);
      }
    }
  });

  it('leaves no stray whitespace in the reading text', () => {
    for (const [file, doc] of documents()) {
      for (const unit of doc.units) {
        expect(unit.text, `${file} ${unit.citation}`).toBe(unit.text.trim());
        expect(unit.text, `${file} ${unit.citation}`).not.toMatch(/ {2}|\t/u);
      }
    }
  });

  it('returns text already in NFC', () => {
    for (const [file, doc] of documents()) {
      for (const unit of doc.units) {
        expect(unit.text.normalize('NFC'), `${file} ${unit.citation}`).toBe(unit.text);
      }
    }
  });

  it('preserves the elision apostrophe Perseus writes as U+02BC', () => {
    // Category Lm, so it matches \p{L}: a downstream word-boundary check will
    // read δʼ as one word. Silently normalising it away here would be invisible
    // to every other assertion and ruinous to a tokenizer.
    const greek = ['homer-odyssey.xml', 'homer-iliad.xml', 'sophocles-oedipus.xml'];
    for (const file of greek) {
      const text = parsed
        .get(file)!
        .units.map((unit) => unit.text)
        .join('\n');
      const source = readFixture(file);
      const inSource = [...source.matchAll(/ʼ/gu)].length;
      const inText = [...text.matchAll(/ʼ/gu)].length;

      expect(inSource, file).toBeGreaterThan(0);
      expect(inText, file).toBe(inSource);
    }
  });

  it('parses deterministically', () => {
    for (const [file, doc] of documents()) {
      expect(parseTeiDocument(readFixture(file)), file).toEqual(doc);
    }
  });

  it('keeps citations independent of the element policy', () => {
    // Structural proof that the citation machinery never consults the text.
    const stripped = { elements: { l: 'drop', p: 'drop', div: 'drop' } } as const;
    for (const [file, doc] of documents()) {
      const other = parseTeiDocument(readFixture(file), stripped);
      expect(
        other.units.map((unit) => unit.citation),
        file,
      ).toEqual(doc.units.map((unit) => unit.citation));
    }
  });

  it('names every element the corpus contains in the default policy', () => {
    // A fixture introducing unfamiliar markup should fail the build rather than
    // quietly take the fallback action.
    const named = new Set([...Object.keys(defaultElementPolicy), ...SELECTING_ELEMENTS]);
    const unknown = new Set<string>();

    for (const shape of shapes) {
      const xml = readFixture(shape.file);
      const body = xml.slice(xml.indexOf('<body'));
      for (const match of body.matchAll(/<([A-Za-z_][\w.-]*)/gu)) {
        const name = match[1] ?? '';
        if (name !== 'body' && !named.has(name)) unknown.add(name);
      }
    }

    expect([...unknown].sort()).toEqual([]);
  });
});
