# Limited friends beta

The Apple Silicon build requires macOS 13+. It is locally ad-hoc signed, unnotarized,
and has no automatic updates. The project has not published a release or download.

## Before sharing

- Review the source and asset notices, known build-time security exception, and the
  exact app version. Preserve the upstream notices inside the complete .app.
- Include LICENSE, LICENSE-SCOPE.md, ASSET-LICENSE.md, and THIRD-PARTY-NOTICES.md
  alongside the app in any future beta archive. The current already-built app has
  not been rebuilt to incorporate the newly added project documentation.
- Do not include preferences, node_modules, backups, logs, or local verification data.
- Prepare a checksum of the final archive and provide it through the same trusted
  communication used to share the beta. Choose a feedback contact before sending it.
- Test an actually downloaded/quarantined copy on another Mac. Passing local tests
  does not guarantee another Mac's Gatekeeper or login-item behavior.

## Installing or replacing a copy

Quit Pixel Break Buddy from its menu-bar menu. Copy the entire .app into Applications,
replacing the prior copy if appropriate, then double-click it in Finder. For a blocked
trusted beta, use [Apple's specific-app instructions](https://support.apple.com/en-us/102445).
Do not disable Gatekeeper globally. Put the app at its final path before enabling
Launch at Login; check System Settings → General → Login Items.

## Acceptance checklist

Use Show Test Reminder Now; check walking, Happy, Annoyed at 5 seconds, Angry at 10
seconds, bubble, enabled sound, and End Test Reminder. Switch apps, desktop Spaces,
and full-screen windows. Check pause/resume, real break/snooze, settings persistence,
relaunch, sleep/wake, and monitor changes. Report macOS version, display setup,
steps, expected behavior, and actual behavior; omit personal data from screenshots.

Quitting and relaunching exits --test-mode. In normal operation an active session
starts fresh on relaunch; settings persist. Quitting is the way to stop reminders.

## Removing the beta

Disable Launch at Login first, quit the app, and remove it from Applications. If a
login item remains, remove it in macOS Login Items. Preferences remain at
`~/Library/Application Support/pixel-break-buddy/`; delete that folder only if you
intentionally want to discard your saved settings. Never remove it just to update.
