"use strict";

var VERSION = 1;
var GRID_COLS = 9;
var GRID_ROWS = 10;
var STARTING_CREDITS = 180;
var STARTING_LIVES = 18;

var PATH_CELLS = [
  { x: 0, y: 5 },
  { x: 1, y: 5 },
  { x: 2, y: 5 },
  { x: 2, y: 3 },
  { x: 4, y: 3 },
  { x: 4, y: 7 },
  { x: 6, y: 7 },
  { x: 6, y: 2 },
  { x: 8, y: 2 }
];

var TOWER_TYPES = {
  bolt: {
    label: "脉冲塔",
    cost: 55,
    range: 2.65,
    damage: 18,
    cooldownMs: 520,
    projectileSpeed: 7.4,
    color: "#69D2FF"
  },
  rail: {
    label: "轨道炮",
    cost: 90,
    range: 3.7,
    damage: 43,
    cooldownMs: 1180,
    projectileSpeed: 9.2,
    color: "#F4C35E"
  },
  frost: {
    label: "霜磁塔",
    cost: 75,
    range: 2.55,
    damage: 9,
    cooldownMs: 820,
    projectileSpeed: 6.3,
    slowFactor: 0.55,
    slowMs: 1350,
    color: "#92E6D8"
  },
  mortar: {
    label: "离子炮",
    cost: 110,
    range: 3.25,
    damage: 30,
    cooldownMs: 1500,
    projectileSpeed: 5.4,
    splash: 0.95,
    color: "#DD89FF"
  }
};

var ENEMY_TYPES = {
  drone: {
    label: "巡航无人机",
    hp: 46,
    speed: 1.12,
    reward: 8,
    damage: 1,
    color: "#7BE0FF"
  },
  skimmer: {
    label: "掠影艇",
    hp: 34,
    speed: 1.62,
    reward: 7,
    damage: 1,
    color: "#B2F77A"
  },
  armor: {
    label: "装甲运输舰",
    hp: 112,
    speed: 0.74,
    reward: 18,
    damage: 2,
    color: "#FFB86B"
  },
  splitter: {
    label: "裂变蜂群",
    hp: 72,
    speed: 1.04,
    reward: 12,
    damage: 1,
    color: "#F58CC7",
    splitInto: "skimmer"
  },
  titan: {
    label: "重型母舰",
    hp: 260,
    speed: 0.54,
    reward: 45,
    damage: 4,
    color: "#C7B6FF"
  }
};

var WAVES = [
  { name: "侦察波", bonus: 24, intervalMs: 680, groups: [{ type: "drone", count: 8 }] },
  { name: "快艇突袭", bonus: 30, intervalMs: 540, groups: [{ type: "skimmer", count: 10 }, { type: "drone", count: 6 }] },
  { name: "护航队", bonus: 38, intervalMs: 640, groups: [{ type: "armor", count: 4 }, { type: "drone", count: 10 }] },
  { name: "蜂群裂变", bonus: 48, intervalMs: 520, groups: [{ type: "splitter", count: 8 }, { type: "skimmer", count: 12 }] },
  { name: "星港围攻", bonus: 70, intervalMs: 610, groups: [{ type: "armor", count: 7 }, { type: "splitter", count: 8 }, { type: "titan", count: 2 }] }
];

function normalizeSeed(seed) {
  var n = Number(seed);
  if (!isFinite(n)) n = 20260612;
  n = Math.floor(Math.abs(n)) >>> 0;
  return n || 1;
}

function makeRng(seed) {
  return { seed: normalizeSeed(seed) };
}

function random(rng) {
  rng.seed = (rng.seed * 1664525 + 1013904223) >>> 0;
  return rng.seed / 4294967296;
}

function randomInt(rng, max) {
  return Math.floor(random(rng) * max);
}

function clonePoint(point) {
  return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
}

function cloneList(list, cloneFn) {
  return Array.isArray(list) ? list.map(cloneFn) : [];
}

function expandWave(wave) {
  var queue = [];
  (wave.groups || []).forEach(function (group) {
    for (var i = 0; i < group.count; i += 1) queue.push(group.type);
  });
  return queue;
}

function pathPoint(index) {
  var cell = PATH_CELLS[Math.max(0, Math.min(PATH_CELLS.length - 1, index))];
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function distance(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToCell(point, cell) {
  return distance(point, { x: cell.x + 0.5, y: cell.y + 0.5 });
}

function cellKey(cell) {
  return cell.x + ":" + cell.y;
}

function inBounds(cell) {
  return !!cell &&
    Math.floor(cell.x) === cell.x &&
    Math.floor(cell.y) === cell.y &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < GRID_COLS &&
    cell.y < GRID_ROWS;
}

function isPathCell(cell) {
  for (var i = 0; i < PATH_CELLS.length; i += 1) {
    if (PATH_CELLS[i].x === cell.x && PATH_CELLS[i].y === cell.y) return true;
  }
  return false;
}

function isBuildable(cell) {
  return inBounds(cell) && !isPathCell(cell);
}

function makeTowerStats(tower) {
  var base = TOWER_TYPES[tower.type] || TOWER_TYPES.bolt;
  var level = Math.max(1, Math.min(4, tower.level || 1));
  var damageScale = 1 + (level - 1) * 0.52;
  var rangeScale = 1 + (level - 1) * 0.08;
  var cooldownScale = Math.max(0.68, 1 - (level - 1) * 0.08);
  return {
    label: base.label,
    cost: base.cost,
    range: base.range * rangeScale,
    damage: base.damage * damageScale,
    cooldownMs: base.cooldownMs * cooldownScale,
    projectileSpeed: base.projectileSpeed,
    splash: base.splash || 0,
    slowFactor: base.slowFactor || 1,
    slowMs: base.slowMs || 0,
    color: base.color
  };
}

function upgradeCost(tower) {
  var base = TOWER_TYPES[tower.type] || TOWER_TYPES.bolt;
  if (!tower || tower.level >= 4) return Infinity;
  return Math.floor(base.cost * (0.58 + tower.level * 0.54));
}

function cloneTower(tower) {
  return {
    id: tower.id,
    type: tower.type,
    x: tower.x,
    y: tower.y,
    level: tower.level,
    cooldownMs: tower.cooldownMs,
    invested: tower.invested
  };
}

function cloneEnemy(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    speed: enemy.speed,
    reward: enemy.reward,
    damage: enemy.damage,
    segment: enemy.segment,
    progress: enemy.progress,
    slowUntilMs: enemy.slowUntilMs || 0,
    slowFactor: enemy.slowFactor || 1
  };
}

function cloneProjectile(projectile) {
  return {
    id: projectile.id,
    towerId: projectile.towerId,
    targetId: projectile.targetId,
    type: projectile.type,
    x: projectile.x,
    y: projectile.y,
    damage: projectile.damage,
    speed: projectile.speed,
    splash: projectile.splash || 0,
    slowFactor: projectile.slowFactor || 1,
    slowMs: projectile.slowMs || 0,
    color: projectile.color
  };
}

function cloneState(state) {
  return {
    version: VERSION,
    phase: state.phase,
    waveIndex: state.waveIndex,
    credits: state.credits,
    lives: state.lives,
    score: state.score,
    timeMs: state.timeMs,
    spawnTimerMs: state.spawnTimerMs,
    spawnQueue: cloneList(state.spawnQueue, function (type) { return type; }),
    nextId: state.nextId,
    selectedTowerId: state.selectedTowerId || null,
    selectedTowerType: state.selectedTowerType || "bolt",
    abilityMode: !!state.abilityMode,
    orbitalCharges: state.orbitalCharges,
    message: state.message || "",
    rngSeed: normalizeSeed(state.rngSeed),
    towers: cloneList(state.towers, cloneTower),
    enemies: cloneList(state.enemies, cloneEnemy),
    projectiles: cloneList(state.projectiles, cloneProjectile),
    recentHits: cloneList(state.recentHits, function (hit) {
      return { x: hit.x, y: hit.y, radius: hit.radius, untilMs: hit.untilMs, color: hit.color };
    })
  };
}

function nextId(state) {
  state.nextId += 1;
  return state.nextId;
}

function getTowerAt(state, cell) {
  if (!inBounds(cell)) return null;
  for (var i = 0; i < state.towers.length; i += 1) {
    if (state.towers[i].x === cell.x && state.towers[i].y === cell.y) return state.towers[i];
  }
  return null;
}

function startGame(seed) {
  return {
    version: VERSION,
    phase: "planning",
    waveIndex: 0,
    credits: STARTING_CREDITS,
    lives: STARTING_LIVES,
    score: 0,
    timeMs: 0,
    spawnTimerMs: 0,
    spawnQueue: [],
    nextId: 0,
    selectedTowerId: null,
    selectedTowerType: "bolt",
    abilityMode: false,
    orbitalCharges: 1,
    message: "布置炮塔，守住星港航道",
    rngSeed: normalizeSeed(seed),
    towers: [],
    enemies: [],
    projectiles: [],
    recentHits: []
  };
}

function sanitizeState(input) {
  if (!input || typeof input !== "object") return startGame(20260612);
  var base = startGame(input.rngSeed);
  base.phase = ["planning", "running", "won", "lost", "paused"].indexOf(input.phase) >= 0 ? input.phase : "planning";
  base.waveIndex = Math.max(0, Math.min(WAVES.length, Math.floor(Number(input.waveIndex) || 0)));
  base.credits = Math.max(0, Math.floor(Number(input.credits) || 0));
  base.lives = Math.max(0, Math.min(99, Math.floor(Number(input.lives) || 0)));
  base.score = Math.max(0, Math.floor(Number(input.score) || 0));
  base.timeMs = Math.max(0, Math.floor(Number(input.timeMs) || 0));
  base.spawnTimerMs = Math.max(-2000, Math.min(10000, Math.floor(Number(input.spawnTimerMs) || 0)));
  base.spawnQueue = Array.isArray(input.spawnQueue) ? input.spawnQueue.filter(function (type) {
    return !!ENEMY_TYPES[type];
  }).slice(0, 200) : [];
  base.nextId = Math.max(0, Math.floor(Number(input.nextId) || 0));
  base.selectedTowerType = TOWER_TYPES[input.selectedTowerType] ? input.selectedTowerType : "bolt";
  base.selectedTowerId = input.selectedTowerId || null;
  base.abilityMode = !!input.abilityMode;
  base.orbitalCharges = Math.max(0, Math.min(3, Math.floor(Number(input.orbitalCharges) || 0)));
  base.message = String(input.message || base.message).slice(0, 56);

  var occupied = {};
  base.towers = cloneList(input.towers, function (tower) {
    return {
      id: tower.id || "tower-" + randomInt(makeRng(base.rngSeed + base.nextId), 999999),
      type: TOWER_TYPES[tower.type] ? tower.type : "bolt",
      x: Math.floor(Number(tower.x)),
      y: Math.floor(Number(tower.y)),
      level: Math.max(1, Math.min(4, Math.floor(Number(tower.level) || 1))),
      cooldownMs: Math.max(0, Math.floor(Number(tower.cooldownMs) || 0)),
      invested: Math.max(0, Math.floor(Number(tower.invested) || 0))
    };
  }).filter(function (tower) {
    var cell = { x: tower.x, y: tower.y };
    if (!isBuildable(cell) || occupied[cellKey(cell)]) return false;
    occupied[cellKey(cell)] = true;
    return true;
  }).slice(0, GRID_COLS * GRID_ROWS);

  base.enemies = cloneList(input.enemies, function (enemy) {
    var type = ENEMY_TYPES[enemy.type] ? enemy.type : "drone";
    var def = ENEMY_TYPES[type];
    return {
      id: enemy.id || "enemy-" + randomInt(makeRng(base.rngSeed + base.nextId), 999999),
      type: type,
      x: isFinite(Number(enemy.x)) ? Number(enemy.x) : pathPoint(0).x,
      y: isFinite(Number(enemy.y)) ? Number(enemy.y) : pathPoint(0).y,
      hp: Math.max(1, Number(enemy.hp) || def.hp),
      maxHp: Math.max(1, Number(enemy.maxHp) || def.hp),
      speed: Math.max(0.1, Number(enemy.speed) || def.speed),
      reward: Math.max(0, Math.floor(Number(enemy.reward) || def.reward)),
      damage: Math.max(1, Math.floor(Number(enemy.damage) || def.damage)),
      segment: Math.max(0, Math.min(PATH_CELLS.length - 1, Math.floor(Number(enemy.segment) || 0))),
      progress: Math.max(0, Number(enemy.progress) || 0),
      slowUntilMs: Math.max(0, Number(enemy.slowUntilMs) || 0),
      slowFactor: Math.max(0.2, Math.min(1, Number(enemy.slowFactor) || 1))
    };
  }).slice(0, 220);

  base.projectiles = cloneList(input.projectiles, cloneProjectile).filter(function (projectile) {
    return !!projectile.targetId && isFinite(projectile.x) && isFinite(projectile.y);
  }).slice(0, 260);

  base.recentHits = cloneList(input.recentHits, function (hit) {
    return {
      x: Number(hit.x) || 0,
      y: Number(hit.y) || 0,
      radius: Math.max(0.1, Number(hit.radius) || 0.2),
      untilMs: Math.max(0, Number(hit.untilMs) || 0),
      color: hit.color || "#FFFFFF"
    };
  }).slice(0, 40);

  if (base.lives <= 0 && base.phase !== "won") base.phase = "lost";
  if (base.waveIndex >= WAVES.length && base.phase !== "lost") base.phase = "won";
  return base;
}

function selectTowerType(state, towerType) {
  var next = cloneState(sanitizeState(state));
  if (TOWER_TYPES[towerType]) {
    next.selectedTowerType = towerType;
    next.abilityMode = false;
    next.selectedTowerId = null;
    next.message = "已选择 " + TOWER_TYPES[towerType].label;
  }
  return next;
}

function placeTower(state, cell, towerType) {
  var next = cloneState(sanitizeState(state));
  towerType = TOWER_TYPES[towerType] ? towerType : next.selectedTowerType;
  var def = TOWER_TYPES[towerType];
  if (next.phase === "lost" || next.phase === "won") {
    next.message = "战斗已结束";
    return next;
  }
  if (!isBuildable(cell)) {
    next.message = "航道和边界不能建塔";
    return next;
  }
  if (getTowerAt(next, cell)) {
    next.selectedTowerId = getTowerAt(next, cell).id;
    next.message = "已选中炮塔";
    return next;
  }
  if (next.credits < def.cost) {
    next.message = "星币不足，需要 " + def.cost;
    return next;
  }
  var tower = {
    id: "tower-" + nextId(next),
    type: towerType,
    x: cell.x,
    y: cell.y,
    level: 1,
    cooldownMs: 0,
    invested: def.cost
  };
  next.towers.push(tower);
  next.credits -= def.cost;
  next.selectedTowerId = tower.id;
  next.abilityMode = false;
  next.message = "部署 " + def.label;
  return next;
}

function selectCell(state, cell) {
  var next = cloneState(sanitizeState(state));
  var tower = getTowerAt(next, cell);
  if (tower) {
    next.selectedTowerId = tower.id;
    next.abilityMode = false;
    next.message = "已选中 " + TOWER_TYPES[tower.type].label + " Lv." + tower.level;
  } else {
    next.selectedTowerId = null;
    next.message = isPathCell(cell) ? "这是敌方航道" : "可部署炮塔";
  }
  return next;
}

function getSelectedTower(state) {
  if (!state.selectedTowerId) return null;
  for (var i = 0; i < state.towers.length; i += 1) {
    if (state.towers[i].id === state.selectedTowerId) return state.towers[i];
  }
  return null;
}

function upgradeSelectedTower(state) {
  var next = cloneState(sanitizeState(state));
  var tower = getSelectedTower(next);
  if (!tower) {
    next.message = "先选中一座炮塔";
    return next;
  }
  if (tower.level >= 4) {
    next.message = "炮塔已满级";
    return next;
  }
  var cost = upgradeCost(tower);
  if (next.credits < cost) {
    next.message = "升级需要 " + cost + " 星币";
    return next;
  }
  next.credits -= cost;
  tower.invested += cost;
  tower.level += 1;
  tower.cooldownMs = Math.min(tower.cooldownMs, makeTowerStats(tower).cooldownMs * 0.5);
  next.message = TOWER_TYPES[tower.type].label + " 升到 Lv." + tower.level;
  return next;
}

function sellSelectedTower(state) {
  var next = cloneState(sanitizeState(state));
  var tower = getSelectedTower(next);
  if (!tower) {
    next.message = "先选中一座炮塔";
    return next;
  }
  var refund = Math.floor((tower.invested || TOWER_TYPES[tower.type].cost) * 0.62);
  next.towers = next.towers.filter(function (item) {
    return item.id !== tower.id;
  });
  next.credits += refund;
  next.selectedTowerId = null;
  next.message = "回收炮塔 +" + refund + " 星币";
  return next;
}

function startWave(state) {
  var next = cloneState(sanitizeState(state));
  if (next.phase === "lost" || next.phase === "won") return next;
  if (next.phase === "running") {
    next.message = "敌袭正在进行";
    return next;
  }
  if (next.waveIndex >= WAVES.length) {
    next.phase = "won";
    next.message = "星港防线完成";
    return next;
  }
  var wave = WAVES[next.waveIndex];
  next.phase = "running";
  next.spawnQueue = expandWave(wave);
  next.spawnTimerMs = 0;
  next.message = "第 " + (next.waveIndex + 1) + " 波：" + wave.name;
  return next;
}

function pauseGame(state) {
  var next = cloneState(sanitizeState(state));
  if (next.phase === "running") {
    next.phase = "paused";
    next.message = "已暂停";
  } else if (next.phase === "paused") {
    next.phase = "running";
    next.message = "继续防守";
  }
  return next;
}

function makeEnemy(state, type) {
  var def = ENEMY_TYPES[type] || ENEMY_TYPES.drone;
  var start = pathPoint(0);
  var jitter = (random(makeRng(state.rngSeed + state.nextId * 17)) - 0.5) * 0.08;
  return {
    id: "enemy-" + nextId(state),
    type: type,
    x: start.x,
    y: start.y + jitter,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    reward: def.reward,
    damage: def.damage,
    segment: 0,
    progress: 0,
    slowUntilMs: 0,
    slowFactor: 1
  };
}

function spawnEnemies(state, dtMs) {
  if (!state.spawnQueue.length) return;
  var wave = WAVES[Math.min(state.waveIndex, WAVES.length - 1)];
  state.spawnTimerMs -= dtMs;
  var guard = 0;
  while (state.spawnTimerMs <= 0 && state.spawnQueue.length && guard < 8) {
    var type = state.spawnQueue.shift();
    state.enemies.push(makeEnemy(state, type));
    state.spawnTimerMs += wave.intervalMs;
    guard += 1;
  }
}

function moveEnemy(enemy, state, dtMs) {
  var remaining = enemy.speed * (dtMs / 1000);
  if (enemy.slowUntilMs > state.timeMs) remaining *= enemy.slowFactor;
  while (remaining > 0 && enemy.segment < PATH_CELLS.length - 1) {
    var from = { x: enemy.x, y: enemy.y };
    var to = pathPoint(enemy.segment + 1);
    var dist = distance(from, to);
    if (dist <= 0.0001) {
      enemy.segment += 1;
      enemy.progress = enemy.segment;
      continue;
    }
    if (remaining >= dist) {
      enemy.x = to.x;
      enemy.y = to.y;
      enemy.segment += 1;
      enemy.progress = enemy.segment;
      remaining -= dist;
    } else {
      enemy.x += (to.x - from.x) / dist * remaining;
      enemy.y += (to.y - from.y) / dist * remaining;
      enemy.progress = enemy.segment + (1 - distance(enemy, to) / distance(pathPoint(enemy.segment), to));
      remaining = 0;
    }
  }
  return enemy.segment >= PATH_CELLS.length - 1;
}

function findEnemyById(state, id) {
  for (var i = 0; i < state.enemies.length; i += 1) {
    if (state.enemies[i].id === id) return state.enemies[i];
  }
  return null;
}

function chooseTarget(state, tower, stats) {
  var origin = { x: tower.x + 0.5, y: tower.y + 0.5 };
  var best = null;
  for (var i = 0; i < state.enemies.length; i += 1) {
    var enemy = state.enemies[i];
    if (enemy.hp <= 0) continue;
    if (distance(origin, enemy) > stats.range) continue;
    if (!best || enemy.progress > best.progress || (enemy.progress === best.progress && enemy.hp > best.hp)) {
      best = enemy;
    }
  }
  return best;
}

function fireTower(state, tower, target, stats) {
  var origin = { x: tower.x + 0.5, y: tower.y + 0.5 };
  state.projectiles.push({
    id: "projectile-" + nextId(state),
    towerId: tower.id,
    targetId: target.id,
    type: tower.type,
    x: origin.x,
    y: origin.y,
    damage: stats.damage,
    speed: stats.projectileSpeed,
    splash: stats.splash,
    slowFactor: stats.slowFactor,
    slowMs: stats.slowMs,
    color: stats.color
  });
}

function updateTowers(state, dtMs) {
  for (var i = 0; i < state.towers.length; i += 1) {
    var tower = state.towers[i];
    var stats = makeTowerStats(tower);
    tower.cooldownMs = Math.max(0, tower.cooldownMs - dtMs);
    if (tower.cooldownMs > 0) continue;
    var target = chooseTarget(state, tower, stats);
    if (!target) continue;
    fireTower(state, tower, target, stats);
    tower.cooldownMs = stats.cooldownMs;
  }
}

function applyDamage(state, enemy, projectile, multiplier) {
  var amount = projectile.damage * (multiplier == null ? 1 : multiplier);
  enemy.hp -= amount;
  if (projectile.slowMs && projectile.slowFactor < enemy.slowFactor) {
    enemy.slowFactor = projectile.slowFactor;
    enemy.slowUntilMs = Math.max(enemy.slowUntilMs, state.timeMs + projectile.slowMs);
  } else if (projectile.slowMs) {
    enemy.slowUntilMs = Math.max(enemy.slowUntilMs, state.timeMs + projectile.slowMs);
    enemy.slowFactor = Math.min(enemy.slowFactor, projectile.slowFactor);
  }
}

function explodeProjectile(state, projectile, target) {
  applyDamage(state, target, projectile, 1);
  var radius = projectile.splash || 0;
  if (radius > 0) {
    for (var i = 0; i < state.enemies.length; i += 1) {
      var enemy = state.enemies[i];
      if (enemy.id === target.id || enemy.hp <= 0) continue;
      var dist = distance(enemy, target);
      if (dist <= radius) applyDamage(state, enemy, projectile, Math.max(0.35, 1 - dist / (radius * 1.4)));
    }
  }
  state.recentHits.push({
    x: target.x,
    y: target.y,
    radius: Math.max(0.22, radius || 0.22),
    untilMs: state.timeMs + 180,
    color: projectile.color
  });
}

function updateProjectiles(state, dtMs) {
  var kept = [];
  for (var i = 0; i < state.projectiles.length; i += 1) {
    var projectile = state.projectiles[i];
    var target = findEnemyById(state, projectile.targetId);
    if (!target || target.hp <= 0) continue;
    var step = projectile.speed * (dtMs / 1000);
    var dist = distance(projectile, target);
    if (dist <= step || dist < 0.08) {
      explodeProjectile(state, projectile, target);
      continue;
    }
    projectile.x += (target.x - projectile.x) / dist * step;
    projectile.y += (target.y - projectile.y) / dist * step;
    kept.push(projectile);
  }
  state.projectiles = kept;
}

function killEnemy(state, enemy) {
  var def = ENEMY_TYPES[enemy.type];
  state.credits += enemy.reward;
  state.score += enemy.reward * 10 + Math.floor(enemy.maxHp);
  if (def && def.splitInto) {
    for (var i = 0; i < 2; i += 1) {
      var child = makeEnemy(state, def.splitInto);
      child.x = enemy.x + (i ? 0.08 : -0.08);
      child.y = enemy.y;
      child.segment = enemy.segment;
      child.progress = enemy.progress;
      child.hp = Math.floor(child.hp * 0.55);
      child.maxHp = child.hp;
      state.enemies.push(child);
    }
  }
}

function cleanupEnemies(state) {
  var kept = [];
  for (var i = 0; i < state.enemies.length; i += 1) {
    var enemy = state.enemies[i];
    if (enemy.hp <= 0) {
      killEnemy(state, enemy);
    } else {
      kept.push(enemy);
    }
  }
  state.enemies = kept;
}

function completeWaveIfNeeded(state) {
  if (state.phase !== "running") return;
  if (state.spawnQueue.length || state.enemies.length || state.projectiles.length) return;
  var wave = WAVES[state.waveIndex];
  state.credits += wave.bonus;
  state.score += 250 + state.lives * 8 + state.waveIndex * 90;
  state.waveIndex += 1;
  state.orbitalCharges = Math.min(3, state.orbitalCharges + 1);
  if (state.waveIndex >= WAVES.length) {
    state.phase = "won";
    state.message = "星港防线守住了";
  } else {
    state.phase = "planning";
    state.message = "波次清除，获得 +" + wave.bonus + " 星币";
  }
}

function trimEffects(state) {
  state.recentHits = state.recentHits.filter(function (hit) {
    return hit.untilMs > state.timeMs;
  }).slice(-40);
}

function tick(state, dtMs) {
  var next = cloneState(sanitizeState(state));
  dtMs = Math.max(0, Math.min(120, Number(dtMs) || 0));
  if (next.phase !== "running" || dtMs <= 0) return next;
  next.timeMs += dtMs;
  spawnEnemies(next, dtMs);

  var survivors = [];
  for (var i = 0; i < next.enemies.length; i += 1) {
    var enemy = next.enemies[i];
    var escaped = moveEnemy(enemy, next, dtMs);
    if (escaped) {
      next.lives = Math.max(0, next.lives - enemy.damage);
      next.message = "有敌舰突破防线";
    } else {
      survivors.push(enemy);
    }
  }
  next.enemies = survivors;

  updateTowers(next, dtMs);
  updateProjectiles(next, dtMs);
  cleanupEnemies(next);
  trimEffects(next);

  if (next.lives <= 0) {
    next.phase = "lost";
    next.message = "星港核心失守";
    next.spawnQueue = [];
  } else {
    completeWaveIfNeeded(next);
  }
  return next;
}

function castOrbitalStrike(state, cell) {
  var next = cloneState(sanitizeState(state));
  if (!inBounds(cell)) {
    next.message = "选择打击坐标";
    return next;
  }
  if (next.phase === "lost" || next.phase === "won") return next;
  if (next.orbitalCharges <= 0) {
    next.message = "轨道打击充能不足";
    return next;
  }
  var center = { x: cell.x + 0.5, y: cell.y + 0.5 };
  var radius = 1.35;
  var hit = 0;
  for (var i = 0; i < next.enemies.length; i += 1) {
    var enemy = next.enemies[i];
    var dist = distance(enemy, center);
    if (dist <= radius) {
      enemy.hp -= 95 * Math.max(0.4, 1 - dist / (radius * 1.5));
      hit += 1;
    }
  }
  next.orbitalCharges -= 1;
  next.abilityMode = false;
  next.recentHits.push({ x: center.x, y: center.y, radius: radius, untilMs: next.timeMs + 360, color: "#FFFFFF" });
  cleanupEnemies(next);
  next.message = hit ? "轨道打击命中 " + hit + " 个目标" : "轨道打击未命中";
  return next;
}

function toggleAbilityMode(state) {
  var next = cloneState(sanitizeState(state));
  if (next.orbitalCharges <= 0) {
    next.message = "轨道打击充能不足";
    next.abilityMode = false;
  } else {
    next.abilityMode = !next.abilityMode;
    next.selectedTowerId = null;
    next.message = next.abilityMode ? "选择轨道打击坐标" : "取消轨道打击";
  }
  return next;
}

function getWaveSummary(state) {
  var index = Math.min(Math.max(0, state.waveIndex || 0), WAVES.length - 1);
  var wave = WAVES[index];
  return {
    index: index,
    total: WAVES.length,
    name: wave ? wave.name : "完成",
    remainingQueue: state.spawnQueue ? state.spawnQueue.length : 0,
    activeEnemies: state.enemies ? state.enemies.length : 0
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    VERSION: VERSION,
    GRID_COLS: GRID_COLS,
    GRID_ROWS: GRID_ROWS,
    PATH_CELLS: PATH_CELLS,
    TOWER_TYPES: TOWER_TYPES,
    ENEMY_TYPES: ENEMY_TYPES,
    WAVES: WAVES,
    STARTING_CREDITS: STARTING_CREDITS,
    STARTING_LIVES: STARTING_LIVES,
    startGame: startGame,
    sanitizeState: sanitizeState,
    cloneState: cloneState,
    inBounds: inBounds,
    isPathCell: isPathCell,
    isBuildable: isBuildable,
    getTowerAt: getTowerAt,
    makeTowerStats: makeTowerStats,
    upgradeCost: upgradeCost,
    selectTowerType: selectTowerType,
    placeTower: placeTower,
    selectCell: selectCell,
    upgradeSelectedTower: upgradeSelectedTower,
    sellSelectedTower: sellSelectedTower,
    startWave: startWave,
    pauseGame: pauseGame,
    tick: tick,
    castOrbitalStrike: castOrbitalStrike,
    toggleAbilityMode: toggleAbilityMode,
    getWaveSummary: getWaveSummary,
    distance: distance,
    pathPoint: pathPoint
  };
}
