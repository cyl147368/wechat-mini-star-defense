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
  "app.json",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "game.js",
  "game.json",
  "js/cloud-config.js",
  "js/cloud-state.js",
  "js/logic.js",
  "js/session-ui.js",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "project.config.json"
], "release should contain only runtime files");

var project = JSON.parse(fs.readFileSync(path.join(releaseDir, "project.config.json"), "utf8"));
var app = JSON.parse(fs.readFileSync(path.join(releaseDir, "app.json"), "utf8"));
assert.strictEqual(project.compileType, "game", "release must be a mini game");
assert.strictEqual(project.appid, "touristappid", "release should import without a private appid");
assert.strictEqual(project.cloudfunctionRoot, "cloudfunctions/", "release should expose cloud functions");
assert.strictEqual(project.setting.packNpmManually, false, "release should not require npm build");
assert.deepStrictEqual(app.pages, ["pages/index/index"], "app should declare the page required by DevTools");

var game = JSON.parse(fs.readFileSync(path.join(releaseDir, "game.json"), "utf8"));
assert.strictEqual(app.deviceOrientation, "portrait", "app should be portrait");
assert.strictEqual(app.showStatusBar, false, "app should hide status bar");
assert.strictEqual(game.deviceOrientation, "portrait", "game should be portrait");

var gameSource = fs.readFileSync(path.join(releaseDir, "game.js"), "utf8");
var cloudSource = fs.readFileSync(path.join(releaseDir, "js", "cloud-state.js"), "utf8");
var cloudFunctionSource = fs.readFileSync(path.join(releaseDir, "cloudfunctions", "playerState", "index.js"), "utf8");
var logicSource = fs.readFileSync(path.join(releaseDir, "js/logic.js"), "utf8");
assert.ok(gameSource.indexOf("星港防线") !== -1, "release should contain new game identity");
assert.ok(gameSource.indexOf("CloudState") !== -1, "release should wire cloud state sync");
assert.ok(cloudSource.indexOf("wxApi.login") !== -1, "cloud state should use WeChat login");
assert.ok(cloudSource.indexOf("callFunction") !== -1, "cloud state should call the cloud function");
assert.ok(cloudFunctionSource.indexOf("OPENID") !== -1, "cloud function should use WeChat OPENID");
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
