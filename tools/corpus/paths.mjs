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
export const CORPUS_DIR = join(WORK_DIR, 'corpus');
export const TARS_DIR = join(WORK_DIR, 'tars');
export const RESULTS = process.env.CORPUS_OUT ?? join(WORK_DIR, 'results.jsonl');
export const REPORT = process.env.CORPUS_REPORT ?? join(WORK_DIR, 'report.md');

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
