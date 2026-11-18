// renderer-camera.js — Puerto Serena: Neon Tide
// One job: the camera and the shared canvas drawing kit. The camera
// follows the player with speed look-ahead and a gentle lag; the kit
// holds the small primitives every module draws with — plates, bars,
// markers, chevrons and outlined text — so the whole game's UI shares
// one visual language.

import { CONFIG, clamp, lerp, hudFont } from './config.js';

export class ChaseCamera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.initialised = false;
  }

  // Snap to a world point (scene staging, respawns).
  snapTo(x, y) {
    this.x = x - CONFIG.view.width / 2;
    this.y = y - CONFIG.view.height / 2;
    this.initialised = true;
    this._clampToWorld();
  }

  // Follow a target with velocity look-ahead.
  follow(dt, tx, ty, vx = 0, vy = 0) {
    if (!this.initialised) {
      this.snapTo(tx, ty);
      return;
    }
    const lookX = tx + vx * 0.55;
    const lookY = ty + vy * 0.55;
    const wantX = lookX - CONFIG.view.width / 2;
    const wantY = lookY - CONFIG.view.height / 2;
    const k = 1 - Math.pow(0.0015, dt); // smooth, frame-rate independent
    this.x = lerp(this.x, wantX, k);
    this.y = lerp(this.y, wantY, k);
    this._clampToWorld();
  }

  _clampToWorld() {
    this.x = clamp(this.x, 0, Math.max(0, CONFIG.world.width - CONFIG.view.width));
    this.y = clamp(this.y, 0, Math.max(0, CONFIG.world.height - CONFIG.view.height));
  }

  // The visible world rectangle.
  viewRect() {
    return { x: this.x, y: this.y, w: CONFIG.view.width, h: CONFIG.view.height };
  }

  worldToScreen(x, y) {
    return { x: x - this.x, y: y - this.y };
  }
}

// A dark translucent plate — the backing of every HUD element.
export function drawPlate(ctx, x, y, w, h, alpha = 0.72, radius = 12) {
  ctx.fillStyle = `rgba(10, 14, 22, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

// A plate with a coloured top rule, used by banners and cards.
export function drawBannerPlate(ctx, x, y, w, h, accent) {
  drawPlate(ctx, x, y, w, h, CONFIG.hud.bannerPlateAlpha, 14);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 14, y, w - 28, 5);
}

// A labelled bar: health, armour, stamina, detection, race position.
export function drawBar(ctx, x, y, w, h, frac, color, label = null) {
  ctx.fillStyle = 'rgba(6, 8, 12, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0.003) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, Math.max(4, (w - 4) * clamp(frac, 0, 1)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
  if (label) {
    ctx.font = hudFont(19, 800);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 10, y + h - 5);
  }
}

// Big outlined text that survives a thumbnail shrink.
export function drawOutlinedText(ctx, text, x, y, font, fill, align = 'center') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.lineWidth = Math.max(4, parseInt(font, 10) / 7 || 5);
  ctx.strokeStyle = 'rgba(6, 8, 12, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// A diamond objective marker with a pulsing ring, in world space.
export function drawObjectiveMarker(ctx, x, y, time, color = '#ffc94d', label = null) {
  const bob = Math.sin(time * 3.2) * 6;
  const pulse = 26 + Math.sin(time * 3.2) * 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 44 + bob);
  ctx.lineTo(x + 17, y - 22 + bob);
  ctx.lineTo(x, y + 2 + bob);
  ctx.lineTo(x - 17, y - 22 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(10,14,22,0.9)';
  ctx.beginPath();
  ctx.moveTo(x, y - 36 + bob);
  ctx.lineTo(x + 10, y - 22 + bob);
  ctx.lineTo(x, y - 9 + bob);
  ctx.lineTo(x - 10, y - 22 + bob);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = hudFont(21, 800);
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.strokeText(label, x, y - 58 + bob);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x, y - 58 + bob);
  }
}

// An off-screen direction chevron at the view edge, pointing the way.
export function drawEdgeChevron(ctx, view, tx, ty, color, label) {
  const cx = view.w / 2;
  const cy = view.h / 2;
  const dx = tx - (view.x + cx);
  const dy = ty - (view.y + cy);
  const ang = Math.atan2(dy, dx);
  const ex = clamp(cx + Math.cos(ang) * (cx - 60), 46, view.w - 46);
  const ey = clamp(cy + Math.sin(ang) * (cy - 60), 46, view.h - 46);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -13);
  ctx.lineTo(-12, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.font = hudFont(20, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.strokeText(label, ex, ey + 34);
    ctx.fillText(label, ex, ey + 34);
  }
}

// Headlight cone for a vehicle at night (additive-feeling wedge).
export function drawHeadlightCone(ctx, x, y, angle, night) {
  if (night < 0.2) return;
  const len = 190;
  const spread = 0.42;
  const g = ctx.createRadialGradient(x, y, 8, x + Math.cos(angle) * len * 0.6, y + Math.sin(angle) * len * 0.6, len);
  g.addColorStop(0, `rgba(255,240,190,${0.3 * night})`);
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, len, angle - spread, angle + spread);
  ctx.closePath();
  ctx.fill();
}

// A soft round shadow blob under an actor.
export function drawShadowBlob(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
