// boats.js — Puerto Serena: Neon Tide
// One job: the boats. Three classes — skiff, speedboat and the
// syndicate's cigarette boat — with water-only physics, buoyancy bob,
// curling wakes and bow spray, dock/undock at the marinas, and police
// boats that hunt on the bay. Puerto Serena's water is a real second
// road network: missions, chases and escapes all run on it.

import { clamp, lerp } from './config.js';
import { isWaterAt } from './city-map.js';
import { shadeColor } from './vehicles-cars.js';

export class Speedboat {
  constructor(x, y, angle, color) {
    this.kind = 'boat';
    this.cls = 'speedboat';
    this.label = 'Marea Speedboat';
    this.w = 56;
    this.h = 24;
    this.topSpeed = 380;
    this.accel = 330;
    this.turnGrip = 2.2;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.color = color || '#f2f4f6';
    this.health = 100;
    this.maxHealth = 100;
    this.role = 'parked';      // parked | player | police | mission
    this.radius = 30;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.wakeTimer = 0;
    this.wrecked = false;
  }

  // Buoyancy: a gentle vertical bob offset for drawing.
  bobOffset(time) {
    return Math.sin(time * 2.1 + this.bobPhase) * 1.6;
  }
}

// The humble harbour skiff: slow, sturdy, everywhere.
export class HarbourSkiff extends Speedboat {
  constructor(x, y, angle, color) {
    super(x, y, angle, color || '#c9862f');
    this.cls = 'skiff';
    this.label = 'Puerto Skiff';
    this.w = 44;
    this.h = 21;
    this.topSpeed = 240;
    this.accel = 220;
    this.turnGrip = 2.6;
    this.radius = 24;
  }
}

// The Cárdenas cigarette boat: long, black and very fast.
export class CigaretteBoat extends Speedboat {
  constructor(x, y, angle, color) {
    super(x, y, angle, color || '#191d24');
    this.cls = 'cigarette';
    this.label = 'Cárdenas Cigarette';
    this.w = 68;
    this.h = 24;
    this.topSpeed = 470;
    this.accel = 420;
    this.turnGrip = 1.9;
    this.radius = 36;
  }
}

// Factory used by the marina, missions and police.
export function createBoat(cls, x, y, angle, color, role = 'parked') {
  let boat;
  if (cls === 'skiff') boat = new HarbourSkiff(x, y, angle, color);
  else if (cls === 'cigarette') boat = new CigaretteBoat(x, y, angle, color);
  else boat = new Speedboat(x, y, angle, color);
  boat.role = role;
  return boat;
}

// A police launch: a speedboat hull in harbour-police colours.
export function launchPoliceBoat(x, y, angle) {
  const boat = new Speedboat(x, y, angle, '#f2f4f6');
  boat.role = 'police';
  boat.label = 'Policía Marítima';
  return boat;
}

// Drive one boat for a frame. Boats only move on water; nosing into
// land kills speed and scrapes the hull. Returns grounding strength.
export function updateBoatPhysics(dt, boat, control, layout, effects, rng, time) {
  if (boat.wrecked) {
    boat.speed = lerp(boat.speed, 0, dt * 2);
    return 0;
  }
  const throttle = clamp(control.throttle || 0, -1, 1);
  const steer = clamp(control.steer || 0, -1, 1);
  if (throttle > 0) boat.speed += boat.accel * throttle * dt * (1 - Math.max(0, boat.speed) / (boat.topSpeed * 1.12));
  else if (throttle < 0) boat.speed += boat.accel * 0.5 * throttle * dt * (1 - Math.max(0, -boat.speed) / (boat.topSpeed * 0.4));
  else boat.speed = lerp(boat.speed, 0, dt * 0.5);
  boat.speed = clamp(boat.speed, -boat.topSpeed * 0.35, boat.topSpeed);

  const authority = clamp(Math.abs(boat.speed) / 70, 0, 1);
  boat.angle += steer * boat.turnGrip * authority * (boat.speed < 0 ? -1 : 1) * dt;

  const nx = boat.x + Math.cos(boat.angle) * boat.speed * dt;
  const ny = boat.y + Math.sin(boat.angle) * boat.speed * dt;
  let grounded = 0;
  // A boat may touch a dock edge to moor, but land stops it cold.
  if (isWaterAt(layout, nx, ny) || isBesideDock(layout, nx, ny)) {
    boat.x = nx;
    boat.y = ny;
  } else {
    grounded = clamp(Math.abs(boat.speed) / 300, 0.1, 1);
    boat.health -= grounded * 9;
    boat.speed *= -0.18;
    if (effects) effects.addShake(grounded * 7);
    if (boat.health <= 0) {
      boat.health = 0;
      boat.wrecked = true;
    }
  }

  // Wake and spray scale with speed.
  boat.wakeTimer -= dt;
  if (Math.abs(boat.speed) > 46 && boat.wakeTimer <= 0) {
    boat.wakeTimer = 0.05;
    const backX = boat.x - Math.cos(boat.angle) * boat.w * 0.5;
    const backY = boat.y - Math.sin(boat.angle) * boat.w * 0.5;
    effects.wake(backX, backY, boat.angle, boat.h * (0.6 + Math.abs(boat.speed) / boat.topSpeed));
    if (Math.abs(boat.speed) > 190) {
      const bowX = boat.x + Math.cos(boat.angle) * boat.w * 0.5;
      const bowY = boat.y + Math.sin(boat.angle) * boat.w * 0.5;
      effects.spray(bowX, bowY, rng, 2);
    }
  }
  return grounded;
}

// Is this water point within mooring distance of a dock rect?
export function isBesideDock(layout, x, y) {
  for (const d of layout.docks) {
    if (x >= d.x - 26 && x <= d.x + d.w + 26 && y >= d.y - 10 && y <= d.y + d.h + 10) return true;
  }
  return false;
}

// Moorings: where boats wait at the marina and the island jetty.
export function listMoorings() {
  return [
    { x: 3600, y: 3560, angle: Math.PI / 2 },
    { x: 3900, y: 3620, angle: Math.PI / 2 },
    { x: 4200, y: 3560, angle: Math.PI / 2 },
    { x: 4500, y: 3640, angle: Math.PI / 2 },
    { x: 4680, y: 3620, angle: 0 },
    { x: 3680, y: 3700, angle: Math.PI / 2 },
    { x: 4280, y: 3720, angle: Math.PI / 2 },
  ];
}

// The nearest mooring to a point (for the wash-up respawn and AI).
export function nearestMooring(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const m of listMoorings()) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// Draw one boat with its bob, hull stripe and (for police) light bar.
export function drawBoat(ctx, boat, env) {
  const bob = boat.bobOffset(env.time);
  ctx.save();
  ctx.translate(boat.x, boat.y + bob);
  ctx.rotate(boat.angle);
  // Foamy outline on the water.
  ctx.fillStyle = 'rgba(240,250,255,0.4)';
  ctx.beginPath(); ctx.roundRect(-boat.w / 2 - 4, -boat.h / 2 - 4, boat.w + 8, boat.h + 8, 12); ctx.fill();
  // Hull.
  ctx.fillStyle = boat.wrecked ? '#3c4046' : boat.color;
  ctx.beginPath();
  ctx.moveTo(-boat.w / 2, -boat.h / 2 + 3);
  ctx.lineTo(boat.w * 0.28, -boat.h / 2);
  ctx.lineTo(boat.w / 2, 0);
  ctx.lineTo(boat.w * 0.28, boat.h / 2);
  ctx.lineTo(-boat.w / 2, boat.h / 2 - 3);
  ctx.closePath();
  ctx.fill();
  // Deck stripe and cockpit.
  ctx.fillStyle = shadeColor(boat.color === '#191d24' ? '#3a3f46' : boat.color, 0.82);
  ctx.fillRect(-boat.w * 0.3, -boat.h / 2 + 4, boat.w * 0.5, boat.h - 8);
  ctx.fillStyle = 'rgba(16,26,38,0.92)';
  ctx.beginPath(); ctx.roundRect(-boat.w * 0.08, -boat.h / 2 + 5, boat.w * 0.24, boat.h - 10, 4); ctx.fill();
  if (boat.cls === 'cigarette') {
    ctx.fillStyle = '#e8232a';
    ctx.fillRect(-boat.w / 2 + 4, -3, boat.w * 0.6, 6);
  }
  if (boat.role === 'police') {
    ctx.fillStyle = '#191d24';
    ctx.fillRect(-boat.w * 0.34, -boat.h / 2 + 2, boat.w * 0.16, boat.h - 4);
    const phase = Math.sin(env.time * 11 + boat.x) > 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#37a6ff';
    ctx.fillRect(-4, -5, 9, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', -boat.w * 0.05, 3.5);
  }
  ctx.restore();
  // An officer stands in a police boat: visible crew, per the brief.
  if (boat.role === 'police') {
    ctx.fillStyle = '#22355c';
    ctx.beginPath(); ctx.arc(boat.x - 6, boat.y + bob - 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(boat.x - 6, boat.y + bob - 2, 4.6, 0, Math.PI * 2); ctx.fill();
  }
}
