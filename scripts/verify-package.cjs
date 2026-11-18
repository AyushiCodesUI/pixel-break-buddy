const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const asar = require("@electron/asar");
const root = path.resolve(__dirname, "..");
const app = path.join(root, "dist/mac-arm64/Pixel Break Buddy.app");
const contents = path.join(app, "Contents");
const archive = path.join(contents, "Resources/app.asar");
const files = asar.listPackage(archive);
const runtime = fs.readdirSync(root).filter(name => /\.(js|html|css)$/.test(name) && !name.endsWith(".test.js"));
for (const name of runtime) {
  assert.ok(files.includes(`/${name}`), `Missing ${name}`);
  assert.deepEqual(asar.extractFile(archive, name), fs.readFileSync(path.join(root, name)), `Outdated ${name}; rebuild the app`);
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
assert.equal(info.CFBundleShortVersionString, "1.0.0");
assert.equal(info.CFBundleDisplayName, "Pixel Break Buddy");
assert.equal(info.LSMinimumSystemVersion, "13.0.0");
const frameworkInfo = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", path.join(contents, "Frameworks/Electron Framework.framework/Resources/Info.plist")], { encoding: "utf8" }));
assert.equal(frameworkInfo.CFBundleVersion, "45.3.4");
assert.match(execFileSync("file", [path.join(contents, "MacOS/Pixel Break Buddy")], { encoding: "utf8" }), /arm64/);
execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "pipe" });
console.log(`Verified ${runtime.length} runtime files, ${images.length} unchanged mascot PNGs, ${trayImages.length} template icons, app metadata, arm64 executable, and valid code signature.`);
console.log(app);
