// police-pursuit.js — Puerto Serena: Neon Tide
// One job: the law. A 1–5 star wanted level fed by witnessed crimes,
// answered by foot officers, patrol cars, interceptors, roadblocks,
// police boats on the water and — at five stars — a helicopter whose
// searchlight tracks the player. Heat cools when line of sight is
// broken; paint shops and phone bribes clear it for cash.

import { CONFIG, clamp, angleDelta, turnToward } from './config.js';
import { isWaterAt, nearestRoadPoint } from './city-map.js';
import { createCar, updateCarPhysics } from './vehicles-cars.js';
import { launchPoliceBoat, updateBoatPhysics } from './boats.js';

// Heat added per witnessed crime. Stars are ceil(heat / 100), max 5.
export function escalateWantedLevel(police, crime, witnessed = true) {
  const table = {
    shove: 12,
    carjack: 55,
    theft: 40,
    gunfire: 34,
    assault: 48,
    hitAndRun: 62,
    vehicleCrash: 16,
    missionAlarm: 100,
    vaultGold: 500,
    speeding: 8,
  };
  const add = table[crime] || 10;
  police.heat = clamp(police.heat + (witnessed ? add : add * 0.4), 0, CONFIG.wanted.maxStars * CONFIG.wanted.heatPerStar);
  police.bribeUsed = false;
  return police.stars();
}

// How many units of each kind a star level fields.
export function responseForStars(stars) {
  return {
    cars: [0, 1, 2, 3, 4, 6][stars] || 0,
    officers: [0, 1, 2, 2, 3, 4][stars] || 0,
    boats: stars >= 4 ? 2 : stars >= 3 ? 1 : 0,
    roadblocks: stars >= 5 ? 2 : stars >= 3 ? 1 : 0,
    helicopter: stars >= 5,
  };
}

export class PoliceDepartment {
  constructor(layout, rng) {
    this.layout = layout;
    this.rng = rng;
    this.heat = 0;
    this.heatFlash = 0;       // stars pulse right after a crime
    this.sightTimer = 0;      // seconds since any unit saw the player
    this.bustMeter = 0;       // 0..1 arrest progress
    this.bribeUsed = false;
    this.cars = [];
    this.officers = [];       // {x,y,angle,speed,shootCd,walkCycle}
    this.boats = [];
    this.roadblocks = [];     // police cars parked across a road
    this.heli = { active: false, x: 0, y: 0, angle: 0, rotor: 0, spawnCd: 0 };
    this.spawnCd = 0;
    this.blockCd = 0;
  }

  stars() {
    if (this.heat <= 0) return 0;
    return clamp(Math.ceil(this.heat / CONFIG.wanted.heatPerStar), 1, CONFIG.wanted.maxStars);
  }

  // Clear all heat (paint shop, bribe, arrest, hospital).
  clearHeat() {
    this.heat = 0;
    this.bustMeter = 0;
    this.bribeUsed = false;
    this.sightTimer = 0;
  }

  // Are units actively engaged (for the HUD star blink and sirens)?
  engaged() {
    return this.sightTimer < 1.2 && this.stars() > 0;
  }

  // Despawn everything (respawns, scene staging).
  standDown() {
    this.cars = [];
    this.officers = [];
    this.boats = [];
    this.roadblocks = [];
    this.heli.active = false;
  }

  _spawnCarNear(x, y, interceptor) {
    const rng = this.rng;
    const road = nearestRoadPoint(this.layout, x + rng.range(-560, 560), y + rng.range(-560, 560));
    if (!road) return null;
    const px = clamp(road.x + rng.range(-30, 30), 80, CONFIG.world.width - 80);
    const py = clamp(road.y + rng.range(-30, 30), 80, CONFIG.world.height - 80);
    if (isWaterAt(this.layout, px, py)) return null;
    const car = createCar('police', px, py, rng.range(0, Math.PI * 2), '#f2f4f6', 'police');
    if (interceptor) {
      car.spec = { ...car.spec, topSpeed: 520, accel: 480 };
      car.label = 'Interceptor';
    }
    this.cars.push(car);
    return car;
  }

  _spawnOfficerNear(x, y) {
    const rng = this.rng;
    const ox = clamp(x + rng.range(-420, 420), 60, CONFIG.world.width - 60);
    const oy = clamp(y + rng.range(-420, 420), 60, CONFIG.world.height - 60);
    if (isWaterAt(this.layout, ox, oy)) return;
    this.officers.push({
      x: ox, y: oy, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(150, 178), shootCd: rng.range(0.4, 1.2), walkCycle: rng.range(0, 6),
    });
  }

  _spawnBoatNear(x, y) {
    const rng = this.rng;
    const boat = launchPoliceBoat(
      clamp(x + rng.range(-520, 520), 120, CONFIG.world.width - 120),
      clamp(Math.max(y, this.layout.coastY + 160) + rng.range(-80, 160), this.layout.coastY + 90, CONFIG.world.height - 90),
      rng.range(0, Math.PI * 2),
    );
    this.boats.push(boat);
    return boat;
  }

  // Place a roadblock across the road ahead of the player.
  _placeRoadblock(player) {
    const rng = this.rng;
    const focus = player.focus();
    const dirX = player.inVehicle ? Math.cos(player.inVehicle.angle) : 1;
    const dirY = player.inVehicle ? Math.sin(player.inVehicle.angle) : 0;
    const aheadX = focus.x + dirX * 520;
    const aheadY = focus.y + dirY * 520;
    const road = nearestRoadPoint(this.layout, aheadX, aheadY);
    if (!road) return;
    const across = road.vertical ? 0 : Math.PI / 2;
    for (let i = -1; i <= 1; i += 2) {
      const bx = road.x + (road.vertical ? i * 34 : 0);
      const by = road.y + (road.vertical ? 0 : i * 34);
      if (isWaterAt(this.layout, bx, by)) continue;
      const car = createCar('police', bx, by, across + Math.PI / 2, '#f2f4f6', 'roadblock');
      car.speed = 0;
      this.roadblocks.push(car);
    }
    void rng;
  }

  update(dt, world) {
    const { player, effects, audio } = world;
    const rng = this.rng;
    const stars = this.stars();
    this.heatFlash = Math.max(0, this.heatFlash - dt);
    const focus = player.focus();
    const playerOnWater = isWaterAt(this.layout, focus.x, focus.y) || (player.inVehicle && player.inVehicle.kind === 'boat');

    // --- Sight and heat decay -------------------------------------------
    let seen = false;
    if (stars > 0) {
      const all = [...this.cars, ...this.officers, ...this.boats];
      for (const u of all) {
        if (Math.hypot(u.x - focus.x, u.y - focus.y) < CONFIG.wanted.sightRange) { seen = true; break; }
      }
      if (this.heli.active && Math.hypot(this.heli.x - focus.x, this.heli.y - focus.y) < 560) seen = true;
    }
    if (seen) this.sightTimer = 0;
    else this.sightTimer += dt;
    if (stars > 0 && this.sightTimer > 2.2) {
      this.heat = Math.max(0, this.heat - CONFIG.wanted.decayPerSecond * dt * (this.sightTimer > 6 ? 2.2 : 1));
      if (this.heat <= 0) this.standDown();
    }

    // --- Spawning to match the star level --------------------------------
    const want = responseForStars(stars);
    this.spawnCd -= dt;
    if (stars > 0 && this.spawnCd <= 0) {
      this.spawnCd = 1.4;
      if (!playerOnWater && this.cars.length < want.cars) this._spawnCarNear(focus.x, focus.y, stars >= 3);
      if (!playerOnWater && this.officers.length < want.officers && !player.inVehicle) this._spawnOfficerNear(focus.x, focus.y);
      if (playerOnWater && this.boats.length < want.boats) this._spawnBoatNear(focus.x, focus.y);
      if (stars >= 4 && !playerOnWater && this.officers.length < want.officers + 1) this._spawnOfficerNear(focus.x, focus.y);
    }
    this.blockCd -= dt;
    if (want.roadblocks > this.roadblocks.length && this.blockCd <= 0 && player.inVehicle && player.inVehicle.kind === 'car') {
      this.blockCd = 16;
      this._placeRoadblock(player);
    }
    this.heli.active = !!want.helicopter;
    if (this.heli.active) {
      this.heli.rotor += dt * 40;
      const hx = focus.x + Math.cos(this.heli.rotor * 0.11) * 120;
      const hy = focus.y + Math.sin(this.heli.rotor * 0.11) * 90 - 40;
      this.heli.x += (hx - this.heli.x) * Math.min(1, dt * 1.6);
      this.heli.y += (hy - this.heli.y) * Math.min(1, dt * 1.6);
      this.heli.angle = Math.atan2(focus.y - this.heli.y, focus.x - this.heli.x);
      this.heli.spawnCd -= dt;
      if (this.heli.spawnCd <= 0) {
        this.heli.spawnCd = 9;
        if (this.cars.length < want.cars + 1 && !playerOnWater) this._spawnCarNear(focus.x, focus.y, true);
      }
    }

    // --- Pursuit cars ------------------------------------------------------
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.wrecked || Math.hypot(car.x - focus.x, car.y - focus.y) > 1500) {
        this.cars.splice(i, 1);
        continue;
      }
      const targetAngle = Math.atan2(focus.y - car.y, focus.x - car.x);
      const steer = clamp(angleDelta(car.angle, targetAngle) * 2.6, -1, 1);
      const dist = Math.hypot(focus.x - car.x, focus.y - car.y);
      let throttle = dist > 60 ? 1 : 0.2;
      if (dist < 46) throttle = -0.4; // nose-to-tail: back off a touch
      updateCarPhysics(dt, car, { throttle, steer, handbrake: false }, this.layout, effects, rng);
    }

    // --- Foot officers -----------------------------------------------------
    let bustPressure = 0;
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      const d = Math.hypot(focus.x - o.x, focus.y - o.y);
      if (d > 1400) { this.officers.splice(i, 1); continue; }
      const runTo = player.inVehicle ? null : focus;
      if (runTo && d > 30) {
        o.angle = turnToward(o.angle, Math.atan2(runTo.y - o.y, runTo.x - o.x), dt * 8);
        const nx = o.x + Math.cos(o.angle) * o.speed * dt;
        const ny = o.y + Math.sin(o.angle) * o.speed * dt;
        if (!isWaterAt(this.layout, nx, ny)) { o.x = nx; o.y = ny; }
        o.walkCycle += dt * 11;
      }
      if (!player.inVehicle && d < CONFIG.wanted.bustRange) bustPressure += 1;
      // Officers shoot at 3+ stars when the player is armed and close.
      o.shootCd -= dt;
      if (stars >= 3 && d < 330 && d > 60 && o.shootCd <= 0 && world.playerArmed) {
        o.shootCd = rng.range(0.7, 1.3);
        world.fireBullet(o.x, o.y, Math.atan2(focus.y - o.y, focus.x - o.x) + rng.range(-0.09, 0.09), 'police');
      }
    }

    // --- Police boats --------------------------------------------------------
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const boat = this.boats[i];
      if (boat.wrecked || Math.hypot(boat.x - focus.x, boat.y - focus.y) > 1600) {
        this.boats.splice(i, 1);
        continue;
      }
      const targetAngle = Math.atan2(focus.y - boat.y, focus.x - boat.x);
      const steer = clamp(angleDelta(boat.angle, targetAngle) * 2.2, -1, 1);
      const dist = Math.hypot(focus.x - boat.x, focus.y - boat.y);
      updateBoatPhysics(dt, boat, { throttle: dist > 90 ? 1 : 0.1, steer }, this.layout, effects, rng, world.time);
    }

    // --- Roadblocks age out ---------------------------------------------------
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const car = this.roadblocks[i];
      if (Math.hypot(car.x - focus.x, car.y - focus.y) > 1300) this.roadblocks.splice(i, 1);
    }

    // --- Bust meter -----------------------------------------------------------
    const playerSlow = !player.inVehicle || Math.abs(player.inVehicle.speed) < 26;
    if (bustPressure > 0 && playerSlow) {
      this.bustMeter = Math.min(1, this.bustMeter + CONFIG.wanted.bustFillPerSecond * dt * bustPressure);
    } else if (this.cars.some((c) => Math.hypot(c.x - focus.x, c.y - focus.y) < 60) && playerSlow && stars > 0) {
      this.bustMeter = Math.min(1, this.bustMeter + CONFIG.wanted.bustFillPerSecond * 0.7 * dt);
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt * 0.7);
    }
    if (audio) audio.sirenClose = this.engaged() && (this.cars.length > 0 || this.boats.length > 0);
  }

  // Every police actor that can collide or be shot.
  allUnits() {
    return [...this.cars, ...this.roadblocks, ...this.boats, ...this.officers];
  }

  drawOfficer(ctx, o, env) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(o.x + 3, o.y + 6, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    const swing = Math.sin(o.walkCycle) * 4;
    ctx.strokeStyle = '#1d2a44';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + 1); ctx.lineTo(o.x + swing * 0.7, o.y + 11);
    ctx.moveTo(o.x, o.y + 1); ctx.lineTo(o.x - swing * 0.7, o.y + 11);
    ctx.stroke();
    ctx.fillStyle = '#22355c';
    ctx.beginPath(); ctx.arc(o.x, o.y, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(o.x, o.y, 5.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#101c33';
    ctx.beginPath(); ctx.arc(o.x, o.y - 1, 5.8, Math.PI, Math.PI * 2); ctx.fill();
    void env;
  }

  // The helicopter: body, spinning rotor, ground shadow and the
  // searchlight cone that pins the player at five stars.
  drawHelicopter(ctx, focus, env) {
    if (!this.heli.active) return;
    const h = this.heli;
    // Ground shadow offset down-light.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(h.x + 60, h.y + 90, 44, 18, 0.3, 0, Math.PI * 2); ctx.fill();
    // Searchlight cone from heli to the player.
    const g = ctx.createRadialGradient(h.x, h.y, 6, focus.x, focus.y, 120);
    g.addColorStop(0, `rgba(255,246,200,${0.34 + env.night * 0.2})`);
    g.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(focus.x - 52, focus.y + 30);
    ctx.lineTo(focus.x + 52, focus.y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,200,0.35)';
    ctx.beginPath(); ctx.ellipse(focus.x, focus.y + 16, 56, 20, 0, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#f2f4f6';
    ctx.beginPath(); ctx.roundRect(-30, -13, 62, 26, 12); ctx.fill();
    ctx.fillStyle = '#191d24';
    ctx.fillRect(18, -9, 16, 18);
    ctx.fillRect(-58, -3, 30, 6);
    ctx.fillStyle = '#22355c';
    ctx.font = '800 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', 0, 3.5);
    ctx.restore();
    // Rotor blur.
    ctx.strokeStyle = 'rgba(20,22,26,0.55)';
    ctx.lineWidth = 4;
    const r = 52;
    ctx.beginPath();
    ctx.moveTo(h.x - r, h.y - 4);
    ctx.lineTo(h.x + r, h.y - 4);
    ctx.moveTo(h.x, h.y - 4 - r * 0.4);
    ctx.lineTo(h.x, h.y - 4 + r * 0.4);
    ctx.stroke();
  }
}
