// main.js — Puerto Serena: Neon Tide (game entrypoint)
// One job: boot and conduct. It builds the seeded world and every
// system, owns the state machine (title, briefing, play, pause,
// board, busted, wasted, progress), runs the frame loop, wires input
// to the systems — enter/exit vehicles, carjackings, interactions,
// crimes and their witnesses, respawns — and renders the world and
// screens in order. Feature modules are imported most-feature-rich
// first so the dossier outline leads with the game's depth.

import { MissionDirector, respectLevelFor } from './missions-story.js';
import { PoliceDepartment, escalateWantedLevel } from './police-pursuit.js';
import { createCar, updateCarPhysics, drawVehicle, collideCars, carEntryBlock } from './vehicles-cars.js';
import { createBoat, updateBoatPhysics, drawBoat, listMoorings, nearestMooring } from './boats.js';
import { CONFIG, clamp } from './config.js';
import { SeededRandom } from './random.js';
import { InputControls, controlHelpLines } from './input-controls.js';
import { buildCityLayout, drawCityGround, isWaterAt } from './city-map.js';
import { districtNameAt, listLandmarks } from './districts.js';
import { DayCycleWeather } from './daycycle-weather.js';
import { ChaseCamera, drawObjectiveMarker, drawEdgeChevron } from './renderer-camera.js';
import { PlayerOnFoot } from './player-on-foot.js';
import { TrafficDirector } from './traffic-ai.js';
import { PedestrianCrowd, applyShove } from './pedestrians.js';
import { WeaponArsenal, updateBullets, drawBullets, drawCrosshair } from './combat-weapons.js';
import { RivalCrew } from './rival-crew.js';
import { SideActivities } from './side-activities.js';
import { PaintShop } from './paint-shop.js';
import { PhoneUI } from './phone.js';
import { SaveGame, freshProgress } from './save-game.js';
import { AudioSynth } from './audio-synth.js';
import { ParticleEffects } from './effects-particles.js';
import { HudMinimap, drawTitleScreen, drawBriefingCard, drawVerdictScreen } from './hud-minimap.js';
import { drawPauseScreen, drawMissionsBoard, drawProgressScreen } from './city-map-screen.js';
import { stageScreenshotScene } from './screenshot-scenes.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const params = new URLSearchParams(window.location.search);
    this.shotName = params.get('shot');
    this.seed = parseInt(params.get('seed') || '7', 10) || 7;

    this.rng = new SeededRandom(this.seed * 1013 + 17);
    this.layout = buildCityLayout(this.seed);
    this.landmarks = listLandmarks();
    this.weather = new DayCycleWeather();
    this.effects = new ParticleEffects();
    this.audio = new AudioSynth();
    this.audio.sirenClose = false;
    this.input = new InputControls(canvas);
    this.camera = new ChaseCamera();
    this.controlLines = controlHelpLines();

    this.progress = freshProgress();
    this.saveSys = new SaveGame();
    this.player = new PlayerOnFoot(this.landmarks.safehouse.x + 60, this.landmarks.safehouse.y + 40);
    this.traffic = new TrafficDirector(this.layout, new SeededRandom(this.seed * 31 + 5));
    this.crowd = new PedestrianCrowd(this.layout, new SeededRandom(this.seed * 77 + 9));
    this.police = new PoliceDepartment(this.layout, new SeededRandom(this.seed * 55 + 3));
    this.rivals = new RivalCrew(new SeededRandom(this.seed * 91 + 13));
    this.arsenal = new WeaponArsenal();
    this.bullets = [];
    this.director = new MissionDirector();
    this.activities = new SideActivities();
    this.paintShop = new PaintShop();
    this.phone = new PhoneUI();
    this.hud = new HudMinimap();

    this.dynamicCars = [];
    this.dynamicBoats = [];
    // Ambient moored boats at the marina and the island jetty.
    for (const m of listMoorings()) {
      const cls = this.rng.pick(['skiff', 'speedboat', 'skiff', 'cigarette']);
      const boat = createBoat(cls, m.x, m.y, m.angle, null, 'parked');
      boat.color = this.rng.pick(boat.cls === 'cigarette' ? ['#191d24'] : ['#f2f4f6', '#37b6ff', '#f2762e', '#c9862f']);
      this.dynamicBoats.push(boat);
    }

    this.state = 'title';
    this.time = 0;
    this.dt = 0;
    this.env = { night: 0, rain: 0, time: 0 };
    this.objective = null;
    this.objectiveOverride = null;
    this.prompt = null;
    this.districtName = 'Playa Serena';
    this.verdict = null;      // {kind, fine}
    this.shotFrames = 0;
    this.started = false;
    this._lastFocus = { x: this.player.x, y: this.player.y };
    this._crimeCd = 0;

    if (this.shotName) this._setupShot();
  }

  // ---- Spawning helpers used by missions, activities and scenes --------
  spawnCar(cls, x, y, angle, color, role = 'mission') {
    const car = createCar(cls, x, y, angle, color, role);
    this.dynamicCars.push(car);
    return car;
  }

  spawnBoat(cls, x, y, angle, color, role = 'mission') {
    const boat = createBoat(cls, x, y, angle, color, role);
    this.dynamicBoats.push(boat);
    return boat;
  }

  removeDynamic(entity) {
    this.dynamicCars = this.dynamicCars.filter((c) => c !== entity);
    this.dynamicBoats = this.dynamicBoats.filter((b) => b !== entity);
    if (this.player.inVehicle === entity) this.player.inVehicle = null;
  }

  // ---- Economy and feedback ----------------------------------------------
  addCash(amount, x, y) {
    this.progress.cash += amount;
    if (x !== undefined) {
      this.effects.cashConfetti(x, y, this.rng);
      this.effects.floatText(x, y - 46, `+$${amount}`, '#7be495', 32);
    }
  }

  addRespect(points) {
    this.progress.respectPoints += points;
    const level = respectLevelFor(this.progress.respectPoints);
    if (level > this.progress.respectLevel) {
      this.progress.respectLevel = level;
      this.toast(`RESPECT LEVEL ${level} — NEW DOORS OPEN`);
      this.audio.missionComplete();
    }
  }

  toast(text) {
    this.hud.showToast(text);
  }

  saveGame() {
    this.saveSys.save(this.progress, this.player);
  }

  // A hostile bullet source for police and rivals.
  fireBullet(x, y, angle, from) {
    this.bullets.push({
      x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 1020, vy: Math.sin(angle) * 1020,
      life: 0.5, damage: 11, from,
    });
    this.effects.muzzleFlash(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, angle);
  }

  // Witnessed crime: heat only rises when the law is near enough to
  // see it, or a heat is already on.
  reportCrime(crime) {
    const focus = this.player.focus();
    const nearLaw = this.police.allUnits().some((u) => Math.hypot(u.x - focus.x, u.y - focus.y) < 520);
    if (nearLaw || this.police.stars() > 0 || crime === 'vaultGold' || crime === 'missionAlarm') {
      escalateWantedLevel(this.police, crime, true);
      this.police.heatFlash = 1.2;
    }
    this.crowd.panicAt(focus.x, focus.y, 380);
    this.traffic.panicAt(focus.x, focus.y, 430);
  }

  onCrime(crime) {
    this.reportCrime(crime);
  }

  // ---- Run control ---------------------------------------------------------
  start() {
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupShot() {
    this.started = true;
    this.state = 'play';
    stageScreenshotScene(this, this.shotName, this.seed);
    this._refreshObjective();
    const focus = this.player.focus();
    this.districtName = districtNameAt(focus.x, focus.y, this.layout.districts);
    this.render();
    this.render();
    window.__shotReady = true;
  }

  _loop(timestamp) {
    requestAnimationFrame(this._loop);
    if (!this._lastTs) this._lastTs = timestamp;
    let dt = (timestamp - this._lastTs) / 1000;
    this._lastTs = timestamp;
    dt = clamp(dt, 0, 0.033);
    this.dt = dt;
    this.time += dt;
    this.env.night = this.weather.nightAmount();
    this.env.rain = this.weather.rain;
    this.env.time = this.time;

    // Screenshot scenes are staged compositions: render them live
    // (lights flash, water sparkles) but never simulate them away.
    if (this.state === 'play' && !this.shotName) this.update(dt);
    else this.updateMenus(dt);
    this.render();
    this.input.endFrame();
  }

  updateMenus(dt) {
    // Title screen: the world idles behind it.
    this.weather.update(dt, this.rng);
    this.crowd.update(dt, this.env);
    if (this.state === 'title') {
      const panX = 2900 + Math.sin(this.time * 0.05) * 500;
      this.camera.snapTo(panX, 1500);
      if (this.input.tapped('Enter')) {
        this.audio.unlock();
        this._beginRun(false);
      }
      if (this.input.tapped('KeyN')) {
        this.audio.unlock();
        this.saveSys.wipe();
        this._beginRun(true);
      }
    } else if (this.state === 'briefing') {
      if (this.input.tapped('Enter')) {
        this.director.begin(this);
        this.state = 'play';
      }
      if (this.input.tapped('Escape')) {
        this.director.briefing = null;
        this.state = 'play';
      }
    } else if (this.state === 'busted' || this.state === 'wasted') {
      if (this.input.tapped('Enter')) this._respawnAfterVerdict();
    } else if (this.state === 'pause') {
      if (this.input.tapped('Escape') || this.input.tapped('KeyM')) this.state = 'play';
      if (this.input.tapped('KeyJ')) this.state = 'board';
    } else if (this.state === 'board') {
      if (this.input.tapped('Escape') || this.input.tapped('KeyJ')) this.state = 'play';
    }
    this.hud.update(dt);
  }

  _beginRun(fresh) {
    if (!fresh) {
      const loaded = this.saveSys.load();
      if (loaded) {
        this.progress = loaded.progress;
        if (loaded.playerStart) {
          this.player.x = loaded.playerStart.x;
          this.player.y = loaded.playerStart.y;
        }
        this.player.armour = loaded.armour || 0;
        this.toast('SAVE LOADED — WELCOME BACK TO PUERTO SERENA');
      }
    }
    this.started = true;
    this.state = 'play';
    this.camera.snapTo(this.player.x, this.player.y);
  }

  _respawnAfterVerdict() {
    const kind = this.verdict ? this.verdict.kind : 'busted';
    this.verdict = null;
    this.player.dead = false;
    this.player.health = CONFIG.player.maxHealth;
    this.player.armour = 0;
    this.player.inVehicle = null;
    const spot = kind === 'busted'
      ? { x: 3100, y: 1030 }   // the comisaría in Centro Aurelio
      : { x: 1900, y: 2380 };  // Bahía General hospital, Mercado edge
    this.player.x = spot.x;
    this.player.y = spot.y;
    this.camera.snapTo(spot.x, spot.y);
    this.state = 'play';
  }

  _verdict(kind) {
    const rate = kind === 'busted' ? CONFIG.economy.bustFineRate : CONFIG.economy.wastedFineRate;
    const fine = Math.min(this.progress.cash, Math.round(this.progress.cash * rate) + 40);
    this.progress.cash -= fine;
    if (kind === 'busted') this.progress.stats.timesBusted += 1;
    else this.progress.stats.timesWasted += 1;
    if (this.director.active) this.director.fail(this, kind === 'busted' ? 'Busted by the Policía' : 'Wasted');
    this.police.clearHeat();
    this.police.standDown();
    this.rivals.clear();
    this.verdict = { kind, fine };
    this.state = kind;
    if (kind === 'busted') this.audio.bustedSting();
    else this.audio.missionFailed();
  }
}

// ---- Play-state update ------------------------------------------------------
// Appended to the Game class as prototype methods so the boot code
// above stays readable: this half is the living game, frame by frame.

Game.prototype.update = function update(dt) {
  const G = this;
  G._crimeCd = Math.max(0, G._crimeCd - dt);
  if (G.input.tapped('Enter') || G.input.mouseClicked) G.audio.unlock();

  // Overlays first: phone and paint shop pause the world.
  if (G.phone.open) {
    G.phone.update(dt, G);
    G.hud.update(dt);
    return;
  }
  if (G.paintShop.open) {
    G.paintShop.update(dt, G);
    G.hud.update(dt);
    return;
  }
  if (G.input.tapped('KeyP')) { G.phone.toggle(G); return; }
  if (G.input.tapped('Escape') || G.input.tapped('KeyM')) { G.state = 'pause'; G.input.flushPresses(); return; }
  if (G.input.tapped('KeyJ')) { G.state = 'board'; return; }
  if (G.input.tapped('KeyT') && G.player.inVehicle) G.toast(G.audio.cycleRadio());
  if (G.input.tapped('KeyU')) G.toast(G.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');

  G.weather.update(dt, G.rng);
  G.env.night = G.weather.nightAmount();
  G.env.rain = G.weather.rain;

  const mouseWorld = {
    x: G.camera.x + G.input.mouseX,
    y: G.camera.y + G.input.mouseY,
  };

  // Player body or vehicle.
  if (G.player.inVehicle) G._updateDriving(dt, mouseWorld);
  else G._updateOnFoot(dt, mouseWorld);

  // Vehicle-to-vehicle bumps across every car on the street.
  const allCars = [...G.traffic.allCars(), ...G.dynamicCars, ...G.police.cars, ...G.police.roadblocks];
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const impact = collideCars(allCars[i], allCars[j], G.effects, G.rng);
      if (impact > 0.45 && G._crimeCd <= 0 && (allCars[i] === G.player.inVehicle || allCars[j] === G.player.inVehicle)) {
        G.audio.crash(impact);
        if (G.police.stars() > 0) G.reportCrime('vehicleCrash');
        G._crimeCd = 1;
      }
    }
  }

  // The living city.
  const focus = G.player.focus();
  G.traffic.update(dt, {
    layout: G.layout, effects: G.effects, audio: G.audio,
    playerFocus: { ...focus, vehicle: G.player.inVehicle },
    policeActive: G.police.stars() > 0,
  });
  G.crowd.maintainDensity(focus.x, focus.y);
  G.crowd.update(dt, G.env);
  G.crowd.reactToTraffic(allCars);
  G.police.update(dt, {
    player: G.player, effects: G.effects, audio: G.audio, time: G.time,
    playerArmed: true,
    fireBullet: (x, y, angle, from) => G.fireBullet(x, y, angle, from),
  });
  G.rivals.update(dt, {
    player: G.player, layout: G.layout, rng: G.rng,
    fireBullet: (x, y, angle, from) => G.fireBullet(x, y, angle, from),
  });
  G._updateBullets(dt);
  G.director.update(dt, G);
  G.activities.update(dt, G);
  G.effects.update(dt);
  G.hud.update(dt);

  // Distance stat.
  const moved = Math.hypot(focus.x - G._lastFocus.x, focus.y - G._lastFocus.y);
  G.progress.stats.distanceKm += moved / 5200;
  G._lastFocus = focus;

  // Bust and death.
  if (G.police.bustMeter >= 1) { G._verdict('busted'); return; }
  if (G.player.dead) { G._verdict('wasted'); return; }

  // Camera and readouts.
  const vel = G.player.inVehicle
    ? { x: Math.cos(G.player.inVehicle.angle) * G.player.inVehicle.speed, y: Math.sin(G.player.inVehicle.angle) * G.player.inVehicle.speed }
    : { x: G.player.vx, y: G.player.vy };
  G.camera.follow(dt, focus.x, focus.y, vel.x, vel.y);
  G.districtName = districtNameAt(focus.x, focus.y, G.layout.districts);
  G._refreshObjective();
  G._refreshPrompt();

  // Audio bed.
  G.audio.update(dt, {
    driving: !!G.player.inVehicle,
    drivingSpeed: G.player.inVehicle ? G.player.inVehicle.speed : 0,
    sirenClose: G.audio.sirenClose,
  });
};

Game.prototype._updateOnFoot = function _updateOnFoot(dt, mouseWorld) {
  const G = this;
  G.player.update(dt, G.input, G.layout, mouseWorld);

  // Falling in the water: wash up at the nearest mooring, fined.
  if (G.player.inDeepWater(G.layout)) {
    const mooring = nearestMooring(G.player.x, G.player.y);
    const fine = Math.min(G.progress.cash, CONFIG.economy.waterFine);
    G.progress.cash -= fine;
    G.player.x = mooring.x + 26;
    G.player.y = mooring.y - 30;
    if (isWaterAt(G.layout, G.player.x, G.player.y)) {
      G.player.x = G.landmarks.marinaDock.x;
      G.player.y = G.landmarks.marinaDock.y - 60;
    }
    G.audio.splash();
    G.toast(`THE TIDE RETURNS YOU TO THE DOCK — FINE $${fine}`);
    G.camera.snapTo(G.player.x, G.player.y);
    return;
  }

  // Shove with a click at close range when not firing a mission gun.
  if (G.input.mouseClicked && !G.director.active) {
    const shoved = G.player.tryShove(G.crowd.pedestrians);
    if (shoved) {
      applyShove(shoved, G.player.x, G.player.y, G.rng);
      if (G._crimeCd <= 0) { G.reportCrime('shove'); G._crimeCd = 2; }
    }
  }

  // Firing on foot.
  G._updateFiring(dt, mouseWorld);

  // Enter a vehicle (F) or interact (E).
  if (G.input.tapped('KeyF')) G._tryEnterVehicle();
  if (G.input.tapped('KeyE')) G._interact();
};

Game.prototype._updateDriving = function _updateDriving(dt, mouseWorld) {
  const G = this;
  const vehicle = G.player.inVehicle;
  const control = {
    throttle: G.input.throttle(),
    steer: G.input.steering(),
    handbrake: G.input.handbrake(),
  };
  let crash = 0;
  if (vehicle.kind === 'car') {
    crash = updateCarPhysics(dt, vehicle, control, G.layout, G.effects, G.rng);
    // Running someone down is the loudest crime there is.
    for (const ped of G.crowd.pedestrians) {
      if (ped.state === 'down') continue;
      if (Math.abs(vehicle.speed) > 60 && Math.hypot(ped.x - vehicle.x, ped.y - vehicle.y) < vehicle.radius + 8) {
        ped.state = 'down';
        ped.stateTimer = 7;
        G.effects.impactPuff(ped.x, ped.y, G.rng);
        if (G._crimeCd <= 0) { G.reportCrime('hitAndRun'); G._crimeCd = 2; }
      }
    }
    // A car in deep water is lost; the driver washes up.
    if (isWaterAt(G.layout, vehicle.x, vehicle.y) && !G.layout.docks.some((d) => vehicle.x > d.x - 20 && vehicle.x < d.x + d.w + 20 && vehicle.y > d.y && vehicle.y < d.y + d.h)) {
      vehicle.health = 0;
      vehicle.wrecked = true;
      G.removeDynamic(vehicle);
      G.player.inVehicle = null;
      G.player.x = vehicle.x;
      G.player.y = vehicle.y;
      G.toast('THE CAR IS LOST TO THE BAY');
      return;
    }
  } else {
    crash = updateBoatPhysics(dt, vehicle, control, G.layout, G.effects, G.rng, G.time);
    if (vehicle.wrecked) {
      G.removeDynamic(vehicle);
      G.player.inVehicle = null;
      G.player.x = vehicle.x;
      G.player.y = vehicle.y;
      G.toast('THE BOAT BREAKS UP — YOU SWIM FOR THE DOCK');
      return;
    }
  }
  if (crash > 0.3) {
    G.audio.crash(crash);
    G.player.damage(crash * 7);
  }
  G.player.x = vehicle.x;
  G.player.y = vehicle.y;

  // Drive-by fire toward the mouse.
  G._updateFiring(dt, mouseWorld);

  // Paint shop: stop in the bay and press E.
  if (G.paintShop.playerAtDoor(G) && G.input.tapped('KeyE')) {
    G.paintShop.openShop(G);
    return;
  }
  // Taxi: stop beside a hailing pedestrian to board them.
  if (vehicle.kind === 'car' && Math.abs(vehicle.speed) < 20 && !G.activities.taxi) {
    for (const ped of G.crowd.pedestrians) {
      if (ped.state === 'hail' && Math.hypot(ped.x - vehicle.x, ped.y - vehicle.y) < 92) {
        G.activities.tryBoardTaxi(G, ped); // the fare is counted on delivery
        break;
      }
    }
  }
  if (G.input.tapped('KeyF')) G._exitVehicle();
};

Game.prototype._updateFiring = function _updateFiring(dt, mouseWorld) {
  const G = this;
  if (G.input.tapped('Digit1')) G.arsenal.switchTo('pistol');
  if (G.input.tapped('Digit2')) G.arsenal.switchTo('scattergun');
  if (G.input.tapped('Digit3')) G.arsenal.switchTo('smg');
  if (G.input.tapped('KeyR') && G.arsenal.startReload()) G.audio.reload();
  const shooter = G.player.inVehicle || G.player;
  const stats = G.arsenal.stats();
  const wantFire = G.input.firing() && (stats.auto || G.input.mouseClicked || G._triggerHeld);
  if (G.input.firing() && wantFire) {
    const aim = Math.atan2(mouseWorld.y - shooter.y, mouseWorld.x - shooter.x);
    const before = G.bullets.length;
    const fired = G.arsenal.tryFire(0, shooter, aim, G.bullets, G.effects, G.audio, G.rng);
    if (fired) {
      G.progress.stats.shotsFired += G.bullets.length - before;
      if (G._crimeCd <= 0) { G.reportCrime('gunfire'); G._crimeCd = 1.4; }
    }
    G._triggerHeld = true;
  } else {
    G._triggerHeld = false;
  }
  // The arsenal cooldown ticks with real time.
  G.arsenal.cooldown -= dt;
  if (G.arsenal.reloadTimer > 0) {
    G.arsenal.reloadTimer -= dt;
    if (G.arsenal.reloadTimer <= 0) {
      const s = G.arsenal.stats();
      const a = G.arsenal.ammo[G.arsenal.current];
      const take = Math.min(s.mag - a.mag, a.reserve === Infinity ? s.mag : a.reserve);
      a.mag += take;
      if (a.reserve !== Infinity) a.reserve -= take;
    }
  }
  if (G.arsenal.muzzle) {
    G.arsenal.muzzle.life -= dt;
    if (G.arsenal.muzzle.life <= 0) G.arsenal.muzzle = null;
  }
};

Game.prototype._updateBullets = function _updateBullets(dt) {
  const G = this;
  const vehicles = [...G.traffic.allCars(), ...G.dynamicCars, ...G.police.cars, ...G.police.roadblocks];
  updateBullets(dt, G.bullets, {
    layout: G.layout,
    effects: G.effects,
    rng: G.rng,
    audio: G.audio,
    player: G.player,
    rivals: G.rivals.members,
    officers: G.police.officers,
    pedestrians: G.crowd.pedestrians,
    vehicles,
    onRivalDown: (rival) => {
      G.effects.floatText(rival.x, rival.y - 30, 'CREW DOWN', '#ff9d94', 24);
      if (G.rng.chance(0.5)) G.addCash(G.rng.int(20, 70), rival.x, rival.y);
    },
    onOfficerHit: (officer) => {
      G.reportCrime('assault');
      if ((officer.health ?? 60) <= 0) {
        G.police.officers = G.police.officers.filter((o) => o !== officer);
        G.effects.floatText(officer.x, officer.y - 30, 'OFFICER DOWN', '#ff9d94', 24);
      }
    },
    onPedestrianHit: () => {
      if (G._crimeCd <= 0) { G.reportCrime('assault'); G._crimeCd = 2; }
    },
    onCrime: (crime) => G.reportCrime(crime),
  });
};

// ---- Vehicles: entering, stealing, exiting ---------------------------------

Game.prototype._tryEnterVehicle = function _tryEnterVehicle() {
  const G = this;
  const p = G.player;
  // Boats first when standing on a dock beside one.
  let bestBoat = null;
  let bestBoatD = 95;
  for (const boat of G.dynamicBoats) {
    const d = Math.hypot(boat.x - p.x, boat.y - p.y);
    if (d < bestBoatD) { bestBoatD = d; bestBoat = boat; }
  }
  let bestCar = null;
  let bestCarD = 78;
  const carPool = [...G.traffic.allCars(), ...G.dynamicCars];
  for (const car of carPool) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestCarD) { bestCarD = d; bestCar = car; }
  }
  const target = bestBoat && (!bestCar || bestBoatD < bestCarD + 30) ? bestBoat : bestCar;
  if (!target) return;

  if (target.kind === 'car') {
    const block = carEntryBlock(target, G.progress);
    if (block) { G.toast(block); return; }
    const wasTraffic = target.role === 'traffic';
    const wasParked = target.role === 'parked';
    G.traffic.release(target);
    if (!G.dynamicCars.includes(target)) G.dynamicCars.push(target);
    if (wasTraffic) {
      // Carjack: the driver is pulled out and runs.
      const driver = G.crowd._makePedestrian(false, target.x, target.y);
      driver.x = target.x + 30;
      driver.y = target.y + 18;
      driver.state = 'flee';
      driver.stateTimer = 3;
      G.crowd.pedestrians.push(driver);
      G.reportCrime('carjack');
      G.toast(`CARJACKED — ${target.spec.label.toUpperCase()}`);
    } else if (wasParked) {
      if (G.police.stars() > 0 || G.police.allUnits().length > 0) G.reportCrime('theft');
      G.toast(target.spec.label.toUpperCase());
    } else {
      G.toast(target.spec.label.toUpperCase());
    }
    target.role = 'player';
    G.progress.stats.carsDriven += 1;
  } else {
    target.role = 'player';
    G.progress.stats.boatsDriven += 1;
    G.toast(target.label.toUpperCase());
  }
  G.player.inVehicle = target;
  G.audio.uiClick();
};

Game.prototype._exitVehicle = function _exitVehicle() {
  const G = this;
  const vehicle = G.player.inVehicle;
  if (!vehicle) return;
  if (Math.abs(vehicle.speed) > 160) {
    G.toast('TOO FAST TO BAIL OUT');
    return;
  }
  vehicle.role = 'parked';
  vehicle.speed = 0;
  G.player.inVehicle = null;
  // Step out on the left side, onto land if at all possible.
  const side = vehicle.angle + Math.PI / 2;
  let nx = vehicle.x + Math.cos(side) * (vehicle.radius + 18);
  let ny = vehicle.y + Math.sin(side) * (vehicle.radius + 18);
  if (vehicle.kind === 'boat' && isWaterAt(G.layout, nx, ny)) {
    // Climb onto the nearest dock instead of swimming.
    const mooring = nearestMooring(vehicle.x, vehicle.y);
    nx = mooring.x + 30;
    ny = mooring.y - 34;
    if (isWaterAt(G.layout, nx, ny)) {
      nx = G.landmarks.marinaDock.x;
      ny = G.landmarks.marinaDock.y - 70;
    }
  }
  G.player.x = nx;
  G.player.y = ny;
};

// ---- Interactions (key E) -----------------------------------------------------

Game.prototype._interact = function _interact() {
  const G = this;
  const p = G.player;
  if (p.inVehicle) return;
  // Mission giver.
  const next = G.director.nextMission(G.progress);
  if (next && !G.director.active) {
    const g = next.def.giverAt;
    if (Math.hypot(p.x - g.x, p.y - g.y) < 95) {
      G.director.openBriefing(G.progress);
      G.state = 'briefing';
      G.audio.uiClick();
      return;
    }
  }
  // Safehouse: save, heal, re-armour.
  if (G.saveSys.atSafehouse(p)) {
    G.saveGame();
    p.heal(40);
    p.armour = CONFIG.player.maxArmour;
    G.arsenal.addAmmo('smg', 40);
    G.arsenal.addAmmo('scattergun', 8);
    G.audio.pickup();
    G.toast('SAVED AT THE SAFEHOUSE — ARMOUR & AMMO RESTOCKED');
    return;
  }
  // Race pads: start the nearest course (in a car for the real thing).
  for (let i = 0; i < G.activities.courses.length; i++) {
    const course = G.activities.courses[i];
    if (Math.hypot(p.x - course.start.x, p.y - course.start.y) < 70) {
      G.toast('RACES RUN IN A CAR — BRING WHEELS TO THE PAD');
      return;
    }
  }
  // Export garage: take the next list job.
  const garage = G.landmarks.exportGarage;
  if (Math.hypot(p.x - garage.x, p.y - garage.y) < 100 && !G.activities.exportRun) {
    const index = G.progress.exportsDone.findIndex((done) => !done);
    if (index >= 0) {
      G.activities.startExportRun(G, index);
      return;
    }
    G.toast('THE EXPORT LIST IS COMPLETE — RUEDA SALUTES YOU');
    return;
  }
  // Talk to a nearby pedestrian: flavour and the odd tip.
  for (const ped of G.crowd.pedestrians) {
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < 46) {
      const lines = [
        '“Golden hour over the bay — best light in Serena.”',
        '“Heard the Cárdenas lost another van last night.”',
        '“Sun shells wash up everywhere. Fifteen, they say.”',
        '“Brillo Paint can lose any heat, for a price.”',
        '“The ferry to Isla Faros? Just take a boat, friend.”',
      ];
      G.toast(G.rng.pick(lines));
      return;
    }
  }
};

// ---- Objective and prompt readouts -------------------------------------------

Game.prototype._refreshObjective = function _refreshObjective() {
  const G = this;
  if (G.objectiveOverride) {
    G.objective = G.objectiveOverride;
    return;
  }
  const obj = G.director.objectiveFor(G);
  // An active side activity outranks the giver hint (not a mission).
  if (!G.director.active) {
    const raceMarker = G.activities.raceMarker();
    const taxiMarker = G.activities.taxiMarker();
    const exportMarker = G.activities.exportMarker();
    if (G.activities.race) obj.title = `RACE — ${G.activities.race.course.name.toUpperCase()}`;
    if (raceMarker) obj.marker = raceMarker;
    else if (taxiMarker) { obj.marker = taxiMarker; obj.title = 'TAXI — DRIVE YOUR FARE'; }
    else if (exportMarker) { obj.marker = exportMarker; obj.title = 'THE EXPORT LIST'; }
  }
  G.objective = obj;
};

Game.prototype._refreshPrompt = function _refreshPrompt() {
  const G = this;
  const p = G.player;
  G.prompt = null;
  if (p.inVehicle) {
    if (G.paintShop.playerAtDoor(G)) G.prompt = 'E — BRILLO PAINT & BODY';
    else if (G.activities.taxi) G.prompt = 'DELIVER YOUR FARE — FOLLOW THE GOLD MARKER';
    return;
  }
  const next = G.director.nextMission(G.progress);
  if (next && !G.director.active && Math.hypot(p.x - next.def.giverAt.x, p.y - next.def.giverAt.y) < 95) {
    G.prompt = `E — TALK TO ${next.def.giver.toUpperCase()} · ${next.def.name.toUpperCase()}`;
    return;
  }
  if (G.saveSys.atSafehouse(p)) {
    G.prompt = 'E — SAVE GAME · RESTORE ARMOUR';
    return;
  }
  const garage = G.landmarks.exportGarage;
  if (Math.hypot(p.x - garage.x, p.y - garage.y) < 100) {
    G.prompt = 'E — EXPORT LIST JOBS';
    return;
  }
  let nearCar = null;
  let nearD = 80;
  for (const car of [...G.traffic.allCars(), ...G.dynamicCars]) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < nearD) { nearD = d; nearCar = car; }
  }
  if (nearCar) {
    G.prompt = `F — ${nearCar.role === 'parked' ? 'STEAL' : 'ENTER'} ${nearCar.spec.label.toUpperCase()}`;
    return;
  }
  for (const boat of G.dynamicBoats) {
    if (Math.hypot(boat.x - p.x, boat.y - p.y) < 96) {
      G.prompt = `F — BOARD ${boat.label.toUpperCase()}`;
      return;
    }
  }
};

// ---- Rendering -----------------------------------------------------------------

Game.prototype.render = function render() {
  const G = this;
  const ctx = G.ctx;
  const view = G.camera.viewRect();
  const shake = G.effects.shakeOffset(G.rng);
  const env = { night: G.env.night, rain: G.env.rain, time: G.time };

  ctx.save();
  ctx.translate(-view.x + shake.x, -view.y + shake.y);

  drawCityGround(ctx, G.layout, view, env);
  G.effects.drawSkids(ctx);
  G.activities.drawShells(ctx, view, G.progress, G.time);
  G.activities.drawRacePads(ctx, view, G.time);
  G.paintShop.drawMarker(ctx, view, G.time);
  G.saveSys.drawMarker(ctx, view, G.time);

  // Giver beacon when no mission is active.
  if (!G.director.active && G.state !== 'title') {
    const giver = G.director.giverPosition(G.progress);
    if (giver) drawObjectiveMarker(ctx, giver.x, giver.y, G.time, '#ff4fd8', 'MISSION');
  }
  // Objective marker + edge chevron.
  if (G.objective && G.objective.marker && G.state === 'play') {
    const m = G.objective.marker;
    drawObjectiveMarker(ctx, m.x, m.y, G.time, '#ffc94d', m.label);
    const focus = G.player.focus();
    if (Math.hypot(m.x - focus.x, m.y - focus.y) > 620) {
      ctx.save();
      ctx.translate(view.x, view.y);
      drawEdgeChevron(ctx, { w: CONFIG.view.width, h: CONFIG.view.height, x: view.x, y: view.y }, m.x, m.y, '#ffc94d', m.label);
      ctx.restore();
    }
  }

  // Boats under cars under people.
  for (const boat of G.dynamicBoats) drawBoat(ctx, boat, env);
  for (const boat of G.police.boats) drawBoat(ctx, boat, env);
  G.traffic.draw(ctx, view, env, drawVehicle);
  for (const car of G.dynamicCars) {
    if (car === G.player.inVehicle) continue;
    drawVehicle(ctx, car, env);
  }
  for (const car of G.police.cars) drawVehicle(ctx, car, env);
  for (const car of G.police.roadblocks) drawVehicle(ctx, car, env);
  G.rivals.draw(ctx, view, env);
  G.crowd.draw(ctx, view, env);
  for (const officer of G.police.officers) G.police.drawOfficer(ctx, officer, env);

  // The player (or the vehicle being driven, drawn on top).
  if (G.player.inVehicle) {
    const v = G.player.inVehicle;
    if (v.kind === 'boat') drawBoat(ctx, v, env);
    else drawVehicle(ctx, v, env);
  } else {
    G.player.draw(ctx, env);
  }

  drawBullets(ctx, G.bullets);
  G.effects.drawParticles(ctx);
  const focus = G.player.focus();
  G.police.drawHelicopter(ctx, focus, env);
  G.effects.drawTexts(ctx);
  ctx.restore();

  // Sky light, rain and flash, in view space.
  G.weather.drawSkyLight(ctx, { w: CONFIG.view.width, h: CONFIG.view.height });
  if (G.env.rain > 0.05 && G.state === 'play') {
    G.weather.drawRain(ctx, { w: CONFIG.view.width, h: CONFIG.view.height }, G.rng);
  }
  if (G.effects.flash > 0) {
    ctx.fillStyle = `rgba(255,240,210,${G.effects.flash * 0.5})`;
    ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
  }

  // Screens and HUD by state.
  if (G.state === 'title') {
    drawTitleScreen(ctx, G, G.saveSys.hasSave());
  } else if (G.state === 'briefing') {
    G.hud.drawGameHud(ctx, G);
    if (G.director.briefing) drawBriefingCard(ctx, G.director.briefing);
  } else if (G.state === 'pause') {
    drawPauseScreen(ctx, G);
  } else if (G.state === 'progress') {
    drawProgressScreen(ctx, G);
  } else if (G.state === 'board') {
    G.hud.drawGameHud(ctx, G);
    drawMissionsBoard(ctx, G);
  } else if (G.state === 'busted' || G.state === 'wasted') {
    drawVerdictScreen(ctx, G.state, G.verdict ? G.verdict.fine : 0);
  } else {
    G.hud.drawGameHud(ctx, G);
    if (!G.player.inVehicle && !G.paintShop.open && !G.phone.open) {
      drawCrosshair(ctx, G.input.mouseX, G.input.mouseY, G.arsenal.reloadTimer > 0);
    }
    if (G.paintShop.open) G.paintShop.drawMenu(ctx, { w: CONFIG.view.width, h: CONFIG.view.height }, G);
    if (G.phone.open) G.phone.draw(ctx, { w: CONFIG.view.width, h: CONFIG.view.height }, G);
  }
};

// Boot: the page holds one canvas; the game starts its own loop.
export function bootGame() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__game = game;
  game.start();
  return game;
}
