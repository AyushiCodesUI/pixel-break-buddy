# Third-party notices

Pixel Break Buddy uses Electron 45.3.4 and its Chromium/Node.js runtime. Electron's
license and bundled third-party notices are independent of this project's licenses.

A packaged app includes these upstream files under Contents/Resources/:

- LICENSE.electron.txt
- LICENSES.chromium.html

Preserve both files and all other upstream notices when copying, archiving, or
sharing the complete .app. Do not distribute only the executable. The project does
not replace upstream licenses with MIT or the visual asset notice.

Development and packaging use electron-builder and its transitive packages. Their
license declarations and installed LICENSE/NOTICE files remain authoritative;
package-lock.json records resolved versions and available license metadata. Preserve
relevant upstream notices if redistributing those tools separately. node_modules
and packaging tools are excluded from this source repository and app runtime.

The UI references macOS system fonts and generic fallbacks; no font binary is
redistributed. Emotion sounds are synthesized locally using Web Audio, without
external audio samples. Mascot provenance and separate permissions are documented
in ASSET-LICENSE.md.

Product and company names mentioned in the documentation identify tools or testing
environments and do not imply sponsorship or endorsement.
