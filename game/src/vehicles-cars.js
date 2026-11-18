// vehicles-cars.js — Puerto Serena: Neon Tide
// One job: the cars. Ten road classes plus a motorcycle, each with its
// own speed, grip, size and silhouette; arcade driving physics with
// drift, skid marks and crash damage; car-to-car and car-to-city
// collision; and the drawing of every vehicle, police light bars and
// headlight cones included.

import { CONFIG, clamp, lerp, turnToward, angleDelta } from './config.js';
import { collideCircleWithCity, isWaterAt } from './city-map.js';
import { drawHeadlightCone } from './renderer-camera.js';

// The class table: name, size, performance, paint options, flavour.
export function buildCarClassTable() {
  return {
    compact: { label: 'Brisa Compact', w: 44, h: 24, topSpeed: 300, accel: 260, grip: 3.4, colors: ['#e2543e', '#3e8ae2', '#f2b134', '#7bc950', '#e8e4da'] },
    sedan: { label: 'Aurelio Sedan', w: 52, h: 26, topSpeed: 340, accel: 280, grip: 3.6, colors: ['#c0c6ce', '#33415c', '#7a1f1f', '#1f4d3a', '#e8e4da'] },
    muscle: { label: 'Toro Muscle', w: 54, h: 27, topSpeed: 400, accel: 360, grip: 2.7, colors: ['#e2543e', '#191d24', '#f2762e', '#5b2a86'] },
    sports: { label: 'Véla Sports', w: 52, h: 25, topSpeed: 460, accel: 420, grip: 3.9, colors: ['#ffd23e', '#e23e8a', '#37e6ff', '#f2f2f2'] },
    supercar: { label: 'Sirena GT Supercar', w: 54, h: 26, topSpeed: 540, accel: 500, grip: 4.2, colors: ['#e8232a', '#ff7a1a', '#12b5a5', '#f2f2f2'] },
    suv: { label: 'Colina SUV', w: 56, h: 29, topSpeed: 330, accel: 270, grip: 3.2, colors: ['#5c6650', '#33415c', '#8a8f96', '#191d24'] },
    pickup: { label: 'Mula Pickup', w: 55, h: 28, topSpeed: 320, accel: 280, grip: 3.1, colors: ['#c9862f', '#7a4a21', '#4d6b8a', '#a33b2e'] },
    van: { label: 'Carga Van', w: 58, h: 30, topSpeed: 290, accel: 230, grip: 2.9, colors: ['#e8e4da', '#8a8f96', '#3a7bc6', '#c65a3a'] },
    taxi: { label: 'Taxi Serena', w: 52, h: 26, topSpeed: 350, accel: 300, grip: 3.5, colors: ['#ffc21a'] },
    police: { label: 'Interceptor', w: 54, h: 27, topSpeed: 470, accel: 440, grip: 4.0, colors: ['#f2f4f6'] },
    bike: { label: 'Ola 250 Bike', w: 34, h: 15, topSpeed: 430, accel: 430, grip: 4.6, colors: ['#e8232a', '#191d24', '#37e6ff', '#7bc950'] },
  };
}

export const CAR_CLASSES = buildCarClassTable();

// Create a car object of a class at a pose. Role decides who drives it.
export function createCar(cls, x, y, angle, color, role = 'parked') {
  const spec = CAR_CLASSES[cls] || CAR_CLASSES.sedan;
  return {
    kind: 'car',
    cls,
    spec,
    x, y,
    angle,
    speed: 0,
    steerVis: 0,
    color: color || spec.colors[0],
    health: 100,
    maxHealth: 100,
    role,
    radius: Math.max(spec.w, spec.h) / 2,
    lightPhase: Math.random() * Math.PI * 2,
    driverName: null,
    locked: false,       // supercars lock until respect unlocks them
    smoking: false,
    wrecked: false,
    hornTimer: 0,
  };
}

// A random civilian class for traffic and parking.
export function randomCivilianClass(rng) {
  return rng.pick(['compact', 'sedan', 'sedan', 'suv', 'pickup', 'van', 'taxi', 'muscle', 'sports', 'compact']);
}

// Drive one car for a frame. control: {throttle -1..1, steer -1..1,
// handbrake bool}. Returns a crash strength (0 = no crash).
export function updateCarPhysics(dt, car, control, layout, effects, rng) {
  if (car.wrecked) {
    car.speed = lerp(car.speed, 0, dt * 4);
    return 0;
  }
  const spec = car.spec;
  const throttle = clamp(control.throttle || 0, -1, 1);
  const steer = clamp(control.steer || 0, -1, 1);
  const maxF = spec.topSpeed;
  const maxR = spec.topSpeed * 0.38;

  if (throttle > 0) car.speed += spec.accel * throttle * dt * (1 - Math.max(0, car.speed) / (maxF * 1.15));
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= spec.accel * 1.5 * dt; // braking
    else car.speed += spec.accel * 0.55 * throttle * dt * (1 - Math.max(0, -car.speed) / (maxR * 1.15));
  } else {
    car.speed = lerp(car.speed, 0, dt * 0.7);
  }
  if (control.handbrake) car.speed = lerp(car.speed, 0, dt * 2.6);
  car.speed = clamp(car.speed, -maxR, maxF);

  // Steering authority grows with speed, fades at the very top.
  const authority = clamp(Math.abs(car.speed) / 90, 0, 1) * clamp(1.25 - Math.abs(car.speed) / (maxF * 2.4), 0.45, 1);
  const turnRate = steer * spec.grip * authority * (car.speed < 0 ? -1 : 1);
  car.angle += turnRate * dt;
  car.steerVis = lerp(car.steerVis, steer, dt * 10);

  const drifting = control.handbrake && Math.abs(car.speed) > 120;
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  let nx = car.x + vx * dt;
  let ny = car.y + vy * dt;

  // Skids and dust while drifting or cornering hard.
  if ((drifting || (Math.abs(turnRate) > 1.9 && Math.abs(car.speed) > 170)) && Math.abs(car.speed) > 60) {
    const backX = car.x - Math.cos(car.angle) * spec.w * 0.36;
    const backY = car.y - Math.sin(car.angle) * spec.w * 0.36;
    const sideX = Math.cos(car.angle + Math.PI / 2) * spec.h * 0.4;
    const sideY = Math.sin(car.angle + Math.PI / 2) * spec.h * 0.4;
    effects.skidMark(backX + sideX, backY + sideY, car.angle, 1);
    effects.skidMark(backX - sideX, backY - sideY, car.angle, 1);
    if (rng.chance(0.4)) effects.dust(backX, backY, rng);
  }

  const before = { x: car.x, y: car.y };
  const resolved = collideCircleWithCity(layout, nx, ny, car.radius * 0.82);
  let crash = 0;
  if (resolved.hit) {
    const impact = Math.abs(car.speed);
    if (impact > 130) {
      crash = clamp((impact - 130) / 300, 0.15, 1);
      damageCar(car, crash * 22, effects, rng);
      effects.addShake(crash * 9);
    }
    car.speed *= 0.35;
  }
  car.x = resolved.x;
  car.y = resolved.y;
  if (crash > 0 && Math.hypot(car.x - before.x, car.y - before.y) < 0.5) car.speed = 0;

  car.smoking = car.health < 42;
  if (car.smoking && rng.chance(0.3)) {
    effects.smoke(car.x + Math.cos(car.angle) * spec.w * 0.4, car.y + Math.sin(car.angle) * spec.w * 0.4, rng, car.health < 20);
  }
  car.hornTimer = Math.max(0, car.hornTimer - dt);
  return crash;
}

// Damage a car; at zero health it is a wreck (engine dead, smoking).
export function damageCar(car, amount, effects, rng) {
  if (car.wrecked) return;
  car.health -= amount;
  if (effects && rng) effects.sparks(car.x, car.y, rng, 5);
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    if (effects) effects.addShake(6);
  }
}

// Simple circle separation between two cars; returns impact strength.
export function collideCars(a, b, effects, rng) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.radius * 0.86 + b.radius * 0.86;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const push = (rr - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
  const impact = clamp(rel / 320, 0, 1);
  if (impact > 0.25) {
    damageCar(a, impact * 13, effects, rng);
    damageCar(b, impact * 13, effects, rng);
    const swap = (a.speed + b.speed) / 2;
    a.speed = swap * 0.6;
    b.speed = swap * 0.6;
  }
  return impact;
}

// Can the player take this car? Locked supercars need respect level 5.
export function carEntryBlock(car, progress) {
  if (car.cls === 'supercar' && progress.respectLevel < 5) {
    return 'The Sirena GT is alarmed — reach Respect 5 to hotwire it.';
  }
  return null;
}

// Draw one vehicle. Police cars get light bars; bikes draw slim.
export function drawVehicle(ctx, car, env) {
  const { spec } = car;
  if (env.night > 0.2 && car.role !== 'parked') {
    drawHeadlightCone(ctx, car.x + Math.cos(car.angle) * spec.w * 0.5, car.y + Math.sin(car.angle) * spec.w * 0.5, car.angle, env.night);
  }
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.roundRect(-spec.w / 2 + 4, -spec.h / 2 + 5, spec.w, spec.h, 7); ctx.fill();

  if (car.cls === 'bike') {
    ctx.fillStyle = '#191d24';
    ctx.beginPath(); ctx.roundRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, 6); ctx.fill();
    ctx.fillStyle = car.color;
    ctx.beginPath(); ctx.roundRect(-spec.w / 2 + 5, -spec.h / 2 + 3, spec.w - 16, spec.h - 6, 5); ctx.fill();
    // Rider.
    ctx.fillStyle = '#33415c';
    ctx.beginPath(); ctx.arc(-2, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(3, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  // Body.
  const bodyColor = car.wrecked ? '#4a4d52' : car.color;
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.roundRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h, 8); ctx.fill();
  // Nose taper.
  ctx.fillStyle = shadeColor(bodyColor, 1.12);
  ctx.beginPath(); ctx.roundRect(spec.w * 0.18, -spec.h / 2 + 2, spec.w * 0.32, spec.h - 4, 6); ctx.fill();
  // Cabin glass.
  ctx.fillStyle = 'rgba(16,26,38,0.92)';
  ctx.beginPath(); ctx.roundRect(-spec.w * 0.16, -spec.h / 2 + 4, spec.w * 0.34, spec.h - 8, 5); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,235,0.5)';
  ctx.fillRect(spec.w * 0.08, -spec.h / 2 + 5, 4, spec.h - 10);
  // Class dressing.
  if (car.cls === 'taxi') {
    ctx.fillStyle = '#191d24';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#ffc21a';
    ctx.font = '800 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3.5);
  }
  if (car.cls === 'van' || car.cls === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-spec.w / 2 + 4, -spec.h / 2 + 3, spec.w * 0.4, spec.h - 6);
  }
  if (car.cls === 'supercar' || car.cls === 'sports') {
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    ctx.fillRect(-spec.w / 2 + 2, -spec.h / 2 + 1.5, 7, spec.h - 3); // rear wing
  }
  if (car.cls === 'police') {
    ctx.fillStyle = '#191d24';
    ctx.fillRect(-spec.w * 0.3, -spec.h / 2, spec.w * 0.2, spec.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', 2, 4);
    // Light bar: alternating red/blue, flashing by phase and time.
    const phase = Math.sin(env.time * 11 + car.lightPhase) > 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5e1f1c';
    ctx.fillRect(-9, -spec.h / 2 + 2, 8, spec.h - 4);
    ctx.fillStyle = phase ? '#274b8f' : '#37a6ff';
    ctx.fillRect(1, -spec.h / 2 + 2, 8, spec.h - 4);
    if (env.night > 0.45) {
      ctx.fillStyle = phase ? 'rgba(255,59,48,0.16)' : 'rgba(55,166,255,0.16)';
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Wheels.
  ctx.fillStyle = '#101216';
  const wy = spec.h / 2 - 1;
  for (const [wx, wz] of [[-spec.w * 0.32, 1], [spec.w * 0.32, 1], [-spec.w * 0.32, -1], [spec.w * 0.32, -1]]) {
    ctx.save();
    ctx.translate(wx, wz * wy);
    if (Math.abs(wx) > spec.w * 0.3) ctx.rotate(car.steerVis * 0.4);
    ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  }
  // Damage scratches.
  if (car.health < 60) {
    ctx.strokeStyle = 'rgba(10,10,12,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-spec.w * 0.4, -spec.h * 0.2);
    ctx.lineTo(-spec.w * 0.1, spec.h * 0.15);
    ctx.moveTo(spec.w * 0.3, -spec.h * 0.3);
    ctx.lineTo(spec.w * 0.45, spec.h * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

// Lighten/darken a #rrggbb colour by a factor (local helper).
export function shadeColor(hex, f) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

// Speed in km/h for the HUD speedometer.
export function speedoKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.42);
}
