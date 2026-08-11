/**
 * Reduce a corpus run to the list of texts downstream can actually use.
 *
 * `report.mjs` answers "how is the parser doing?" — it ranks failures and
 * outliers into a document to be read by hand. This answers the question a
 * consumer asks instead: **which of these 3,503 files can I pick up and rely
 * on?** The output is therefore machine-readable and nothing else — one JSON
 * file, keyed by URN, with every text it refuses to list carrying the exception
 * or the measurement that disqualified it.
 *
 *   node tools/corpus/manifest.mjs                  # released corpus (the default)
 *   node tools/corpus/manifest.mjs --corpus=normalized
 *
 * The released corpus is the default deliberately. The normalised branches are
 * measured, not recommended: they parse fewer files, cite 213 works at a coarser
 * depth, lose text in 23, and drop the URN from all but 17 — see finding 8 in
 * `docs/corpus-testing.md`. Building a manifest from them tracks that migration;
 * it is not a source to ship from.
 *
 * Reads `.corpus/results*.jsonl`, writes `.corpus/manifest*.json`, both inside
 * `.corpus/`, which is git-ignored — regenerating produces no tracked change.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { corpus, readSources, requireResults, select, texts } from './paths.mjs';

const CORPUS = corpus();
const RESULTS = requireResults(CORPUS);
const VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

/**
 * The bar, in one place, because the whole artifact is only as trustworthy as
 * this list is explicit.
 *
 * **Blocking** checks describe a text a consumer cannot use at all: it has no
 * identifier to fetch it by, nothing citable in it, or a citation scheme that
 * demonstrably does not describe its body. Failing one keeps a text out of the
 * manifest, with the check named.
 *
 * **Advisory** checks describe a text that parses correctly and is worth a
 * second look before it is used unattended. Failing one keeps the text in, at
 * `review` rather than `high` confidence, with the warning attached. They are
 * advisory because each has a legitimate cause as often as a suspicious one —
 * a commentary really does drop most of its body to apparatus, and a letter
 * really is one unit long.
 *
 * Thresholds live here rather than on the command line on purpose: two runs of
 * this script must be comparable, and a tunable bar is not a bar. Change them
 * here, in a commit, where the change is reviewable.
 */
const CRITERIA = {
  blocking: {
    parsed: 'parseTeiDocument returned without throwing',
    identified: 'the document declares a URN, which is how downstream addresses it',
    citable: 'the scheme produced at least one citable unit',
    uniqueCitations: 'no citation addresses two different units',
    normalisedText: 'unit text is NFC, trimmed, and free of doubled spaces',
    coverageFloor: 'at least 50% of the body’s characters reached a unit',
  },
  advisory: {
    'unexplained-loss': 'more than 5% of body characters vanished without the policy accounting for it',
    'coarse-citation': 'fewer than 5% as many units as the body has numbered divisions',
    'low-coverage': 'below 90% of body characters reached a unit',
    'inferred-scheme': 'the citation scheme was inferred from structure, not declared',
    'empty-units': 'more than 5% of units carry no text',
    'single-unit': 'the whole work reduced to one unit, so it is barely citable',
  },
  thresholds: {
    coverageFloor: 0.5,
    unexplainedLossWarn: 0.05,
    resolutionWarn: 0.05,
    coverageWarn: 0.9,
    emptyUnitsWarn: 0.05,
  },
};

const { coverageFloor, unexplainedLossWarn, resolutionWarn, coverageWarn, emptyUnitsWarn } =
  CRITERIA.thresholds;

/** Why a record is not in the manifest — the first blocking check it fails. */
function blockedBy(record) {
  // The full message, not just the signature: downstream deciding what to do
  // about a rejected text needs the line number and the pattern it names, and
  // the signature exists to group causes, not to describe one.
  if (!record.ok) return { check: 'parsed', detail: record.error.signature, error: record.error };
  if (record.urn === null || record.urn === undefined)
    return { check: 'identified', detail: 'no URN in the edition div' };
  if (record.units === 0) return { check: 'citable', detail: 'no units' };
  if (!record.invariants.unique) return { check: 'uniqueCitations', detail: 'duplicate citations' };
  if (!record.invariants.nfc || !record.invariants.trimmed) {
    return { check: 'normalisedText', detail: 'unit text is not NFC or not trimmed' };
  }
  // Null coverage means the body held no character data to compare against, so
  // there is nothing to have covered — treated as a failure rather than a pass,
  // since a document with no body text is not one to hand downstream either.
  if (record.coverage === null || record.coverage < coverageFloor) {
    return { check: 'coverageFloor', detail: `coverage ${record.coverage ?? 'none'}` };
  }
  return null;
}

/**
 * What is worth knowing about a text that is in the manifest.
 *
 * The first two are the discriminating ones, and they measure different axes.
 * `unexplained-loss` asks whether the characters survived once the policy's own
 * deletions are subtracted — 81% of the corpus scores zero, so its tail means
 * something in a way a raw coverage percentile does not. `coarse-citation` asks
 * the question coverage cannot ask at all: whether the scheme carved the
 * document as finely as the document says it can be. A text can keep every
 * character and still be useless to cite, and 67 do exactly that at a coverage
 * above 0.9 — invisible to every other check here.
 */
function warningsFor(record) {
  const warnings = [];
  if (typeof record.unexplainedLoss === 'number' && record.unexplainedLoss > unexplainedLossWarn) {
    warnings.push('unexplained-loss');
  }
  // The `numbered` guard keeps a document with two numbered divisions out of a
  // ratio that would be noise at that size.
  if (typeof record.resolution === 'number' && record.resolution < resolutionWarn && record.numbered > 10) {
    warnings.push('coarse-citation');
  }
  if (record.coverage < coverageWarn) warnings.push('low-coverage');
  if (record.scheme.source === 'inferred') warnings.push('inferred-scheme');
  if (record.emptyUnits / record.units > emptyUnitsWarn) warnings.push('empty-units');
  if (record.units === 1) warnings.push('single-unit');
  return warnings;
}

const records = readFileSync(RESULTS, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line));

// A resumed run that was interrupted leaves a results file that is complete
// enough to report on and not complete enough to publish. Say so, loudly,
// rather than emitting a manifest that is short by an unknown number of texts.
const onDisk = existsSync(CORPUS.dir) ? texts(CORPUS.dir).length : null;
const partial = onDisk !== null && onDisk !== records.length;
if (partial) {
  process.stderr.write(
    `warning: ${records.length} records but ${onDisk} texts in ${CORPUS.dir} — ` +
      `the run did not finish. Re-run \`npm run corpus:run${select(CORPUS)}\` to complete it; ` +
      'this manifest covers only what was parsed.\n',
  );
}

const included = [];
const excluded = [];

for (const record of records) {
  const blocked = blockedBy(record);
  if (blocked !== null) {
    excluded.push({
      path: record.path,
      repo: record.repo,
      urn: record.urn ?? null,
      language: record.language ?? null,
      // Both null on a text that threw, since nothing got far enough to measure
      // them. Present either way so the shape does not change per reason.
      units: record.units ?? null,
      coverage: record.coverage ?? null,
      ...blocked,
    });
    continue;
  }
  const warnings = warningsFor(record);
  included.push({
    urn: record.urn,
    path: record.path,
    repo: record.repo,
    language: record.language,
    title: record.title ?? null,
    author: record.author ?? null,
    edition: record.edition ?? null,
    license: record.license ?? null,
    citation: {
      source: record.scheme.source,
      levels: record.scheme.levels,
      elements: record.scheme.elements,
      first: record.firstCitation,
      last: record.lastCitation,
    },
    units: record.units,
    coverage: record.coverage,
    // The two measurements behind the warnings, carried raw so a consumer can
    // set its own bar rather than inherit this script's. `unexplainedLoss` is
    // coverage with the policy's deliberate deletions subtracted, so 0 means
    // every missing character is accounted for; `resolution` is units over the
    // divisions the body numbers, where only the far low tail means anything.
    unexplainedLoss: record.unexplainedLoss ?? null,
    resolution: record.resolution ?? null,
    // Not a warning: ragged citation is how editions are, and the parser cites
    // such a division at the depth it has. It is here because it tells a
    // consumer that `unit.path` may be shorter than `citation.levels` in this
    // text specifically, which changes how the units are read.
    ragged: record.invariants.pathLen === false,
    confidence: warnings.length === 0 ? 'high' : 'review',
    warnings,
  });
}

// URN is the key downstream indexes on, so a collision would silently make one
// text shadow another. Nothing in the released corpus collides today; this is
// here so that stops being an assumption the moment it stops being true.
const byUrn = new Map();
for (const text of included) {
  if (!byUrn.has(text.urn)) byUrn.set(text.urn, []);
  byUrn.get(text.urn).push(text.path);
}
const collisions = [...byUrn.entries()].filter(([, paths]) => paths.length > 1);

included.sort((a, b) => a.urn.localeCompare(b.urn) || a.path.localeCompare(b.path));
excluded.sort((a, b) => a.check.localeCompare(b.check) || a.path.localeCompare(b.path));

const high = included.filter((text) => text.confidence === 'high');
const count = (items, key) => {
  const counts = {};
  for (const item of items) for (const k of [key(item)].flat()) counts[k] = (counts[k] ?? 0) + 1;
  return counts;
};
const totals = {
  files: records.length,
  included: included.length,
  high: high.length,
  review: included.length - high.length,
  excluded: excluded.length,
  units: included.reduce((sum, text) => sum + text.units, 0),
  // The same numbers a reader would otherwise reduce the two arrays to get.
  byRepo: count(included, (text) => text.repo),
  byLanguage: count(included, (text) => text.language ?? 'unknown'),
  excludedBy: count(excluded, (text) => text.check),
  warnings: count(included, (text) => text.warnings),
};

// Everything needed to say what produced this file and to produce it again:
// which parser at which version, under which options, over which commit of
// which branch of which repository.
const sources = readSources(CORPUS);
const unknownCommits = sources.filter((source) => source.commit === null);
if (unknownCommits.length > 0) {
  const refetch =
    CORPUS.name === 'released'
      ? 'npm run corpus:fetch -- --refetch'
      : `npm run corpus:fetch -- --refetch --corpus=${CORPUS.name}`;
  process.stderr.write(
    `warning: no commit recorded for ${unknownCommits.map((source) => source.name).join(', ')} — ` +
      'downloaded before provenance was recorded, and a commit cannot be recovered after the fact ' +
      `(the tarball carries only the branch name). Capture it with: ${refetch}\n`,
  );
}

if (collisions.length > 0) {
  process.stderr.write(
    `warning: ${collisions.length} URNs address more than one listed file — ` +
      'downstream keyed on URN would shadow one with the other: ' +
      `${collisions
        .map(([urn]) => urn)
        .slice(0, 3)
        .join(', ')}\n`,
  );
}

writeFileSync(
  CORPUS.manifest,
  JSON.stringify(
    {
      schema: 'tei-cts/corpus-manifest@1',
      generated: new Date().toISOString(),
      parser: { package: 'tei-cts', version: VERSION, options: CORPUS.options },
      // `partial` is about the run, not the provenance: a source with a null
      // commit is fully parsed, just unlabelled. Two different doubts, so two
      // different places to look rather than one flag meaning either.
      corpus: { name: CORPUS.name, sources, partial },
      criteria: CRITERIA,
      totals,
      texts: included,
      excluded,
    },
    null,
    2,
  ) + '\n',
);

process.stderr.write(`wrote ${CORPUS.manifest}\n`);
for (const source of sources) {
  process.stderr.write(
    `  ${source.name}: ${source.repo}#${source.branch} @ ${source.commit?.slice(0, 7) ?? 'unrecorded'}\n`,
  );
}
process.stdout.write(
  `${CORPUS.name}: ${totals.included} of ${totals.files} texts listed ` +
    `(${totals.high} high, ${totals.review} review), ${totals.excluded} excluded, ` +
    `${totals.units.toLocaleString()} units\n`,
);
