# Electron 45 migration — 2026-11-18

Approved target: Electron 45.3.4, macOS 13+, Apple Silicon. Bundle identifier remains `com.pixelbreakbuddy.app`; app version remains 1.0.0.

## Rollback checkpoint

Before changing dependencies or source, created `backups/pixel-break-buddy-approved-migration-2026-11-18.tar.gz` (source, lockfile, tests, icons, and artwork; excludes dependencies, build output, Git metadata, and other backups).

SHA-256: `f10f1bcc341f59a0f0df81e63602e54208d9cf4f64d11f45e34ebe58ab2467b8`.

To roll back, extract into a separate folder and run `npm ci`; do not extract over a running app or overwrite userData. Saved user preferences are not part of this source archive and were not reset during migration.

## Migration review

Reviewed Electron's major-version breaking changes from 34 through 45 against the application's API usage: https://www.electronjs.org/docs/latest/breaking-changes

- 34–37: no affected Windows/Linux, extension, printing, utility-process, or storage APIs are used. Migrated the deprecated positional `console-message` callback to its event object.
- 38: macOS 11 support removed upstream. No removed plugin or Linux environment APIs are used.
- 39–41: no affected window.open, capture, clipboard, PDF, or cookie APIs are used. Child windows and navigation remain blocked.
- 42: Electron's npm binary download became lazy. electron-builder downloaded the target runtime successfully. No offscreen rendering, native macOS notifications, or affected session APIs are used.
- 43: no affected bitmap conversion, dialog, or extension APIs are used. PNG artwork remains byte-identical.
- 44: minimum macOS version raised to 13 in package metadata. Login integration uses openAtLogin/status and does not use removed openAsHidden/restoreState attributes.
- 45: sandbox preloads only import electron and use supported IPC instance methods. They require none of the removed Node shims/globals. Preference files are outside ASAR and use ordinary fs calls; no native descriptor consumers are used.
- BrowserWindow, Tray, contextBridge/IPC, single-instance lock, floating/all-Spaces visibility, showInactive, application lifecycle, and login APIs remain in use. Renderer Node integration remains disabled, context isolation enabled, and sandboxing explicit for all windows.

## Scope of changes

- `package.json` / `package-lock.json`: exact Electron 45.3.4, macOS minimum 13.0.0; no new direct dependency.
- `main.js`: current console-message signature, explicit mascot sandbox, display topology/metrics listeners and cleanup. Existing primary-display placement policy retained; movement animation still renderer-only. No timer, artwork, UI, login, persistence, or sound design changes.
- `main.test.js`: secure window configuration, display relocation at negative coordinates and after removal, one timer, listener cleanup.
- `application-main.test.js`: screen EventEmitter mock.
- `timer.test.js`: simulated day-long gaps for paused work, overdue work/snooze, and break recovery.
- `scripts/verify-package.cjs`: assert Electron framework version and macOS minimum in addition to existing bundle, assets, ARM64, and signature checks.

## Security audit

Before: 13 affected dependency entries (8 high, 5 moderate), including Electron 33 and extract-zip. After: 11 entries (6 high, 5 moderate); no Electron entry remains. See the before/after JSON reports in this folder. Counts include parent packages affected by the same underlying advisory, not 11 independent defects.

Remaining roots: minimatch glob amplification denial-of-service and picomatch repeated-extglob denial-of-service in electron-builder's development dependency tree. Affected parent entries include app-builder-lib, @electron/rebuild, node-gyp, tinyglobby, fdir, @electron/universal, dmg-builder, electron-builder-squirrel-windows, and electron-builder. These tooling modules are excluded from the packaged runtime.

Registry queries returned electron-builder 26.18.0 and picomatch 4.0.7 as latest. Audit suggested a builder downgrade or a cross-major minimatch override; neither was applied. Avoid forcing these changes without separate packaging validation. Production-only npm audit has zero entries, but this alone does not prove Electron security because Electron is declared under devDependencies. The full audit no longer flags the target Electron version.

The build remains ad-hoc signed, without hardened runtime/notarization, paid credentials, publishing, or auto-updates. Gatekeeper restrictions remain. A stable local candidate is not a public distribution release.

## Validation results

- Baseline: 38 tests passed. Upgraded: 39 tests passed. The additional test simulates long sleep gaps; display-event assertions also extend the existing main-process test.
- `node_modules/.bin/electron --version`: v45.3.4; package-lock pins 45.3.4. `npm run test-mode` remains unchanged.
- Build succeeded via `npm run build:mac`; verification confirms 24 runtime files, five mascot PNGs and two template icons, app identifier/version, Electron framework 45.3.4, minimum macOS 13.0.0, ARM64, and valid deep/strict ad-hoc signature.
- Compared all seven assets PNGs against the pre-migration archive: byte-identical.
- Standalone app launched through macOS Launch Services (the Finder launch mechanism). Isolated packaged checks passed: settings and customization IPC, five sampled walking frames, Happy/Annoyed/Angry sound requests exactly once after settling, snooze, break/reset, single-instance rejection/focus, and quitting. Audio was muted during automation; audible quality requires listening manually.
- Normal-mode tray preview passed: 60-minute work session, walking/Happy, accelerated Annoyed/Angry, one window, floating/all-Spaces flags, preview cancellation, and original countdown restoration.
- macOS still reports Launch at Login enabled. No login registration was toggled. Existing saved preference file hash is unchanged.
- Native tray regression passed: Retina template icon, singleton, live status, Pause/Resume, immediate break, restart, both settings windows, moods, and Quit. Relaunching with the same isolated userData restored saved application and mascot preferences and production timings on Electron 45.3.4.
- Packaged workflow details are in `packaged-workflow-result.json`; all test writes used temporary userData, outside the real preference folder.

## Manual acceptance checks for this candidate

1. Quit all running copies. Copy `dist/mac-arm64/Pixel Break Buddy.app` to the existing installed location (normally Applications), replacing the whole bundle, then double-click it in Finder. Check the tray icon and saved appearance/settings.
2. Use Show Test Reminder Now. Check entrance, Happy bubble and enabled sound, Annoyed at 5 seconds, and Angry at 10 seconds. Switch between Chrome, Finder, Figma, ChatGPT, Spaces, and full-screen windows. Verify no unexpected focus changes. End Test Reminder and check the original work countdown continues.
3. Exercise Pause/Resume, Take a Break Now, Restart Session, Settings, Customize Mascot, and Quit. Quit and reopen: preferences should persist and only one tray icon should appear.
4. For accelerated real break/snooze testing, quit first and run:

   `open -n "dist/mac-arm64/Pixel Break Buddy.app" --args --test-mode`

   Work is 20 seconds, snooze 10 seconds, break 15 seconds. Quit and reopen without arguments afterward to return to normal timing.
5. In test mode, put the Mac to sleep during work or snooze for over 20 seconds and wake it. Expect a fresh Happy reminder when overdue. Repeat during a break (expect fresh work), and with the timer paused (expect unchanged remaining time). Listen for duplicate or delayed audio.
6. Connect/disconnect an external monitor, change the primary screen, resolution, scale, and Dock position while the mascot is visible. Check that it remains in the primary display's work area with crisp art and clickable controls. Simulated display events passed; physical displays were not changed automatically.
7. Verify Launch at Login in Settings and macOS Login Items at the final install path. Log out/in when convenient; actual login launch was not tested automatically.
8. Leave the app in the background for a longer normal work/break cycle to check sustained operation, sounds, CPU, and window behavior. macOS 13 compatibility is based on the runtime requirement; testing occurred on macOS 26.6.2, not on physical macOS 13 hardware.

Update: the project creator subsequently reports all seven post-upgrade manual tests passed. This user-reported result is distinct from the automated checks recorded above; test again on new Macs or downloaded beta copies. Nothing has been published, notarized, or distributed. Gatekeeper may require Privacy & Security → Open Anyway for this local ad-hoc build.
