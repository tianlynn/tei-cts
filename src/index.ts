/**
 * tei-cts — parse CTS/CapiTainS TEI XML into citable text units.
 *
 * One function does the work. Everything else here is types, and the default
 * element policy, which is exported so a caller can inspect or extend it rather
 * than reconstruct it.
 */

export { parseTeiDocument } from './parse.js';
export { defaultAppPreference, defaultChoicePreference, defaultElementPolicy } from './policy.js';
export type {
  CitableUnit,
  CitationLevel,
  CitationScheme,
  ElementAction,
  ElementPolicy,
  ParseOptions,
  TeiDocument,
  UnitKind,
} from './types.js';
