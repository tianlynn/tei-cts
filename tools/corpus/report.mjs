/**
 * Reduce `.corpus/results.jsonl` to a findings report.
 *
 * The point of every section is to turn thousands of records into a handful of
 * things worth reading a file about. Counts alone say nothing about quality —
 * they say where to look.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { corpus } from './paths.mjs';

const CORPUS = corpus();
const { report: REPORT, results: RESULTS } = CORPUS;

if (!existsSync(RESULTS)) {
  throw new Error(`${RESULTS} is missing — run \`CORPUS=${CORPUS.name} npm run corpus:run\` first`);
}

const records = readFileSync(RESULTS, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line));

const ok = records.filter((r) => r.ok);
const failed = records.filter((r) => !r.ok);
const out = [];
const say = (s = '') => out.push(s);

const pct = (n, d) => (d === 0 ? '0.0' : ((n / d) * 100).toFixed(1));
const leaf = (path) => path.split(/[/\\]/).pop();
const table = (header, rows) => {
  say(`| ${header.join(' | ')} |`);
  say(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) say(`| ${row.join(' | ')} |`);
  say();
};
const group = (items, key) => {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
};

say(`# Corpus run — findings (${CORPUS.name})\n`);
say(`Parsed with \`${JSON.stringify(CORPUS.options)}\`.\n`);

// 1. Totals
say('## Totals\n');
const bytes = records.reduce((total, r) => total + r.bytes, 0);
const ms = records.reduce((total, r) => total + (r.ms ?? 0), 0);
table(
  ['Corpus', 'Files', 'Parsed', 'Failed', 'Pass rate', 'Units'],
  [
    ...group(records, (r) => r.repo).map(([repo, rs]) => {
      const good = rs.filter((r) => r.ok);
      return [
        repo,
        rs.length,
        good.length,
        rs.length - good.length,
        `${pct(good.length, rs.length)}%`,
        good.reduce((total, r) => total + r.units, 0).toLocaleString(),
      ];
    }),
    [
      '**total**',
      records.length,
      ok.length,
      failed.length,
      `**${pct(ok.length, records.length)}%**`,
      ok.reduce((total, r) => total + r.units, 0).toLocaleString(),
    ],
  ],
);
say(
  `${(bytes / 1e6).toFixed(0)} MB parsed in ${(ms / 1000).toFixed(1)}s of parser time ` +
    `(${(bytes / 1e6 / (ms / 1000)).toFixed(0)} MB/s). Peak RSS ${Math.max(...records.map((r) => r.rssMb ?? 0))} MB.\n`,
);

// 2. Error taxonomy
say('## Error taxonomy\n');
if (failed.length === 0) say('No failures.\n');
else {
  table(
    ['n', '%', 'Signature', 'Examples'],
    group(failed, (r) => r.error.signature).map(([sig, rs]) => [
      rs.length,
      `${pct(rs.length, records.length)}%`,
      sig.replace(/\|/g, '\\|').slice(0, 130),
      rs
        .slice(0, 2)
        .map((r) => `\`${leaf(r.path)}\``)
        .join(' '),
    ]),
  );
}

// 3. Scheme census
say('## Citation schemes\n');
// citeStructure is counted separately from cRefPattern rather than folded in
// with it: on the normalised corpus its share is the measure of how far the
// migration has actually got, which a combined "declared" column would hide.
table(
  ['Corpus', 'cRefPattern', 'citeStructure', 'inferred', 'inferred %'],
  group(ok, (r) => r.repo).map(([repo, rs]) => {
    const count = (source) => rs.filter((r) => r.scheme.source === source).length;
    const inferred = count('inferred');
    return [repo, count('refsDecl'), count('citeStructure'), inferred, `${pct(inferred, rs.length)}%`];
  }),
);

say('### Level shapes\n');
const shapes = group(ok, (r) => r.scheme.levels.join('/') || '(none)');
table(
  ['Shape', 'Elements', 'Files', 'Example'],
  shapes
    .slice(0, 25)
    .map(([shape, rs]) => [
      `\`${shape}\``,
      `\`${rs[0].scheme.elements.join('/')}\``,
      rs.length,
      `\`${leaf(rs[0].path)}\``,
    ]),
);
if (shapes.length > 25) say(`…and ${shapes.length - 25} further shapes.\n`);

// 4. Unknown elements
say('## Elements absent from the default policy\n');
const unknown = new Map();
for (const r of ok) {
  for (const name of r.unknownElements ?? []) {
    if (!unknown.has(name)) unknown.set(name, []);
    unknown.get(name).push(r.path);
  }
}
const ranked = [...unknown.entries()].sort((a, b) => b[1].length - a[1].length);
if (ranked.length === 0) say('None. The policy names every element the corpus contains.\n');
else
  table(
    ['Element', 'Files', 'Example'],
    ranked.slice(0, 40).map(([name, paths]) => [`\`${name}\``, paths.length, `\`${leaf(paths[0])}\``]),
  );

// 5. Invariant violations
say('## Invariant violations\n');
const violations = ok.filter((r) => !Object.values(r.invariants).every(Boolean));
if (violations.length === 0) say('None. Every parsed document satisfied every invariant.\n');
else {
  const byKind = new Map();
  for (const r of violations) {
    for (const [kind, held] of Object.entries(r.invariants)) {
      if (held) continue;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(r.path);
    }
  }
  table(
    ['Invariant', 'Files', 'Examples'],
    [...byKind.entries()].map(([kind, paths]) => [
      kind,
      paths.length,
      paths
        .slice(0, 3)
        .map((p) => `\`${leaf(p)}\``)
        .join(' '),
    ]),
  );
  say('`pathLen` and `noMarkup` are expected to fail here; see the findings document.\n');
}

// 6. Outliers to read by hand
say('## Outliers for close reading\n');
const withCoverage = ok.filter((r) => typeof r.coverage === 'number' && r.units > 0);
const sorted = [...withCoverage].sort((a, b) => a.coverage - b.coverage);
const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)].coverage;
say(`Median coverage ${median}. Lowest ten:\n`);
table(
  ['Coverage', 'Units', 'Empty', 'Path'],
  sorted.slice(0, 10).map((r) => [r.coverage, r.units, r.emptyUnits, `\`${r.path}\``]),
);

const single = ok.filter((r) => r.units === 1);
say(`### Documents reduced to a single unit — ${single.length}\n`);
table(
  ['Path', 'Shape', 'Source'],
  single.slice(0, 10).map((r) => [`\`${r.path}\``, `\`${r.scheme.levels.join('/')}\``, r.scheme.source]),
);

const empties = ok
  .filter((r) => r.units > 0 && r.emptyUnits / r.units > 0.1)
  .sort((a, b) => b.emptyUnits / b.units - a.emptyUnits / a.units);
say(`### More than a tenth of units empty — ${empties.length}\n`);
table(
  ['Empty/units', 'Path'],
  empties.slice(0, 10).map((r) => [`${r.emptyUnits}/${r.units}`, `\`${r.path}\``]),
);

say('### Slowest ten\n');
table(
  ['ms', 'MB', 'RSS MB', 'Path'],
  [...ok]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10)
    .map((r) => [r.ms, (r.bytes / 1e6).toFixed(1), r.rssMb, `\`${leaf(r.path)}\``]),
);

writeFileSync(REPORT, out.join('\n'));
process.stderr.write(`wrote ${REPORT}\n`);
process.stdout.write(
  `${records.length} files, ${ok.length} parsed, ${failed.length} failed, ` +
    `${new Set(failed.map((r) => r.error.signature)).size} distinct error causes, ` +
    `${ranked.length} unknown elements, ${violations.length} invariant violations\n`,
);
