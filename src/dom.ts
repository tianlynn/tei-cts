import { SaxesParser } from 'saxes';
import { corpusEntities, xmlEntityNames } from './entities.js';

/**
 * A minimal element tree, shaped for the traversal that consumes it.
 *
 * This is not a DOM and does not try to be. It keeps exactly what the citation
 * machine and the text flattener need — local names, attributes, and children
 * in source order with text interleaved. Mixed content is the reason a
 * name-keyed object tree will not do: `<l>ἄνδρα <add>μοι</add> ἔννεπε</l>` is
 * three children in a fixed order, and losing that order silently reorders the
 * words of a poem.
 *
 * Comments and processing instructions are discarded; nothing downstream reads
 * them, and keeping them would mean every consumer filtering them out.
 */

export const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export type TeiText = {
  type: 'text';
  value: string;
};

export type TeiElement = {
  type: 'element';
  /** Local name, prefix stripped: `div`, not `tei:div`. */
  name: string;
  /** Resolved namespace URI, or '' when the document declares none. */
  uri: string;
  /**
   * Attributes by local name, plus a `prefix:local` entry for prefixed ones, so
   * both `lang` and `xml:lang` find the same value.
   */
  attributes: Record<string, string>;
  children: TeiNode[];
  parent: TeiElement | null;
};

export type TeiNode = TeiElement | TeiText;

export const isElement = (node: TeiNode): node is TeiElement => node.type === 'element';

/** Element children of `element`, in source order. */
export const elementChildren = (element: TeiElement): TeiElement[] => element.children.filter(isElement);

/**
 * Every descendant element of `element`, in document order, excluding itself.
 */
export function descendants(element: TeiElement): TeiElement[] {
  const found: TeiElement[] = [];
  const walk = (node: TeiElement): void => {
    for (const child of node.children) {
      if (isElement(child)) {
        found.push(child);
        walk(child);
      }
    }
  };
  walk(element);
  return found;
}

/** The first descendant-or-self element with this local name, in document order. */
export function findElement(root: TeiElement, name: string): TeiElement | null {
  if (root.name === name) return root;
  return descendants(root).find((element) => element.name === name) ?? null;
}

/** Every descendant-or-self element with this local name, in document order. */
export function findElements(root: TeiElement, name: string): TeiElement[] {
  const all = root.name === name ? [root] : [];
  return all.concat(descendants(root).filter((element) => element.name === name));
}

/** The entity settings `parseXml` reads out of `ParseOptions`. */
export type EntityOptions = {
  corpusEntities?: boolean;
  entities?: Record<string, string>;
};

/**
 * Teach the parser the entity names the document's DTD would have defined.
 *
 * Replacement text is inserted verbatim and never rescanned, so a value
 * containing `&other;` stays those seven characters rather than expanding
 * again. That is a limitation of resolving entities without a DTD processor,
 * and it is the safe direction: nothing a caller supplies can become markup.
 */
function defineEntities(parser: SaxesParser, options: EntityOptions): void {
  if (options.corpusEntities !== false) {
    Object.assign(parser.ENTITIES, corpusEntities);
  }
  for (const [name, value] of Object.entries(options.entities ?? {})) {
    if (xmlEntityNames.includes(name)) {
      throw new Error(`the XML entity &${name}; is defined by XML itself and cannot be redefined`);
    }
    parser.ENTITIES[name] = value;
  }
}

/**
 * Parse XML into a `TeiElement` tree.
 *
 * Throws on anything not well-formed, with the line and column saxes reports —
 * a truncated download is the most likely bad input, and "unexpected end of
 * input at 4211:18" is worth more than "cannot read property of undefined".
 */
export function parseXml(xml: string, options: EntityOptions = {}): TeiElement {
  const parser = new SaxesParser({ xmlns: true, position: true });
  defineEntities(parser, options);
  let root: TeiElement | null = null;
  let current: TeiElement | null = null;
  let failure: Error | null = null;

  parser.on('error', (error) => {
    failure ??= error;
  });

  parser.on('opentag', (tag) => {
    const attributes: Record<string, string> = {};
    for (const attribute of Object.values(tag.attributes)) {
      attributes[attribute.local] = attribute.value;
      if (attribute.prefix !== '') {
        attributes[`${attribute.prefix}:${attribute.local}`] = attribute.value;
      }
    }

    const element: TeiElement = {
      type: 'element',
      name: tag.local,
      uri: tag.uri,
      attributes,
      children: [],
      parent: current,
    };

    if (current === null) {
      root ??= element;
    } else {
      current.children.push(element);
    }
    current = element;
  });

  parser.on('text', (text) => {
    if (current !== null) current.children.push({ type: 'text', value: text });
  });

  parser.on('cdata', (text) => {
    if (current !== null) current.children.push({ type: 'text', value: text });
  });

  parser.on('closetag', () => {
    if (current !== null) current = current.parent;
  });

  try {
    parser.write(xml).close();
  } catch (error) {
    /* v8 ignore next -- saxes reports through the error handler; this is belt and braces */
    failure ??= error instanceof Error ? error : new Error(String(error));
  }

  if (failure !== null) {
    throw new Error(`the document is not well-formed XML: ${failure.message}`);
  }
  // Defensive: saxes rejects a rootless document before we reach this, and the
  // compiler cannot see that `root` is assigned inside the handler above.
  /* v8 ignore next 3 */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (root === null) {
    throw new Error('the document contains no elements');
  }
  return root;
}
