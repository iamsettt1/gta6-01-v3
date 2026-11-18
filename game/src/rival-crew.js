// rival-crew.js — Puerto Serena: Neon Tide
// One job: the Cárdenas syndicate's street crew — the human opposition
// of the shootout missions. Rivals take cover behind crates and cars,
// advance when the player is far, shoot in bursts, and break and flee
// when their numbers thin. They are also the game's ambush and finale
// muscle, spawned by the mission director.

import { clamp, turnToward } from './config.js';
import { collideCircleWithCity, isWaterAt } from './city-map.js';

export class RivalCrew {
  constructor(rng) {
    this.rng = rng;
    this.members = [];
  }

  // Spawn a group around a point, with cover points to fight from.
  spawnGroup(x, y, count, layout) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const mx = x + Math.cos(a) * this.rng.range(50, 130);
      const my = y + Math.sin(a) * this.rng.range(50, 130);
      if (isWaterAt(layout, mx, my)) continue;
      const member = {
        x: mx, y: my,
        angle: a + Math.PI,
        health: 62,
        maxHealth: 62,
        state: 'cover',        // cover | advance | flee | down
        shootCd: this.rng.range(0.5, 1.6),
        burst: 0,
        walkCycle: this.rng.range(0, 6),
        coverX: mx,
        coverY: my,
        id: (Math.random() * 1e9) | 0,
      };
      // Prefer a crate or container edge as cover when one is near.
      for (const c of layout.crates) {
        if (Math.hypot(c.x - mx, c.y - my) < 120) {
          member.coverX = c.x + c.w / 2;
          member.coverY = c.y + c.h + 22;
          break;
        }
      }
      this.members.push(member);
      spawned.push(member);
    }
    return spawned;
  }

  aliveCount() {
    return this.members.filter((m) => m.health > 0).length;
  }

  clear() {
    this.members = [];
  }

  update(dt, world) {
    const { player, layout, rng } = world;
    const focus = player.focus();
    const alive = this.aliveCount();
    for (let i = this.members.length - 1; i >= 0; i--) {
      const m = this.members[i];
      if (m.health <= 0) {
        // Downed rivals stay down; the director counts the kill.
        continue;
      }
      const d = Math.hypot(focus.x - m.x, focus.y - m.y);
      m.angle = turnToward(m.angle, Math.atan2(focus.y - m.y, focus.x - m.x), dt * 6);

      // Morale: the last two standing often break.
      if (m.state !== 'flee' && alive <= 2 && this.members.length >= 4 && rng.chance(0.004)) {
        m.state = 'flee';
      }

      let moveX = 0;
      let moveY = 0;
      let speed = 0;
      if (m.state === 'flee') {
        speed = 196;
        moveX = Math.cos(m.angle + Math.PI);
        moveY = Math.sin(m.angle + Math.PI);
        if (d > 620) this.members.splice(i, 1);
      } else if (d > 300) {
        m.state = 'advance';
        speed = 138;
        moveX = Math.cos(m.angle);
        moveY = Math.sin(m.angle);
      } else if (d > 130) {
        m.state = 'cover';
        // Drift toward the cover point, strafing a little.
        const ca = Math.atan2(m.coverY - m.y, m.coverX - m.x);
        if (Math.hypot(m.coverX - m.x, m.coverY - m.y) > 16) {
          speed = 96;
          moveX = Math.cos(ca);
          moveY = Math.sin(ca);
        }
      } else {
        m.state = 'cover';
      }

      if (speed > 0) {
        const nx = m.x + moveX * speed * dt;
        const ny = m.y + moveY * speed * dt;
        if (!isWaterAt(layout, nx, ny)) {
          const resolved = collideCircleWithCity(layout, nx, ny, 13);
          m.x = resolved.x;
          m.y = resolved.y;
        }
        m.walkCycle += dt * 10;
      }

      // Shooting: bursts at range, with a wind-up after each burst.
      m.shootCd -= dt;
      if (m.state !== 'flee' && d < 330 && d > 34 && m.shootCd <= 0) {
        if (m.burst <= 0) m.burst = 3;
        m.burst -= 1;
        m.shootCd = m.burst > 0 ? 0.16 : rng.range(0.8, 1.5);
        const spread = clamp(d / 2600, 0.03, 0.13);
        world.fireBullet(m.x, m.y, m.angle + rng.range(-spread, spread), 'rival');
        world.onRivalShot?.(m);
      }
    }
  }

  drawMember(ctx, m, env) {
    const down = m.health <= 0;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(m.x + 3, m.y + 6, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(m.x, m.y);
    if (down) ctx.rotate(1.35);
    const swing = Math.sin(m.walkCycle) * 4;
    ctx.strokeStyle = '#26262e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(swing * 0.7, 11);
    ctx.moveTo(0, 1); ctx.lineTo(-swing * 0.7, 11);
    ctx.stroke();
    // Syndicate maroon.
    ctx.fillStyle = down ? '#5c2f33' : '#8e2434';
    ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,16,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d9a066';
    ctx.beginPath(); ctx.arc(0, 0, 5.6, 0, Math.PI * 2); ctx.fill();
    // Gun arm toward the player.
    if (!down) {
      ctx.strokeStyle = '#191d24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(m.angle) * 6, Math.sin(m.angle) * 6);
      ctx.lineTo(Math.cos(m.angle) * 21, Math.sin(m.angle) * 21);
      ctx.stroke();
    }
    ctx.restore();
    // Health tick over wounded rivals.
    if (!down && m.health < m.maxHealth) {
      ctx.fillStyle = 'rgba(6,8,12,0.7)';
      ctx.fillRect(m.x - 14, m.y - 26, 28, 5);
      ctx.fillStyle = '#ff5347';
      ctx.fillRect(m.x - 13, m.y - 25, 26 * clamp(m.health / m.maxHealth, 0, 1), 3);
    }
    void env;
  }

  draw(ctx, view, env) {
    for (const m of this.members) {
      if (m.x < view.x - 40 || m.x > view.x + view.w + 40 || m.y < view.y - 40 || m.y > view.y + view.h + 40) continue;
      this.drawMember(ctx, m, env);
    }
  }
}
