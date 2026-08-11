/**
 * Parse every text in `.corpus/` and emit one JSON record per file.
 *
 * Imports the built `dist/`, not `src/`, so this exercises what a consumer
 * installs. Records are written synchronously one line at a time: if a file
 * kills the process — out-of-memory on a huge document being the plausible way
 * — everything before it survives and the crash itself becomes a finding rather
 * than losing the run. Re-running skips paths already recorded, so a crash can
 * be resumed past.
 *
 * Exceptions are the easy half of what this measures. A parser can also return
 * a well-formed, plausible-looking result quietly missing most of its text, so
 * each record also carries coverage, per-document invariants, and the elements
 * the default policy has no opinion about.
 *
 * Two of the measurements are the ones that discriminate, and they sit on
 * different axes. `unexplainedLoss` is coverage with the policy's own deliberate
 * deletions subtracted, so it separates "correctly dropped a third of this
 * commentary" from "silently lost a third to a bug"; 81% of the corpus scores
 * exactly zero. `resolution` is units over the divisions the body numbers, and
 * it catches what no character count can — a scheme that keeps every character
 * while emitting a fraction of the units the edition is numbered for.
 *
 *   node tools/corpus/run.mjs                          # released corpus, options as shipped
 *   node tools/corpus/run.mjs --corpus=normalized      # working branches, citeStructure on
 *   CORPUS_ROOT=fixtures node tools/corpus/run.mjs     # self-test, see README
 */
import { closeSync, existsSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { relative } from 'node:path';
import { corpus, DIST, fail, requireTexts } from './paths.mjs';

const CORPUS = corpus();
const ROOT = CORPUS.dir;
const RESULTS = CORPUS.results;

const files = requireTexts(CORPUS);

const { defaultElementPolicy, parseTeiDocument } = await import(DIST).catch(() =>
  fail(`${DIST} is missing — the package has not been built.`, '', 'Build it:', '', '  npm run build'),
);

// Every record says which corpus and which options produced it, so two runs
// cannot be compared without noticing that they were parsed differently.
const OPTIONS = CORPUS.options;
process.stderr.write(`${CORPUS.name}: parsing ${ROOT} with ${JSON.stringify(OPTIONS)}\n`);

/** Elements the policy names, plus the ones it handles structurally. */
const KNOWN = new Set([...Object.keys(defaultElementPolicy), 'choice', 'app', 'subst', 'body']);

/** The names the policy discards, which is why coverage is legitimately below 1. */
const DROPPED = Object.entries(defaultElementPolicy)
  .filter(([, action]) => action === 'drop')
  .map(([name]) => name);

/**
 * `<body>`, comments removed. Everything below measures the source this way —
 * by regular expression over raw XML rather than by walking the parse — so that
 * the measurements stay independent of the thing being measured. A traversal
 * bug that loses text would otherwise lose it from both sides of the ratio.
 */
function bodyOf(xml) {
  const start = xml.indexOf('<body');
  if (start === -1) return null;
  const end = xml.lastIndexOf('</body>');
  return xml.slice(start, end === -1 ? undefined : end).replace(/<!--[\s\S]*?-->/g, '');
}

/** Non-whitespace character data, markup removed. */
const plainLength = (fragment) => fragment.replace(/<[^>]*>/g, '').replace(/\s+/gu, '').length;

/** Element local names appearing inside <body>. */
function bodyElements(xml) {
  const body = bodyOf(xml);
  if (body === null) return [];
  const names = new Set();
  for (const match of body.matchAll(/<([A-Za-z_][\w.:-]*)/g)) {
    names.add((match[1] ?? '').replace(/^[^:]*:/, ''));
  }
  return [...names];
}

/**
 * The share of body characters the policy is *supposed* to discard.
 *
 * Measured as a set difference — prune every dropped subtree, then compare —
 * rather than by summing each element's text, because summing double-counts a
 * `<note>` inside a `<head>` and would explain away loss that never happened.
 *
 * Imprecise in one known direction: with a non-greedy match, `<note>a<note>b
 * </note>c</note>` leaves `c` behind, so nesting of the same name under-reports
 * what was dropped. That inflates unexplained loss rather than hiding it, which
 * is the safe way for a suspicion-locating metric to be wrong.
 */
function droppedShare(body, total) {
  if (total === 0) return null;
  let pruned = body;
  for (const name of DROPPED) {
    const element = `(?:[\\w.-]+:)?${name}`;
    // Skip names with no closing tag in this document, which is both an
    // optimisation and the fix for a quadratic blowup. Half these names are
    // milestones written `<lb/>`, and for every one of them the non-greedy match
    // below would scan to the end of the document hunting a `</lb>` that does
    // not exist. On a 17 MB document with thousands of them that dominated the
    // whole corpus run — 3 minutes against 25 seconds. Nothing is lost by
    // skipping them: an empty element encloses no characters to drop.
    if (!new RegExp(`</${element}>`).test(pruned)) continue;
    const pattern = new RegExp(`<${element}(?:\\s[^>]*)?>[\\s\\S]*?</${element}>`, 'g');
    for (let previous = null; previous !== pruned;) {
      previous = pruned;
      pruned = pruned.replace(pattern, '');
    }
  }
  return Number(((total - plainLength(pruned)) / total).toFixed(4));
}

/**
 * How many divisions the edition numbers, against which unit count is read.
 *
 * `@n` is how CTS numbers anything citable, so this counts the document's own
 * claim about how finely it can be addressed. It over-counts — `<pb n="12">` and
 * `<milestone>` carry `@n` and are not citable — so the ratio's absolute value
 * means nothing, exactly as coverage's does not. Only the far low tail is a
 * signal, and there it is one coverage cannot give: a scheme that keeps every
 * character while emitting a fraction of the units the body is numbered for.
 */
const numberedDivisions = (body) => (body.match(/<[A-Za-z][\w.:-]*\s[^>]*\bn=/g) ?? []).length;

/** Collapse a message into a signature, so thousands of failures group into causes. */
const signature = (message) =>
  message
    .replace(/"[^"]*"/g, '"X"')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .slice(0, 200);

const done = new Set();
if (existsSync(RESULTS)) {
  for (const line of readFileSync(RESULTS, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      done.add(JSON.parse(line).path);
    } catch {
      /* a truncated final line from a crash; ignore */
    }
  }
  process.stderr.write(`resuming, ${done.size} already recorded\n`);
}

const fd = openSync(RESULTS, 'a');
let peakRss = 0;
let count = 0;
const started = Date.now();

for (const file of files) {
  const path = relative(ROOT, file);
  if (done.has(path)) continue;
  count += 1;

  const bytes = statSync(file).size;
  const record = { corpus: CORPUS.name, path, repo: path.split(/[/\\]/)[0], bytes };

  let xml;
  try {
    xml = readFileSync(file, 'utf8');
  } catch (error) {
    record.ok = false;
    record.error = { message: `unreadable: ${error.message}`, signature: 'unreadable' };
    writeSync(fd, JSON.stringify(record) + '\n');
    continue;
  }

  const t0 = performance.now();
  try {
    const doc = parseTeiDocument(xml, OPTIONS);
    record.ms = Number((performance.now() - t0).toFixed(2));
    record.ok = true;
    record.urn = doc.urn;
    record.language = doc.language;
    // Header metadata is carried through so the manifest can be built from the
    // JSONL alone, without re-reading 898 MB of XML to answer "what is this?".
    record.title = doc.title;
    record.author = doc.author;
    record.editor = doc.editor;
    record.edition = doc.edition;
    record.license = doc.license;
    record.scheme = {
      source: doc.citation.source,
      levels: doc.citation.levels.map((level) => level.label),
      elements: doc.citation.levels.map((level) => level.element),
    };
    record.units = doc.units.length;

    let empty = 0;
    let textChars = 0;
    let pathLen = true;
    let nfc = true;
    let noMarkup = true;
    let trimmed = true;
    let unique = true;
    const seen = new Set();

    for (const unit of doc.units) {
      if (unit.text === '') empty += 1;
      textChars += unit.text.replace(/\s+/g, '').length;
      if (unit.path.length !== doc.citation.levels.length) pathLen = false;
      if (unit.text.normalize('NFC') !== unit.text) nfc = false;
      if (/[<>]/.test(unit.text)) noMarkup = false;
      if (unit.text !== unit.text.trim() || / {2}/.test(unit.text)) trimmed = false;
      if (seen.has(unit.citation)) unique = false;
      seen.add(unit.citation);
    }

    const body = bodyOf(xml);
    const bodyChars = body === null ? 0 : plainLength(body);
    record.emptyUnits = empty;
    record.coverage = bodyChars === 0 ? null : Number((textChars / bodyChars).toFixed(4));

    // Two signals coverage cannot give on its own, measured on separate axes:
    // did the characters survive, and did the scheme carve the document as
    // finely as the document says it can be carved. A text can pass either one
    // while failing the other, which is the whole reason both are here.
    record.droppedShare = body === null ? null : droppedShare(body, bodyChars);
    record.unexplainedLoss =
      record.coverage === null || record.droppedShare === null
        ? null
        : Number((1 - record.coverage - record.droppedShare).toFixed(4));
    record.numbered = body === null ? 0 : numberedDivisions(body);
    record.resolution =
      record.numbered === 0 ? null : Number((doc.units.length / record.numbered).toFixed(4));
    // pathLen and noMarkup are expected to fail on real data: ragged editions
    // cite above the deepest level, and <> is editorial notation. See the
    // findings document before treating either as a defect.
    record.invariants = { pathLen, unique, nfc, noMarkup, trimmed };
    record.unknownElements = bodyElements(xml).filter((name) => !KNOWN.has(name));
    record.firstCitation = doc.units[0]?.citation ?? null;
    record.lastCitation = doc.units.at(-1)?.citation ?? null;
  } catch (error) {
    record.ms = Number((performance.now() - t0).toFixed(2));
    record.ok = false;
    record.error = { message: error.message, signature: signature(error.message) };
  }

  const rss = process.memoryUsage().rss;
  if (rss > peakRss) peakRss = rss;
  record.rssMb = Math.round(rss / 1e6);

  writeSync(fd, JSON.stringify(record) + '\n');

  if (count % 250 === 0) {
    process.stderr.write(`  ${count}/${files.length}  peak RSS ${Math.round(peakRss / 1e6)} MB\n`);
  }
}

closeSync(fd);
process.stderr.write(
  `done: ${count} files in ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
    `peak RSS ${Math.round(peakRss / 1e6)} MB → ${RESULTS}\n`,
);
