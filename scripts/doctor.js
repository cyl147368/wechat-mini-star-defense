"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-star-defense-release");
var releaseZip = path.join(outputRoot, "wechat-mini-star-defense-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-star-defense.zip");

var expectedReleaseFiles = [
  "app.json",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "game.js",
  "game.json",
  "js/cloud-state.js",
  "js/logic.js",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "project.config.json"
];

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(dir, base, files) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, files);
    else files.push(path.relative(base, full).replace(/\\/g, "/"));
  });
}

function assertZip(file) {
  childProcess.execFileSync("unzip", ["-t", file], { stdio: "pipe" });
}

if (!fs.existsSync(releaseDir)) fail("release directory missing");
if (!fs.existsSync(releaseZip)) fail("release zip missing");
if (!fs.existsSync(fullZip)) fail("full zip missing");

var files = [];
walk(releaseDir, releaseDir, files);
files.sort();
if (files.join("\n") !== expectedReleaseFiles.join("\n")) {
  fail("unexpected release files:\n" + files.join("\n"));
}

var project = readJson(path.join(releaseDir, "project.config.json"));
var app = readJson(path.join(releaseDir, "app.json"));
if (project.compileType !== "game") fail("compileType must be game");
if (project.appid !== "touristappid") fail("release appid must be touristappid");
if (project.cloudfunctionRoot !== "cloudfunctions/") fail("cloudfunctionRoot must point at cloudfunctions/");
if (project.setting && project.setting.packNpmManually) fail("release should not require npm packing");

var game = readJson(path.join(releaseDir, "game.json"));
if (!Array.isArray(app.pages) || app.pages[0] !== "pages/index/index") fail("app.json pages must include pages/index/index");
if (app.deviceOrientation !== "portrait") fail("app.json must be portrait");
if (app.showStatusBar !== false) fail("app.json showStatusBar must be false");
if (game.deviceOrientation !== "portrait") fail("game must be portrait");

var source = fs.readFileSync(path.join(releaseDir, "game.js"), "utf8");
var cloudSource = fs.readFileSync(path.join(releaseDir, "js", "cloud-state.js"), "utf8");
var functionSource = fs.readFileSync(path.join(releaseDir, "cloudfunctions", "playerState", "index.js"), "utf8");
if (source.indexOf("星港防线") === -1) fail("new star-defense identity missing");
if (source.indexOf("CloudState") === -1) fail("cloud state sync should be wired into game.js");
if (cloudSource.indexOf("wxApi.login") === -1) fail("cloud state should call wx.login");
if (cloudSource.indexOf("callFunction") === -1) fail("cloud state should call a cloud function");
if (functionSource.indexOf("OPENID") === -1) fail("cloud function should persist state by WeChat OPENID");
["霓虹贪吃蛇", "合成 2048", "极速躲避", "花房订单", "wechat-mini-arcade", "wechat-mini-garden-match"].forEach(function (oldText) {
  if (source.indexOf(oldText) !== -1) fail("old project content leaked into release: " + oldText);
});

var logic = require(path.join(releaseDir, "js/logic.js"));
if (Object.keys(logic.TOWER_TYPES).length < 4) fail("expected at least four tower types");
if (Object.keys(logic.ENEMY_TYPES).length < 5) fail("expected at least five enemy types");
if (logic.WAVES.length < 5) fail("expected at least five waves");
if (logic.PATH_CELLS.length < 8) fail("expected a multi-turn path");

var state = logic.startGame(123);
state = logic.placeTower(state, { x: 1, y: 1 }, "bolt");
state = logic.placeTower(state, { x: 3, y: 1 }, "rail");
state = logic.startWave(state);
for (var i = 0; i < 80; i += 1) state = logic.tick(state, 100);
if (!state.enemies.length && !state.projectiles.length) fail("simulation did not spawn or engage enemies");

assertZip(releaseZip);
assertZip(fullZip);

console.log("doctor checks passed");
console.log("release project:", releaseDir);
console.log("release zip:", releaseZip);
console.log("open command:");
console.log("/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project " + releaseDir + " --port 9420 --lang zh");
