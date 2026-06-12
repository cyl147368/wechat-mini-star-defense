"use strict";

var assert = require("assert");
var Logic = require("../js/logic");

var state = Logic.startGame(42);
assert.strictEqual(state.phase, "planning");
assert.strictEqual(state.credits, Logic.STARTING_CREDITS);
assert.strictEqual(state.lives, Logic.STARTING_LIVES);
assert.ok(Logic.isPathCell({ x: 0, y: 5 }), "path cell should be recognized");
assert.strictEqual(Logic.isBuildable({ x: 0, y: 5 }), false, "path should not be buildable");
assert.strictEqual(Logic.isBuildable({ x: 1, y: 1 }), true, "empty grid cell should be buildable");

var invalid = Logic.placeTower(state, { x: 0, y: 5 }, "bolt");
assert.strictEqual(invalid.towers.length, 0, "cannot place on path");
assert.strictEqual(invalid.credits, state.credits, "invalid placement should not spend credits");

var placed = Logic.placeTower(state, { x: 1, y: 1 }, "bolt");
assert.strictEqual(placed.towers.length, 1, "tower should be placed");
assert.strictEqual(placed.credits, state.credits - Logic.TOWER_TYPES.bolt.cost, "tower should spend credits");
assert.strictEqual(placed.selectedTowerId, placed.towers[0].id, "new tower should be selected");

var selectedType = Logic.selectTowerType(placed, "mortar");
assert.strictEqual(selectedType.selectedTowerType, "mortar", "tower type should change");
assert.strictEqual(selectedType.selectedTowerId, null, "selecting tower type clears selected tower");

var tooExpensive = Logic.placeTower({ credits: 1, lives: 18, phase: "planning", waveIndex: 0, towers: [], enemies: [], projectiles: [], spawnQueue: [] }, { x: 1, y: 1 }, "mortar");
assert.strictEqual(tooExpensive.towers.length, 0, "insufficient credits should block placement");

var upgraded = Logic.upgradeSelectedTower(placed);
assert.strictEqual(upgraded.towers[0].level, 2, "upgrade should increase level");
assert.ok(upgraded.credits < placed.credits, "upgrade should spend credits");
var stats1 = Logic.makeTowerStats(placed.towers[0]);
var stats2 = Logic.makeTowerStats(upgraded.towers[0]);
assert.ok(stats2.damage > stats1.damage, "upgrade should increase damage");
assert.ok(stats2.range > stats1.range, "upgrade should increase range");

var sold = Logic.sellSelectedTower(upgraded);
assert.strictEqual(sold.towers.length, 0, "sell should remove tower");
assert.ok(sold.credits > upgraded.credits, "sell should refund credits");

var wave = Logic.startWave(placed);
assert.strictEqual(wave.phase, "running", "startWave should enter running phase");
assert.strictEqual(wave.spawnQueue.length, Logic.WAVES[0].groups[0].count, "wave queue should be expanded");
var afterTicks = wave;
for (var i = 0; i < 20; i += 1) afterTicks = Logic.tick(afterTicks, 100);
assert.ok(afterTicks.enemies.length > 0, "tick should spawn enemies");

var strikeState = Logic.startGame(7);
strikeState = Logic.startWave(strikeState);
for (var s = 0; s < 3; s += 1) strikeState = Logic.tick(strikeState, 200);
assert.ok(strikeState.enemies.length > 0, "strike setup should have enemies");
var beforeHp = strikeState.enemies[0].hp;
strikeState = Logic.castOrbitalStrike(strikeState, { x: 0, y: 5 });
assert.strictEqual(strikeState.orbitalCharges, 0, "strike spends a charge");
assert.ok(strikeState.enemies.length === 0 || strikeState.enemies[0].hp < beforeHp, "strike should damage enemies in radius");

var paused = Logic.pauseGame(afterTicks);
assert.strictEqual(paused.phase, "paused", "pause should pause running game");
var resumed = Logic.pauseGame(paused);
assert.strictEqual(resumed.phase, "running", "pause should resume paused game");

var restored = Logic.sanitizeState({
  phase: "lost",
  lives: 0,
  credits: 0,
  waveIndex: 2,
  towers: placed.towers,
  enemies: [],
  projectiles: [],
  spawnQueue: [],
  orbitalCharges: 0
});
assert.strictEqual(restored.phase, "lost", "sanitize should preserve lost phase");
assert.strictEqual(restored.lives, 0, "sanitize should preserve zero lives");

console.log("logic tests passed");
