// traffic-ai.js — Puerto Serena: Neon Tide
// One job: civilian traffic. About two dozen cars drive the avenue
// and street grid in lanes, slow for the car ahead, stop at busy
// junctions, turn at intersections, honk and flee from gunfire and
// sirens — plus the parked cars that dress every street and give the
// player something to steal.

import { clamp, angleDelta } from './config.js';
import { ROAD_HALF, isWaterAt } from './city-map.js';
import { createCar, randomCivilianClass, updateCarPhysics } from './vehicles-cars.js';

export class TrafficDirector {
  constructor(layout, rng, movingCount = 24, parkedCount = 46) {
    this.layout = layout;
    this.rng = rng;
    this.moving = [];   // {car, axis, dir, cruise}
    this.parked = [];   // car objects, role 'parked'
    for (let i = 0; i < movingCount; i++) this.moving.push(this._spawnMoving(true));
    for (let i = 0; i < parkedCount; i++) {
      const car = this._spawnParked();
      if (car) this.parked.push(car);
    }
  }

  _spawnMoving(anywhere = false, nearX = 0, nearY = 0) {
    const rng = this.rng;
    const vertical = rng.chance(0.5);
    const line = vertical ? rng.pick(this.layout.avenues) : rng.pick(this.layout.streets);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = anywhere ? rng.range(300, 3300) : (vertical ? nearY + rng.range(-600, 600) : nearX + rng.range(-600, 600));
    // Right-hand traffic: lane sits to the right of the direction.
    const lane = (ROAD_HALF / 2) * dir;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = line + lane;
      y = clamp(along, 260, 3380);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = clamp(along, 480, 5740);
      y = line + lane;
      angle = dir > 0 ? 0 : Math.PI;
    }
    const cls = randomCivilianClass(rng);
    const spec = createCar(cls, x, y, angle, null, 'traffic');
    spec.color = rng.pick(spec.spec.colors);
    spec.speed = rng.range(60, 130) * dir;
    return { car: spec, axis: vertical ? 'v' : 'h', dir, cruise: rng.range(130, 185), panic: 0 };
  }

  _spawnParked() {
    const rng = this.rng;
    for (let tries = 0; tries < 20; tries++) {
      const vertical = rng.chance(0.5);
      const line = vertical ? rng.pick(this.layout.avenues) : rng.pick(this.layout.streets);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = (ROAD_HALF - 13) * side;
      let x;
      let y;
      let angle;
      if (vertical) {
        x = line + off;
        y = rng.range(280, 3340);
        angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = rng.range(500, 5700);
        y = line + off;
        angle = side > 0 ? 0 : Math.PI;
      }
      if (isWaterAt(this.layout, x, y)) continue;
      const cls = rng.chance(0.07) ? 'bike' : randomCivilianClass(rng);
      const car = createCar(cls, x, y, angle, null, 'parked');
      car.color = rng.pick(car.spec.colors);
      return car;
    }
    return null;
  }

  // All civilian cars (for collision and drawing).
  allCars() {
    const out = this.parked.slice();
    for (const m of this.moving) out.push(m.car);
    return out;
  }

  // Remove a car from the world (the player stole it, or it wrecked).
  release(car) {
    this.parked = this.parked.filter((c) => c !== car);
    this.moving = this.moving.filter((m) => m.car !== car);
  }

  // Gunfire or a siren nearby: nearby drivers panic and speed off.
  panicAt(x, y, radius = 420) {
    for (const m of this.moving) {
      if (Math.hypot(m.car.x - x, m.car.y - y) < radius) m.panic = this.rng.range(1.5, 3);
    }
  }

  update(dt, world) {
    const { layout, effects, playerFocus, policeActive } = world;
    const rng = this.rng;
    // Keep traffic near the player.
    for (let i = 0; i < this.moving.length; i++) {
      const m = this.moving[i];
      if (Math.hypot(m.car.x - playerFocus.x, m.car.y - playerFocus.y) > 1250 || m.car.wrecked) {
        this.moving[i] = this._spawnMoving(false, playerFocus.x, playerFocus.y);
      }
    }

    for (const m of this.moving) {
      const car = m.car;
      m.panic = Math.max(0, m.panic - dt);
      const speedLimit = m.panic > 0 ? car.spec.topSpeed * 0.8 : m.cruise;

      // Look ahead: brake for anything slow or stopped in the lane.
      let blocked = false;
      const aheadX = car.x + Math.cos(car.angle) * 74;
      const aheadY = car.y + Math.sin(car.angle) * 74;
      for (const other of this.moving) {
        if (other === m) continue;
        if (Math.hypot(other.car.x - aheadX, other.car.y - aheadY) < 40 && Math.abs(other.car.speed) < Math.abs(car.speed)) blocked = true;
      }
      if (playerFocus.vehicle && Math.hypot(playerFocus.vehicle.x - aheadX, playerFocus.vehicle.y - aheadY) < 44) blocked = true;
      if (policeActive && rng.chance(0.002)) blocked = true; // junction courtesy chaos

      // Desired heading: along the current axis, in our direction.
      let targetAngle = m.axis === 'v' ? (m.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (m.dir > 0 ? 0 : Math.PI);
      // Lane keeping: steer back toward the lane centre-line.
      const lineCoord = m.axis === 'v'
        ? this.layout.avenues.reduce((best, ax) => (Math.abs(ax - car.x) < Math.abs(best - car.x) ? ax : best), this.layout.avenues[0])
        : this.layout.streets.reduce((best, sy) => (Math.abs(sy - car.y) < Math.abs(best - car.y) ? sy : best), this.layout.streets[0]);
      const laneCenter = lineCoord + (ROAD_HALF / 2) * m.dir;
      const offLane = m.axis === 'v' ? laneCenter - car.x : laneCenter - car.y;
      targetAngle += clamp(offLane * 0.012, -0.3, 0.3) * (m.axis === 'v' ? 1 : 1);

      const steer = clamp(angleDelta(car.angle, targetAngle) * 2.4, -1, 1);
      let throttle = 0;
      const forwardSpeed = car.speed * (m.dir > 0 ? 1 : 1);
      if (blocked) throttle = car.speed > 20 ? -0.7 : 0;
      else if (Math.abs(car.speed) < speedLimit) throttle = 0.85;
      else throttle = -0.2;

      const crashed = updateCarPhysics(dt, car, { throttle, steer, handbrake: false }, layout, effects, rng);
      if (crashed > 0.4 && car.hornTimer <= 0) {
        car.hornTimer = 2;
        if (world.audio) world.audio.carHorn();
      }

      // At a junction, sometimes turn onto the crossing road.
      const nearCross = m.axis === 'v'
        ? this.layout.streets.some((sy) => Math.abs(car.y - sy) < 26)
        : this.layout.avenues.some((ax) => Math.abs(car.x - ax) < 26);
      if (nearCross && !m.turnCooldown) {
        m.turnCooldown = 2.5;
        if (rng.chance(m.panic > 0 ? 0.1 : 0.3)) {
          m.axis = m.axis === 'v' ? 'h' : 'v';
          m.dir = rng.chance(0.5) ? 1 : -1;
        }
      }
      m.turnCooldown = Math.max(0, (m.turnCooldown || 0) - dt);
      void forwardSpeed;
    }
  }

  draw(ctx, view, env, drawVehicleFn) {
    for (const car of this.parked) {
      if (car.x < view.x - 90 || car.x > view.x + view.w + 90 || car.y < view.y - 90 || car.y > view.y + view.h + 90) continue;
      drawVehicleFn(ctx, car, env);
    }
    for (const m of this.moving) {
      const car = m.car;
      if (car.x < view.x - 90 || car.x > view.x + view.w + 90 || car.y < view.y - 90 || car.y > view.y + view.h + 90) continue;
      drawVehicleFn(ctx, car, env);
    }
  }
}
