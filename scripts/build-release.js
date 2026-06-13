"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-star-defense-release");
var releaseZip = path.join(outputRoot, "wechat-mini-star-defense-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-star-defense.zip");

var releaseFiles = [
  "app.json",
  "game.js",
  "game.json",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "project.config.json",
  "js/cloud-state.js",
  "js/cloud-config.js",
  "js/session-ui.js",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "js/logic.js"
];

var fullFiles = [
  "app.json",
  "game.js",
  "game.json",
  "project.config.json",
  "README.md",
  "package.json",
  "open-in-wechat-devtools.command",
  "cloudfunctions",
  "js",
  "pages",
  "scripts",
  "test",
  "preview"
];

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function assertExists(file) {
  if (!fs.existsSync(file)) throw new Error("missing file: " + file);
}

function copyFile(relative) {
  var from = path.join(root, relative);
  var to = path.join(releaseDir, relative);
  assertExists(from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function zip(cwd, output, files) {
  remove(output);
  childProcess.execFileSync("zip", ["-qr", output].concat(files), { cwd: cwd, stdio: "pipe" });
}

remove(releaseDir);
fs.mkdirSync(releaseDir, { recursive: true });
releaseFiles.forEach(copyFile);
zip(releaseDir, releaseZip, ["app.json", "game.js", "game.json", "project.config.json", "cloudfunctions", "js", "pages"]);
zip(root, fullZip, fullFiles);

console.log("release project:", releaseDir);
console.log("release zip:", releaseZip);
console.log("full zip:", fullZip);
