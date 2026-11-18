// combat-weapons.js — Puerto Serena: Neon Tide
// One job: gunplay. Three weapons — pistol, scattergun and SMG — with
// distinct spread, rate, range and sound; mouse aim on foot and
// drive-by fire from cars and boats; tracers, muzzle flash, hit
// sparks and shell casings; and the bullet simulation that resolves
// hits on rivals, officers, pedestrians, vehicles and crates.

import { clamp } from './config.js';
import { circleRectOverlap } from './config.js';

// The three-weapon table. First declaration reads as the feature.
export function weaponStats(name) {
  const table = {
    pistol: {
      label: 'Pistol', damage: 26, rate: 0.24, spread: 0.035, speed: 1150,
      range: 560, pellets: 1, mag: 12, reserve: Infinity, auto: false, kick: 2,
    },
    scattergun: {
      label: 'Scattergun', damage: 13, rate: 0.78, spread: 0.16, speed: 980,
      range: 330, pellets: 7, mag: 6, reserve: 48, auto: false, kick: 7,
    },
    smg: {
      label: 'SMG', damage: 15, rate: 0.085, spread: 0.075, speed: 1250,
      range: 520, pellets: 1, mag: 32, reserve: 220, auto: true, kick: 1.4,
    },
  };
  return table[name] || table.pistol;
}

export const WEAPON_ORDER = ['pistol', 'scattergun', 'smg'];

export class WeaponArsenal {
  constructor() {
    this.current = 'pistol';
    this.ammo = {
      pistol: { mag: 12, reserve: Infinity },
      scattergun: { mag: 6, reserve: 48 },
      smg: { mag: 32, reserve: 220 },
    };
    this.unlocked = { pistol: true, scattergun: true, smg: true };
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.muzzle = null; // {x,y,angle,life} for the render pass
  }

  stats() {
    return weaponStats(this.current);
  }

  switchTo(name) {
    if (!this.unlocked[name]) return false;
    if (this.reloadTimer > 0) return false;
    this.current = name;
    this.cooldown = Math.max(this.cooldown, 0.12);
    return true;
  }

  startReload() {
    const s = this.stats();
    const a = this.ammo[this.current];
    if (this.reloadTimer > 0 || a.mag >= s.mag || a.reserve <= 0) return false;
    this.reloadTimer = this.current === 'scattergun' ? 1.5 : 1.05;
    return true;
  }

  // Try to fire one trigger pull. Spawns bullets into `bullets`.
  // Returns true when a shot actually left the barrel.
  tryFire(dt, shooter, aimAngle, bullets, effects, audio, rng) {
    this.cooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const s = this.stats();
        const a = this.ammo[this.current];
        const take = Math.min(s.mag - a.mag, a.reserve === Infinity ? s.mag : a.reserve);
        a.mag += take;
        if (a.reserve !== Infinity) a.reserve -= take;
      }
      return false;
    }
    if (this.cooldown > 0) return false;
    const s = this.stats();
    const a = this.ammo[this.current];
    if (a.mag <= 0) {
      this.cooldown = 0.3;
      if (audio) audio.dryFire();
      this.startReload();
      return false;
    }
    this.cooldown = s.rate;
    a.mag -= 1;
    const mx = shooter.x + Math.cos(aimAngle) * 24;
    const my = shooter.y + Math.sin(aimAngle) * 24;
    for (let i = 0; i < s.pellets; i++) {
      const ang = aimAngle + rng.range(-s.spread, s.spread);
      bullets.push({
        x: mx, y: my,
        vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
        life: s.range / s.speed, damage: s.damage, from: 'player',
      });
    }
    this.muzzle = { x: mx, y: my, angle: aimAngle, life: 0.06 };
    effects.muzzleFlash(mx, my, aimAngle);
    effects.shellCasing(shooter.x, shooter.y, aimAngle, rng);
    if (audio) audio.gunshot(this.current);
    return true;
  }

  // Add reserve ammunition (mission rewards, paint-shop restock).
  addAmmo(name, rounds) {
    if (this.ammo[name] && this.ammo[name].reserve !== Infinity) {
      this.ammo[name].reserve += rounds;
    }
  }

  ammoText() {
    const a = this.ammo[this.current];
    const reserve = a.reserve === Infinity ? '∞' : a.reserve;
    return `${a.mag} / ${reserve}`;
  }
}

// Move every bullet, resolve every hit. `world` supplies the targets
// and the callbacks for crimes, damage and effects.
export function updateBullets(dt, bullets, world) {
  const { layout, effects, rng } = world;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;

    // Buildings stop bullets cold (with a spark).
    if (!dead) {
      for (const bd of layout.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          effects.sparks(b.x, b.y, rng, 4);
          dead = true;
          break;
        }
      }
    }
    // Crates soak bullets and break.
    if (!dead) {
      for (const c of layout.crates) {
        if (c.health > 0 && b.x > c.x && b.x < c.x + c.w && b.y > c.y && b.y < c.y + c.h) {
          c.health -= b.damage;
          effects.sparks(b.x, b.y, rng, 3);
          dead = true;
          break;
        }
      }
    }

    if (!dead && b.from === 'player') dead = hitFromPlayer(b, world);
    else if (!dead && b.from !== 'player') dead = hitFromHostile(b, world);

    if (dead) bullets.splice(i, 1);
  }
}

function hitFromPlayer(b, world) {
  const { effects, rng, audio } = world;
  // Rivals first — they are the intended targets.
  for (const r of world.rivals) {
    if (r.health > 0 && Math.hypot(r.x - b.x, r.y - b.y) < 17) {
      r.health -= b.damage;
      effects.impactPuff(b.x, b.y, rng);
      if (audio) audio.hitMarker();
      if (r.health <= 0) world.onRivalDown(r);
      return true;
    }
  }
  // Officers: shooting the law is a serious crime.
  for (const o of world.officers) {
    if (Math.hypot(o.x - b.x, o.y - b.y) < 16) {
      o.health = (o.health ?? 60) - b.damage;
      effects.impactPuff(b.x, b.y, rng);
      world.onOfficerHit(o);
      return true;
    }
  }
  // Pedestrians: assault, panic, a tragedy the game never rewards.
  for (const p of world.pedestrians) {
    if (p.state !== 'down' && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      p.state = 'down';
      p.stateTimer = 6;
      effects.impactPuff(b.x, b.y, rng);
      world.onPedestrianHit(p);
      return true;
    }
  }
  // Vehicles: any car can be shot up, including police cars.
  for (const car of world.vehicles) {
    if (circleRectOverlap(b.x, b.y, 4, { x: car.x - car.spec.w / 2, y: car.y - car.spec.h / 2, w: car.spec.w, h: car.spec.h })) {
      car.health -= b.damage * 0.7;
      effects.sparks(b.x, b.y, rng, 5);
      if (car.health <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
      }
      if (car.role === 'police') world.onCrime('assault');
      return true;
    }
  }
  return false;
}

function hitFromHostile(b, world) {
  const { player, effects, rng } = world;
  const focus = player.focus();
  const inVehicle = player.inVehicle;
  if (Math.hypot(focus.x - b.x, focus.y - b.y) < (inVehicle ? inVehicle.radius : 16)) {
    if (inVehicle) {
      inVehicle.health -= b.damage * 0.5;
      effects.sparks(b.x, b.y, rng, 4);
      if (inVehicle.health <= 0 && !inVehicle.wrecked) {
        inVehicle.wrecked = true;
        player.damage(18);
      }
    } else {
      player.damage(b.damage * 0.55);
      effects.impactPuff(b.x, b.y, rng);
    }
    return true;
  }
  return false;
}

// Draw tracers: short bright streaks along each bullet's path.
export function drawBullets(ctx, bullets) {
  ctx.lineCap = 'round';
  for (const b of bullets) {
    const back = 0.016;
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,220,130,0.95)' : 'rgba(255,120,100,0.95)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * back, b.y - b.vy * back);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// Draw the crosshair at the mouse (view space).
export function drawCrosshair(ctx, x, y, reloading) {
  ctx.strokeStyle = reloading ? '#ff5347' : '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 17, y); ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y); ctx.lineTo(x + 17, y);
  ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 17);
  ctx.stroke();
  ctx.fillStyle = '#ffc94d';
  ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
}

// Magazine size helper for the HUD weapon plate.
export function magazineFraction(arsenal) {
  const s = arsenal.stats();
  const a = arsenal.ammo[arsenal.current];
  return clamp(a.mag / s.mag, 0, 1);
}
