// pedestrians.js — Puerto Serena: Neon Tide
// One job: the people of Puerto Serena. Around fifty pedestrians with
// simple routines — strolling the sidewalks, carrying umbrellas in the
// rain, flagging taxis — who flee gunfire and sirens, cower when a car
// bears down, get shoved, and get up again. Density is staged high
// near the player so the streets always feel lived in.

import { clamp, turnToward } from './config.js';
import { collideCircleWithCity, isWaterAt, ROAD_HALF } from './city-map.js';

const SHIRT_COLORS = ['#e2543e', '#3e8ae2', '#f2b134', '#7bc950', '#e23e8a', '#f2f2f2', '#12b5a5', '#c9862f', '#8a779c', '#ffd23e'];
const SKIN_TONES = ['#e8b98a', '#c98d5e', '#8a5a34', '#f2cfa4', '#6e4525'];

export class PedestrianCrowd {
  constructor(layout, rng, count = 50) {
    this.layout = layout;
    this.rng = rng;
    this.pedestrians = [];
    for (let i = 0; i < count; i++) {
      this.pedestrians.push(this._makePedestrian(true));
    }
  }

  _makePedestrian(anywhere = false, nearX = 0, nearY = 0) {
    const rng = this.rng;
    // Spawn on a sidewalk: beside a road, never in the water.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 24; tries++) {
      if (anywhere) {
        x = rng.range(560, 5700);
        y = rng.range(260, 3380);
      } else {
        x = nearX + rng.range(-700, 700);
        y = nearY + rng.range(-520, 520);
      }
      if (!isWaterAt(this.layout, x, y)) break;
    }
    return {
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(46, 74),
      state: 'walk',          // walk | flee | cower | down | hail
      stateTimer: 0,
      shirt: rng.pick(SHIRT_COLORS),
      skin: rng.pick(SKIN_TONES),
      umbrella: false,
      walkCycle: rng.range(0, 6),
      wanderTimer: rng.range(1, 4),
      wantsTaxi: rng.chance(0.1),
      shoveVx: 0,
      shoveVy: 0,
      id: (Math.random() * 1e9) | 0,
    };
  }

  // Keep the crowd near the player: far pedestrians quietly relocate
  // to the player's neighbourhood (never within sight when possible).
  maintainDensity(playerX, playerY) {
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const d = Math.hypot(p.x - playerX, p.y - playerY);
      if (d > 1150) {
        this.pedestrians[i] = this._makePedestrian(false, playerX, playerY);
      }
    }
  }

  // A gunshot, explosion or siren sends everyone nearby running.
  panicAt(x, y, radius = 340) {
    for (const p of this.pedestrians) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius && p.state !== 'down') {
        p.state = 'flee';
        p.stateTimer = this.rng.range(1.6, 3.2);
        p.angle = Math.atan2(p.y - y, p.x - x);
      }
    }
  }

  update(dt, env) {
    const rng = this.rng;
    for (const p of this.pedestrians) {
      p.stateTimer -= dt;
      // Umbrellas come out with the rain.
      p.umbrella = env.rain > 0.35 && p.state === 'walk';

      if (p.state === 'down') {
        if (p.stateTimer <= 0) p.state = 'walk';
        continue;
      }
      // Shove physics decays.
      if (Math.abs(p.shoveVx) > 1 || Math.abs(p.shoveVy) > 1) {
        p.x += p.shoveVx * dt;
        p.y += p.shoveVy * dt;
        p.shoveVx *= 1 - 6 * dt;
        p.shoveVy *= 1 - 6 * dt;
        continue;
      }

      let speed = p.speed;
      if (p.state === 'flee') {
        speed = 205;
        if (p.stateTimer <= 0) p.state = 'walk';
      } else if (p.state === 'cower') {
        speed = 0;
        if (p.stateTimer <= 0) p.state = 'walk';
      } else if (p.state === 'hail') {
        speed = 0; // arm up, waiting for a taxi (the player)
      } else {
        // Wander: pick a new heading now and then, favouring streets.
        p.wanderTimer -= dt;
        if (p.wanderTimer <= 0) {
          p.wanderTimer = rng.range(1.5, 4.5);
          p.angle = rng.range(0, Math.PI * 2);
          if (p.wantsTaxi && rng.chance(0.4)) p.state = 'hail';
        }
      }

      if (speed > 0) {
        const nx = p.x + Math.cos(p.angle) * speed * dt;
        const ny = p.y + Math.sin(p.angle) * speed * dt;
        if (isWaterAt(this.layout, nx, ny)) {
          p.angle += Math.PI * 0.9;
        } else {
          const resolved = collideCircleWithCity(this.layout, nx, ny, 11);
          if (resolved.hit) p.angle += rng.range(1.8, 2.6);
          p.x = resolved.x;
          p.y = resolved.y;
        }
        p.walkCycle += dt * (speed > 120 ? 13 : 8);
      }
    }
  }

  // A fast car nearby makes walkers dive or cower.
  reactToTraffic(cars) {
    for (const p of this.pedestrians) {
      if (p.state === 'down' || p.state === 'flee') continue;
      for (const car of cars) {
        if (Math.abs(car.speed) < 130) continue;
        const d = Math.hypot(p.x - car.x, p.y - car.y);
        if (d < 66) {
          p.state = this.rng.chance(0.5) ? 'flee' : 'cower';
          p.stateTimer = this.rng.range(0.9, 1.8);
          p.angle = Math.atan2(p.y - car.y, p.x - car.x);
          break;
        }
      }
    }
  }

  // Draw one pedestrian, umbrella and hail arm included.
  drawPedestrian(ctx, p, env) {
    const swing = Math.sin(p.walkCycle) * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 6, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'down') ctx.rotate(1.2);
    // Legs.
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(swing * 0.7, 10);
    ctx.moveTo(0, 1); ctx.lineTo(-swing * 0.7, 10);
    ctx.stroke();
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,16,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.stroke();
    // Head.
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, Math.PI * 2); ctx.fill();
    // Hailing arm.
    if (p.state === 'hail') {
      ctx.strokeStyle = p.skin;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(13, -13); ctx.stroke();
    }
    // Cower: arms over head.
    if (p.state === 'cower') {
      ctx.strokeStyle = p.skin;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(0, -10);
      ctx.moveTo(6, -4); ctx.lineTo(0, -10);
      ctx.stroke();
    }
    ctx.restore();
    // Umbrella canopy above everything.
    if (p.umbrella) {
      ctx.fillStyle = '#28418c';
      ctx.beginPath(); ctx.arc(p.x, p.y - 6, 17, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#37e6ff';
      ctx.beginPath(); ctx.arc(p.x, p.y - 6, 17, Math.PI * 1.15, Math.PI * 1.5); ctx.fill();
    }
    // Taxi hail bubble.
    if (p.state === 'hail') {
      ctx.fillStyle = '#ffc21a';
      ctx.beginPath(); ctx.roundRect(p.x - 15, p.y - 40, 30, 17, 5); ctx.fill();
      ctx.fillStyle = '#191d24';
      ctx.font = '800 11px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', p.x, p.y - 27);
    }
  }

  draw(ctx, view, env) {
    for (const p of this.pedestrians) {
      if (p.x < view.x - 40 || p.x > view.x + view.w + 40 || p.y < view.y - 40 || p.y > view.y + view.h + 40) continue;
      this.drawPedestrian(ctx, p, env);
    }
  }
}

// Shove impulse, attached to each pedestrian object by the player.
// Defined here so pedestrian behaviour lives in one file.
export function applyShove(ped, fromX, fromY, rng) {
  const a = Math.atan2(ped.y - fromY, ped.x - fromX);
  ped.shoveVx = Math.cos(a) * 260;
  ped.shoveVy = Math.sin(a) * 260;
  ped.state = 'flee';
  ped.stateTimer = rng.range(1.2, 2.2);
}
