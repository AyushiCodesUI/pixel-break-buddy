# Pixel Break Buddy: local macOS build

The local build is an Apple Silicon (arm64) app, version 1.0.0, with bundle ID `com.pixelbreakbuddy.app`.

**App:** `dist/mac-arm64/Pixel Break Buddy.app`

Open the project in Finder, open `dist/mac-arm64`, and double-click **Pixel Break Buddy.app**. You can copy the complete `.app` to Applications. It includes Electron and its own runtime; Node.js, npm, Cursor, Codex, and Terminal are not needed to run it.

The mascot stays hidden during a work session. A monochrome pixel Buddy icon remains in the macOS menu bar, using template rendering for light/dark mode and a Retina companion. Click it for live timer status, Pause/Resume Timer, Take a Break Now, Restart Session, Customize Mascot, Settings, and Quit. Pausing freezes the countdown and reminder mood progression; resuming preserves remaining time. Restart Session begins a fresh work session. The application menu also offers **Settings…**, **Customize Mascot…**, and **Quit**. Settings is also available with **⌘,** while the app is active. Closing a settings window leaves reminders running; **⌘Q** quits the application. A second executable instance is rejected and focuses Settings in the original process instead of starting another timer.

## Preferences

Both development and packaged runs retain the existing folder:

`~/Library/Application Support/pixel-break-buddy/`

Application preferences are in `application-preferences.json`; mascot preferences are in `mascot-preferences.json`. The app never writes preferences into its bundle. Explicit isolated test paths are respected.

## Quick packaged-app test

1. Quit any running copy with **⌘Q**.
2. To run the packaged app with the existing accelerated timings, run this once:

   ```sh
   open -n "dist/mac-arm64/Pixel Break Buddy.app" --args --test-mode
   ```

3. The first reminder starts after 20 seconds. Watch the two-second walking entrance and Happy pose. Annoyed follows 5 seconds after the reminder starts; Angry follows at 10 seconds.
4. Open Settings, enable Reminder Sounds, choose a volume, and save. Preview all three sounds. Changes to production durations do not affect test timings.
5. Test bubble toggling, the 10-second snooze, and the 15-second break countdown. The break should end in another 20-second work session.
6. Open Customize Mascot and check size/personality updates. Reopen both windows and confirm preferences persist.
7. Open a second copy: it should reuse the first process. Quit, then launch normally from Finder to return to production timing.

The `open` command hands the app to macOS; Terminal can close afterward. The development command `npm run test-mode` remains available too.

## Immediate reminder preview in normal mode

Click the menu-bar Buddy icon → **Show Test Reminder Now**. It uses the normal entrance, Happy expression, bubble, and sound (if enabled at a nonzero volume). Annoyed starts at 5 seconds and Angry at 10 seconds, with the existing expression animations and settled sounds. A visible test label distinguishes this preview from a real reminder.

Choose **End Test Reminder** to restore the real session. Break and Snooze buttons also end this temporary preview without changing the real session. Pause/Resume, Break Now, Restart, and repeated preview requests are disabled during the preview to prevent accidental changes. The real timer continues in the background, preserving its original deadline and pause state; if it becomes due while testing, its real reminder is shown when the preview ends. No preview state is saved and no additional interval or window is created.

For visibility checks, switch between Chrome, Finder, Figma, and ChatGPT; switch desktop Spaces and try full-screen applications. Check both the mascot and bubble, click-through empty areas, and whether the active app retains keyboard focus. The existing floating/all-workspaces/full-screen window configuration is preserved. These settings do not prove real visibility across every application: user verification is required.

To replace an installed copy:

1. Quit Pixel Break Buddy from its tray menu.
2. In Finder, copy the rebuilt `dist/mac-arm64/Pixel Break Buddy.app` into the folder containing your installed app (usually Applications), and choose **Replace**. Copy the whole app bundle.
3. Open that installed copy. Preferences remain in the existing userData folder. Leave the app at the same permanent path; check Launch at Login in Settings and macOS Login Items, especially if you moved it to a new location.
4. Use the tray preview without launching with `--test-mode`. Choose End Test Reminder when done.

## Launch at Login

Use Settings in the packaged app, enable **Launch at Login**, and save. Check **System Settings → General → Login Items**. To verify a real login launch, log out and log in when convenient. Move the app to its intended permanent location before enabling this setting; moving or deleting a registered app can invalidate its login entry.

## Local signing and Gatekeeper

This build is **ad-hoc signed**, without a paid Apple certificate, notarization, public distribution, publishing, or auto-updates. Code-signature verification can pass while Gatekeeper assessment rejects it because it is not an identified/notarized distribution build.

If macOS blocks this locally built app, first attempt opening it, then use **System Settings → Privacy & Security → Open Anyway** for this specific app. Do not disable Gatekeeper globally. See [Apple's instructions](https://support.apple.com/en-us/102445).

## Rebuilding

The project uses electron-builder 26.18.0 and Electron 45.3.4 (pinned). macOS 13 or newer is required. The Electron npm package requires Node.js 22.12 or newer for development; the standalone app bundles its own runtime.

```sh
npm ci
npm test
npm run build:mac
node scripts/verify-package.cjs
```

`npm run build:icon` regenerates the temporary icon from the existing Happy PNG. The production icon can replace `build/icon.icns` later. Python and the native `iconutil` command are used only to regenerate this development asset, never by the standalone app.

The archive includes runtime HTML/CSS/JavaScript and all five PNGs in `assets/mascot`, plus the two template icons in `assets/tray`. Original sounds are synthesized locally by `emotion-audio.js`; there are no external sound downloads. Tests, preparation scripts, duplicate `assets:mascot` files, and development dependencies are excluded.

## Security scope

The runtime has been upgraded to Electron 45.3.4. The full npm audit now reports 11 affected build-tool entries (6 high, 5 moderate), rooted in minimatch and picomatch denial-of-service advisories; Electron is no longer flagged. These build dependencies are excluded from the packaged app. Production-only npm audit reports zero findings; see [the migration report](release-audit/MIGRATION.md) for the important distinction between npm dependency classification and the bundled Electron runtime. No forced fixes or major build-tool downgrades were applied.

## Verification performed on this Mac

See `release-audit/MIGRATION.md` for the Electron 45 migration. The project creator reports all seven post-upgrade manual acceptance tests passed. New Macs and downloaded beta copies still require testing.

- 39 automated tests passed, including tray singleton/menu actions, pause/resume timing, and template icon dimensions.
- ARM64 executable, bundle identifier/version, valid deep ad-hoc signature, 24 runtime files, five byte-identical mascot PNGs, and both template icons verified.
- The standalone app launched through macOS Launch Services with isolated preferences. Settings, customization, previews, six walking frames, all three automatic emotion cues, snooze, break/reset, second-instance rejection, and clean quit passed.
- A normal Finder/Launch Services relaunch restored production timing and used the existing `~/Library/Application Support/pixel-break-buddy` folder. The app remained running after its external test controller exited.
- Launch at Login is currently enabled. Tray validation reads its state without changing the registration. A real logout/login was not performed.
- Gatekeeper assessment rejected this non-notarized local build, as expected.
