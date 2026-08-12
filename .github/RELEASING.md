# Releasing

```bash
npm version <version> --no-git-tag-version
# date the version's section in CHANGELOG.md
git commit -am "Release <version>"
git tag v<version>
git push origin main --tags
```

The tag runs [`release.yml`](workflows/release.yml), which re-runs the checks, refuses if the tag and
`package.json` disagree, and publishes with provenance. Run it from **Actions → Release → Run
workflow** to exercise everything except the publish step.

Needs a repository secret `NPM_TOKEN` holding an npm **automation** token — those bypass the 2FA
prompt, which is what lets CI publish.

While the major version is `0`, a breaking change bumps the minor. Note that the element policy's
defaults are observable behaviour: changing what `defaultElementPolicy` drops changes the text every
consumer gets.
