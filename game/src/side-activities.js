// side-activities.js — Puerto Serena: Neon Tide
// One job: everything to do between story missions — four street
// races with best-time medals, taxi fares with speed tips, fifteen
// hidden sun shells, and the six-car export list that pays at the
// Zona Industrial garage. All of it feeds the completion percentage.

import { clamp } from './config.js';
import { listLandmarks } from './districts.js';

// The six cars on Rueda's standing export list (separate from the
// story mission that introduces the garage).
export function listExportCars() {
  return [
    { name: 'Brisa Compact GT', cls: 'compact', at: { x: 700, y: 1620 }, color: '#3e8ae2' },
    { name: 'Aurelio Sedan Lux', cls: 'sedan', at: { x: 3100, y: 2220 }, color: '#33415c' },
    { name: 'Toro Muscle 500', cls: 'muscle', at: { x: 4300, y: 1030 }, color: '#191d24' },
    { name: 'Mula Pickup Pro', cls: 'pickup', at: { x: 4900, y: 2820 }, color: '#c9862f' },
    { name: 'Véla Sports R', cls: 'sports', at: { x: 1900, y: 620 }, color: '#e23e8a' },
    { name: 'Carga Van XL', cls: 'van', at: { x: 5500, y: 2220 }, color: '#3a7bc6' },
  ];
}

// Four race courses: name, start, checkpoints, medal times (seconds).
export function listRaceCourses() {
  return [
    {
      name: 'Centro Sprint', start: { x: 2500, y: 1750 }, gold: 55, silver: 75,
      checkpoints: [
        { x: 3100, y: 1700 }, { x: 3100, y: 1100 }, { x: 2500, y: 1100 }, { x: 2500, y: 1700 },
      ],
    },
    {
      name: 'Mercado Weave', start: { x: 1300, y: 1150 }, gold: 70, silver: 95,
      checkpoints: [
        { x: 1900, y: 1100 }, { x: 1900, y: 1700 }, { x: 1300, y: 1700 }, { x: 1300, y: 2300 }, { x: 1900, y: 2300 },
      ],
    },
    {
      name: 'Neon Mile', start: { x: 3700, y: 1150 }, gold: 60, silver: 85,
      checkpoints: [
        { x: 4300, y: 1100 }, { x: 4900, y: 1100 }, { x: 4900, y: 1700 }, { x: 4300, y: 1700 },
      ],
    },
    {
      name: 'Bridge Run', start: { x: 4300, y: 2950 }, gold: 80, silver: 110,
      checkpoints: [
        { x: 4625, y: 3260 }, { x: 4625, y: 3860 }, { x: 5275, y: 3860 }, { x: 4900, y: 2900 },
      ],
    },
  ];
}

// Fifteen sun shells, one or two per district, some on the island.
export function listSunShellSpots() {
  return [
    { x: 760, y: 3320 }, { x: 1500, y: 3360 }, { x: 2380, y: 3300 },   // Playa Serena
    { x: 2620, y: 640 }, { x: 3380, y: 1780 },                          // Centro Aurelio
    { x: 900, y: 2080 }, { x: 2050, y: 950 },                           // Mercado Brisa
    { x: 3560, y: 3380 }, { x: 4720, y: 2620 },                         // Marina
    { x: 4980, y: 560 }, { x: 3760, y: 1640 },                          // Barrio Neón
    { x: 1250, y: 420 },                                                // Colinas Verdes
    { x: 5780, y: 1900 },                                               // Zona Industrial
    { x: 4460, y: 4040 }, { x: 5520, y: 3840 },                         // Isla Faros
  ];
}

export class SideActivities {
  constructor() {
    this.courses = listRaceCourses();
    this.exports = listExportCars();
    this.shellSpots = listSunShellSpots();
    this.race = null;        // {course, cp, time, lap}
    this.taxi = null;        // {phase, passenger, dest, fareBase, timer}
    this.exportRun = null;   // {def, car}
    this.landmarks = listLandmarks();
  }

  // --- Races ---------------------------------------------------------------
  startRace(G, courseIndex) {
    const course = this.courses[courseIndex];
    if (!course) return;
    this.race = { course, cp: 0, time: 0, index: courseIndex };
    G.toast(`RACE — ${course.name.toUpperCase()} · GOLD UNDER ${course.gold}s`);
  }

  raceMarker() {
    if (!this.race) return null;
    const cp = this.race.course.checkpoints[this.race.cp];
    return { x: cp.x, y: cp.y, label: `${this.race.course.name.toUpperCase()} · ${this.race.time.toFixed(0)}s` };
  }

  // --- Taxi fares -------------------------------------------------------------
  // A hailing pedestrian boards when the player stops beside them in a
  // car; the fare pays base + a speed tip on delivery.
  tryBoardTaxi(G, ped) {
    if (this.taxi || !G.player.inVehicle || G.player.inVehicle.kind !== 'car') return false;
    if (Math.abs(G.player.inVehicle.speed) > 24) return false;
    if (Math.hypot(ped.x - G.player.x, ped.y - G.player.y) > 90 && Math.hypot(ped.x - G.player.inVehicle.x, ped.y - G.player.inVehicle.y) > 90) return false;
    const spots = [
      { x: 2500, y: 1150, name: 'Centro Aurelio' }, { x: 1450, y: 1450, name: 'Mercado Brisa' },
      { x: 4250, y: 1150, name: 'Club Marea Rosa' }, { x: 1750, y: 3150, name: 'Chiringuito Sol' },
      { x: 3560, y: 2560, name: 'the Marina' }, { x: 1250, y: 420, name: 'Mirador Verde' },
    ];
    const dest = G.rng.pick(spots);
    this.taxi = { phase: 'drive', ped, dest, elapsed: 0, par: Math.hypot(dest.x - ped.x, dest.y - ped.y) / 9.5 };
    ped.state = 'aboard';
    G.toast(`TAXI — DRIVE TO ${dest.name.toUpperCase()}`);
    return true;
  }

  taxiMarker() {
    if (!this.taxi) return null;
    return { x: this.taxi.dest.x, y: this.taxi.dest.y, label: 'FARE DROP-OFF' };
  }

  // --- Export list ---------------------------------------------------------------
  startExportRun(G, index) {
    const def = this.exports[index];
    if (!def || G.progress.exportsDone[index]) return;
    const car = G.spawnCar(def.cls, def.at.x, def.at.y, Math.PI / 2, def.color, 'mission');
    car.displayName = def.name;
    car.missionTarget = true;
    this.exportRun = { def, car, index, phase: 'steal' };
    G.toast(`EXPORT — STEAL THE ${def.name.toUpperCase()}`);
  }

  exportMarker() {
    if (!this.exportRun) return null;
    if (this.exportRun.phase === 'steal') {
      return { x: this.exportRun.car.x, y: this.exportRun.car.y, label: this.exportRun.def.name.toUpperCase() };
    }
    const g = this.landmarks.exportGarage;
    return { x: g.x, y: g.y, label: 'EXPORT SERENA GARAGE' };
  }

  update(dt, G) {
    const focus = G.player.focus();
    // Races.
    if (this.race) {
      this.race.time += dt;
      const cp = this.race.course.checkpoints[this.race.cp];
      if (G.player.inVehicle && Math.hypot(focus.x - cp.x, focus.y - cp.y) < 110) {
        G.audio.pickup();
        this.race.cp += 1;
        if (this.race.cp >= this.race.course.checkpoints.length) {
          const t = this.race.time;
          const medal = t <= this.race.course.gold ? 'GOLD' : t <= this.race.course.silver ? 'SILVER' : 'FINISH';
          const pay = medal === 'GOLD' ? 600 : medal === 'SILVER' ? 350 : 150;
          G.progress.racesWon[this.race.index] = true;
          const prev = G.progress.raceBest[this.race.index];
          if (prev === null || prev === undefined || t < prev) G.progress.raceBest[this.race.index] = Math.round(t * 10) / 10;
          G.addCash(pay, focus.x, focus.y);
          G.addRespect(15);
          G.toast(`RACE COMPLETE — ${medal} · ${t.toFixed(1)}s · +$${pay}`);
          this.race = null;
        }
      }
    }
    // Taxi.
    if (this.taxi) {
      this.taxi.elapsed += dt;
      if (!G.player.inVehicle) {
        G.toast('FARE LOST — THE PASSENGER GOT OUT');
        if (this.taxi.ped) this.taxi.ped.state = 'walk';
        this.taxi = null;
      } else if (Math.hypot(focus.x - this.taxi.dest.x, focus.y - this.taxi.dest.y) < 95 && Math.abs(G.player.inVehicle.speed) < 30) {
        const tip = this.taxi.elapsed < this.taxi.par ? 120 : this.taxi.elapsed < this.taxi.par * 1.6 ? 50 : 0;
        const fare = 140 + tip;
        G.progress.stats.faresDone += 1;
        G.addCash(fare, focus.x, focus.y);
        G.audio.cashRegister();
        G.toast(`FARE PAID — $${fare}${tip ? ` (TIP $${tip})` : ''}`);
        if (this.taxi.ped) {
          this.taxi.ped.state = 'walk';
          this.taxi.ped.x = focus.x + 34;
          this.taxi.ped.y = focus.y + 20;
          this.taxi.ped.wantsTaxi = false;
        }
        this.taxi = null;
      }
    }
    // Exports.
    if (this.exportRun) {
      const run = this.exportRun;
      if (run.phase === 'steal' && G.player.inVehicle === run.car) {
        run.phase = 'deliver';
        G.toast('DELIVER IT TO EXPORT SERENA — ZONA INDUSTRIAL');
      } else if (run.phase === 'deliver' && G.player.inVehicle === run.car) {
        const g = this.landmarks.exportGarage;
        if (Math.hypot(focus.x - g.x, focus.y - g.y) < 105) {
          G.player.inVehicle = null;
          G.player.x = run.car.x - 44;
          G.player.y = run.car.y + 26;
          G.removeDynamic(run.car);
          G.progress.exportsDone[run.index] = true;
          G.addCash(850, focus.x, focus.y);
          G.addRespect(20);
          G.audio.cashRegister();
          G.toast(`EXPORT DELIVERED — ${run.def.name.toUpperCase()} · +$850`);
          this.exportRun = null;
        }
      }
    }
    // Sun shells: walk (or drive slowly) over one to collect it.
    for (let i = 0; i < this.shellSpots.length; i++) {
      if (G.progress.shellsFound[i]) continue;
      const spot = this.shellSpots[i];
      if (Math.hypot(focus.x - spot.x, focus.y - spot.y) < 40) {
        G.progress.shellsFound[i] = true;
        G.audio.pickup();
        G.effects.floatText(spot.x, spot.y - 30, 'SUN SHELL!', '#ffc94d', 30);
        const found = G.progress.shellsFound.filter(Boolean).length;
        G.toast(`SUN SHELL ${found}/15`);
        if (found === 15) {
          G.addCash(1500, focus.x, focus.y);
          G.toast('ALL 15 SUN SHELLS — +$1,500 COLLECTOR BONUS');
        }
      }
    }
  }

  // Draw uncollected shells as golden spirals that catch the light.
  drawShells(ctx, view, progress, time) {
    for (let i = 0; i < this.shellSpots.length; i++) {
      if (progress.shellsFound[i]) continue;
      const spot = this.shellSpots[i];
      if (spot.x < view.x - 30 || spot.x > view.x + view.w + 30 || spot.y < view.y - 30 || spot.y > view.y + view.h + 30) continue;
      const bob = Math.sin(time * 2.6 + i) * 3;
      ctx.fillStyle = 'rgba(255,201,77,0.3)';
      ctx.beginPath(); ctx.arc(spot.x, spot.y + bob, 17 + Math.sin(time * 3 + i) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath(); ctx.arc(spot.x, spot.y + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b57e1e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y + bob, 6, 0.4, 4.4);
      ctx.arc(spot.x, spot.y + bob, 3, 4.4, 8);
      ctx.stroke();
    }
  }

  // Race start pads: standing on one on foot offers the race (key E).
  drawRacePads(ctx, view, time) {
    for (let i = 0; i < this.courses.length; i++) {
      const c = this.courses[i];
      if (c.start.x < view.x - 60 || c.start.x > view.x + view.w + 60 || c.start.y < view.y - 60 || c.start.y > view.y + view.h + 60) continue;
      ctx.strokeStyle = `rgba(123,228,149,${0.6 + 0.3 * Math.sin(time * 3)})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(c.start.x, c.start.y, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7be495';
      ctx.font = '800 19px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RACE', c.start.x, c.start.y - 44);
    }
  }
}

// Completion percentage: missions 50%, races 15%, shells 15%,
// exports 12%, respect 8% — shown on the progress screen.
export function completionPercent(progress) {
  const missions = progress.missionsDone.filter(Boolean).length / 10;
  const races = progress.racesWon.filter(Boolean).length / 4;
  const shells = progress.shellsFound.filter(Boolean).length / 15;
  const exportsDone = progress.exportsDone.filter(Boolean).length / 6;
  const respect = clamp((progress.respectLevel - 1) / 9, 0, 1);
  return Math.round(missions * 50 + races * 15 + shells * 15 + exportsDone * 12 + respect * 8);
}
