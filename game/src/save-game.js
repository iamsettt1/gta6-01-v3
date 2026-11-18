// save-game.js — Puerto Serena: Neon Tide
// One job: persistence. The whole run — cash, respect, missions,
// races, shells, exports, garage stats and the player's position —
// serializes to localStorage at the safehouse and on mission
// completion, and loads again on the title screen. The safehouse also
// refills armour and keeps the garage statistics board.

import { CONFIG } from './config.js';
import { listLandmarks } from './districts.js';
import { respectLevelFor } from './missions-story.js';

// A fresh run's progress record.
export function freshProgress() {
  return {
    cash: 250,
    respectPoints: 0,
    respectLevel: 1,
    missionsDone: [false, false, false, false, false, false, false, false, false, false],
    racesWon: [false, false, false, false],
    raceBest: [null, null, null, null],
    shellsFound: new Array(15).fill(false),
    exportsDone: [false, false, false, false, false, false],
    stats: {
      carsDriven: 0,
      boatsDriven: 0,
      distanceKm: 0,
      faresDone: 0,
      timesBusted: 0,
      timesWasted: 0,
      shotsFired: 0,
    },
    playerStart: null, // {x, y} written by saves
  };
}

export class SaveGame {
  constructor() {
    this.key = CONFIG.saveKey;
    this.safehouse = listLandmarks().safehouse;
    this.lastSaveText = '';
  }

  // Serialize the run. Returns true on success.
  save(progress, player) {
    try {
      const data = {
        version: 1,
        progress: {
          ...progress,
          stats: { ...progress.stats },
        },
        playerStart: { x: Math.round(player.x), y: Math.round(player.y) },
        armour: Math.round(player.armour),
      };
      localStorage.setItem(this.key, JSON.stringify(data));
      this.lastSaveText = 'GAME SAVED AT THE SAFEHOUSE';
      return true;
    } catch (err) {
      return false; // storage can be unavailable; the game goes on
    }
  }

  // Load a saved run, or null when there is none / it is unreadable.
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !data.progress) return null;
      const progress = { ...freshProgress(), ...data.progress };
      progress.stats = { ...freshProgress().stats, ...(data.progress.stats || {}) };
      progress.respectLevel = respectLevelFor(progress.respectPoints);
      return { progress, playerStart: data.playerStart, armour: data.armour || 0 };
    } catch (err) {
      return null;
    }
  }

  hasSave() {
    try {
      return !!localStorage.getItem(this.key);
    } catch (err) {
      return false;
    }
  }

  wipe() {
    try {
      localStorage.removeItem(this.key);
    } catch (err) { /* ignore */ }
  }

  // Standing at the safehouse door on foot, key E saves and heals.
  atSafehouse(player) {
    return !player.inVehicle
      && Math.hypot(player.x - this.safehouse.x, player.y - this.safehouse.y) < 85;
  }

  // The garage statistics board lines (safehouse & progress screen).
  statsLines(progress) {
    const s = progress.stats;
    return [
      `Cars driven ${s.carsDriven} · Boats driven ${s.boatsDriven}`,
      `Distance ${s.distanceKm.toFixed(1)} km · Taxi fares ${s.faresDone}`,
      `Busted ${s.timesBusted} · Wasted ${s.timesWasted} · Shots fired ${s.shotsFired}`,
    ];
  }

  // The safehouse world marker.
  drawMarker(ctx, view, time) {
    const { x, y } = this.safehouse;
    if (x < view.x - 60 || x > view.x + view.w + 60 || y < view.y - 60 || y > view.y + view.h + 60) return;
    const bob = Math.sin(time * 2.4 + 1) * 5;
    ctx.fillStyle = '#7be495';
    ctx.beginPath(); ctx.arc(x, y - 54 + bob, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0e16';
    ctx.font = '900 20px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', x, y - 47 + bob);
    ctx.font = '700 19px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6,8,12,0.9)';
    ctx.strokeText('SERENA SAFEHOUSE — E TO SAVE', x, y - 82 + bob);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SERENA SAFEHOUSE — E TO SAVE', x, y - 82 + bob);
  }
}
