# Publish candidate manifest

Reviewed local Git candidates after cleanup, updated to include the two recorded demo assets (68 files). The unchanged full MP4 contains account/sidebar and project information: review it before public upload. No files were staged or committed.
Regenerate the live list using `git ls-files --cached --others --exclude-standard`
before publishing; new files can change this snapshot. This list is not a command
to upload the entire working folder.

```text
docs/releases/v1.0.0-beta.1.md
.gitignore
ASSET-LICENSE.md
LICENSE
LICENSE-SCOPE.md
PACKAGING.md
PUBLIC-RELEASE-AUDIT.md
README.md
THIRD-PARTY-NOTICES.md
application-main.test.js
application-preferences.js
application-preferences.test.js
application-preload.js
application-settings.css
application-settings.html
application-settings.js
assets/mascot/state-angry.png
assets/mascot/state-annoyed.png
assets/mascot/state-happy.png
assets/mascot/walking-aligned.png
assets/mascot/walking.png
assets/tray/buddyTemplate.png
assets/tray/buddyTemplate@2x.png
bootstrap.js
bootstrap.test.js
build/icon.icns
customization.test.js
docs/BETA.md
docs/PUBLISH-MANIFEST.md
docs/README.md
docs/REPOSITORY-REVIEW.md
docs/demo/README.md
docs/demo/pixel-break-buddy-demo.mp4
docs/demo/pixel-break-buddy-preview.gif
docs/screenshots/README.md
emotion-audio.js
emotion-audio.test.js
emotions.js
emotions.test.js
entrance.js
entrance.test.js
index.html
login.js
main.js
main.test.js
mascot-art.js
mascot-images.js
mascot-images.test.js
package-lock.json
package.json
preferences.js
preload.js
release-audit/MIGRATION.md
renderer.js
renderer.test.js
scripts/create-icon.py
scripts/create-tray-icon.py
scripts/prepare-walking.py
scripts/verify-package.cjs
settings-preload.js
settings.css
settings.html
settings.js
styles.css
timer.js
timer.test.js
tray.js
tray.test.js
```

Excluded locally: node_modules/, dist/, backups/, assets:mascot/, credential patterns,
logs, local preferences, and raw release-audit output. These files remain on disk;
exclusion does not delete them. Only sanitized release-audit Markdown is a candidate.

Required source inputs retained: package-lock.json, all runtime JS/HTML/CSS, tests,
the seven assets PNGs, build/icon.icns, and preparation/verification scripts.
The additional GIF and original MP4 are explicitly included as demo media.

## Recorded checks

- No personal home-folder or temporary test paths found in publishable text.
- The text scan does not cover visible desktop information or audio in recordings.
- No provider-token, credential-assignment, or private-key patterns found in the
  scanned candidate text. Pattern scans cannot guarantee absence of all secrets.
- Runtime source, PNGs, and icon remain unchanged. Beta packaging changes set the root version to 1.0.0-beta.1 in package.json/lock metadata, add a DMG command/configuration, include license notices, and strengthen package verification; dependency entries are unchanged.
- Existing suite: 39 tests passed after documentation cleanup.
- A local beta DMG has since been built and verified. No commit, tag, push, or GitHub Release was created by that process. Git history/object scan results and
  remaining build-tool advisories are documented in ../PUBLIC-RELEASE-AUDIT.md.
