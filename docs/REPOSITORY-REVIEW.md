# Review before the first public upload

No commit, push, repository creation, or release was performed during cleanup.
Dependencies and the built app are unchanged. The local Git repository currently
has no commits; local unreferenced objects are not a substitute for project history.

## Review content first

Read README.md, LICENSE, LICENSE-SCOPE.md, ASSET-LICENSE.md,
THIRD-PARTY-NOTICES.md, PUBLIC-RELEASE-AUDIT.md, and PACKAGING.md. In particular,
confirm that visual asset permission is intended for distribution with Pixel Break
Buddy, not an unrestricted standalone artwork license. Keep original generation
records locally. Confirm any public attribution/name you want before adding it.

Media folders contain guidance only. Add actual screenshots/demo later after a
privacy and rights review. There are no invented research results, usage metrics,
release links, or product endorsements.

## Preview the files Git would include

Run these from the project root; none uploads or stages files:

```sh
git status --short
git ls-files --cached --others --exclude-standard
git status --short --ignored
npm test
```

The generated docs/PUBLISH-MANIFEST.md records the reviewed file list, but always
check the live list again before committing. node_modules, dist, backups, logs,
local preferences, credentials, duplicate artwork, and raw machine reports must
stay excluded. build/icon.icns, assets/, package-lock.json, source, and tests should
remain visible. .gitignore applies to Git operations; it does not filter a Finder
ZIP of the entire folder or GitHub's browser uploader. Do not upload the whole
working folder or its hidden .git directory. Prefer a reviewed Git commit later.

Local .git contains unreferenced objects from earlier work; some contain machine
paths. Ordinary pushes publish referenced commit history, not these objects. Do not
copy or archive .git for publication. No local object cleanup was performed.

## After reviewing, stage only when you choose

When ready, you can stage the reviewed files and inspect them before committing:

```sh
git add --dry-run .
# Only after reviewing the dry run:
git add .
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Staging is local and reversible; these commands do not publish. Check staged
filenames and text for personal data, credentials, unwanted binaries, and raw
reports. Inspect PNGs/icon visually because a text diff cannot show their contents.
Choose the Git commit identity intentionally. Do not put secrets in README examples.

Publication and friends-beta distribution remain separate explicit steps. See
BETA.md before preparing an archive; include license notices alongside the complete
app and preserve upstream notices inside it.
