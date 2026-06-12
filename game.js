"use strict";

var Logic = require("./js/logic");
var CloudState = require("./js/cloud-state");

var GAME_ID = "wechat-mini-star-defense";
var STORAGE_KEY = "wechat-mini-star-defense-state-v1";
var PI2 = Math.PI * 2;

var TOWER_ORDER = ["bolt", "rail", "frost", "mortar"];
var ENEMY_SHORT = {
  drone: "D",
  skimmer: "S",
  armor: "A",
  splitter: "F",
  titan: "T"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getWx() {
  return typeof wx !== "undefined" ? wx : null;
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return fallback;
  }
}

function getSystemInfo(wxApi) {
  var info = wxApi && wxApi.getSystemInfoSync ? safe(function () {
    return wxApi.getSystemInfoSync();
  }, null) : null;
  info = info || {};
  return {
    width: clamp(Number(info.windowWidth) || 390, 280, 1200),
    height: clamp(Number(info.windowHeight) || 720, 420, 1600),
    dpr: clamp(Number(info.pixelRatio) || 1, 1, 4)
  };
}

function createCanvas(wxApi) {
  if (wxApi && wxApi.createCanvas) return wxApi.createCanvas();
  if (typeof document !== "undefined" && document.createElement) {
    var canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    return canvas;
  }
  return {
    width: 390,
    height: 720,
    getContext: function () { return null; }
  };
}

function call(ctx, name, args) {
  if (ctx && typeof ctx[name] === "function") return ctx[name].apply(ctx, args || []);
  return undefined;
}

function roundedRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  call(ctx, "beginPath");
  if (ctx && typeof ctx.moveTo === "function" && typeof ctx.lineTo === "function" && typeof ctx.quadraticCurveTo === "function") {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    call(ctx, "rect", [x, y, w, h]);
  }
  call(ctx, "closePath");
}

function fillRound(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundedRect(ctx, x, y, w, h, r);
  call(ctx, "fill");
}

function strokeRound(ctx, x, y, w, h, r, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  roundedRect(ctx, x, y, w, h, r);
  call(ctx, "stroke");
}

function circle(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  call(ctx, "beginPath");
  if (ctx && typeof ctx.arc === "function") ctx.arc(x, y, radius, 0, PI2);
  else call(ctx, "rect", [x - radius, y - radius, radius * 2, radius * 2]);
  call(ctx, "fill");
}

function strokeCircle(ctx, x, y, radius, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  call(ctx, "beginPath");
  if (ctx && typeof ctx.arc === "function") ctx.arc(x, y, radius, 0, PI2);
  else call(ctx, "rect", [x - radius, y - radius, radius * 2, radius * 2]);
  call(ctx, "stroke");
}

function setFont(ctx, size, weight) {
  ctx.font = (weight ? weight + " " : "") + Math.round(size) + "px sans-serif";
}

function measure(ctx, text) {
  if (ctx && typeof ctx.measureText === "function") return ctx.measureText(String(text)).width;
  return String(text).length * 9;
}

function drawText(ctx, text, x, y, options) {
  options = options || {};
  var size = options.size || 14;
  var min = options.minSize || 10;
  setFont(ctx, size, options.weight || "600");
  while (size > min && measure(ctx, text) > (options.maxWidth || 9999)) {
    size -= 1;
    setFont(ctx, size, options.weight || "600");
  }
  ctx.fillStyle = options.color || "#F7F4EA";
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = options.baseline || "middle";
  call(ctx, "fillText", [String(text), x, y]);
}

function makeBackground(ctx, width, height) {
  var gradient = ctx && typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, width, height) : null;
  if (gradient && gradient.addColorStop) {
    gradient.addColorStop(0, "#26172F");
    gradient.addColorStop(0.45, "#163746");
    gradient.addColorStop(1, "#40321C");
    return gradient;
  }
  return "#202633";
}

function computeLayout(width, height) {
  var pad = clamp(width * 0.04, 12, 22);
  var headerH = clamp(height * 0.12, 76, 104);
  var footerH = clamp(height * 0.24, 146, 194);
  var usableH = height - headerH - footerH - pad * 1.6;
  var maxGridW = Math.min(width - pad * 2, usableH * Logic.GRID_COLS / Logic.GRID_ROWS);
  var gridSize = clamp(maxGridW, 230, 500);
  var cell = gridSize / Logic.GRID_COLS;
  var gridHeight = cell * Logic.GRID_ROWS;
  var gridX = (width - gridSize) / 2;
  var gridY = headerH + Math.max(4, (usableH - gridHeight) / 2);
  var footerY = gridY + gridHeight + clamp(height * 0.02, 10, 18);
  var paletteH = clamp(footerH * 0.38, 52, 68);
  var actionH = clamp(footerH * 0.34, 44, 56);
  var gap = 8;
  var towerW = (width - pad * 2 - gap * 3) / 4;
  var actionW = (width - pad * 2 - gap * 4) / 5;
  var palette = TOWER_ORDER.map(function (type, i) {
    return { kind: "tower", id: type, x: pad + i * (towerW + gap), y: footerY, w: towerW, h: paletteH };
  });
  var actionLabels = [
    { id: "start", label: "开战" },
    { id: "upgrade", label: "升级" },
    { id: "sell", label: "回收" },
    { id: "strike", label: "打击" },
    { id: "restart", label: "重启" }
  ];
  var actions = actionLabels.map(function (item, i) {
    return { kind: "action", id: item.id, label: item.label, x: pad + i * (actionW + gap), y: footerY + paletteH + 10, w: actionW, h: actionH };
  });
  return {
    width: width,
    height: height,
    pad: pad,
    headerH: headerH,
    footerY: footerY,
    gridX: gridX,
    gridY: gridY,
    gridSize: gridSize,
    gridHeight: gridHeight,
    cell: cell,
    palette: palette,
    actions: actions
  };
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.w && point.y <= rect.y + rect.h;
}

function gridCellFromPoint(layout, x, y) {
  if (x < layout.gridX || y < layout.gridY || x >= layout.gridX + layout.gridSize || y >= layout.gridY + layout.gridHeight) return null;
  return {
    x: Math.floor((x - layout.gridX) / layout.cell),
    y: Math.floor((y - layout.gridY) / layout.cell)
  };
}

function controlFromPoint(layout, x, y) {
  var point = { x: x, y: y };
  var controls = layout.palette.concat(layout.actions);
  for (var i = 0; i < controls.length; i += 1) {
    if (pointInRect(point, controls[i])) return controls[i];
  }
  return null;
}

function cellToScreen(layout, point) {
  return {
    x: layout.gridX + point.x * layout.cell,
    y: layout.gridY + point.y * layout.cell
  };
}

function worldToScreen(layout, point) {
  return {
    x: layout.gridX + point.x * layout.cell,
    y: layout.gridY + point.y * layout.cell
  };
}

function drawStars(ctx, layout) {
  var dots = 42;
  for (var i = 0; i < dots; i += 1) {
    var x = (i * 83 % Math.floor(layout.width));
    var y = (i * 47 % Math.floor(layout.height));
    var r = 0.8 + (i % 3) * 0.45;
    circle(ctx, x, y, r, i % 5 === 0 ? "rgba(255,219,142,0.6)" : "rgba(209,244,255,0.42)");
  }
}

function drawHud(ctx, state, layout) {
  var wave = Logic.getWaveSummary(state);
  drawText(ctx, "星港防线", layout.pad, 28, { size: 25, weight: "800", color: "#F8F2D8", maxWidth: layout.width * 0.42 });
  drawText(ctx, "第 " + Math.min(wave.index + 1, wave.total) + "/" + wave.total + " 波 · " + wave.name, layout.pad, 56, {
    size: 13,
    weight: "500",
    color: "#BDD7D8",
    maxWidth: layout.width * 0.58
  });

  var chipW = clamp(layout.width * 0.24, 76, 110);
  var x0 = layout.width - layout.pad - chipW;
  var rows = [
    "星币 " + state.credits,
    "核心 " + state.lives,
    "分数 " + state.score
  ];
  rows.forEach(function (text, i) {
    fillRound(ctx, x0, 14 + i * 27, chipW, 22, 7, i === 1 && state.lives <= 5 ? "rgba(255,106,106,0.22)" : "rgba(255,255,255,0.12)");
    drawText(ctx, text, x0 + chipW / 2, 25 + i * 27, {
      size: 12,
      minSize: 9,
      align: "center",
      color: i === 1 && state.lives <= 5 ? "#FFD0C7" : "#F4F3E7",
      maxWidth: chipW - 10
    });
  });

  drawText(ctx, state.message || "", layout.pad, layout.headerH - 14, {
    size: 12,
    weight: "500",
    color: "#FFE3A0",
    maxWidth: layout.width - layout.pad * 2
  });
}

function drawPath(ctx, layout) {
  ctx.strokeStyle = "#D79843";
  ctx.lineWidth = Math.max(8, layout.cell * 0.33);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  call(ctx, "beginPath");
  Logic.PATH_CELLS.forEach(function (cell, i) {
    var p = worldToScreen(layout, { x: cell.x + 0.5, y: cell.y + 0.5 });
    if (i === 0) call(ctx, "moveTo", [p.x, p.y]);
    else call(ctx, "lineTo", [p.x, p.y]);
  });
  call(ctx, "stroke");

  ctx.strokeStyle = "rgba(255,240,185,0.55)";
  ctx.lineWidth = Math.max(2, layout.cell * 0.08);
  call(ctx, "beginPath");
  Logic.PATH_CELLS.forEach(function (cell, i) {
    var p = worldToScreen(layout, { x: cell.x + 0.5, y: cell.y + 0.5 });
    if (i === 0) call(ctx, "moveTo", [p.x, p.y]);
    else call(ctx, "lineTo", [p.x, p.y]);
  });
  call(ctx, "stroke");
}

function drawGrid(ctx, state, layout) {
  fillRound(ctx, layout.gridX - 8, layout.gridY - 8, layout.gridSize + 16, layout.gridHeight + 16, 8, "rgba(10,18,24,0.72)");
  strokeRound(ctx, layout.gridX - 8, layout.gridY - 8, layout.gridSize + 16, layout.gridHeight + 16, 8, "rgba(155,231,218,0.46)", 1.5);

  for (var y = 0; y < Logic.GRID_ROWS; y += 1) {
    for (var x = 0; x < Logic.GRID_COLS; x += 1) {
      var p = cellToScreen(layout, { x: x, y: y });
      var path = Logic.isPathCell({ x: x, y: y });
      ctx.fillStyle = path ? "rgba(157,99,42,0.35)" : "rgba(255,255,255,0.045)";
      call(ctx, "fillRect", [p.x + 1, p.y + 1, layout.cell - 2, layout.cell - 2]);
      ctx.strokeStyle = path ? "rgba(255,217,139,0.20)" : "rgba(180,244,230,0.12)";
      ctx.lineWidth = 1;
      call(ctx, "strokeRect", [p.x + 0.5, p.y + 0.5, layout.cell - 1, layout.cell - 1]);
    }
  }
  drawPath(ctx, layout);
}

function drawTowerIcon(ctx, type, cx, cy, size, level) {
  var def = Logic.TOWER_TYPES[type] || Logic.TOWER_TYPES.bolt;
  var r = size * 0.33;
  circle(ctx, cx, cy, r, "rgba(12,18,25,0.96)");
  strokeCircle(ctx, cx, cy, r, def.color, 2);
  if (type === "bolt") {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    call(ctx, "beginPath");
    call(ctx, "moveTo", [cx - r * 0.58, cy + r * 0.1]);
    call(ctx, "lineTo", [cx - r * 0.05, cy - r * 0.54]);
    call(ctx, "lineTo", [cx + r * 0.12, cy + r * 0.02]);
    call(ctx, "lineTo", [cx + r * 0.56, cy - r * 0.1]);
    call(ctx, "stroke");
  } else if (type === "rail") {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 4;
    call(ctx, "beginPath");
    call(ctx, "moveTo", [cx - r * 0.55, cy]);
    call(ctx, "lineTo", [cx + r * 0.56, cy]);
    call(ctx, "stroke");
    circle(ctx, cx, cy, r * 0.18, "#FFF5C6");
  } else if (type === "frost") {
    for (var i = 0; i < 6; i += 1) {
      var a = i * Math.PI / 3;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      call(ctx, "beginPath");
      call(ctx, "moveTo", [cx, cy]);
      call(ctx, "lineTo", [cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72]);
      call(ctx, "stroke");
    }
    circle(ctx, cx, cy, r * 0.18, "#E6FFFF");
  } else {
    circle(ctx, cx, cy, r * 0.38, def.color);
    circle(ctx, cx + r * 0.18, cy - r * 0.14, r * 0.16, "#FFF");
  }
  drawText(ctx, "L" + level, cx, cy + r + 8, { size: 9, align: "center", color: "#F8F2D8", maxWidth: size });
}

function drawTowers(ctx, state, layout) {
  state.towers.forEach(function (tower) {
    var p = worldToScreen(layout, { x: tower.x + 0.5, y: tower.y + 0.5 });
    if (tower.id === state.selectedTowerId) {
      var stats = Logic.makeTowerStats(tower);
      strokeCircle(ctx, p.x, p.y, stats.range * layout.cell, "rgba(139,231,255,0.42)", 2);
      fillRound(ctx, p.x - layout.cell * 0.42, p.y - layout.cell * 0.42, layout.cell * 0.84, layout.cell * 0.84, 7, "rgba(255,255,255,0.12)");
    }
    drawTowerIcon(ctx, tower.type, p.x, p.y, layout.cell, tower.level);
  });
}

function drawEnemies(ctx, state, layout) {
  state.enemies.forEach(function (enemy) {
    var p = worldToScreen(layout, enemy);
    var def = Logic.ENEMY_TYPES[enemy.type] || Logic.ENEMY_TYPES.drone;
    var r = clamp(layout.cell * (enemy.type === "titan" ? 0.31 : 0.23), 6, 17);
    circle(ctx, p.x, p.y, r + 2, "rgba(0,0,0,0.38)");
    circle(ctx, p.x, p.y, r, def.color);
    if (enemy.slowUntilMs > state.timeMs) strokeCircle(ctx, p.x, p.y, r + 4, "#D9FFFF", 2);
    drawText(ctx, ENEMY_SHORT[enemy.type] || "E", p.x, p.y + 1, { size: r * 0.9, align: "center", color: "#18222A", maxWidth: r * 2 });
    var barW = r * 2.4;
    var ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    fillRound(ctx, p.x - barW / 2, p.y - r - 9, barW, 4, 2, "rgba(0,0,0,0.45)");
    fillRound(ctx, p.x - barW / 2, p.y - r - 9, barW * ratio, 4, 2, ratio < 0.3 ? "#FF756E" : "#BDF76F");
  });
}

function drawProjectiles(ctx, state, layout) {
  state.projectiles.forEach(function (projectile) {
    var p = worldToScreen(layout, projectile);
    circle(ctx, p.x, p.y, clamp(layout.cell * 0.08, 2, 5), projectile.color || "#FFF");
  });
  state.recentHits.forEach(function (hit) {
    var p = worldToScreen(layout, hit);
    strokeCircle(ctx, p.x, p.y, hit.radius * layout.cell, hit.color || "#FFF", 2);
  });
}

function drawControls(ctx, state, layout) {
  layout.palette.forEach(function (button) {
    var def = Logic.TOWER_TYPES[button.id];
    var active = state.selectedTowerType === button.id && !state.abilityMode;
    fillRound(ctx, button.x, button.y, button.w, button.h, 7, active ? "rgba(255,234,163,0.24)" : "rgba(255,255,255,0.10)");
    strokeRound(ctx, button.x, button.y, button.w, button.h, 7, active ? "#FFE39A" : "rgba(189,232,224,0.34)", 1.5);
    drawTowerIcon(ctx, button.id, button.x + button.w * 0.27, button.y + button.h / 2, Math.min(button.h, button.w) * 0.72, 1);
    drawText(ctx, def.label, button.x + button.w * 0.52, button.y + button.h * 0.35, {
      size: 11,
      minSize: 8,
      color: "#F7F4EA",
      maxWidth: button.w * 0.45
    });
    drawText(ctx, String(def.cost), button.x + button.w * 0.52, button.y + button.h * 0.66, {
      size: 11,
      minSize: 8,
      color: "#FFE39A",
      maxWidth: button.w * 0.45
    });
  });

  layout.actions.forEach(function (button) {
    var label = button.label;
    var disabled = false;
    if (button.id === "start") label = state.phase === "running" ? "暂停" : state.phase === "paused" ? "继续" : "开战";
    if (button.id === "upgrade") disabled = !state.selectedTowerId;
    if (button.id === "sell") disabled = !state.selectedTowerId;
    if (button.id === "strike") label = "打击 " + state.orbitalCharges;
    var active = button.id === "strike" && state.abilityMode;
    fillRound(ctx, button.x, button.y, button.w, button.h, 7, disabled ? "rgba(255,255,255,0.06)" : active ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)");
    strokeRound(ctx, button.x, button.y, button.w, button.h, 7, active ? "#FFFFFF" : "rgba(255,227,160,0.38)", 1.4);
    drawText(ctx, label, button.x + button.w / 2, button.y + button.h / 2, {
      size: 12,
      minSize: 8,
      align: "center",
      color: disabled ? "rgba(247,244,234,0.45)" : "#F7F4EA",
      maxWidth: button.w - 8
    });
  });
}

function drawOverlay(ctx, state, layout) {
  if (state.phase !== "won" && state.phase !== "lost") return;
  var w = layout.width - layout.pad * 2;
  var h = 118;
  var x = layout.pad;
  var y = layout.gridY + layout.gridHeight / 2 - h / 2;
  fillRound(ctx, x, y, w, h, 8, "rgba(16,23,28,0.92)");
  strokeRound(ctx, x, y, w, h, 8, state.phase === "won" ? "#BDF76F" : "#FF756E", 2);
  drawText(ctx, state.phase === "won" ? "星港守住了" : "核心失守", layout.width / 2, y + 38, {
    size: 24,
    weight: "800",
    align: "center",
    color: "#F8F2D8",
    maxWidth: w - 24
  });
  drawText(ctx, "点“重启”重新规划防线", layout.width / 2, y + 78, {
    size: 14,
    align: "center",
    color: "#BDD7D8",
    maxWidth: w - 24
  });
}

function render(ctx, state, layout) {
  ctx.fillStyle = makeBackground(ctx, layout.width, layout.height);
  call(ctx, "fillRect", [0, 0, layout.width, layout.height]);
  drawStars(ctx, layout);
  drawHud(ctx, state, layout);
  drawGrid(ctx, state, layout);
  drawTowers(ctx, state, layout);
  drawProjectiles(ctx, state, layout);
  drawEnemies(ctx, state, layout);
  drawControls(ctx, state, layout);
  drawOverlay(ctx, state, layout);
}

function extractTouch(event) {
  var touch = event && event.changedTouches && event.changedTouches[0] || event && event.touches && event.touches[0] || event;
  if (!touch) return null;
  var x = Number(touch.clientX);
  var y = Number(touch.clientY);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x: x, y: y };
}

function saveState(wxApi, state, cloudSync) {
  if (wxApi && wxApi.setStorageSync) {
    safe(function () {
      wxApi.setStorageSync(STORAGE_KEY, state);
    }, null);
  }
  if (cloudSync && typeof cloudSync.save === "function") cloudSync.save(state);
}

function loadState(wxApi) {
  if (!wxApi || !wxApi.getStorageSync) return Logic.startGame(Date.now());
  var stored = safe(function () {
    return wxApi.getStorageSync(STORAGE_KEY);
  }, null);
  return stored ? Logic.sanitizeState(stored) : Logic.startGame(Date.now());
}

function scheduleFrame(canvas, wxApi, cb) {
  if (canvas && typeof canvas.requestAnimationFrame === "function") return canvas.requestAnimationFrame(cb);
  if (wxApi && typeof wxApi.requestAnimationFrame === "function") return wxApi.requestAnimationFrame(cb);
  if (typeof requestAnimationFrame !== "undefined") return requestAnimationFrame(cb);
  return setTimeout(function () { cb(Date.now()); }, 16);
}

function createRuntime(options) {
  options = options || {};
  var wxApi = options.wx || getWx();
  var canvas = options.canvas || createCanvas(wxApi);
  var ctx = canvas.getContext && canvas.getContext("2d");
  var system = getSystemInfo(wxApi);
  var runtime = {
    wx: wxApi,
    canvas: canvas,
    ctx: ctx,
    layout: computeLayout(system.width, system.height),
    state: options.state ? Logic.sanitizeState(options.state) : loadState(wxApi),
    lastFrame: 0,
    saveTimer: 0,
    stopped: false,
    cloudSync: null
  };
  runtime.cloudSync = CloudState.create({
    wx: wxApi,
    gameId: GAME_ID,
    storageKey: STORAGE_KEY,
    sanitize: Logic.sanitizeState
  });

  function resize() {
    system = getSystemInfo(wxApi);
    canvas.width = Math.floor(system.width * system.dpr);
    canvas.height = Math.floor(system.height * system.dpr);
    if (canvas.style) {
      canvas.style.width = system.width + "px";
      canvas.style.height = system.height + "px";
    }
    ctx = canvas.getContext && canvas.getContext("2d");
    runtime.ctx = ctx;
    if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(system.dpr, 0, 0, system.dpr, 0, 0);
    else if (ctx && typeof ctx.scale === "function") ctx.scale(system.dpr, system.dpr);
    runtime.layout = computeLayout(system.width, system.height);
  }

  function redraw() {
    if (runtime.ctx) render(runtime.ctx, runtime.state, runtime.layout);
  }

  function applyRemoteState(remoteState) {
    if (!remoteState) return;
    runtime.state = Logic.sanitizeState(remoteState);
    saveState(wxApi, runtime.state, null);
    redraw();
  }

  function commit(nextState) {
    runtime.state = Logic.sanitizeState(nextState);
    saveState(wxApi, runtime.state, runtime.cloudSync);
    redraw();
  }

  function handleControl(control) {
    if (control.kind === "tower") {
      commit(Logic.selectTowerType(runtime.state, control.id));
      return;
    }
    if (control.id === "start") {
      if (runtime.state.phase === "running" || runtime.state.phase === "paused") commit(Logic.pauseGame(runtime.state));
      else commit(Logic.startWave(runtime.state));
    } else if (control.id === "upgrade") {
      commit(Logic.upgradeSelectedTower(runtime.state));
    } else if (control.id === "sell") {
      commit(Logic.sellSelectedTower(runtime.state));
    } else if (control.id === "strike") {
      commit(Logic.toggleAbilityMode(runtime.state));
    } else if (control.id === "restart") {
      commit(Logic.startGame(Date.now()));
    }
  }

  function tap(point) {
    var control = controlFromPoint(runtime.layout, point.x, point.y);
    if (control) {
      handleControl(control);
      return;
    }
    var cell = gridCellFromPoint(runtime.layout, point.x, point.y);
    if (!cell) return;
    if (runtime.state.abilityMode) {
      commit(Logic.castOrbitalStrike(runtime.state, cell));
      return;
    }
    if (Logic.getTowerAt(runtime.state, cell)) {
      commit(Logic.selectCell(runtime.state, cell));
    } else {
      commit(Logic.placeTower(runtime.state, cell, runtime.state.selectedTowerType));
    }
  }

  function onTouchEnd(event) {
    var point = extractTouch(event);
    if (point) tap(point);
  }

  function loop(now) {
    if (runtime.stopped) return;
    now = Number(now) || Date.now();
    var dt = runtime.lastFrame ? now - runtime.lastFrame : 16;
    runtime.lastFrame = now;
    if (runtime.state.phase === "running") {
      runtime.state = Logic.tick(runtime.state, dt);
      runtime.saveTimer += dt;
      if (runtime.saveTimer > 1000 || runtime.state.phase !== "running") {
        runtime.saveTimer = 0;
        saveState(wxApi, runtime.state, runtime.cloudSync);
      }
    }
    redraw();
    scheduleFrame(canvas, wxApi, loop);
  }

  function bind() {
    if (wxApi && wxApi.onTouchEnd) wxApi.onTouchEnd(onTouchEnd);
    else if (canvas && canvas.addEventListener) canvas.addEventListener("pointerup", onTouchEnd);
    if (wxApi && wxApi.onHide) wxApi.onHide(function () { saveState(wxApi, runtime.state, runtime.cloudSync); });
    if (wxApi && wxApi.onShow) wxApi.onShow(function () {
      if (runtime.cloudSync && runtime.cloudSync.load(function (remoteState) {
        if (remoteState) applyRemoteState(remoteState);
        else {
          runtime.state = loadState(wxApi);
          redraw();
        }
      })) return;
      runtime.state = loadState(wxApi);
      redraw();
    });
    if (wxApi && wxApi.onWindowResize) wxApi.onWindowResize(function () { resize(); redraw(); });
  }

  resize();
  bind();
  redraw();
  if (runtime.cloudSync) runtime.cloudSync.start(applyRemoteState);
  if (options.autoLoop !== false) scheduleFrame(canvas, wxApi, loop);
  runtime.tap = tap;
  runtime.redraw = redraw;
  runtime.stop = function () { runtime.stopped = true; };
  return runtime;
}

if (getWx() && getWx().createCanvas) {
  createRuntime();
}

if (typeof module !== "undefined") {
  module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    computeLayout: computeLayout,
    gridCellFromPoint: gridCellFromPoint,
    controlFromPoint: controlFromPoint,
    worldToScreen: worldToScreen,
    render: render,
    createRuntime: createRuntime
  };
}
