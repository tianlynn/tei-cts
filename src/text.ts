import { elementChildren, isElement, type TeiElement, type TeiNode } from './dom.js';
import {
  defaultAppPreference,
  defaultChoicePreference,
  defaultElementPolicy,
  resolveAction,
  SELECTING_ELEMENTS,
} from './policy.js';
import { type ElementAction, type ElementPolicy, type ParseOptions } from './types.js';

/**
 * Flatten an element subtree to the text a reader would see.
 *
 * The walk emits a flat run of text pieces and explicit break markers rather
 * than concatenating as it goes. Assembling afterwards is what lets whitespace
 * be collapsed once, globally: TEI is pretty-printed, so the indentation
 * between `<l>` elements is source formatting, not text, and a naive
 * concatenation carries it into the reading text.
 */

export type FlattenSettings = {
  policy: ElementPolicy;
  unknownElement: ElementAction;
  preferences: Record<string, string[]>;
  blockSeparator: string;
  normalize: 'NFC' | 'NFD' | 'none';
};

/**
 * The block sentinel. U+0000 is not legal anywhere in XML, so it cannot
 * collide with source text.
 */
const BREAK = '\u0000';

export function flattenSettings(options: ParseOptions = {}): FlattenSettings {
  return {
    policy: { ...defaultElementPolicy, ...options.elements },
    unknownElement: options.unknownElement ?? 'keep',
    preferences: {
      choice: options.choicePreference ?? defaultChoicePreference,
      app: options.appPreference ?? defaultAppPreference,
      subst: ['add', 'del'],
    },
    blockSeparator: options.blockSeparator ?? '\n',
    normalize: options.normalize ?? 'NFC',
  };
}

/**
 * Pick the child of a selecting element that wins.
 *
 * `<choice><sic>αἱ</sic><corr>οἱ</corr></choice>` renders the correction. This
 * cannot be a per-element action: dropping `sic` outright would also delete a
 * standalone `sic` that has no correction to stand in for it.
 */
function selectChild(element: TeiElement, preference: string[]): TeiElement[] {
  const children = elementChildren(element);
  for (const name of preference) {
    const winner = children.find((child) => child.name === name);
    if (winner !== undefined) return [winner];
  }
  // Nothing matched the preference: render everything rather than nothing.
  return children;
}

export function flattenText(element: TeiElement, settings: FlattenSettings): string {
  const pieces: string[] = [];

  const walkChildren = (nodes: TeiNode[]): void => {
    for (const node of nodes) walk(node);
  };

  const walk = (node: TeiNode): void => {
    if (!isElement(node)) {
      pieces.push(node.value);
      return;
    }

    const preference = settings.preferences[node.name];
    if (preference !== undefined && SELECTING_ELEMENTS.has(node.name)) {
      walkChildren(selectChild(node, preference));
      return;
    }

    const action = resolveAction(settings.policy, node.name, settings.unknownElement);
    if (action === 'drop') return;
    if (action === 'space') {
      pieces.push(' ');
      return;
    }
    if (typeof action === 'object') {
      pieces.push(action.replace);
      return;
    }
    if (action === 'block') {
      pieces.push(BREAK);
      walkChildren(node.children);
      pieces.push(BREAK);
      return;
    }
    walkChildren(node.children);
  };

  walk(element);

  const blocks = pieces
    .join('')
    .split(BREAK)
    .map((block) => block.replace(/\s+/gu, ' ').trim())
    .filter((block) => block !== '');

  const text = blocks.join(settings.blockSeparator);
  return settings.normalize === 'none' ? text : text.normalize(settings.normalize);
}
