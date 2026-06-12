"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-star-defense-release");
var releaseZip = path.join(outputRoot, "wechat-mini-star-defense-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-star-defense.zip");

function walk(dir, base, files) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, files);
    else files.push(path.relative(base, full).replace(/\\/g, "/"));
  });
}

assert.ok(fs.existsSync(releaseDir), "release directory missing");
assert.ok(fs.existsSync(releaseZip), "release zip missing");
assert.ok(fs.existsSync(fullZip), "full zip missing");

var files = [];
walk(releaseDir, releaseDir, files);
files.sort();
assert.deepStrictEqual(files, [
  "game.js",
  "game.json",
  "js/logic.js",
  "project.config.json"
], "release should contain only runtime files");

var project = JSON.parse(fs.readFileSync(path.join(releaseDir, "project.config.json"), "utf8"));
assert.strictEqual(project.compileType, "game", "release must be a mini game");
assert.strictEqual(project.appid, "touristappid", "release should import without a private appid");
assert.strictEqual(project.setting.packNpmManually, false, "release should not require npm build");

var game = JSON.parse(fs.readFileSync(path.join(releaseDir, "game.json"), "utf8"));
assert.strictEqual(game.deviceOrientation, "portrait", "game should be portrait");

var gameSource = fs.readFileSync(path.join(releaseDir, "game.js"), "utf8");
var logicSource = fs.readFileSync(path.join(releaseDir, "js/logic.js"), "utf8");
assert.ok(gameSource.indexOf("星港防线") !== -1, "release should contain new game identity");
assert.ok(logicSource.indexOf("TOWER_TYPES") !== -1, "release should include tower-defense systems");
[
  "霓虹贪吃蛇",
  "合成 2048",
  "极速躲避",
  "花房订单",
  "wechat-mini-arcade",
  "wechat-mini-garden-match"
].forEach(function (oldText) {
  assert.strictEqual(gameSource.indexOf(oldText), -1, "old content should not leak: " + oldText);
  assert.strictEqual(logicSource.indexOf(oldText), -1, "old content should not leak: " + oldText);
});
assert.strictEqual(gameSource.indexOf("http://"), -1, "release should not use remote assets");
assert.strictEqual(gameSource.indexOf("https://"), -1, "release should not use remote assets");
assert.strictEqual(logicSource.indexOf("http://"), -1, "release should not use remote assets");
assert.strictEqual(logicSource.indexOf("https://"), -1, "release should not use remote assets");

console.log("release tests passed");
