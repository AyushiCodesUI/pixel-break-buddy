# Public repository and friends beta audit

Date: 2026-11-18. Electron 45.3.4 / electron-builder 26.18.0; Apple Silicon, macOS 13+. The owner reports all seven post-upgrade manual tests passed. Dependencies, runtime behavior, artwork, settings, and the built app remain unchanged. Repository cleanup and separate code/asset notices have since been prepared with owner approval; nothing has been published.

## 1. Dependency findings

Fresh full npm audit matches the migration report: **11 affected package entries, 6 high / 5 moderate**, representing **two underlying advisories**. Production-only npm audit reports zero. Electron is a devDependency but its runtime ships, so production-only audit alone is insufficient; the full audit currently has no Electron finding.

All entries below are **development-installed build/packaging dependencies**, not application production runtime dependencies. They are absent from the distributed app's ASAR; the app bundles Electron separately. The inspected ASAR contains application JS/HTML/CSS, package metadata, and mascot/tray PNGs, with no node_modules. Development tooling is not shipped in Electron Framework either.

Path shorthand: `B` = electron-builder@26.18.0; `L` = B → app-builder-lib@26.18.0; `R` = L → @electron/rebuild@4.2.1 → node-gyp@12.4.0 → tinyglobby@0.2.17.

| Affected package/version | npm severity | Dependency path | Underlying advisory |
|---|---|---|---|
| electron-builder 26.18.0 | Moderate | B | M/P, inherited |
| app-builder-lib 26.18.0 | High | L; B → dmg-builder → app-builder-lib | M/P, inherited |
| @electron/rebuild 4.2.1 | High | L → @electron/rebuild | P, inherited |
| @electron/universal 2.0.3 | Moderate | L → @electron/universal | M, inherited |
| dmg-builder 26.18.0 | Moderate | B → dmg-builder; L → dmg-builder | M/P through app-builder-lib |
| electron-builder-squirrel-windows 26.18.0 | Moderate | L → electron-builder-squirrel-windows → app-builder-lib | M/P, inherited |
| node-gyp 12.4.0 | High | R up to node-gyp | P, inherited |
| tinyglobby 0.2.17 | High | R | P, inherited |
| fdir 6.5.0 | High | R → fdir | P, inherited |
| picomatch 4.0.7 | High | R → picomatch; R → fdir → picomatch | P, direct |
| minimatch 10.2.6 and 9.0.9 | Moderate | L → minimatch (10); L → @electron/universal → minimatch (9) | M, direct |

- **M:** [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249): globparts amplification denial of service; affected >=7.0.0, <11.0.1. The other installed minimatch versions (3.1.5, 5.1.9) are outside this advisory range.
- **P:** [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): repeated-extglob regex denial of service; affected <=4.0.7.

The parent severities above reproduce npm's output; they are not separate exploitable bugs in each parent. See `release-audit/npm-audit-public-review.json` for every installed node path and npm's propagated dependency graph.

### Remediation decision

`npm outdated` returns an empty result for the direct dependencies. Registry checks return electron-builder 26.18.0, picomatch 4.0.7, and minimatch 11.0.9 as latest. No compatible update within the current vulnerable minimatch major ranges fixes M; no patched picomatch is currently available in the registry.

A cross-major minimatch override to 11.0.9 could address M but changes both the builder's ^10.2.5 dependency and universal's 9.x dependency. It requires focused file-glob/packaging compatibility tests and a rebuild; do not treat it as a safe patch update. @electron/universal 3.0.6 removes its direct minimatch dependency, but upgrading the builder's 2.x dependency is also a major override and does not resolve the builder's own minimatch use or P. npm's suggested downgrade to builder 25.1.0 is not recommended without justification.

**Smallest safe proposal:** retain current dependencies for now, document the build-time exception, monitor patched upstream releases, and keep the lockfile. No force fix, downgrade, override, or package installation was performed. If a minimatch override is approved later, test matching/exclusion behavior, run the complete tests and audit, rebuild, and verify the ASAR asset allowlist before accepting it. P would remain until a patched upstream version becomes available.

**Remaining developer/CI risk:** malicious glob expressions from untrusted source/configuration can consume CPU/memory or stall packaging/scanning. Current globs are project-controlled; there is no app UI passing user glob expressions to these packages. Do not run untrusted PR packaging jobs with signing secrets or write-capable tokens. Use isolated runners, least privilege, execution timeouts, and review build configuration/dependency changes. These measures reduce exposure rather than remove the advisories. Ordinary friend beta users do not execute these build modules.

## 2. GitHub safety

- No credential/private-key/provider-token patterns were detected in project text, the source backups, or text Git blobs. No .env, .npmrc, signing-key/certificate, provisioning-profile, or local preference files were found in the project. Pattern scanning is not proof that every possible secret is absent; binary contents and external folders are outside its guarantees.
- Git has zero commits, zero tracked files, no remotes, and an empty reflog. Its object database nevertheless contains 167 blobs and 37 trees from prior local operations; scanned text objects had no credential-pattern hits, but nine contain machine-specific user paths. Ordinary pushes send referenced history, not these unreferenced objects. Do not upload the .git directory as an archive or use a filesystem mirror as the public artifact.
- Personal account/home-folder paths were removed from publishable packaging/migration documentation. Raw signing/verification reports and packaged-workflow JSON are now excluded through .gitignore; local originals remain on disk. The package lock's maintainer email is upstream metadata, not the owner's credential. Retina icon filenames were false-positive email matches.
- The improved .gitignore excludes dependencies, generated app bundles, backups, duplicate artwork, logs, local preference files, credential patterns, and raw machine reports. Review the publish manifest before staging any files.
- Source assets are about 5.4 MB; the app icon is about 920 KB. They are reasonable repository assets after rights clearance. Duplicate `assets:mascot/` is about 3.3 MB and is excluded from the app; omit it from the public repo to avoid duplication. Backups are about 18 MB, dist about 263 MB, and node_modules about 362 MB: keep these out of Git.

Representative exclusions now applied:

```gitignore
backups/
assets:mascot/
*.log
npm-debug.log*
coverage/
.env
.env.*
!.env.example
*.p12
*.pfx
*.pem
*.key
*.mobileprovision
*.provisionprofile
application-preferences.json
mascot-preferences.json
release-audit/packaged-*.json
release-audit/code-signing.txt
release-audit/package-verification.txt
```

Keep package-lock.json, build/icon.icns, scripts, and tests. Do not blanket-ignore build/ because its icon is an input. Excluding files does not remove already committed history; there are currently no commits here.

**Safe publication candidates after review:** root runtime JS/HTML/CSS, test files, scripts, package.json/package-lock.json, improved .gitignore, sanitized documentation/audit summaries, and rights-cleared runtime images/icon. README.md, LICENSE (MIT source), LICENSE-SCOPE.md, ASSET-LICENSE.md, and THIRD-PARTY-NOTICES.md are now present. Separate visuals are excluded from MIT. Media now includes a GIF derived from the working-app recording and its unchanged original MP4; no screenshots were fabricated. The original full desktop recording needs privacy review before public upload.

## 3. Asset rights inventory

| Asset | Provenance supported by project | Rights status / action |
|---|---|---|
| assets/mascot/state-happy.png, state-annoyed.png, state-angry.png | User-supplied custom PNGs, retained unchanged | Owner confirms ChatGPT generation and intended app/repository distribution. Covered by the separate ASSET-LICENSE.md permission, not MIT. |
| assets/mascot/walking.png | User-supplied six-frame sheet | Owner confirms ChatGPT generation based on their original mascot design; separate asset notice applies. |
| assets/mascot/walking-aligned.png | Local alignment derivative of walking.png | Inherits the source sheet's restrictions. |
| build/icon.icns | Locally generated derivative of Happy PNG via create-icon.py | Inherits Happy artwork rights. |
| assets/tray/buddyTemplate.png and buddyTemplate@2x.png | Locally drawn pixel grid recorded in create-tray-icon.py | No external source identified; separate asset notice applies. |
| Buddy/Cat/Bunny vectors and accessories in mascot-art.js | Code-defined pixel art in the project | No external attribution found; MIT source-code scope applies; no independent third-party clearance is implied. |
| Happy/Annoyed/Angry sounds in emotion-audio.js | Locally synthesized Web Audio note definitions; no audio samples or downloads | No external sound assets identified; MIT source-code scope applies. |
| Fonts | -apple-system, BlinkMacSystemFont, ui-monospace, Menlo, generic fallbacks | OS-installed fonts referenced only; no font binaries, @font-face, or font downloads bundled. |
| assets:mascot/* duplicates/source copies | Duplicate state art and original named walking sheet | Same recorded ChatGPT provenance; duplicate folder is excluded from Git. |
| Electron/Chromium runtime and dependencies | Third-party software | Packaged Resources contains LICENSE.electron.txt and LICENSES.chromium.html. Preserve them when sharing the entire .app; they do not license the mascot or application source. |

No embedded PNG text/EXIF metadata was detected in the seven runtime PNGs. That does not establish authorship or licensing. No documented third-party stock images, external music, font assets, or animation libraries were found beyond the runtime/tooling. The owner has confirmed ChatGPT provenance. Retain generation records and review applicable service terms and any third-party references. This records provenance and permission intent, not a guarantee of uniqueness, copyright eligibility, or noninfringement.

## 4. Readiness and approval boundary

**Public GitHub: ready for the owner’s final content/license review, not yet published.** Approved cleanup is complete: portable documentation, improved exclusions, README, MIT source scope, separate visual asset notice, third-party notice guidance, and screenshot/demo folders. Confirm that the asset permission's project-specific scope reflects the intended reuse policy. A real recording and GIF have since been supplied; review the full recording’s visible account/sidebar and project information before uploading it. Original artwork generation records are not included. Review the Git candidate manifest and licenses before the first commit.

**Limited unnotarized beta: technically tested; ready for owner review before sharing.** The creator reports all seven post-upgrade acceptance tests passed. Preserve the complete app and upstream notices, and include the newly prepared source/asset notice documents alongside it. No rebuild was done for documentation changes. Confirm a feedback route and test a downloaded/quarantined copy on another Mac before sending it more widely; local success does not prove Gatekeeper acceptance or another Mac's login registration.

The app is ad-hoc signed, not Developer ID signed/notarized, and has no automatic updates. Recipients may need macOS Privacy & Security → Open Anyway for this specific trusted app; never disable Gatekeeper globally. [Apple guidance](https://support.apple.com/en-us/102445). This is distinct from public App Store/distribution readiness.

Remaining build-tool advisories are unchanged. No dependency override, forced fix, downgrade, application rebuild, commit, push, release, or distribution was performed during repository cleanup. Review instructions are in docs/REPOSITORY-REVIEW.md.
