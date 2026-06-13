"use strict";

var assert = require("assert");
var CloudState = require("../js/cloud-state");

var calls = [];
var loginCalled = false;
var initCalled = false;
var profileCalled = false;
var remoteState = {
  version: 1,
  phase: "planning",
  waveIndex: 1,
  credits: 160,
  lives: 14,
  score: 420,
  timeMs: 18000,
  spawnTimerMs: 0,
  spawnQueue: ["scout"],
  nextId: 8,
  selectedTowerId: null,
  selectedTowerType: "bolt",
  abilityMode: false,
  orbitalCharges: 1,
  message: "remote tower defense state",
  rngSeed: 20260613,
  towers: [{ id: 1, type: "bolt", x: 2, y: 3, level: 1, cooldownMs: 0, targetId: null }],
  enemies: [],
  projectiles: [],
  recentHits: []
};

var mockWx = {
  getStorageSync: function () { return null; },
  setStorageSync: function () {},
  getUserProfile: function (options) {
    profileCalled = true;
    options.success({ userInfo: { nickName: "Tester", avatarUrl: "https://example.com/avatar.png" } });
  },
  login: function (options) {
    loginCalled = true;
    options.success({ code: "login-code" });
  },
  cloud: {
    init: function (options) {
      initCalled = options && options.traceUser === true && options.env === "test-env";
    },
    callFunction: function (options) {
      calls.push(options);
      if (options.data.action === "load") {
        options.success({ result: { ok: true, openid: "openid-1", state: remoteState } });
      } else {
        options.success({ result: { ok: true, openid: "openid-1", saved: true } });
      }
    }
  }
};

var sanitized = 0;
var service = CloudState.create({
  wx: mockWx,
  gameId: "wechat-mini-star-defense",
  storageKey: "star-state",
  env: "test-env",
  sanitize: function (state) {
    sanitized += 1;
    return state;
  }
});

var loaded = null;
assert.strictEqual(service.start(function (state) {
  loaded = state;
}), true, "cloud service should start when wx.cloud is available");

assert.strictEqual(loginCalled, true, "wx.login should be called");
assert.strictEqual(initCalled, true, "wx.cloud.init should enable traceUser");
assert.deepStrictEqual(loaded, remoteState, "remote state should be returned to the runtime");
assert.strictEqual(calls[0].name, "playerState");
assert.strictEqual(calls[0].data.action, "load");
assert.strictEqual(calls[0].data.gameId, "wechat-mini-star-defense");
assert.strictEqual(calls[0].data.loginCode, "login-code");

assert.strictEqual(service.save(remoteState), true, "save should call the cloud function");
assert.strictEqual(calls[1].data.action, "save");
assert.strictEqual(calls[1].data.payload.state.towers[0].type, "bolt");
assert.ok(calls[1].data.payload.state._clientUpdatedAt >= 0);

assert.strictEqual(service.requestUserProfile("用于测试", function () {}), true, "profile request should be available from a tap handler");
assert.strictEqual(profileCalled, true, "wx.getUserProfile should be called");
assert.strictEqual(calls[2].data.action, "profile");
assert.strictEqual(calls[2].data.profile.nickName, "Tester");

var status = service.getStatus();
assert.strictEqual(status.mode, "cloud");
assert.strictEqual(status.loggedIn, true);
assert.strictEqual(status.loginCode, "login-code");
assert.strictEqual(status.openid, "openid-1");
assert.ok(status.lastSyncAt >= 0);
assert.ok(sanitized >= 2, "load and save should sanitize state");

var localOnly = CloudState.create({ wx: {}, gameId: "offline" });
assert.strictEqual(localOnly.start(function () {}), false, "missing cloud API should keep local mode");
assert.strictEqual(localOnly.getStatus().mode, "local");

var noEnv = CloudState.create({ wx: mockWx, gameId: "offline" });
assert.strictEqual(noEnv.start(function () {}), false, "missing env should keep local mode");
assert.strictEqual(noEnv.getStatus().envConfigured, false);

console.log("cloud state tests passed");
