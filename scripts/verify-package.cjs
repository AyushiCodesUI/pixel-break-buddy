const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const asar = require("@electron/asar");
const root = path.resolve(__dirname, "..");
const app = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "dist/mac-arm64/Pixel Break Buddy.app");
const metadata = require(path.join(root, "package.json"));
const contents = path.join(app, "Contents");
const archive = path.join(contents, "Resources/app.asar");
const files = asar.listPackage(archive);
const runtime = fs.readdirSync(root).filter(name => /\.(js|html|css)$/.test(name) && !name.endsWith(".test.js"));
for (const name of runtime) {
  assert.ok(files.includes(`/${name}`), `Missing ${name}`);
  assert.deepEqual(asar.extractFile(archive, name), fs.readFileSync(path.join(root, name)), `Outdated ${name}; rebuild the app`);
}
const notices = ["LICENSE", "LICENSE-SCOPE.md", "ASSET-LICENSE.md", "THIRD-PARTY-NOTICES.md"];
for (const name of notices) {
  assert.deepEqual(asar.extractFile(archive, name), fs.readFileSync(path.join(root, name)), `Missing or outdated notice: ${name}`);
}
const allowed = new Set([...runtime, "package.json", ...notices].map(name => `/${name}`));
for (const file of files) {
  if (file === "/assets" || file === "/assets/mascot" || file === "/assets/tray") continue;
  assert.ok(allowed.has(file) || /^\/assets\/(mascot|tray)\/[^/]+\.png$/.test(file), `Unexpected private/development file in archive: ${file}`);
}
const bundledMetadata = JSON.parse(asar.extractFile(archive, "package.json"));
assert.equal(bundledMetadata.version, metadata.version);
for (const [name, config] of Object.entries(bundledMetadata)) {
  assert.ok(!/token|password|secret|credential/i.test(name), `Unexpected credential key: ${name}`);
}
for (const name of ["LICENSE.electron.txt", "LICENSES.chromium.html"]) {
  assert.ok(fs.statSync(path.join(contents, "Resources", name)).size > 0, `Missing upstream notice: ${name}`);
}
const images = fs.readdirSync(path.join(root, "assets/mascot")).filter(name => name.endsWith(".png"));
for (const name of images) {
  assert.deepEqual(asar.extractFile(archive, `assets/mascot/${name}`), fs.readFileSync(path.join(root, "assets/mascot", name)), `Image changed: ${name}`);
}
const trayImages = ["buddyTemplate.png", "buddyTemplate@2x.png"];
for (const name of trayImages) {
  assert.deepEqual(asar.extractFile(archive, `assets/tray/${name}`), fs.readFileSync(path.join(root, "assets/tray", name)), `Tray image changed: ${name}`);
}
assert.ok(files.every(name => !name.includes(".test.js") && !/^\/(scripts|node_modules|assets:mascot)\//.test(name)), "Development files must not ship");
const info = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", path.join(contents, "Info.plist")], { encoding: "utf8" }));
assert.equal(info.CFBundleIdentifier, "com.pixelbreakbuddy.app");
assert.equal(info.CFBundleShortVersionString, metadata.version);
assert.equal(info.CFBundleDisplayName, "Pixel Break Buddy");
assert.equal(info.LSMinimumSystemVersion, "13.0.0");
const frameworkInfo = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", path.join(contents, "Frameworks/Electron Framework.framework/Resources/Info.plist")], { encoding: "utf8" }));
assert.equal(frameworkInfo.CFBundleVersion, "45.3.4");
assert.match(execFileSync("file", [path.join(contents, "MacOS/Pixel Break Buddy")], { encoding: "utf8" }), /arm64/);
execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "pipe" });
console.log(`Verified ${runtime.length} runtime files, ${images.length} unchanged mascot PNGs, ${trayImages.length} template icons, app metadata, arm64 executable, and valid code signature.`);
console.log(app);
