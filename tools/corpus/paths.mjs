/**
 * Where the corpus tooling is allowed to write: `.corpus/` and nowhere else.
 *
 * Every path below resolves from this file rather than the working directory,
 * so the scripts behave the same run from the repo root or from here. `.corpus/`
 * is in .gitignore — a clone can fetch, parse and report without producing a
 * single tracked change.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** Everything this tooling downloads or generates lives here. */
export const WORK_DIR = process.env.CORPUS_WORK ?? join(REPO, '.corpus');
export const TARS_DIR = join(WORK_DIR, 'tars');

/**
 * Two corpora, because upstream is mid-migration.
 *
 * `released` is what `npm install` users actually parse: the published branches,
 * every one of which declares its citation scheme with `cRefPattern`. `normalized`
 * is Perseus's working branches, where the body is restructured and the scheme is
 * re-declared as `citeStructure` — see `docs/corpus-testing.md`.
 *
 * They are parsed with different options, and that is the point: `released` must
 * keep parsing with `citeStructure` off, and `normalized` must parse with it on.
 * Running one set under the other's option is what would hide a regression.
 */
export const CORPORA = {
  released: {
    dir: join(WORK_DIR, 'corpus'),
    results: join(WORK_DIR, 'results.jsonl'),
    report: join(WORK_DIR, 'report.md'),
    manifest: join(WORK_DIR, 'manifest.json'),
    options: {},
    repos: [
      ['PerseusDL/canonical-greekLit', 'master', 'greekLit'],
      ['PerseusDL/canonical-latinLit', 'master', 'latinLit'],
      ['OpenGreekAndLatin/First1KGreek', 'master', 'First1KGreek'],
    ],
  },
  normalized: {
    dir: join(WORK_DIR, 'corpus-normalized'),
    results: join(WORK_DIR, 'results-normalized.jsonl'),
    report: join(WORK_DIR, 'report-normalized.md'),
    manifest: join(WORK_DIR, 'manifest-normalized.json'),
    options: { citeStructure: true },
    // Branches, not defaults: the forks' default branches carry no work of their
    // own yet. These are the ones that do — verify with the compare API before
    // assuming a fresh fetch contains anything new.
    repos: [
      ['PerseusDLCode/canonical-greekLit', 'editing', 'greekLit'],
      ['PerseusDLCode/canonical-latinLit', 'dev', 'latinLit'],
      ['PerseusDLCode/First1KGreek', 'editing', 'First1KGreek'],
    ],
  },
};

/**
 * Stop with an explanation rather than a stack trace.
 *
 * Every way these scripts fail before doing any work is a missing input the
 * caller can produce with one command, so the message names that command. A
 * stack trace here would only point at the line that noticed.
 */
export function fail(...lines) {
  for (const line of lines) process.stderr.write(`${line}\n`);
  process.exit(1);
}

/**
 * Which corpus a script is working on: `--corpus=normalized`, or `CORPUS=`.
 *
 * The flag wins over the environment variable, so a one-off run does not have
 * to fight a value exported in the shell.
 */
export function corpus(name = corpusName()) {
  const chosen = CORPORA[name];
  if (chosen === undefined) {
    fail(
      `unknown corpus "${name}" — expected one of: ${Object.keys(CORPORA).join(', ')}`,
      '',
      'Select one with --corpus=<name> or CORPUS=<name>.',
    );
  }
  return {
    name,
    ...chosen,
    dir: process.env.CORPUS_ROOT ?? chosen.dir,
    results: process.env.CORPUS_OUT ?? chosen.results,
    report: process.env.CORPUS_REPORT ?? chosen.report,
    manifest: process.env.CORPUS_MANIFEST ?? chosen.manifest,
  };
}

function corpusName() {
  const flag = process.argv.slice(2).find((argument) => argument.startsWith('--corpus='));
  return flag === undefined ? (process.env.CORPUS ?? 'released') : flag.slice('--corpus='.length);
}

/**
 * How the caller would ask for this corpus again, for use in messages.
 *
 * The `--` is npm's, not ours: without it npm eats the flag instead of passing
 * it to the script, and the suggested command would quietly run the default
 * corpus — the one failure mode a suggestion must not have.
 */
export const select = (chosen) => (chosen.name === 'released' ? '' : ` -- --corpus=${chosen.name}`);

/**
 * The texts of `chosen`, or a message saying how to download them.
 *
 * The directory existing is not the same as the corpus being there: an
 * interrupted `tar` leaves the tree in place with nothing useful under it, and
 * `CORPUS_ROOT` pointed somewhere harmless is an easy typo. Both read as empty
 * here and get the same answer, which is to fetch.
 */
export function requireTexts(chosen) {
  const found = existsSync(chosen.dir) ? texts(chosen.dir) : [];
  if (found.length > 0) return found;
  fail(
    `No ${chosen.name} corpus found at ${chosen.dir}.`,
    '',
    existsSync(chosen.dir)
      ? '  The directory exists but holds no .xml texts — an interrupted download leaves it that way.'
      : '  Nothing has been downloaded there yet.',
    '',
    'Download it (about 1.2 GB, once):',
    '',
    `  npm run corpus:fetch${select(chosen)}`,
    '',
    `Everything lands in ${WORK_DIR}, which is git-ignored; delete it to reclaim the space.`,
  );
}

/** The results file of `chosen`, or a message saying which step writes it. */
export function requireResults(chosen) {
  if (existsSync(chosen.results)) return chosen.results;
  fail(
    `No ${chosen.name} results found at ${chosen.results}.`,
    '',
    'Parse the corpus first:',
    '',
    `  npm run corpus:run${select(chosen)}`,
    '',
    existsSync(chosen.dir)
      ? `The corpus itself is already at ${chosen.dir}, so this is the only missing step.`
      : `That needs the corpus, which is not downloaded either — run \`npm run corpus:fetch${select(chosen)}\` before it.`,
  );
}

/**
 * Where `fetch.mjs` records what it downloaded, beside what it downloaded.
 *
 * Provenance lives inside each extracted repository rather than in one file per
 * corpus, so it cannot outlive the thing it describes: deleting the tree
 * deletes the claim about it, and a half-fetched corpus is missing exactly the
 * records it has not earned.
 */
export const sourceFile = (chosen, name) => join(chosen.dir, name, '.source.json');

/**
 * What is on disk, per repository: branch, commit, and when it was taken.
 *
 * A branch name is not a version — `master` means something different every
 * week — so a result generated from a corpus is only reproducible if the commit
 * is recorded at download time. Corpora fetched before this was recorded report
 * `commit: null`, which is the honest answer and not one to paper over: the
 * tarball carries the branch name in its top-level directory and nothing else,
 * so the commit cannot be recovered after the fact. Re-fetch to capture it.
 */
export function readSources(chosen) {
  return chosen.repos.map(([repo, branch, name]) => {
    const file = sourceFile(chosen, name);
    const recorded = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    return { name, repo, branch, commit: null, committed: null, fetched: null, ...recorded };
  });
}

/** The built package, which is what a consumer installs. */
export const DIST = join(REPO, 'dist', 'index.js');

/**
 * Every `.xml` under `dir` except `__cts__.xml` — those are CapiTainS metadata
 * describing works, not editions of them, and there are more of them than texts.
 */
export function texts(dir) {
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.xml') && entry.name !== '__cts__.xml') found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}
