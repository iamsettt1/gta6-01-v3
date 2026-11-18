// input-controls.js — Puerto Serena: Neon Tide
// One job: own the keyboard and mouse. It tracks held keys, one-shot
// key presses (consumed by the systems that read them), the mouse
// position in view coordinates and the firing button, and it knows the
// named actions the rest of the game asks about.

export class InputControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();      // key codes currently down
    this.pressed = new Set();   // key codes pressed since last consume
    this.mouseX = 640;
    this.mouseY = 400;
    this.mouseDown = false;
    this.mouseClicked = false;  // one-shot left click
    this.enabled = true;
    this._attach();
  }

  _attach() {
    window.addEventListener('keydown', (ev) => {
      if (!this.enabled) return;
      if (!ev.repeat) this.pressed.add(ev.code);
      this.held.add(ev.code);
      // Keep the page from scrolling on game keys.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
        ev.preventDefault();
      }
    });
    window.addEventListener('keyup', (ev) => {
      this.held.delete(ev.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouseDown = false;
    });
    this.canvas.addEventListener('mousemove', (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / rect.width;
      const sy = this.canvas.height / rect.height;
      this.mouseX = (ev.clientX - rect.left) * sx;
      this.mouseY = (ev.clientY - rect.top) * sy;
    });
    this.canvas.addEventListener('mousedown', (ev) => {
      if (ev.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) this.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  // Is a code held right now?
  down(code) {
    return this.held.has(code);
  }

  // Was a code pressed since the last frame? Consumes the press.
  tapped(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Any of a list of codes tapped?
  tappedAny(codes) {
    for (const code of codes) if (this.tapped(code)) return true;
    return false;
  }

  // Movement axes from WASD and the arrow keys: x/y in [-1, 1].
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // Driving throttle: +1 forward, -1 reverse/brake.
  throttle() {
    let t = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) t += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) t -= 1;
    return t;
  }

  // Driving steering: -1 left, +1 right.
  steering() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }

  sprinting() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  handbrake() {
    return this.down('Space');
  }

  firing() {
    return this.mouseDown;
  }

  // End-of-frame bookkeeping: one-shot clicks live exactly one frame.
  endFrame() {
    this.mouseClicked = false;
  }

  // Forget all one-shot presses (used when a menu opens mid-frame).
  flushPresses() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}

// The control list shown on the title screen and the pause panel.
export function controlHelpLines() {
  return [
    'WASD / Arrows — move & drive',
    'Shift — sprint · Space — handbrake',
    'F — enter / exit car or boat',
    'Mouse — aim · Click — fire · R — reload',
    '1 / 2 / 3 — pistol · scattergun · SMG',
    'E — talk, pick up, use shop & safehouse',
    'P — phone · J — missions board',
    'M / Esc — pause & full-city map',
    'Enter — start · confirm',
  ];
}
