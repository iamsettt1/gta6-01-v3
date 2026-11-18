// daycycle-weather.js — Puerto Serena: Neon Tide
// One job: own the sky. A full day cycle (dawn → noon → golden hour →
// neon night) drives the light level and sky tint, and the weather
// system brings rain — randomly in free roam, scripted in Barrio Neón —
// with wet streets, rain streaks and a dusk-to-night palette blend.

export class DayCycleWeather {
  constructor() {
    // Hour of day, 0–24. Golden hour is where the cover shot lives.
    this.hour = 17.4;
    this.dayLengthSeconds = 480; // one full day every eight minutes
    this.rain = 0;               // 0 clear … 1 downpour (current)
    this.rainTarget = 0;
    this.rainTimer = 26;         // seconds until the weather rethinks
    this.scriptedRain = null;    // forced rain level, or null
    this.wind = 0.35;
    this.time = 0;               // total seconds, for animation
  }

  // Set the hour directly (missions and screenshot scenes do this).
  setHour(hour) {
    this.hour = ((hour % 24) + 24) % 24;
  }

  // Force rain on or off regardless of the random weather mind.
  scriptRain(level) {
    this.scriptedRain = level;
    if (level !== null) this.rainTarget = level;
  }

  update(dt, rng) {
    this.time += dt;
    this.hour = (this.hour + (dt * 24) / this.dayLengthSeconds) % 24;

    if (this.scriptedRain === null) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.rainTimer = rng.range(24, 60);
        // Rain loves the night districts' mood but can visit any hour.
        this.rainTarget = rng.chance(0.34) ? rng.range(0.45, 1) : 0;
      }
    } else {
      this.rainTarget = this.scriptedRain;
    }
    const step = dt * 0.25;
    if (this.rain < this.rainTarget) this.rain = Math.min(this.rainTarget, this.rain + step);
    else if (this.rain > this.rainTarget) this.rain = Math.max(this.rainTarget, this.rain - step);
  }

  // Darkness of the world: 0 at noon, 1 in deep night.
  nightAmount() {
    const h = this.hour;
    if (h >= 6 && h < 8) return 1 - (h - 6) / 2;         // dawn fades in
    if (h >= 8 && h < 17) return 0;                       // full day
    if (h >= 17 && h < 19.5) return (h - 17) / 2.5;       // golden → dusk
    if (h >= 19.5 || h < 5) return 1;                     // night
    return 1 - (h - 5);                                   // pre-dawn
  }

  // Is it the golden hour the cover shot is staged in?
  isGoldenHour() {
    return this.hour >= 16.6 && this.hour < 18.6;
  }

  // Warm tint strength for sunsets and dawns.
  goldenAmount() {
    const h = this.hour;
    if (h >= 16.6 && h < 18.6) return 1 - Math.abs(h - 17.6) / 1.2;
    if (h >= 6 && h < 8) return 0.6;
    return 0;
  }

  // A short label for the HUD clock.
  phaseName() {
    const h = this.hour;
    if (h < 5.5) return 'Night';
    if (h < 8) return 'Dawn';
    if (h < 12) return 'Morning';
    if (h < 16.6) return 'Afternoon';
    if (h < 18.6) return 'Golden Hour';
    if (h < 20) return 'Dusk';
    return 'Neon Night';
  }

  // HH:MM clock text.
  clockText() {
    const hh = Math.floor(this.hour);
    const mm = Math.floor((this.hour - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // Paint the sky-light over the world: golden wash, night blue, and
  // the rain's grey — drawn as translucent full-view overlays.
  drawSkyLight(ctx, view) {
    const night = this.nightAmount();
    const golden = this.goldenAmount();
    if (golden > 0.02) {
      ctx.fillStyle = `rgba(255, 166, 66, ${0.16 * golden})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (night > 0.02) {
      ctx.fillStyle = `rgba(8, 16, 44, ${0.34 * night})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (this.rain > 0.02) {
      ctx.fillStyle = `rgba(70, 84, 102, ${0.18 * this.rain})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  // Rain streaks in view space, plus splash rings near the ground.
  drawRain(ctx, view, rng) {
    if (this.rain < 0.05) return;
    const count = Math.floor(130 * this.rain);
    ctx.strokeStyle = `rgba(190, 220, 245, ${0.35 + 0.3 * this.rain})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const rx = rng.range(0, view.w);
      const ry = (rng.range(0, view.h) + this.time * 620 * (1 + i * 0.001)) % view.h;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5 - this.wind * 6, ry + 17);
    }
    ctx.stroke();
  }

  // A one-line weather summary for menus and the phone.
  summary() {
    const sky = this.rain > 0.6 ? 'Downpour' : this.rain > 0.15 ? 'Rain' : 'Clear skies';
    return `${this.phaseName()} · ${sky} · ${this.clockText()}`;
  }
}
