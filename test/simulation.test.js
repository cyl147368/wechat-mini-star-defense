"use strict";

var assert = require("assert");
var Logic = require("../js/logic");

function runUntilPlanningOrEnd(state, limit) {
  var steps = 0;
  while (state.phase === "running" && steps < limit) {
    state = Logic.tick(state, 100);
    steps += 1;
  }
  assert.ok(steps < limit, "simulation should not hang while running");
  return state;
}

function buildStrongDefense() {
  var state = Logic.startGame(9001);
  state.credits = 5000;
  [
    ["rail", 1, 4],
    ["bolt", 1, 6],
    ["frost", 3, 2],
    ["mortar", 3, 5],
    ["rail", 5, 6],
    ["frost", 5, 8],
    ["mortar", 7, 4],
    ["bolt", 7, 1],
    ["rail", 4, 1],
    ["mortar", 6, 8]
  ].forEach(function (item) {
    state = Logic.placeTower(state, { x: item[1], y: item[2] }, item[0]);
    for (var i = 0; i < 3; i += 1) state = Logic.upgradeSelectedTower(state);
  });
  return state;
}

var defended = buildStrongDefense();
assert.ok(defended.towers.length >= 8, "strong defense should build many towers");
while (defended.phase !== "won" && defended.phase !== "lost") {
  if (defended.phase === "planning") defended = Logic.startWave(defended);
  defended = runUntilPlanningOrEnd(defended, 1800);
}
assert.strictEqual(defended.phase, "won", "strong defense should clear every wave");
assert.ok(defended.score > 1000, "winning run should score points");
assert.ok(defended.lives > 0, "winning run should preserve the core");

var exposed = Logic.startGame(314);
var guard = 0;
while (exposed.phase !== "lost" && exposed.phase !== "won" && guard < 7000) {
  if (exposed.phase === "planning") exposed = Logic.startWave(exposed);
  exposed = Logic.tick(exposed, 100);
  guard += 1;
}
assert.strictEqual(exposed.phase, "lost", "unprotected base should eventually lose");

var economy = Logic.startGame(55);
economy = Logic.placeTower(economy, { x: 1, y: 1 }, "bolt");
economy = Logic.startWave(economy);
var sawProjectile = false;
var sawReward = false;
for (var step = 0; step < 500; step += 1) {
  economy = Logic.tick(economy, 100);
  sawProjectile = sawProjectile || economy.projectiles.length > 0;
  sawReward = sawReward || economy.credits > Logic.STARTING_CREDITS - Logic.TOWER_TYPES.bolt.cost;
  if (economy.phase !== "running") break;
}
assert.ok(sawProjectile, "tower should fire projectiles during a wave");
assert.ok(sawReward, "tower kills should grant credits");

console.log("simulation tests passed");
