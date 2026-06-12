"use strict";

var assert = require("assert");
var Logic = require("../js/logic");
var Game = require("../game");

function makeContext() {
  return {
    calls: [],
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "left",
    textBaseline: "alphabetic",
    beginPath: function () { this.calls.push("beginPath"); },
    closePath: function () { this.calls.push("closePath"); },
    fill: function () { this.calls.push("fill"); },
    stroke: function () { this.calls.push("stroke"); },
    fillRect: function () { this.calls.push("fillRect"); },
    strokeRect: function () { this.calls.push("strokeRect"); },
    rect: function () { this.calls.push("rect"); },
    moveTo: function () { this.calls.push("moveTo"); },
    lineTo: function () { this.calls.push("lineTo"); },
    quadraticCurveTo: function () { this.calls.push("quadraticCurveTo"); },
    arc: function () { this.calls.push("arc"); },
    fillText: function () { this.calls.push("fillText"); },
    measureText: function (text) { return { width: String(text).length * 8 }; },
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
    setTransform: function () { this.calls.push("setTransform"); },
    scale: function () { this.calls.push("scale"); }
  };
}

var ctx = makeContext();
var layout = Game.computeLayout(390, 720);
var state = Logic.startGame(2026);
state = Logic.placeTower(state, { x: 1, y: 1 }, "bolt");
state = Logic.startWave(state);
for (var i = 0; i < 12; i += 1) state = Logic.tick(state, 100);
Game.render(ctx, state, layout);
assert.ok(ctx.calls.indexOf("fillRect") !== -1, "render should paint background and grid");
assert.ok(ctx.calls.indexOf("fillText") !== -1, "render should draw labels");
assert.ok(ctx.calls.indexOf("strokeRect") !== -1, "render should draw grid cells");

var cell = Game.gridCellFromPoint(layout, layout.gridX + layout.cell * 1.5, layout.gridY + layout.cell * 1.5);
assert.deepStrictEqual(cell, { x: 1, y: 1 }, "grid hit testing should map to cells");
assert.strictEqual(Game.gridCellFromPoint(layout, layout.gridX - 3, layout.gridY), null, "outside grid should miss");

var firstTowerButton = layout.palette[0];
var control = Game.controlFromPoint(layout, firstTowerButton.x + firstTowerButton.w / 2, firstTowerButton.y + firstTowerButton.h / 2);
assert.strictEqual(control.kind, "tower", "palette hit testing should return tower control");
assert.strictEqual(control.id, "bolt");

var mockCtx = makeContext();
var mockCanvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: function () { return mockCtx; }
};
var stored = null;
var mockWx = {
  createCanvas: function () { return mockCanvas; },
  getSystemInfoSync: function () { return { windowWidth: 360, windowHeight: 720, pixelRatio: 2 }; },
  getStorageSync: function () { return stored; },
  setStorageSync: function (key, value) { stored = value; },
  onTouchEnd: function () {},
  onHide: function () {},
  onShow: function () {},
  onWindowResize: function () {}
};

var runtime = Game.createRuntime({ wx: mockWx, canvas: mockCanvas, state: Logic.startGame(1), autoLoop: false });
assert.strictEqual(mockCanvas.width, 720, "runtime should scale canvas width by device pixel ratio");
assert.strictEqual(mockCanvas.height, 1440, "runtime should scale canvas height by device pixel ratio");
runtime.tap({ x: runtime.layout.palette[1].x + 4, y: runtime.layout.palette[1].y + 4 });
assert.strictEqual(runtime.state.selectedTowerType, "rail", "tap should select tower type");
runtime.tap({ x: runtime.layout.gridX + runtime.layout.cell * 1.5, y: runtime.layout.gridY + runtime.layout.cell * 1.5 });
assert.strictEqual(runtime.state.towers.length, 1, "tap on buildable cell should place selected tower");
runtime.stop();

console.log("render contract tests passed");
