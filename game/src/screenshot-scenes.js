// screenshot-scenes.js — Puerto Serena: Neon Tide
// One job: stage the four screenshot scenes (?shot=chase|neon|boat|
// progress, with &seed=N). Each scene builds a fresh seeded world,
// then places the REAL game state — player, vehicles, police, crowd,
// HUD values, mission banner — exactly as gameplay would, only
// composed for the contact sheet: few, big actors; bold colour; every
// important element thick enough to survive a thumbnail shrink.

import { createCar } from './vehicles-cars.js';
import { createBoat, launchPoliceBoat } from './boats.js';
import { listLandmarks } from './districts.js';

// Stage entry point. Called once by main when ?shot= is present.
export function stageScreenshotScene(G, name, seed) {
  const L = listLandmarks();
  G.progress.cash = 12450;
  if (name === 'neon') stageNeonScene(G, L);
  else if (name === 'boat') stageBoatScene(G, L);
  else if (name === 'progress') stageProgressScene(G, L);
  else stageChaseScene(G, L);
  void seed;
}

// 1 — THE COVER: a five-star escape down a Centro Aurelio avenue at
// golden hour, helicopter searchlight at the frame's edge.
export function stageChaseScene(G, L) {
  G.weather.setHour(17.5);
  G.weather.scriptRain(0);
  const px = 2960;
  const py = 1700;
  // The player: red Sirena GT supercar, mid-escape, heading east.
  const hero = G.spawnCar('supercar', px, py, 0, '#e8232a', 'player');
  hero.speed = 330;
  G.player.inVehicle = hero;
  G.player.x = px;
  G.player.y = py;
  // Skid marks curling behind the hero car.
  for (let i = 0; i < 16; i++) {
    G.effects.skidMark(px - 60 - i * 26, py + 16 + Math.sin(i * 0.6) * 9, 0.1, 1);
    G.effects.skidMark(px - 60 - i * 26, py - 16 - Math.sin(i * 0.6) * 7, 0.1, 1);
  }
  // Four police cars: two close behind, one alongside, one roadblock.
  G.police.heat = 500;
  G.police.heatFlash = 2;
  const copPositions = [
    { x: px - 185, y: py - 34, angle: 0 },
    { x: px - 330, y: py + 42, angle: 0.06 },
    { x: px - 60, y: py - 54, angle: 0 },
  ];
  for (const c of copPositions) {
    const cop = createCar('police', c.x, c.y, c.angle, '#f2f4f6', 'police');
    cop.speed = 320;
    G.police.cars.push(cop);
  }
  const block = createCar('police', px + 380, py + 6, Math.PI / 2, '#f2f4f6', 'roadblock');
  G.police.roadblocks.push(block);
  const block2 = createCar('police', px + 380, py - 62, Math.PI / 2, '#f2f4f6', 'roadblock');
  G.police.roadblocks.push(block2);
  // The helicopter at the frame's top-right edge, light on the hero.
  G.police.heli.active = true;
  G.police.heli.x = px + 330;
  G.police.heli.y = py - 260;
  G.police.heli.angle = Math.PI * 0.8;
  // Dense traffic ahead and behind.
  const trafficSpots = [
    { cls: 'taxi', x: px + 240, y: py + 118, angle: 0, color: '#ffc21a' },
    { cls: 'sedan', x: px + 470, y: py - 120, angle: Math.PI, color: '#33415c' },
    { cls: 'suv', x: px - 470, y: py + 120, angle: 0, color: '#5c6650' },
    { cls: 'compact', x: px + 120, y: py + 210, angle: 0, color: '#3e8ae2' },
    { cls: 'van', x: px - 560, y: py - 200, angle: Math.PI, color: '#e8e4da' },
    { cls: 'muscle', x: px + 560, y: py + 60, angle: 0, color: '#f2762e' },
  ];
  for (const t of trafficSpots) {
    const car = G.spawnCar(t.cls, t.x, t.y, t.angle, t.color, 'traffic');
    car.speed = 120;
  }
  // Pedestrians fleeing on both sidewalks.
  G.crowd.maintainDensity(px, py);
  for (const ped of G.crowd.pedestrians) {
    const d = Math.hypot(ped.x - px, ped.y - py);
    if (d < 560) {
      ped.state = 'flee';
      ped.stateTimer = 3;
      ped.angle = Math.atan2(ped.y - py, ped.x - px);
    }
  }
  // HUD: SMG out, finale banner, full heat.
  G.arsenal.switchTo('smg');
  G.arsenal.ammo.smg.mag = 24;
  G.arsenal.ammo.smg.reserve = 180;
  G.player.health = 82;
  G.player.armour = 45;
  G.objectiveOverride = {
    title: 'ESCAPE WITH THE VAULT GOLD — REACH THE MARINA',
    checklist: [
      { text: 'Crack the vault', done: true },
      { text: 'Escape with the vault gold — reach the Marina', done: false, current: true },
    ],
    marker: { x: L.marinaDock.x, y: L.marinaDock.y, label: 'MARINA' },
    meter: null,
  };
  G.camera.snapTo(px + 60, py);
}

// 2 — Barrio Neón at night in the rain: on foot in a crowd under the
// signs, mid-tail with the detection meter half full.
export function stageNeonScene(G, L) {
  G.weather.setHour(21.7);
  G.weather.scriptRain(0.9);
  const px = 4150;
  const py = 1230;
  G.player.x = px;
  G.player.y = py;
  G.player.angle = 0.4;
  G.player.aimAngle = 0.4;
  // A crowd of fifteen-plus around the player, umbrellas up.
  G.crowd.maintainDensity(px, py);
  let placed = 0;
  for (const ped of G.crowd.pedestrians) {
    if (placed >= 17) break;
    const a = (placed / 17) * Math.PI * 2;
    ped.x = px + Math.cos(a) * (60 + (placed % 4) * 44);
    ped.y = py + Math.sin(a) * (46 + (placed % 3) * 40);
    ped.state = 'walk';
    ped.umbrella = true;
    placed += 1;
  }
  // The courier, ahead in the crowd, in a dark sedan at the kerb.
  const courier = G.spawnCar('sedan', px + 300, py - 60, 0, '#33415c', 'courier');
  courier.speed = 60;
  // Parked bikes at the kerb.
  for (let i = 0; i < 3; i++) {
    const bike = createCar('bike', px - 130 + i * 52, py + 128, Math.PI / 2, ['#e8232a', '#37e6ff', '#191d24'][i], 'parked');
    G.traffic.parked.push(bike);
  }
  // A patrol car watches from down the avenue.
  const cop = createCar('police', px - 330, py - 150, 0.3, '#f2f4f6', 'police');
  G.police.cars.push(cop);
  G.police.heat = 150;
  G.arsenal.switchTo('pistol');
  G.player.health = 94;
  G.objectiveOverride = {
    title: 'FOLLOW THE COURIER — DON’T BE SPOTTED',
    checklist: [
      { text: 'Reach the Mercado overlook', done: true },
      { text: 'Follow the courier — don’t be spotted', done: false, current: true },
    ],
    marker: { x: px + 300, y: py - 60, label: 'COURIER' },
    meter: { label: 'DETECTION', frac: 0.5, danger: true },
  };
  void L;
  G.camera.snapTo(px + 30, py);
}

// 3 — The bay at late afternoon: a speedboat run for Isla Faros with a
// police boat alongside and the player firing back.
export function stageBoatScene(G, L) {
  G.weather.setHour(16.3);
  G.weather.scriptRain(0);
  // Open water west of Isla Faros: the marina docks across the top of
  // the frame, the island's lighthouse point on the right.
  const px = 3950;
  const py = 3850;
  const hero = G.spawnBoat('speedboat', px, py, -0.1, '#f2762e', 'player');
  hero.speed = 320;
  G.player.inVehicle = hero;
  G.player.x = px;
  G.player.y = py;
  // The police boat alongside, officer visible, lights flashing.
  const copBoat = launchPoliceBoat(px - 135, py + 98, -0.04);
  copBoat.speed = 300;
  G.police.boats.push(copBoat);
  G.police.heat = 290;
  // A second police boat further back, and harbour dressing boats.
  const cop2 = launchPoliceBoat(px - 430, py - 150, 0.08);
  cop2.speed = 260;
  G.police.boats.push(cop2);
  const skiff = createBoat('skiff', px + 300, py - 300, 2.4, '#c9862f', 'parked');
  G.dynamicBoats.push(skiff);
  // Wake curling behind both fast boats.
  for (let i = 0; i < 12; i++) {
    G.effects.wake(px - 40 - i * 34, py + i * 3, -0.12, 20);
    G.effects.wake(px - 170 - i * 34, py + 96 + i * 3, -0.05, 20);
  }
  G.effects.spray(px + 30, py, G.rng, 6);
  // The player fires back: tracers and a muzzle flash toward the cop.
  const aim = Math.atan2((py + 96) - py, (px - 130) - px);
  for (let i = 0; i < 4; i++) {
    G.bullets.push({
      x: px - 20 - i * 26, y: py + 22 + i * 15,
      vx: Math.cos(aim) * 1250, vy: Math.sin(aim) * 1250,
      life: 0.4, damage: 15, from: 'player',
    });
  }
  G.effects.muzzleFlash(px - 6, py + 16, aim);
  G.arsenal.switchTo('smg');
  G.arsenal.ammo.smg.mag = 9;
  G.arsenal.ammo.smg.reserve = 34;
  G.player.health = 46;
  G.player.armour = 18;
  G.objectiveOverride = {
    title: 'WET CARGO — REACH ISLA FAROS',
    checklist: [
      { text: 'Board the speedboat at the docks', done: true },
      { text: 'Wet cargo — reach Isla Faros', done: false, current: true },
      { text: 'Lose the maritime police', done: false },
    ],
    marker: { x: L.islandCove.x, y: L.islandCove.y, label: 'ISLA FAROS' },
    meter: null,
  };
  G.camera.snapTo(px + 100, py - 20);
}

// 4 — Progress: pause over Playa Serena at dusk — full-city map on
// the left, the story panel on the right, the city alive behind.
export function stageProgressScene(G, L) {
  G.weather.setHour(18.2);
  G.weather.scriptRain(0);
  const px = 1750;
  const py = 3120;
  G.player.x = px;
  G.player.y = py;
  G.player.angle = Math.PI / 2;
  // A staged mid-game run: seven missions done, the eighth current.
  G.progress.missionsDone = [true, true, true, true, true, true, true, false, false, false];
  G.progress.cash = 8640;
  G.progress.respectPoints = 560;
  G.progress.respectLevel = 6;
  G.progress.racesWon = [true, true, true, false];
  G.progress.raceBest = [52.4, 68.9, 58.2, null];
  G.progress.shellsFound = [true, true, true, true, true, true, true, true, true, false, false, false, false, false, false];
  G.progress.exportsDone = [true, true, true, true, false, false];
  G.progress.stats.carsDriven = 23;
  G.progress.stats.boatsDriven = 4;
  G.progress.stats.distanceKm = 41.6;
  // Life behind the panel: beach traffic and strollers.
  const taxi = G.spawnCar('taxi', px + 260, py + 130, 0, '#ffc21a', 'traffic');
  taxi.speed = 110;
  const sedan = G.spawnCar('sedan', px - 320, py + 130, Math.PI, '#c0c6ce', 'traffic');
  sedan.speed = 90;
  G.crowd.maintainDensity(px, py);
  G.state = 'progress';
  void L;
  G.camera.snapTo(px, py);
}
