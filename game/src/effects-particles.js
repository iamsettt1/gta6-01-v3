// effects-particles.js — Puerto Serena: Neon Tide
// One job: every transient visual that is not an actor — muzzle
// flashes, hit sparks, smoke, dust, water spray, boat wakes, skid
// marks, cash confetti, shell casings, screen shake and floating
// score text. Systems emit; this module simulates and draws.

export class ParticleEffects {
  constructor() {
    this.particles = [];   // {x,y,vx,vy,life,maxLife,size,color,kind,grav}
    this.skids = [];       // {x,y,angle,len,alpha} fading tyre marks
    this.texts = [];       // {x,y,vy,life,text,color,size}
    this.shake = 0;        // current screen-shake magnitude
    this.flash = 0;        // full-screen flash alpha (explosions)
  }

  // Add screen shake (decays over time in update).
  addShake(amount) {
    this.shake = Math.min(22, this.shake + amount);
  }

  // A short full-screen flash, tinted.
  addFlash(alpha) {
    this.flash = Math.max(this.flash, alpha);
  }

  spawn(p) {
    if (this.particles.length > 900) this.particles.shift();
    this.particles.push(p);
  }

  // A burst of sparks where a bullet bites metal or concrete.
  sparks(x, y, rng, count = 7) {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(60, 300);
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, maxLife: rng.range(0.14, 0.4), size: rng.range(2, 4),
        color: rng.pick(['#ffd873', '#ffb347', '#fff3c4']), kind: 'spark', grav: 0,
      });
    }
  }

  // Blood-free impact puff for pedestrian/rival hits: a red spark.
  impactPuff(x, y, rng) {
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(30, 130);
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, maxLife: rng.range(0.2, 0.45), size: rng.range(3, 6),
        color: '#e0483e', kind: 'puff', grav: 0,
      });
    }
  }

  // Muzzle flash: a bright star at the gun mouth for a few frames.
  muzzleFlash(x, y, angle) {
    this.spawn({
      x, y, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
      life: 0, maxLife: 0.07, size: 17, color: '#ffe9a3', kind: 'flash', grav: 0, angle,
    });
    this.spawn({
      x, y, vx: 0, vy: 0, life: 0, maxLife: 0.12, size: 8,
      color: '#ffb347', kind: 'glow', grav: 0,
    });
  }

  // Grey smoke that rises and thins (damaged engines, gunfire haze).
  smoke(x, y, rng, big = false) {
    this.spawn({
      x: x + rng.range(-4, 4), y: y + rng.range(-4, 4),
      vx: rng.range(-12, 12), vy: rng.range(-34, -16),
      life: 0, maxLife: rng.range(0.6, 1.3), size: big ? rng.range(12, 20) : rng.range(6, 11),
      color: 'rgba(70,70,76,0.5)', kind: 'smoke', grav: -8,
    });
  }

  // Dust kicked up by tyres on dirt and hard cornering.
  dust(x, y, rng) {
    this.spawn({
      x, y, vx: rng.range(-20, 20), vy: rng.range(-20, 20),
      life: 0, maxLife: rng.range(0.3, 0.7), size: rng.range(5, 10),
      color: 'rgba(216,190,140,0.55)', kind: 'dust', grav: 0,
    });
  }

  // White spray at a boat's bow or a car's waterline.
  spray(x, y, rng, count = 2) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + rng.range(-8, 8), y: y + rng.range(-8, 8),
        vx: rng.range(-46, 46), vy: rng.range(-46, 46),
        life: 0, maxLife: rng.range(0.25, 0.55), size: rng.range(3, 7),
        color: 'rgba(235,248,255,0.85)', kind: 'spray', grav: 0,
      });
    }
  }

  // A curling wake segment behind a boat (drawn as a fading V).
  wake(x, y, angle, width) {
    this.spawn({
      x, y, vx: 0, vy: 0, life: 0, maxLife: 1.15, size: width,
      color: 'rgba(240,250,255,0.5)', kind: 'wake', grav: 0, angle,
    });
  }

  // Green confetti of banknotes when a payout lands.
  cashConfetti(x, y, rng) {
    for (let i = 0; i < 22; i++) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(50, 240);
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        life: 0, maxLife: rng.range(0.7, 1.4), size: rng.range(4, 7),
        color: rng.pick(['#7be495', '#b8f4c8', '#ffc94d']), kind: 'cash', grav: 190,
      });
    }
  }

  // A spent shell casing that arcs and vanishes.
  shellCasing(x, y, angle, rng) {
    const side = angle + Math.PI / 2;
    this.spawn({
      x, y, vx: Math.cos(side) * rng.range(50, 90), vy: Math.sin(side) * rng.range(50, 90) - 40,
      life: 0, maxLife: 0.5, size: 3, color: '#d8b25a', kind: 'shell', grav: 260,
    });
  }

  // Lay a skid mark segment (kept in a capped fading list).
  skidMark(x, y, angle, strength = 1) {
    if (this.skids.length > 420) this.skids.shift();
    this.skids.push({ x, y, angle, alpha: 0.34 * strength, life: 0, maxLife: 7 });
  }

  // Floating feedback text: "+$450", "BUSTED", "+RESPECT".
  floatText(x, y, text, color = '#ffc94d', size = 30) {
    this.texts.push({ x, y, vy: -56, life: 0, maxLife: 1.5, text, color, size });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'dust') {
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 1.2 * dt;
      }
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.life += dt;
      if (s.life >= s.maxLife) this.skids.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 1.8 * dt;
      if (t.life >= t.maxLife) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 34);
    this.flash = Math.max(0, this.flash - dt * 2.4);
  }

  // Draw the skid layer (under the actors).
  drawSkids(ctx) {
    ctx.fillStyle = '#14161a';
    for (const s of this.skids) {
      const fade = 1 - s.life / s.maxLife;
      ctx.globalAlpha = s.alpha * fade;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillRect(-9, -3.4, 18, 6.8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Draw all live particles (over the actors, under the HUD).
  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t;
      if (p.kind === 'wake') {
        // An expanding foam ellipse: reads as churned water, not a glyph.
        ctx.strokeStyle = `rgba(240,250,255,${0.4 * alpha})`;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12 + t * 40, 7 + t * 22, p.angle, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(240,250,255,${0.13 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 10 + t * 34, 6 + t * 18, p.angle, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flash') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = `rgba(255,233,163,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(p.size + 10, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'glow') {
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size * 2.4);
        g.addColorStop(0, `rgba(255,190,90,${0.7 * alpha})`);
        g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'smoke' || p.kind === 'dust') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + t * 1.3), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Draw floating texts with a dark outline so they read anywhere.
  drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = 1 - t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = `800 ${t.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(8,10,14,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // Random shake offset for the camera this frame.
  shakeOffset(rng) {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return {
      x: rng.range(-this.shake, this.shake),
      y: rng.range(-this.shake, this.shake),
    };
  }
}
