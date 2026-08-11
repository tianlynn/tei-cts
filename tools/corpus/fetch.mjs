/**
 * Download a CTS corpus into `.corpus/`, keeping only `data/`.
 *
 * Tarballs rather than clones: no history, one request each, and `data/` is the
 * only part with editions in it. Idempotent — a corpus already extracted is
 * skipped, so this is safe to run before every parse run.
 *
 *   node tools/corpus/fetch.mjs                    # the released branches
 *   CORPUS=normalized node tools/corpus/fetch.mjs  # Perseus's working branches
 *
 * Needs `tar` on PATH. Nothing is written outside `.corpus/`, which is ignored
 * by git; delete that directory to reclaim the ~1.2 GB each corpus costs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpus, TARS_DIR, texts } from './paths.mjs';

const CORPUS = corpus();

/**
 * A branch is named rather than guessed.
 *
 * The released corpora all sit on `master`, but the normalisation work is on
 * branches whose names carry meaning (`editing`, `dev`), and downloading the
 * fork's default branch instead would silently fetch a copy of upstream and
 * report that nothing changed.
 */
async function download(repo, branch, target) {
  const response = await fetch(`https://codeload.github.com/${repo}/tar.gz/refs/heads/${branch}`);
  if (!response.ok) {
    throw new Error(`could not download ${repo}#${branch}: HTTP ${response.status}`);
  }
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

/** GNU tar needs --wildcards for the pattern; BSD tar rejects the flag and globs anyway. */
function extract(tarball, into) {
  const args = ['-xzf', tarball, '-C', into, '--strip-components=1'];
  const gnu = spawnSync('tar', [...args, '--wildcards', '*/data/*'], { stdio: 'ignore' });
  if (gnu.status === 0) return;
  const bsd = spawnSync('tar', [...args, '*/data/*'], { stdio: 'ignore' });
  if (bsd.status !== 0) throw new Error(`tar failed on ${tarball}`);
}

mkdirSync(CORPUS.dir, { recursive: true });
mkdirSync(TARS_DIR, { recursive: true });

for (const [repo, branch, name] of CORPUS.repos) {
  const into = join(CORPUS.dir, name);
  if (existsSync(join(into, 'data'))) {
    console.log(`${name}: already extracted, skipping`);
    continue;
  }

  // Tarballs from different branches of the same work must not collide.
  const tarball = join(TARS_DIR, `${CORPUS.name}-${name}.tar.gz`);
  process.stdout.write(`${name}: downloading ${repo}#${branch} … `);
  await download(repo, branch, tarball);
  console.log(`${(statSync(tarball).size / 1e6).toFixed(0)} MB`);

  mkdirSync(into, { recursive: true });
  extract(tarball, into);
  console.log(`${name}: ${texts(into).length.toLocaleString()} texts`);
}

const all = texts(CORPUS.dir);
const bytes = all.reduce((total, file) => total + statSync(file).size, 0);
console.log(
  `\n${CORPUS.name}: ${all.length.toLocaleString()} texts, ${(bytes / 1e6).toFixed(0)} MB in ${CORPUS.dir}`,
);
console.log(
  `${readdirSync(TARS_DIR).length} tarballs kept in ${TARS_DIR}; delete them if you want the space`,
);
