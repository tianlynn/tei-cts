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
 *   node tools/corpus/run.mjs                        # released corpus, options as shipped
 *   CORPUS=normalized node tools/corpus/run.mjs      # working branches, citeStructure on
 *   CORPUS_ROOT=fixtures node tools/corpus/run.mjs   # self-test, see README
 */
import { closeSync, existsSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { relative } from 'node:path';
import { corpus, DIST, texts } from './paths.mjs';

const { defaultElementPolicy, parseTeiDocument } = await import(DIST).catch(() => {
  throw new Error(`${DIST} is missing — run \`npm run build\` first`);
});

const CORPUS = corpus();
const ROOT = CORPUS.dir;
const RESULTS = CORPUS.results;
if (!existsSync(ROOT)) {
  throw new Error(`${ROOT} is missing — run \`CORPUS=${CORPUS.name} npm run corpus:fetch\` first`);
}

// Every record says which corpus and which options produced it, so two runs
// cannot be compared without noticing that they were parsed differently.
const OPTIONS = CORPUS.options;
process.stderr.write(`${CORPUS.name}: parsing ${ROOT} with ${JSON.stringify(OPTIONS)}\n`);

/** Elements the policy names, plus the ones it handles structurally. */
const KNOWN = new Set([...Object.keys(defaultElementPolicy), 'choice', 'app', 'subst', 'body']);

/** Non-whitespace character data inside <body>, markup and comments removed. */
function bodyTextLength(xml) {
  const start = xml.indexOf('<body');
  if (start === -1) return 0;
  const end = xml.lastIndexOf('</body>');
  const body = xml.slice(start, end === -1 ? undefined : end);
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '').length;
}

/** Element local names appearing inside <body>. */
function bodyElements(xml) {
  const start = xml.indexOf('<body');
  if (start === -1) return [];
  const body = xml.slice(start).replace(/<!--[\s\S]*?-->/g, '');
  const names = new Set();
  for (const match of body.matchAll(/<([A-Za-z_][\w.:-]*)/g)) {
    names.add((match[1] ?? '').replace(/^[^:]*:/, ''));
  }
  return [...names];
}

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

const files = texts(ROOT);
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

    const bodyChars = bodyTextLength(xml);
    record.emptyUnits = empty;
    record.coverage = bodyChars === 0 ? null : Number((textChars / bodyChars).toFixed(4));
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
