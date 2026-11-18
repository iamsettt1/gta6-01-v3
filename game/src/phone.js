// phone.js — Puerto Serena: Neon Tide
// One job: Nico's phone. Key P opens it: Marina's and the other
// givers' contacts with the next objective, the weather and clock,
// garage stats — and the one shady button that matters: a bribe that
// clears the wanted level for cash, once per heat, arranged through
// a harbour contact who knows a clerk at the comisaría.

import { CONFIG, hudFont } from './config.js';
import { drawPlate } from './renderer-camera.js';

// The contact list: name, role, and the line they answer with.
export function phoneContacts() {
  return [
    { name: 'Marina Solís', role: 'Fixer — Harbour Crew', line: '“The harbour provides, Nico. Check your next job.”' },
    { name: 'Lola Ferrer', role: 'Club Marea Rosa', line: '“Neón nights are for fast cars, handsome.”' },
    { name: 'Taller Rueda', role: 'Export Serena Garage', line: '“The list pays, wheelman. Bring me clean cars.”' },
    { name: 'Capitán Iker', role: 'Marina Dockmaster', line: '“Moorings are free after dark. Mind the patrol.”' },
  ];
}

// What a bribe costs at the current star level.
export function bribePrice(stars) {
  return CONFIG.economy.bribeBase + stars * CONFIG.economy.bribePerStar;
}

export class PhoneUI {
  constructor() {
    this.open = false;
    this.selection = 0;
    this.message = '';
    this.messageTimer = 0;
    this.readout = ''; // weather/objective text shown after a "call"
  }

  toggle(G) {
    this.open = !this.open;
    if (this.open) {
      this.selection = 0;
      this.readout = '';
      G.audio.uiClick();
    }
  }

  close() {
    this.open = false;
  }

  update(dt, G) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (!this.open) return;
    const input = G.input;
    const rows = phoneContacts().length + 1; // contacts + bribe row
    if (input.tapped('ArrowUp') || input.tapped('KeyW')) {
      this.selection = (this.selection + rows - 1) % rows;
      G.audio.uiClick();
    }
    if (input.tapped('ArrowDown') || input.tapped('KeyS')) {
      this.selection = (this.selection + 1) % rows;
      G.audio.uiClick();
    }
    if (input.tapped('Enter')) this.activate(G);
    if (input.tapped('KeyP') || input.tapped('Escape')) this.close();
  }

  activate(G) {
    const contacts = phoneContacts();
    if (this.selection < contacts.length) {
      const c = contacts[this.selection];
      const objective = G.director.objectiveFor(G);
      this.readout = `${c.name}: ${c.line}\nNext: ${objective.title}`;
      G.audio.uiClick();
      return;
    }
    // The bribe row.
    const stars = G.police.stars();
    if (stars === 0) {
      this.message = 'NO HEAT TO BUY OFF';
      this.messageTimer = 2;
      return;
    }
    if (G.police.bribeUsed) {
      this.message = 'THE CLERK WON’T RISK IT TWICE';
      this.messageTimer = 2;
      return;
    }
    const price = bribePrice(stars);
    if (G.progress.cash < price) {
      this.message = `BRIBE NEEDS $${price}`;
      this.messageTimer = 2;
      G.audio.dryFire();
      return;
    }
    G.progress.cash -= price;
    G.police.clearHeat();
    G.police.standDown();
    G.police.bribeUsed = true;
    G.audio.cashRegister();
    this.message = `BRIBED — $${price} · THE LAW LOOKS AWAY`;
    this.messageTimer = 2.6;
    G.toast(this.message);
    this.close();
  }

  // The phone: a handset slab on the right of the screen.
  draw(ctx, view, G) {
    if (!this.open) return;
    const w = 430;
    const h = 600;
    const x = view.w - w - 28;
    const y = (view.h - h) / 2;
    drawPlate(ctx, x, y, w, h, 0.94, 26);
    ctx.strokeStyle = '#37e6ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = hudFont(30, 900);
    ctx.textAlign = 'left';
    ctx.fillText('NICO — PHONE', x + 26, y + 48);
    ctx.font = hudFont(21, 600);
    ctx.fillStyle = '#9fb2c8';
    ctx.fillText(G.weather.summary(), x + 26, y + 80);

    const contacts = phoneContacts();
    let ry = y + 122;
    for (let i = 0; i < contacts.length; i++) {
      const selected = this.selection === i;
      if (selected) {
        ctx.fillStyle = 'rgba(55,230,255,0.18)';
        ctx.beginPath(); ctx.roundRect(x + 14, ry - 30, w - 28, 56, 10); ctx.fill();
      }
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath(); ctx.arc(x + 44, ry - 4, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0e16';
      ctx.font = hudFont(20, 900);
      ctx.textAlign = 'center';
      ctx.fillText(contacts[i].name[0], x + 44, ry + 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = hudFont(24, 800);
      ctx.fillText(contacts[i].name, x + 72, ry + 2);
      ctx.fillStyle = '#9fb2c8';
      ctx.font = hudFont(19, 600);
      ctx.fillText(contacts[i].role, x + 72, ry + 24);
      ry += 68;
    }

    // Bribe row.
    const stars = G.police.stars();
    const bribeSelected = this.selection === contacts.length;
    if (bribeSelected) {
      ctx.fillStyle = 'rgba(255,83,71,0.2)';
      ctx.beginPath(); ctx.roundRect(x + 14, ry - 30, w - 28, 56, 10); ctx.fill();
    }
    ctx.fillStyle = '#ff5347';
    ctx.beginPath(); ctx.arc(x + 44, ry - 4, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = hudFont(20, 900);
    ctx.textAlign = 'center';
    ctx.fillText('$', x + 44, ry + 3);
    ctx.textAlign = 'left';
    ctx.font = hudFont(24, 800);
    ctx.fillText('Call the Clerk (Bribe)', x + 72, ry + 2);
    ctx.fillStyle = '#9fb2c8';
    ctx.font = hudFont(19, 600);
    ctx.fillText(stars > 0 ? `Clear ${stars}★ for $${bribePrice(stars)} · once per heat` : 'No heat right now', x + 72, ry + 24);

    // Readout / message area.
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(x + 18, y + h - 128, w - 36, 76, 10); ctx.fill();
    ctx.fillStyle = '#e8f2ff';
    ctx.font = hudFont(20, 600);
    const text = this.messageTimer > 0 ? this.message : this.readout || '↑ ↓ select · ENTER call · P close';
    const lines = wrapText(ctx, text, w - 64);
    lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, x + 30, y + h - 96 + i * 26));
    ctx.fillStyle = '#9fb2c8';
    ctx.font = hudFont(18, 600);
    ctx.fillText(`Cash $${G.progress.cash} · Respect Lv ${G.progress.respectLevel}`, x + 26, y + h - 22);
  }
}

// Greedy word wrap for canvas text blocks.
export function wrapText(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    out.push(line);
  }
  return out;
}
