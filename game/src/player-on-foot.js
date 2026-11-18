// player-on-foot.js — Puerto Serena: Neon Tide
// One job: Nico Vidal on foot — 8-direction walk and sprint with a
// stamina bar, mouse aim, shoving pedestrians, world collision, the
// water rule (fall in and you wash up at a dock, fined), and drawing
// the character big and readable enough to survive a thumbnail.

import { CONFIG, clamp, turnToward } from './config.js';
import { collideCircleWithCity, isWaterAt } from './city-map.js';
import { drawShadowBlob } from './renderer-camera.js';

export class PlayerOnFoot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;   // facing
    this.aimAngle = -Math.PI / 2;
    this.radius = CONFIG.player.radius;
    this.health = CONFIG.player.maxHealth;
    this.armour = 0;
    this.stamina = CONFIG.player.staminaMax;
    this.inVehicle = null;       // car or boat object while driving
    this.dead = false;
    this.walkCycle = 0;          // leg-swing animation phase
    this.shoveCooldown = 0;
    this.hurtFlash = 0;
  }

  get driving() {
    return this.inVehicle !== null;
  }

  // Position of whatever the camera and police should care about.
  focus() {
    if (this.inVehicle) return { x: this.inVehicle.x, y: this.inVehicle.y };
    return { x: this.x, y: this.y };
  }

  speedNow() {
    if (this.inVehicle) return Math.abs(this.inVehicle.speed || 0);
    return Math.hypot(this.vx, this.vy);
  }

  // Take damage: armour soaks two thirds until it is gone.
  damage(amount) {
    if (this.dead) return;
    let rest = amount;
    if (this.armour > 0) {
      const soaked = Math.min(this.armour, amount * 0.66);
      this.armour -= soaked;
      rest = amount - soaked;
    }
    this.health -= rest;
    this.hurtFlash = 0.25;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, CONFIG.player.maxHealth);
  }

  // Move on foot for one frame. `world` gives collision and water;
  // `aimWorld` is the mouse position in world coordinates.
  update(dt, input, layout, aimWorld) {
    if (this.driving || this.dead) return;
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    const axes = input.moveAxes();
    const wantSprint = input.sprinting() && this.stamina > 1 && (axes.x !== 0 || axes.y !== 0);
    if (wantSprint) this.stamina = Math.max(0, this.stamina - CONFIG.player.staminaDrain * dt);
    else this.stamina = Math.min(CONFIG.player.staminaMax, this.stamina + CONFIG.player.staminaRegen * dt);

    const speed = wantSprint ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    this.vx = axes.x * speed;
    this.vy = axes.y * speed;
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;

    const resolved = collideCircleWithCity(layout, nx, ny, this.radius);
    nx = resolved.x;
    ny = resolved.y;

    this.x = nx;
    this.y = ny;
    if (axes.x !== 0 || axes.y !== 0) {
      this.angle = turnToward(this.angle, Math.atan2(axes.y, axes.x), dt * 14);
      this.walkCycle += dt * (wantSprint ? 13 : 9);
    }
    this.aimAngle = Math.atan2(aimWorld.y - this.y, aimWorld.x - this.x);
  }

  // Falling in the water: returns true when the player is in deep
  // water and must wash up at the nearest dock (handled by main).
  inDeepWater(layout) {
    return !this.driving && isWaterAt(layout, this.x, this.y);
  }

  // Shove the nearest pedestrian within reach: a small crime, a big
  // laugh. Returns the pedestrian shoved, or null.
  tryShove(pedestrians) {
    if (this.shoveCooldown > 0 || this.driving) return null;
    for (const ped of pedestrians) {
      const dx = ped.x - this.x;
      const dy = ped.y - this.y;
      if (dx * dx + dy * dy < 40 * 40) {
        const a = Math.atan2(dy, dx);
        ped.shoveVx = Math.cos(a) * 240;
        ped.shoveVy = Math.sin(a) * 240;
        this.shoveCooldown = 0.4;
        return ped;
      }
    }
    return null;
  }

  // Draw Nico: sun-shirt teal, dark trousers, an aim arm with the gun.
  draw(ctx, env) {
    if (this.driving) return;
    const { x, y } = this;
    drawShadowBlob(ctx, x, y + 8, 16, 8);
    const swing = Math.sin(this.walkCycle) * 5;
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 4;
    ctx.save();
    ctx.translate(x, y);
    // Legs.
    ctx.strokeStyle = '#2c3550';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (moving) {
      ctx.moveTo(0, 2);
      ctx.lineTo(Math.cos(this.angle) * 6 + swing * Math.cos(this.angle + Math.PI / 2) * 0.4, 12 + Math.abs(swing) * 0.4);
      ctx.moveTo(0, 2);
      ctx.lineTo(Math.cos(this.angle) * 6 - swing * Math.cos(this.angle + Math.PI / 2) * 0.4, 12 - Math.abs(swing) * 0.2);
    } else {
      ctx.moveTo(-4, 4); ctx.lineTo(-4, 13);
      ctx.moveTo(4, 4); ctx.lineTo(4, 13);
    }
    ctx.stroke();
    // Torso: bright teal shirt so the hero reads at any zoom.
    ctx.fillStyle = this.hurtFlash > 0 ? '#ff7a6e' : '#12b5a5';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,16,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    // Shoulders point the facing way.
    ctx.fillStyle = '#0d8a7f';
    ctx.beginPath();
    ctx.ellipse(Math.cos(this.angle) * 5, Math.sin(this.angle) * 5, 9, 6.5, this.angle, 0, Math.PI * 2);
    ctx.fill();
    // Aim arm + weapon, toward the mouse.
    ctx.strokeStyle = '#e8b98a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(this.aimAngle) * 15, Math.sin(this.aimAngle) * 15);
    ctx.stroke();
    ctx.strokeStyle = '#191d24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(this.aimAngle) * 13, Math.sin(this.aimAngle) * 13);
    ctx.lineTo(Math.cos(this.aimAngle) * 23, Math.sin(this.aimAngle) * 23);
    ctx.stroke();
    // Head with a cap.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(0, 0, 7.5, this.aimAngle - 2.2, this.aimAngle + 2.2); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
    // Armour vest hint when armoured.
    if (this.armour > 4) {
      ctx.strokeStyle = 'rgba(120,180,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
