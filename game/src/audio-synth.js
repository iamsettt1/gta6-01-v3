// audio-synth.js — Puerto Serena: Neon Tide
// One job: all sound, synthesized live with WebAudio — no audio files.
// Engine hum pitched by speed, two-tone sirens, gunshots per weapon,
// pickup chimes, UI clicks, a cash register payout and a three-station
// radio loop that plays while driving. Everything is guarded so a
// browser without audio (or before the first key press) stays silent
// and error-free.

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.radioTimer = 0;
    this.radioStation = 0; // 0 off, 1 Sol FM, 2 Marea Wave, 3 Neón Nights
    this.radioStep = 0;
    this.muted = false;
  }

  // Create the context on the first user gesture; safe to call often.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      this._startSiren();
    } catch (err) {
      this.ctx = null;
    }
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Per-frame: engine pitch follows speed, the siren wails when police
  // are close, and the radio sequencer advances while driving.
  update(dt, state) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      const speed = state.drivingSpeed || 0;
      const target = state.driving ? 0.05 + Math.min(0.06, Math.abs(speed) / 6000) : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.55, t, 0.06);
    }
    if (this.sirenGain) {
      const wail = state.sirenClose ? 0.028 : 0;
      this.sirenGain.gain.setTargetAtTime(wail, t, 0.2);
      if (state.sirenClose) {
        this.sirenTimer += dt;
        const phase = Math.sin(this.sirenTimer * 4.4) > 0;
        this.sirenOsc.frequency.setTargetAtTime(phase ? 880 : 660, t, 0.05);
      }
    }
    if (state.driving && this.radioStation > 0) {
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) {
        this.radioTimer = 0.21;
        this._radioNote();
      }
    }
  }

  _radioNote() {
    // Three tiny generative loops, one per station.
    const scales = [
      null,
      [262, 294, 330, 392, 440, 392, 330, 294],          // Sol FM — sunny major
      [220, 262, 311, 262, 196, 220, 262, 349],          // Marea Wave — minor drift
      [330, 392, 494, 587, 494, 392, 330, 262],          // Neón Nights — bright arp
    ];
    const scale = scales[this.radioStation];
    if (!scale) return;
    const note = scale[this.radioStep % scale.length];
    this.radioStep++;
    this._tone(note, 0.19, 'triangle', 0.05);
    if (this.radioStep % 4 === 0) this._tone(note / 2, 0.3, 'sine', 0.06);
  }

  // Cycle radio stations while driving (key T).
  cycleRadio() {
    this.radioStation = (this.radioStation + 1) % 4;
    this.radioStep = 0;
    return ['Radio off', 'Sol FM', 'Marea Wave', 'Neón Nights'][this.radioStation];
  }

  _tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (err) { /* audio is decoration; never break the game */ }
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch (err) { /* ignore */ }
  }

  // A gunshot shaped per weapon: pistol crack, scattergun boom, SMG rip.
  gunshot(weapon) {
    if (weapon === 'scattergun') {
      this._noise(0.28, 0.5, 900);
      this._tone(120, 0.2, 'square', 0.16, 45);
    } else if (weapon === 'smg') {
      this._noise(0.09, 0.3, 2600);
      this._tone(340, 0.06, 'square', 0.08, 160);
    } else {
      this._noise(0.14, 0.36, 1800);
      this._tone(220, 0.09, 'square', 0.1, 90);
    }
  }

  dryFire() {
    this._tone(1200, 0.04, 'square', 0.05);
  }

  reload() {
    this._tone(500, 0.05, 'square', 0.07);
    setTimeout(() => this._tone(760, 0.05, 'square', 0.07), 90);
  }

  hitMarker() {
    this._tone(1500, 0.05, 'square', 0.06);
  }

  pickup() {
    this._tone(880, 0.09, 'sine', 0.12);
    setTimeout(() => this._tone(1320, 0.12, 'sine', 0.12), 70);
  }

  cashRegister() {
    this._tone(1046, 0.08, 'triangle', 0.14);
    setTimeout(() => this._tone(1318, 0.08, 'triangle', 0.14), 80);
    setTimeout(() => this._tone(1568, 0.16, 'triangle', 0.14), 160);
  }

  missionComplete() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.22, 'triangle', 0.13), i * 110));
  }

  missionFailed() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.24, 'triangle', 0.12), i * 130));
  }

  uiClick() {
    this._tone(660, 0.05, 'sine', 0.08);
  }

  carHorn() {
    this._tone(370, 0.18, 'square', 0.07);
    this._tone(466, 0.18, 'square', 0.05);
  }

  crash(strength = 1) {
    this._noise(0.22, 0.3 * strength, 700);
    this._tone(90, 0.2, 'sine', 0.2 * strength, 40);
  }

  splash() {
    this._noise(0.4, 0.3, 500);
  }

  bustedSting() {
    this._tone(196, 0.5, 'sawtooth', 0.14, 98);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
