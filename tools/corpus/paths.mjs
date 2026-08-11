/**
 * Where the corpus tooling is allowed to write: `.corpus/` and nowhere else.
 *
 * Every path below resolves from this file rather than the working directory,
 * so the scripts behave the same run from the repo root or from here. `.corpus/`
 * is in .gitignore — a clone can fetch, parse and report without producing a
 * single tracked change.
 */
import { readdirSync } from 'node:fs';
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

/** Which corpus a script is working on. `CORPUS=normalized` selects the other. */
export function corpus(name = process.env.CORPUS ?? 'released') {
  const chosen = CORPORA[name];
  if (chosen === undefined) {
    throw new Error(`unknown corpus "${name}" — expected one of ${Object.keys(CORPORA).join(', ')}`);
  }
  return {
    name,
    ...chosen,
    dir: process.env.CORPUS_ROOT ?? chosen.dir,
    results: process.env.CORPUS_OUT ?? chosen.results,
    report: process.env.CORPUS_REPORT ?? chosen.report,
  };
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
