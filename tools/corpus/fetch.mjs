/**
 * Download a CTS corpus into `.corpus/`, keeping only `data/`.
 *
 * Tarballs rather than clones: no history, one request each, and `data/` is the
 * only part with editions in it. Idempotent — a corpus already extracted is
 * skipped, so this is safe to run before every parse run.
 *
 *   node tools/corpus/fetch.mjs                      # the released branches
 *   node tools/corpus/fetch.mjs --corpus=normalized  # Perseus's working branches
 *   node tools/corpus/fetch.mjs --refetch            # re-download even if present
 *
 * Each repository's commit is resolved before download and written beside it as
 * `.source.json`, which is what lets a manifest name the exact corpus it was
 * generated from rather than a branch that has since moved.
 *
 * Needs `tar` on PATH. Nothing is written outside `.corpus/`, which is ignored
 * by git; delete that directory to reclaim the ~1.2 GB each corpus costs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpus, sourceFile, TARS_DIR, texts } from './paths.mjs';

const CORPUS = corpus();
const REFETCH = process.argv.includes('--refetch');

/**
 * Resolve a branch to the commit it points at, before downloading it.
 *
 * A branch name alone does not identify what was parsed, so this is what makes
 * a manifest reproducible. It is one unauthenticated API call per repository —
 * well inside the rate limit — and a failure here is not fatal: the corpus is
 * still worth having without the label, and the manifest says `commit: null`
 * rather than implying a provenance nobody established.
 */
async function resolveCommit(repo, branch) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'tei-cts-corpus-harness' },
    });
    if (!response.ok) return null;
    const commit = await response.json();
    return { commit: commit.sha, committed: commit.commit?.committer?.date ?? null };
  } catch {
    return null;
  }
}

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

  if (existsSync(join(into, 'data')) && !REFETCH) {
    // An extraction from before provenance was recorded is still perfectly good
    // data — it just cannot say which commit it is, and no amount of inspecting
    // it now would establish that. Say so once, here, rather than letting the
    // manifest report a null nobody can explain.
    const known = existsSync(sourceFile(CORPUS, name));
    console.log(
      `${name}: already extracted, skipping` +
        (known ? '' : ' — downloaded before its commit was recorded, so re-fetch to capture it'),
    );
    continue;
  }

  // Resolved before the download, so the commit named is the tip the tarball is
  // built from rather than whatever the branch moved to while it transferred.
  const source = await resolveCommit(repo, branch);

  // Tarballs from different branches of the same work must not collide.
  const tarball = join(TARS_DIR, `${CORPUS.name}-${name}.tar.gz`);
  process.stdout.write(
    `${name}: downloading ${repo}#${branch}${source ? ` @ ${source.commit.slice(0, 7)}` : ''} … `,
  );
  await download(repo, branch, tarball);
  console.log(`${(statSync(tarball).size / 1e6).toFixed(0)} MB`);

  if (REFETCH) rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  extract(tarball, into);
  writeFileSync(
    sourceFile(CORPUS, name),
    JSON.stringify(
      { name, repo, branch, commit: null, committed: null, ...source, fetched: new Date().toISOString() },
      null,
      2,
    ) + '\n',
  );
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
