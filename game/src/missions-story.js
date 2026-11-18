// missions-story.js — Puerto Serena: Neon Tide
// One job: the story. Ten chained missions for fixer Marina Solís and
// her harbour crew against the Cárdenas logistics syndicate — courier
// work, a tail, a night run, a dock shootout, a street race, a boat
// smuggling run, an export list, an ambush, a two-bridge chase and a
// five-star harbour heist — each with a giver, a briefing, objectives,
// a checklist, fail states and cash + respect rewards.

import { clamp } from './config.js';
import { listLandmarks } from './districts.js';
import { escalateWantedLevel } from './police-pursuit.js';

// The ten story missions, in chain order. Steps are data; the
// MissionDirector below interprets them.
export function listStoryMissions() {
  const L = listLandmarks();
  return [
    {
      id: 'first-wheels', name: 'First Wheels', giver: 'Marina Solís', giverAt: L.marinaOffice,
      brief: [
        'Marina: "Nico Vidal. Word is you can drive anything with wheels."',
        '"Prove it. There is a marked Aurelio Sedan waiting in Centro."',
        '"Bring it to my harbour office. No dents you cannot explain."',
      ],
      reward: { cash: 450, respect: 40 },
      steps: [
        { type: 'steal-deliver', label: 'STEAL THE MARKED SEDAN', carCls: 'sedan', carAt: { x: 2500, y: 1620 }, carColor: '#c0c6ce', deliver: L.marinaOffice, deliverLabel: 'DELIVER IT TO THE MARINA' },
      ],
    },
    {
      id: 'tail-courier', name: 'Tail the Courier', giver: 'Marina Solís', giverAt: L.marinaOffice,
      brief: [
        'Marina: "A Cárdenas courier crosses Mercado Brisa at noon."',
        '"Follow him to his drop. Stay close enough to see, far enough',
        'to stay a ghost. The meter fills if you crowd him or lose him."',
      ],
      reward: { cash: 600, respect: 50 },
      steps: [
        { type: 'goto', label: 'REACH THE MERCADO OVERLOOK', at: { x: 1300, y: 1030 }, radius: 90 },
        {
          type: 'follow', label: 'FOLLOW THE COURIER — DON’T BE SPOTTED',
          route: [
            { x: 1300, y: 1100 }, { x: 1900, y: 1100 }, { x: 1900, y: 1700 },
            { x: 2500, y: 1700 }, { x: 2500, y: 2300 }, { x: 3100, y: 2300 },
          ],
        },
      ],
    },
    {
      id: 'neon-run', name: 'Neon Run', giver: 'Lola Ferrer', giverAt: L.neonClub,
      brief: [
        'Lola runs Club Marea Rosa and half the favours in Barrio Neón.',
        '"A package, handsome. Across the district, before the song ends."',
        '"Rain makes the streets honest. Drive like you mean it."',
      ],
      reward: { cash: 750, respect: 55 },
      night: true, rain: true,
      steps: [
        { type: 'goto', label: 'PICK UP THE PACKAGE AT CLUB MAREA ROSA', at: L.neonClub, radius: 80 },
        { type: 'timed-goto', label: 'NEON RUN — DELIVER BEFORE TIME RUNS OUT', at: { x: 4900, y: 1100 }, seconds: 95, radius: 90 },
      ],
    },
    {
      id: 'dockside-static', name: 'Dockside Static', giver: 'Marina Solís', giverAt: L.marinaOffice,
      brief: [
        'Marina: "Cárdenas muscle is sitting on my dock crew’s turf."',
        '"Clear the yard by the cranes. All of them. Then we talk money."',
      ],
      reward: { cash: 950, respect: 70 },
      steps: [
        { type: 'goto', label: 'REACH THE MARINA YARD', at: { x: 4050, y: 3050 }, radius: 110 },
        { type: 'shootout', label: 'CLEAR THE CÁRDENAS CREW', at: { x: 4050, y: 3050 }, count: 6 },
      ],
    },
    {
      id: 'street-crown', name: 'Street Crown', giver: 'Lola Ferrer', giverAt: L.raceStart,
      brief: [
        'Lola: "Three laps of Centro Aurelio, every checkpoint lit."',
        '"The Crown is not about the car, wheelman. It is about the line."',
      ],
      reward: { cash: 1100, respect: 80 },
      steps: [
        {
          type: 'race', label: 'STREET CROWN — 3 LAPS OF CENTRO AURELIO', laps: 3,
          checkpoints: [
            { x: 2500, y: 1100 }, { x: 3100, y: 1100 }, { x: 3100, y: 1700 },
            { x: 3100, y: 2300 }, { x: 2500, y: 2300 }, { x: 2500, y: 1700 },
          ],
        },
      ],
    },
    {
      id: 'wet-cargo', name: 'Wet Cargo', giver: 'Marina Solís', giverAt: L.marinaDock,
      brief: [
        'Marina: "The speedboat at the dock is loaded. Isla Faros, the cove."',
        '"The maritime police have new boats and old grudges. Outrun both."',
      ],
      reward: { cash: 1400, respect: 90 },
      steps: [
        { type: 'goto', label: 'BOARD THE SPEEDBOAT AT THE DOCKS', at: L.marinaDock, radius: 130, need: 'boat' },
        { type: 'boat-goto', label: 'WET CARGO — REACH ISLA FAROS', at: L.islandCove, radius: 170, heat: 3 },
      ],
    },
    {
      id: 'export-list', name: 'The Export List', giver: 'Taller Rueda', giverAt: L.exportGarage,
      brief: [
        'Rueda, of Export Serena: "Three cars, wheelman. Names on a list."',
        '"A Toro Muscle, a Véla Sports, a Colina SUV. My garage pays top."',
      ],
      reward: { cash: 1800, respect: 100 },
      steps: [
        {
          type: 'collect-cars', label: 'STEAL THE EXPORT CARS', deliver: L.exportGarage, deliverLabel: 'DELIVER TO EXPORT SERENA',
          cars: [
            { name: 'Toro Muscle', cls: 'muscle', at: { x: 1900, y: 2220 }, color: '#e2543e' },
            { name: 'Véla Sports', cls: 'sports', at: { x: 3700, y: 1620 }, color: '#ffd23e' },
            { name: 'Colina SUV', cls: 'suv', at: { x: 1300, y: 420 }, color: '#5c6650' },
          ],
        },
      ],
    },
    {
      id: 'rainy-ambush', name: 'Rainy Night Ambush', giver: 'Lola Ferrer', giverAt: L.neonClub,
      brief: [
        'Lola: "They know your face now, handsome. Tonight, in the rain,"',
        '"the Neón bites back. Survive it, and the city respects you."',
      ],
      reward: { cash: 2000, respect: 110 },
      night: true, rain: true,
      steps: [
        { type: 'goto', label: 'MEET LOLA AT CLUB MAREA ROSA', at: L.neonClub, radius: 85 },
        { type: 'survive', label: 'SURVIVE THE AMBUSH', at: L.neonClub, seconds: 75, waves: 3 },
      ],
    },
    {
      id: 'two-bridges', name: 'Two Bridges', giver: 'Marina Solís', giverAt: L.marinaOffice,
      brief: [
        'Marina: "A Cárdenas armoured van runs gold over both bridges."',
        '"Stop it before the island. Ram it, shoot it — bring me the gold."',
      ],
      reward: { cash: 2600, respect: 130 },
      steps: [
        { type: 'goto', label: 'INTERCEPT AT PUENTE OESTE', at: L.bridgeWest, radius: 130 },
        {
          type: 'chase-van', label: 'STOP THE ARMOURED VAN',
          route: [
            { x: 4625, y: 3260 }, { x: 4625, y: 3860 }, { x: 5275, y: 3860 }, { x: 5275, y: 3260 },
          ],
        },
        { type: 'goto', label: 'BRING THE GOLD TO THE MARINA', at: L.marinaOffice, radius: 110 },
      ],
    },
    {
      id: 'harbour-heist', name: 'The Harbour Heist', giver: 'Marina Solís', giverAt: L.marinaOffice,
      brief: [
        'Marina: "Tonight we take the vault convoy at the Cárdenas yard."',
        '"Crack the vault, take the gold, and run — five stars of run."',
        '"Car or boat, wheelman. Just do not stop. This is the big one."',
      ],
      reward: { cash: 5000, respect: 200 },
      steps: [
        { type: 'goto', label: 'REACH THE VAULT YARD', at: L.vaultYard, radius: 120 },
        { type: 'crack-vault', label: 'CRACK THE VAULT — HOLD THE YARD', at: L.vaultYard, seconds: 6 },
        { type: 'escape', label: 'ESCAPE WITH THE VAULT GOLD — REACH THE MARINA', at: L.marinaDock, radius: 170 },
      ],
    },
  ];
}

// Respect points per level threshold: level n needs (n-1)*110 points.
export function respectLevelFor(points) {
  return clamp(1 + Math.floor(points / 110), 1, 10);
}

export class MissionDirector {
  constructor() {
    this.missions = listStoryMissions();
    this.active = null;      // {def, stepIndex, step} runtime
    this.briefing = null;    // mission def awaiting the player's go
    this.failedReason = null;
    this.completedCount = 0;
  }

  // The next mission the player can take (chain order).
  nextMission(progress) {
    for (let i = 0; i < this.missions.length; i++) {
      if (!progress.missionsDone[i]) return { def: this.missions[i], index: i };
    }
    return null;
  }

  giverPosition(progress) {
    const next = this.nextMission(progress);
    return next ? next.def.giverAt : null;
  }

  // Open the briefing for the next mission (main shows the card).
  openBriefing(progress) {
    const next = this.nextMission(progress);
    if (!next) return null;
    this.briefing = next.def;
    return next.def;
  }

  // Begin the briefed mission.
  begin(G) {
    if (!this.briefing) return;
    const def = this.briefing;
    this.briefing = null;
    this.active = { def, stepIndex: 0, step: null, elapsed: 0 };
    if (def.night) G.weather.setHour(21.6);
    if (def.rain) G.weather.scriptRain(0.85);
    this._setupStep(G);
    G.toast(`MISSION STARTED — ${def.name.toUpperCase()}`);
    G.audio.uiClick();
  }

  _setupStep(G) {
    const a = this.active;
    const step = a.def.steps[a.stepIndex];
    a.step = { ...step, state: {}, startedAt: G.time };
    const s = a.step.state;
    if (step.type === 'steal-deliver') {
      s.car = G.spawnCar(step.carCls, step.carAt.x, step.carAt.y, Math.PI / 2, step.carColor, 'mission');
      s.car.missionTarget = true;
      s.phase = 'steal';
    } else if (step.type === 'follow') {
      const start = step.route[0];
      s.courier = G.spawnCar('sedan', start.x, start.y, 0, '#33415c', 'courier');
      s.wp = 1;
      s.detection = 0;
      s.courier.speed = 0;
    } else if (step.type === 'timed-goto') {
      s.left = step.seconds;
    } else if (step.type === 'shootout') {
      s.spawned = false;
      s.total = step.count;
    } else if (step.type === 'race') {
      s.lap = 1;
      s.cp = 0;
      s.time = 0;
    } else if (step.type === 'boat-goto') {
      if (step.heat) {
        G.police.heat = Math.max(G.police.heat, step.heat * 100 - 1);
        escalateWantedLevel(G.police, 'missionAlarm');
      }
    } else if (step.type === 'collect-cars') {
      s.index = 0;
      s.phase = 'steal';
      s.car = this._spawnCollectCar(G, step, 0);
    } else if (step.type === 'survive') {
      s.left = step.seconds;
      s.wave = 0;
      s.waveTimer = 2;
    } else if (step.type === 'chase-van') {
      const start = step.route[0];
      s.van = G.spawnCar('van', start.x, start.y, Math.PI / 2, '#3a3f46', 'mission');
      s.van.spec = { ...s.van.spec, topSpeed: 330, accel: 300 };
      s.van.health = 320;
      s.van.maxHealth = 320;
      s.van.missionTarget = true;
      s.wp = 1;
      s.stopped = false;
    } else if (step.type === 'crack-vault') {
      s.progress = 0;
      G.rivals.spawnGroup(step.at.x, step.at.y, 4, G.layout);
    } else if (step.type === 'escape') {
      G.police.heat = 500;
      G.police.bribeUsed = true; // no buying your way out of the finale
    }
  }

  _spawnCollectCar(G, step, index) {
    const c = step.cars[index];
    const car = G.spawnCar(c.cls, c.at.x, c.at.y, Math.PI / 2, c.color, 'mission');
    car.missionTarget = true;
    car.displayName = c.name;
    return car;
  }

  _advanceStep(G) {
    const a = this.active;
    this._cleanupStep(G);
    a.stepIndex += 1;
    if (a.stepIndex >= a.def.steps.length) {
      this._completeMission(G);
    } else {
      this._setupStep(G);
    }
  }

  _cleanupStep(G) {
    const s = this.active.step.state;
    if (s.car && s.car.role === 'mission') G.removeDynamic(s.car);
    if (s.courier) G.removeDynamic(s.courier);
    if (s.van && !s.stopped) G.removeDynamic(s.van);
  }

  _completeMission(G) {
    const def = this.active.def;
    const index = this.missions.indexOf(def);
    G.progress.missionsDone[index] = true;
    this.completedCount += 1;
    this.active = null;
    G.addRespect(def.reward.respect);
    G.addCash(def.reward.cash, G.player.focus().x, G.player.focus().y);
    G.audio.missionComplete();
    G.toast(`MISSION COMPLETE — ${def.name.toUpperCase()}  +$${def.reward.cash}`);
    if (!def.rain) G.weather.scriptRain(null);
    G.saveGame();
  }

  // Fail the active mission (death, detection, escape, timeout).
  fail(G, reason) {
    if (!this.active) return;
    this._cleanupStep(G);
    this.failedReason = reason;
    this.active = null;
    G.rivals.clear();
    G.weather.scriptRain(null);
    G.audio.missionFailed();
    G.toast(`MISSION FAILED — ${reason}`);
  }

  // The HUD objective for the active mission, or the giver hint.
  objectiveFor(G) {
    if (!this.active) {
      const next = this.nextMission(G.progress);
      if (!next) return { title: 'PUERTO SERENA IS YOURS', checklist: [{ text: 'Free roam — races, fares, shells and exports remain', done: false }] };
      return {
        title: `MEET ${next.def.giver.toUpperCase()}`,
        checklist: [{ text: `Next mission: ${next.def.name} — $${next.def.reward.cash}`, done: false }],
        marker: { x: next.def.giverAt.x, y: next.def.giverAt.y, label: next.def.giver },
      };
    }
    const a = this.active;
    const step = a.step;
    const s = step.state;
    const checklist = a.def.steps.map((st, i) => ({
      text: st.label || st.type,
      done: i < a.stepIndex,
      current: i === a.stepIndex,
    }));
    const out = { title: step.label || a.def.name, checklist, meter: null, marker: null };
    this._objectiveMarker(out, step, s, G);
    return out;
  }

  _objectiveMarker(out, step, s, G) {
    const focus = G.player.focus();
    switch (step.type) {
      case 'goto':
      case 'timed-goto':
        out.marker = { x: step.at.x, y: step.at.y, label: step.label };
        break;
      case 'steal-deliver':
        out.marker = s.phase === 'steal' && s.car
          ? { x: s.car.x, y: s.car.y, label: 'TARGET CAR' }
          : { x: step.deliver.x, y: step.deliver.y, label: step.deliverLabel };
        break;
      case 'follow':
        out.marker = s.courier ? { x: s.courier.x, y: s.courier.y, label: 'COURIER' } : null;
        out.meter = { label: 'DETECTION', frac: (s.detection || 0) / 100, danger: true };
        break;
      case 'shootout':
        out.marker = { x: step.at.x, y: step.at.y, label: `${G.rivals.aliveCount()} CREW LEFT` };
        break;
      case 'race':
        out.marker = { x: step.checkpoints[s.cp].x, y: step.checkpoints[s.cp].y, label: `LAP ${s.lap}/${step.laps} · CP ${s.cp + 1}` };
        out.meter = { label: 'RACE TIME', frac: 0, text: `${s.time.toFixed(1)}s` };
        break;
      case 'boat-goto':
        out.marker = { x: step.at.x, y: step.at.y, label: 'ISLA FAROS' };
        break;
      case 'collect-cars': {
        const carDef = step.cars[s.index];
        out.marker = s.phase === 'steal' && s.car
          ? { x: s.car.x, y: s.car.y, label: carDef.name.toUpperCase() }
          : { x: step.deliver.x, y: step.deliver.y, label: step.deliverLabel };
        out.title = `${step.label} — ${carDef.name.toUpperCase()} (${s.index + (s.phase === 'deliver' ? 0 : 0)}/${step.cars.length} DELIVERED ${s.index})`;
        break;
      }
      case 'survive':
        out.marker = { x: step.at.x, y: step.at.y, label: 'HOLD THE CLUB' };
        out.meter = { label: 'SURVIVE', frac: clamp((s.left || 0) / step.seconds, 0, 1) };
        break;
      case 'chase-van':
        out.marker = s.van ? { x: s.van.x, y: s.van.y, label: 'ARMOURED VAN' } : { x: step.route[step.route.length - 1].x, y: step.route[step.route.length - 1].y, label: 'VAN' };
        if (s.van) out.meter = { label: 'VAN ARMOUR', frac: clamp(s.van.health / s.van.maxHealth, 0, 1), danger: true };
        break;
      case 'crack-vault':
        out.marker = { x: step.at.x, y: step.at.y, label: 'VAULT' };
        out.meter = { label: 'CRACKING', frac: (s.progress || 0) / step.seconds };
        break;
      case 'escape':
        out.marker = { x: step.at.x, y: step.at.y, label: 'MARINA — ESCAPE' };
        break;
      default:
        break;
    }
    void focus;
  }
}

// ---- Step engine -----------------------------------------------------------
// One update pass over the active step. Each branch is small: move the
// step's actors, test its win/fail conditions, advance or fail.

function stepUpdate(G, director) {
  const a = director.active;
  if (!a) return;
  const step = a.step;
  const s = step.state;
  const player = G.player;
  const focus = player.focus();
  const dt = G.dt;

  const near = (x, y, r) => Math.hypot(focus.x - x, focus.y - y) < r;

  switch (step.type) {
    case 'goto': {
      if (step.need === 'boat') {
        // Boarding any boat at the marina completes the step.
        if (player.inVehicle && player.inVehicle.kind === 'boat') director._advanceStep(G);
        break;
      }
      if (near(step.at.x, step.at.y, step.radius)) director._advanceStep(G);
      break;
    }

    case 'timed-goto': {
      s.left -= dt;
      if (near(step.at.x, step.at.y, step.radius)) {
        director._advanceStep(G);
      } else if (s.left <= 0) {
        director.fail(G, 'Out of time in the Neon Run');
      }
      break;
    }

    case 'steal-deliver': {
      if (s.phase === 'steal') {
        if (player.inVehicle === s.car) {
          s.phase = 'deliver';
          G.toast(step.deliverLabel);
        }
      } else if (player.inVehicle === s.car && near(step.deliver.x, step.deliver.y, 95)) {
        // Delivered: the car stays with Marina's crew.
        const delivered = s.car;
        player.inVehicle = null;
        player.x = delivered.x + 40;
        player.y = delivered.y + 30;
        G.removeDynamic(delivered);
        s.car = null;
        director._advanceStep(G);
      }
      break;
    }

    case 'follow': {
      const courier = s.courier;
      if (!courier) { director._advanceStep(G); break; }
      const target = step.route[s.wp];
      if (target) {
        const ang = Math.atan2(target.y - courier.y, target.x - courier.x);
        const steer = clamp(((ang - courier.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
        courier.angle += steer * dt * 1.6;
        courier.speed = Math.min(150, courier.speed + 130 * dt);
        courier.x += Math.cos(courier.angle) * courier.speed * dt;
        courier.y += Math.sin(courier.angle) * courier.speed * dt;
        if (Math.hypot(target.x - courier.x, target.y - courier.y) < 60) s.wp += 1;
      } else {
        // Route done: the tail succeeds if never fully detected.
        director._advanceStep(G);
        break;
      }
      const d = Math.hypot(focus.x - courier.x, focus.y - courier.y);
      if (d < 118 || d > 430) s.detection += dt * (d < 118 ? 26 : 15);
      else s.detection = Math.max(0, s.detection - dt * 9);
      if (s.detection >= 100) director.fail(G, 'The courier spotted you');
      break;
    }

    case 'shootout': {
      if (!s.spawned && near(step.at.x, step.at.y, 260)) {
        s.spawned = true;
        G.rivals.spawnGroup(step.at.x, step.at.y, step.count, G.layout);
        escalateWantedLevel(G.police, 'gunfire');
      }
      if (s.spawned && G.rivals.aliveCount() === 0) director._advanceStep(G);
      break;
    }

    case 'race': {
      s.time += dt;
      const cp = step.checkpoints[s.cp];
      if (near(cp.x, cp.y, 105)) {
        G.audio.pickup();
        G.effects.floatText(cp.x, cp.y - 40, s.cp === step.checkpoints.length - 1 ? `LAP ${s.lap} DONE` : 'CHECKPOINT', '#7be495', 30);
        s.cp += 1;
        if (s.cp >= step.checkpoints.length) {
          s.cp = 0;
          s.lap += 1;
          if (s.lap > step.laps) {
            G.progress.lastRaceTime = s.time;
            director._advanceStep(G);
          }
        }
      }
      break;
    }

    case 'boat-goto': {
      if (player.inVehicle && player.inVehicle.kind === 'boat' && near(step.at.x, step.at.y, step.radius)) {
        director._advanceStep(G);
      }
      break;
    }

    case 'collect-cars': {
      if (s.phase === 'steal') {
        if (s.car && player.inVehicle === s.car) {
          s.phase = 'deliver';
          escalateWantedLevel(G.police, 'theft');
          G.toast(step.deliverLabel);
        }
      } else {
        if (s.car && player.inVehicle === s.car && near(step.deliver.x, step.deliver.y, 100)) {
          const delivered = s.car;
          player.inVehicle = null;
          player.x = delivered.x - 44;
          player.y = delivered.y + 26;
          G.removeDynamic(delivered);
          s.car = null;
          s.index += 1;
          G.addCash(300, focus.x, focus.y);
          if (s.index >= step.cars.length) {
            director._advanceStep(G);
          } else {
            s.phase = 'steal';
            s.car = director._spawnCollectCar(G, step, s.index);
          }
        }
      }
      break;
    }

    case 'survive': {
      s.left -= dt;
      s.waveTimer -= dt;
      if (s.waveTimer <= 0 && s.wave < step.waves) {
        s.wave += 1;
        s.waveTimer = step.seconds / step.waves;
        G.rivals.spawnGroup(step.at.x + G.rng.range(-160, 160), step.at.y + G.rng.range(-160, 160), 3, G.layout);
        G.toast(`AMBUSH — WAVE ${s.wave}`);
      }
      if (s.left <= 0) {
        G.rivals.clear();
        director._advanceStep(G);
      }
      break;
    }

    case 'chase-van': {
      const van = s.van;
      if (!van) { director._advanceStep(G); break; }
      if (!s.stopped) {
        const target = step.route[s.wp];
        if (target) {
          const ang = Math.atan2(target.y - van.y, target.x - van.x);
          let delta = (ang - van.angle) % (Math.PI * 2);
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          van.angle += clamp(delta, -1, 1) * dt * 1.7;
          van.speed = Math.min(van.spec.topSpeed, van.speed + van.spec.accel * dt);
          van.x += Math.cos(van.angle) * van.speed * dt;
          van.y += Math.sin(van.angle) * van.speed * dt;
          if (Math.hypot(target.x - van.x, target.y - van.y) < 70) s.wp += 1;
        } else {
          director.fail(G, 'The van reached the island');
          break;
        }
        if (van.health <= 60 || van.wrecked) {
          s.stopped = true;
          van.speed = 0;
          G.toast('THE VAN IS STOPPED — GOLD SECURED');
          G.effects.cashConfetti(van.x, van.y, G.rng);
          director._advanceStep(G);
        }
      }
      break;
    }

    case 'crack-vault': {
      if (near(step.at.x, step.at.y, 130)) {
        s.progress += dt;
        if (G.rng.chance(0.1)) G.effects.sparks(step.at.x, step.at.y, G.rng, 3);
        if (s.progress >= step.seconds) {
          escalateWantedLevel(G.police, 'vaultGold');
          G.effects.cashConfetti(focus.x, focus.y, G.rng);
          director._advanceStep(G);
        }
      }
      break;
    }

    case 'escape': {
      if (near(step.at.x, step.at.y, step.radius)) {
        G.police.clearHeat();
        director._advanceStep(G);
      }
      break;
    }

    default:
      break;
  }
}

// Attach the step engine to the director (kept as a prototype method
// so the class above stays readable as pure story data and flow).
MissionDirector.prototype.update = function update(dt, G) {
  if (!this.active) return;
  this.active.elapsed += dt;
  stepUpdate(G, this);
};
