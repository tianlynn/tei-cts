/**
 * Download the three CTS corpora into `.corpus/`, keeping only `data/`.
 *
 * Tarballs rather than clones: no history, one request each, and `data/` is the
 * only part with editions in it. Idempotent — a corpus already extracted is
 * skipped, so this is safe to run before every parse run.
 *
 * Needs `tar` on PATH. Nothing is written outside `.corpus/`, which is ignored
 * by git; delete that directory to reclaim the ~1.2 GB.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPUS_DIR, TARS_DIR, texts } from './paths.mjs';

const REPOS = [
  ['PerseusDL/canonical-greekLit', 'greekLit'],
  ['PerseusDL/canonical-latinLit', 'latinLit'],
  ['OpenGreekAndLatin/First1KGreek', 'First1KGreek'],
];

/** Try the usual default branch names rather than spending an API call on it. */
async function download(repo, target) {
  for (const branch of ['master', 'main']) {
    const response = await fetch(`https://codeload.github.com/${repo}/tar.gz/refs/heads/${branch}`);
    if (!response.ok) continue;
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    return branch;
  }
  throw new Error(`could not download ${repo}: no master or main branch`);
}

/** GNU tar needs --wildcards for the pattern; BSD tar rejects the flag and globs anyway. */
function extract(tarball, into) {
  const args = ['-xzf', tarball, '-C', into, '--strip-components=1'];
  const gnu = spawnSync('tar', [...args, '--wildcards', '*/data/*'], { stdio: 'ignore' });
  if (gnu.status === 0) return;
  const bsd = spawnSync('tar', [...args, '*/data/*'], { stdio: 'ignore' });
  if (bsd.status !== 0) throw new Error(`tar failed on ${tarball}`);
}

mkdirSync(CORPUS_DIR, { recursive: true });
mkdirSync(TARS_DIR, { recursive: true });

for (const [repo, name] of REPOS) {
  const into = join(CORPUS_DIR, name);
  if (existsSync(join(into, 'data'))) {
    console.log(`${name}: already extracted, skipping`);
    continue;
  }

  const tarball = join(TARS_DIR, `${name}.tar.gz`);
  process.stdout.write(`${name}: downloading ${repo} … `);
  const branch = await download(repo, tarball);
  console.log(`${(statSync(tarball).size / 1e6).toFixed(0)} MB from ${branch}`);

  mkdirSync(into, { recursive: true });
  extract(tarball, into);
  console.log(`${name}: ${texts(into).length.toLocaleString()} texts`);
}

const all = texts(CORPUS_DIR);
const bytes = all.reduce((total, file) => total + statSync(file).size, 0);
console.log(`\n${all.length.toLocaleString()} texts, ${(bytes / 1e6).toFixed(0)} MB in ${CORPUS_DIR}`);
console.log(
  `${readdirSync(TARS_DIR).length} tarballs kept in ${TARS_DIR}; delete them if you want the space`,
);
