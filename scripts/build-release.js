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
  "game.js",
  "game.json",
  "project.config.json",
  "js/logic.js"
];

var fullFiles = [
  "game.js",
  "game.json",
  "project.config.json",
  "README.md",
  "package.json",
  "open-in-wechat-devtools.command",
  "js",
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
zip(releaseDir, releaseZip, ["game.js", "game.json", "project.config.json", "js"]);
zip(root, fullZip, fullFiles);

console.log("release project:", releaseDir);
console.log("release zip:", releaseZip);
console.log("full zip:", fullZip);
