// paint-shop.js — Puerto Serena: Neon Tide
// One job: Brillo Paint & Body in Centro Aurelio. Drive in to repaint
// a car from a colour palette, repair all damage, restock ammunition
// and armour — and, for a fee that grows with your wanted level, lose
// the police entirely. The classic crime-game pressure valve.

import { CONFIG, hudFont } from './config.js';
import { listLandmarks } from './districts.js';
import { drawPlate } from './renderer-camera.js';

// The repaint palette offered on the shop wall.
export function paintColourChoices() {
  return [
    { name: 'Serena Red', hex: '#e8232a' },
    { name: 'Neon Pink', hex: '#ff4fd8' },
    { name: 'Lagoon Cyan', hex: '#37e6ff' },
    { name: 'Sol Gold', hex: '#ffc94d' },
    { name: 'Palma Green', hex: '#2fae5f' },
    { name: 'Midnight', hex: '#191d24' },
    { name: 'Pearl White', hex: '#f2f4f6' },
    { name: 'Syndicate Maroon', hex: '#8e2434' },
  ];
}

export class PaintShop {
  constructor() {
    this.at = listLandmarks().paintShop;
    this.open = false;
    this.selection = 0;
    this.message = '';
    this.messageTimer = 0;
  }

  // Total price of a full service for the player's current state.
  priceFor(G) {
    const stars = G.police.stars();
    return CONFIG.economy.paintBaseFee + stars * CONFIG.economy.paintHeatFee;
  }

  // Is the player at the shop door, in a car?
  playerAtDoor(G) {
    return G.player.inVehicle && G.player.inVehicle.kind === 'car'
      && Math.hypot(G.player.inVehicle.x - this.at.x, G.player.inVehicle.y - this.at.y) < 110;
  }

  openShop(G) {
    if (!this.playerAtDoor(G)) return false;
    this.open = true;
    this.selection = 0;
    this.message = '';
    G.audio.uiClick();
    return true;
  }

  closeShop() {
    this.open = false;
  }

  // Menu keys while open: arrows pick a colour, Enter buys, Esc exits.
  update(dt, G) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (!this.open) return;
    const input = G.input;
    const colours = paintColourChoices();
    if (input.tapped('ArrowLeft') || input.tapped('KeyA')) {
      this.selection = (this.selection + colours.length - 1) % colours.length;
      G.audio.uiClick();
    }
    if (input.tapped('ArrowRight') || input.tapped('KeyD')) {
      this.selection = (this.selection + 1) % colours.length;
      G.audio.uiClick();
    }
    if (input.tapped('Enter')) this.buy(G);
    if (input.tapped('Escape')) this.closeShop();
  }

  // Buy the full service: repaint, repair, restock, clear the heat.
  buy(G) {
    const price = this.priceFor(G);
    const car = G.player.inVehicle;
    if (!car) { this.closeShop(); return; }
    if (G.progress.cash < price) {
      this.message = `NOT ENOUGH CASH — NEED $${price}`;
      this.messageTimer = 2.4;
      G.audio.dryFire();
      return;
    }
    G.progress.cash -= price;
    const colour = paintColourChoices()[this.selection];
    car.color = colour.hex;
    car.health = car.maxHealth;
    car.wrecked = false;
    G.player.armour = Math.max(G.player.armour, 50);
    G.arsenal.addAmmo('smg', 60);
    G.arsenal.addAmmo('scattergun', 12);
    const hadHeat = G.police.stars() > 0;
    G.police.clearHeat();
    G.police.standDown();
    G.audio.cashRegister();
    G.effects.cashConfetti(car.x, car.y, G.rng);
    this.message = hadHeat ? `REPAINTED ${colour.name.toUpperCase()} — THE LAW LOSES YOU` : `REPAINTED ${colour.name.toUpperCase()} — GOOD AS NEW`;
    this.messageTimer = 3;
    this.closeShop();
    G.toast(this.message);
  }

  // The shop's world marker: a spray-can beacon over the door.
  drawMarker(ctx, view, time) {
    const { x, y } = this.at;
    if (x < view.x - 60 || x > view.x + view.w + 60 || y < view.y - 60 || y > view.y + view.h + 60) return;
    const bob = Math.sin(time * 2.4) * 5;
    ctx.fillStyle = '#37e6ff';
    ctx.beginPath(); ctx.arc(x, y - 54 + bob, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0e16';
    ctx.font = '900 21px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', x, y - 46 + bob);
    ctx.font = hudFont(19, 800);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    const label = 'BRILLO PAINT & BODY';
    ctx.strokeText(label, x, y - 82 + bob);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x, y - 82 + bob);
  }

  // The shop menu overlay.
  drawMenu(ctx, view, G) {
    if (!this.open) return;
    const w = 640;
    const h = 400;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    drawPlate(ctx, x, y, w, h, 0.92, 18);
    ctx.fillStyle = '#37e6ff';
    ctx.fillRect(x, y, w, 8);
    ctx.font = hudFont(36, 900);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BRILLO PAINT & BODY', view.w / 2, y + 58);
    ctx.font = hudFont(24, 700);
    ctx.fillStyle = '#ffc94d';
    ctx.fillText(`FULL SERVICE — $${this.priceFor(G)}  ·  REPAIR + REPAINT + HEAT CLEARED`, view.w / 2, y + 98);
    // Colour swatches.
    const colours = paintColourChoices();
    const sw = 58;
    const totalW = colours.length * (sw + 12) - 12;
    let sx = view.w / 2 - totalW / 2;
    for (let i = 0; i < colours.length; i++) {
      ctx.fillStyle = colours[i].hex;
      ctx.beginPath(); ctx.roundRect(sx, y + 140, sw, sw, 10); ctx.fill();
      if (i === this.selection) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.roundRect(sx - 4, y + 136, sw + 8, sw + 8, 12); ctx.stroke();
      }
      sx += sw + 12;
    }
    ctx.font = hudFont(27, 800);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(colours[this.selection].name.toUpperCase(), view.w / 2, y + 248);
    ctx.font = hudFont(22, 600);
    ctx.fillStyle = '#c8d2e0';
    ctx.fillText('← → choose colour · ENTER buy · ESC leave', view.w / 2, y + 300);
    ctx.fillText(`Your cash: $${G.progress.cash}`, view.w / 2, y + 336);
    if (this.messageTimer > 0) {
      ctx.fillStyle = '#ff9d94';
      ctx.font = hudFont(24, 800);
      ctx.fillText(this.message, view.w / 2, y + 372);
    }
  }
}
