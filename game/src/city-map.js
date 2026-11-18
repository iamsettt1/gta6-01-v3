// city-map.js — Puerto Serena: Neon Tide
// One job: build and draw the physical city — the road grid, bridges,
// docks, buildings, props and signage of the eight districts — and
// answer the world's spatial questions: what is water, what is land,
// and what does a moving circle collide with.

import { CONFIG, clamp, lerp, pointInRect } from './config.js';
import { listDistricts } from './districts.js';
import { SeededRandom, deriveSeed } from './random.js';

// Vertical avenue centre-lines (west → east) and horizontal streets.
export function avenueLines() {
  return [700, 1300, 1900, 2500, 3100, 3700, 4300, 4900, 5500];
}

export function streetLines() {
  return [500, 1100, 1700, 2300, 2900, 3260];
}

export const ROAD_HALF = 52;      // half the width of a road, in px
export const COAST_Y = 3480;      // mainland shore line
export const ISLAND = { x: 4350, y: 3600, w: 1400, h: 520 };

export function bridgeRects() {
  return [
    { x: 4553, y: 3300, w: 144, h: 420 },
    { x: 5203, y: 3300, w: 144, h: 420 },
  ];
}

export function dockRects() {
  const docks = [];
  for (const cx of [3620, 3920, 4220, 4520]) {
    docks.push({ x: cx - 20, y: 3400, w: 40, h: 330 });
  }
  // Island jetty on the cove side.
  docks.push({ x: 4620, y: 3560, w: 36, h: 120 });
  return docks;
}

// Build the whole static layout from a seed. Pure data; drawing and
// collision read it, nothing mutates it after the build.
export function buildCityLayout(seed) {
  const rng = new SeededRandom(deriveSeed(seed, 'city-layout'));
  const districts = listDistricts();
  const buildings = [];
  const props = [];
  const crates = [];

  const avenues = avenueLines();
  const streets = streetLines();

  // Buildings fill the blocks between roads, district by district.
  for (const district of districts) {
    const r = district.rect;
    for (let bx = r.x; bx < r.x + r.w - 110; bx += 176) {
      for (let by = r.y; by < r.y + r.h - 110; by += 176) {
        // Skip lots that sit on a road.
        if (avenues.some((ax) => Math.abs(bx + 80 - ax) < ROAD_HALF + 66)) continue;
        if (streets.some((sy) => Math.abs(by + 80 - sy) < ROAD_HALF + 66)) continue;
        // The marina yard and the beach stay open ground.
        if (district.id === 'marina' && by > 2950) continue;
        if (district.id === 'playa' && by > 2980) continue;
        if (district.id === 'isla' && Math.hypot(bx - 4470, by - 3740) < 190) continue; // lighthouse point
        if (rng.chance(0.1)) continue; // plazas and gaps
        const tower = rng.chance(district.towerChance);
        const w = rng.range(104, 158);
        const h = rng.range(104, 158);
        buildings.push({
          x: bx + rng.range(0, 14),
          y: by + rng.range(0, 14),
          w,
          h,
          floors: tower ? rng.int(9, 22) : rng.int(2, 6),
          roof: rng.pick(district.roofPalette),
          wall: rng.pick(district.wallPalette),
          district: district.id,
          sign: rng.chance(0.3) ? rng.pick(district.signs) : null,
          signColor: rng.pick(['#ff4fd8', '#37e6ff', '#ffc94d', '#7be495']),
        });
      }
    }
  }

  // Props: palms on the beach and avenues, lamps at junctions, market
  // stalls, harbour containers, hill trees, crates everywhere.
  const propRng = new SeededRandom(deriveSeed(seed, 'city-props'));
  for (let x = 640; x < 2700; x += 130) {
    props.push({ kind: 'palm', x: x + propRng.range(-14, 14), y: 3120 + propRng.range(-8, 8), s: propRng.range(0.85, 1.25) });
    props.push({ kind: 'umbrella', x: x + propRng.range(-40, 40), y: 3340 + propRng.range(-16, 16), s: 1, color: propRng.pick(['#ff6b5e', '#37b6ff', '#ffc94d', '#ff4fd8']) });
  }
  for (const ax of avenues) {
    for (const sy of streets) {
      props.push({ kind: 'lamp', x: ax - ROAD_HALF - 10, y: sy - ROAD_HALF - 10, s: 1 });
      props.push({ kind: 'lamp', x: ax + ROAD_HALF + 10, y: sy + ROAD_HALF + 10, s: 1 });
      if (propRng.chance(0.5)) props.push({ kind: 'palm', x: ax + ROAD_HALF + 26, y: sy - ROAD_HALF - 30, s: propRng.range(0.8, 1.15) });
    }
  }
  for (let i = 0; i < 90; i++) {
    props.push({ kind: 'stall', x: propRng.range(820, 2080), y: propRng.range(920, 2080), s: 1, color: propRng.pick(['#ff8a3d', '#37b6ff', '#7be495', '#ff4fd8', '#ffc94d']) });
  }
  for (let i = 0; i < 70; i++) {
    const inMarina = i < 40;
    props.push({
      kind: 'container',
      x: inMarina ? propRng.range(3450, 4750) : propRng.range(4900, 5750),
      y: inMarina ? propRng.range(2980, 3380) : propRng.range(1850, 3150),
      s: 1,
      angle: propRng.pick([0, Math.PI / 2]),
      color: propRng.pick(['#c65a3a', '#3a7bc6', '#3fae6a', '#c6a23a', '#7a5fc0']),
    });
  }
  for (let i = 0; i < 60; i++) {
    props.push({ kind: 'tree', x: propRng.range(700, 2100), y: propRng.range(240, 820), s: propRng.range(0.8, 1.4) });
  }
  for (let i = 0; i < 46; i++) {
    crates.push({
      x: propRng.range(500, 5700),
      y: propRng.range(300, 3350),
      w: 34,
      h: 34,
      health: 30,
    });
  }
  // Cranes over the marina yard.
  props.push({ kind: 'crane', x: 3900, y: 3050, s: 1 });
  props.push({ kind: 'crane', x: 4450, y: 3120, s: 1 });
  props.push({ kind: 'crane', x: 5250, y: 2100, s: 1 });

  return {
    districts,
    avenues,
    streets,
    buildings,
    props,
    crates,
    bridges: bridgeRects(),
    docks: dockRects(),
    island: { ...ISLAND },
    coastY: COAST_Y,
  };
}

// Is this point open water (boats yes, wheels and feet no)?
export function isWaterAt(layout, x, y) {
  if (pointInRect(x, y, layout.island)) return false;
  for (const b of layout.bridges) if (pointInRect(x, y, b)) return false;
  for (const d of layout.docks) if (pointInRect(x, y, d)) return false;
  return y > layout.coastY;
}

// Is this point solid ground a person or car can stand on?
export function isLandAt(layout, x, y) {
  return !isWaterAt(layout, x, y);
}

// Is this point on a road surface (either direction)?
export function isRoadAt(layout, x, y) {
  if (isWaterAt(layout, x, y) && !layout.bridges.some((b) => pointInRect(x, y, b))) return false;
  for (const b of layout.bridges) if (pointInRect(x, y, b)) return true;
  if (pointInRect(x, y, layout.island)) {
    if (Math.abs(y - 3860) < ROAD_HALF) return true;
    if (Math.abs(x - 5050) < ROAD_HALF) return true;
    return false;
  }
  for (const ax of layout.avenues) if (Math.abs(x - ax) < ROAD_HALF) return true;
  for (const sy of layout.streets) if (Math.abs(y - sy) < ROAD_HALF) return true;
  return false;
}

// Push a circle out of every building and live crate it overlaps.
// Returns the corrected position and whether anything was hit.
export function collideCircleWithCity(layout, x, y, r) {
  let hit = false;
  const solids = layout.buildings;
  for (let i = 0; i < solids.length; i++) {
    const b = solids[i];
    if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) continue;
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest axis.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  for (const c of layout.crates) {
    if (c.health <= 0) continue;
    if (x < c.x - r || x > c.x + c.w + r || y < c.y - r || y > c.y + c.h + r) continue;
    const nx = clamp(x, c.x, c.x + c.w);
    const ny = clamp(y, c.y, c.y + c.h);
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
      hit = true;
    }
  }
  // World bounds.
  x = clamp(x, 30, CONFIG.world.width - 30);
  y = clamp(y, 30, CONFIG.world.height - 30);
  return { x, y, hit };
}

// The nearest point on the road network — traffic and spawns use it.
export function nearestRoadPoint(layout, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of layout.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, vertical: true }; }
  }
  for (const sy of layout.streets) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}

// ---- Drawing -------------------------------------------------------------
// env carries { night: 0..1, rain: 0..1, time: seconds, sparkleSeed }.

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function drawCityGround(ctx, layout, view, env) {
  const x0 = view.x;
  const y0 = view.y;
  const x1 = view.x + view.w;
  const y1 = view.y + view.h;
  const night = env.night;
  const groundDim = lerp(1, 0.55, night);

  // Sea first: the whole canvas, then land is painted over it.
  ctx.fillStyle = shade(night > 0.5 ? CONFIG.palette.seaNight : CONFIG.palette.seaDay, lerp(1, 0.8, night));
  ctx.fillRect(x0, y0, view.w, view.h);
  // Animated sparkle on the water.
  ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(env.time * 2)})`;
  const sparkle = new SeededRandom(1234);
  for (let i = 0; i < 130; i++) {
    const sx = sparkle.range(0, CONFIG.world.width);
    const sy = layout.coastY + sparkle.range(10, CONFIG.world.height - layout.coastY - 10);
    if (sx < x0 - 8 || sx > x1 + 8 || sy < y0 - 8 || sy > y1 + 8) continue;
    if (pointInRect(sx, sy, layout.island)) continue;
    const tw = 3 + 2.4 * Math.sin(env.time * 3 + i * 1.7);
    ctx.fillRect(sx, sy, Math.max(2, tw), 2);
  }

  // District ground blocks.
  for (const d of layout.districts) {
    const r = d.rect;
    if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue;
    ctx.fillStyle = shade(d.ground, groundDim);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // Island ground.
  ctx.fillStyle = shade('#a8c07a', groundDim);
  ctx.fillRect(layout.island.x, layout.island.y, layout.island.w, layout.island.h);
  // Beach sand along the mainland shore and the island rim.
  ctx.fillStyle = shade(CONFIG.palette.sand, groundDim);
  ctx.fillRect(420, layout.coastY - 130, 3200, 130);
  ctx.fillRect(layout.island.x, layout.island.y, layout.island.w, 26);
  ctx.fillRect(layout.island.x, layout.island.y + layout.island.h - 26, layout.island.w, 26);

  // Roads: asphalt slabs with sidewalk borders, then lane paint.
  const asphalt = env.rain > 0.3 ? CONFIG.palette.asphaltWet : CONFIG.palette.asphalt;
  ctx.fillStyle = shade(CONFIG.palette.sidewalk, groundDim);
  for (const ax of layout.avenues) {
    if (ax + ROAD_HALF + 8 < x0 || ax - ROAD_HALF - 8 > x1) continue;
    ctx.fillRect(ax - ROAD_HALF - 8, 180, ROAD_HALF * 2 + 16, layout.coastY - 180);
  }
  for (const sy of layout.streets) {
    if (sy + ROAD_HALF + 8 < y0 || sy - ROAD_HALF - 8 > y1) continue;
    ctx.fillRect(420, sy - ROAD_HALF - 8, 5380, ROAD_HALF * 2 + 16);
  }
  ctx.fillStyle = shade(asphalt, lerp(1, 0.8, night));
  for (const ax of layout.avenues) {
    if (ax + ROAD_HALF < x0 || ax - ROAD_HALF > x1) continue;
    ctx.fillRect(ax - ROAD_HALF, 180, ROAD_HALF * 2, layout.coastY - 180);
  }
  for (const sy of layout.streets) {
    if (sy + ROAD_HALF < y0 || sy - ROAD_HALF > y1) continue;
    ctx.fillRect(420, sy - ROAD_HALF, 5380, ROAD_HALF * 2);
  }
  // Island roads.
  ctx.fillRect(layout.island.x, 3860 - ROAD_HALF, layout.island.w, ROAD_HALF * 2);
  ctx.fillRect(5050 - ROAD_HALF, layout.island.y, ROAD_HALF * 2, layout.island.h);
  // Lane dashes.
  ctx.fillStyle = `rgba(245,238,218,${lerp(0.85, 0.5, night)})`;
  for (const ax of layout.avenues) {
    if (ax < x0 - 10 || ax > x1 + 10) continue;
    for (let y = Math.max(200, y0 - 40); y < Math.min(layout.coastY, y1 + 40); y += 64) {
      ctx.fillRect(ax - 3, y, 6, 34);
    }
  }
  for (const sy of layout.streets) {
    if (sy < y0 - 10 || sy > y1 + 10) continue;
    for (let x = Math.max(440, x0 - 40); x < Math.min(5800, x1 + 40); x += 64) {
      ctx.fillRect(x, sy - 3, 34, 6);
    }
  }
  // Crosswalks at junctions.
  ctx.fillStyle = `rgba(245,238,218,${lerp(0.5, 0.3, night)})`;
  for (const ax of layout.avenues) {
    for (const sy of layout.streets) {
      if (ax < x0 - 120 || ax > x1 + 120 || sy < y0 - 120 || sy > y1 + 120) continue;
      for (let s = -40; s <= 40; s += 16) ctx.fillRect(ax + s - 5, sy - ROAD_HALF + 4, 10, 12);
    }
  }
  // Bridges and docks over the water.
  for (const b of layout.bridges) {
    ctx.fillStyle = shade('#6b6f76', groundDim);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(asphalt, lerp(1, 0.8, night));
    ctx.fillRect(b.x + 10, b.y, b.w - 20, b.h);
    ctx.fillStyle = 'rgba(245,238,218,0.7)';
    for (let y = b.y + 16; y < b.y + b.h - 20; y += 56) ctx.fillRect(b.x + b.w / 2 - 3, y, 6, 30);
  }
  for (const d of layout.docks) {
    ctx.fillStyle = shade('#8a6a48', groundDim);
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = d.y + 12; y < d.y + d.h; y += 24) ctx.fillRect(d.x, y, d.w, 3);
  }

  // Buildings: shadow, walls, roof, then night dressing.
  for (const b of layout.buildings) {
    if (b.x > x1 + 40 || b.x + b.w < x0 - 40 || b.y > y1 + 40 || b.y + b.h < y0 - 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = shade(b.wall, groundDim);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(b.roof, groundDim);
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(b.x + 14, b.y + 14, b.w - 28, 10);
    if (night > 0.35) {
      // Lit windows: a seeded scatter so they never flicker per frame.
      const wr = new SeededRandom((b.x * 31 + b.y * 17) | 0);
      ctx.fillStyle = `rgba(255,214,120,${0.35 + night * 0.55})`;
      const cols = Math.floor(b.w / 22);
      const rows = Math.floor(b.h / 22);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (wr.next() < 0.42) ctx.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 9, 7);
        }
      }
    }
    if (b.sign) {
      const neonDistrict = b.district === 'neon';
      if (neonDistrict || night > 0.2) {
        ctx.save();
        if (neonDistrict && night > 0.3) {
          ctx.shadowColor = b.signColor;
          ctx.shadowBlur = 18;
        }
        ctx.fillStyle = neonDistrict ? b.signColor : 'rgba(30,26,20,0.85)';
        ctx.font = '700 17px "Trebuchet MS", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sign.toUpperCase(), b.x + b.w / 2, b.y - 6);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(30,26,20,0.8)';
        ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sign.toUpperCase(), b.x + b.w / 2, b.y - 6);
      }
    }
  }

  drawProps(ctx, layout, view, env);
  drawLighthouse(ctx, layout, env);
}

function drawProps(ctx, layout, view, env) {
  const x0 = view.x - 90;
  const y0 = view.y - 90;
  const x1 = view.x + view.w + 90;
  const y1 = view.y + view.h + 90;
  const night = env.night;
  const dim = lerp(1, 0.6, night);
  for (const p of layout.props) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.kind === 'palm' || p.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 8, 20 * p.s, 12 * p.s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(p.kind === 'palm' ? '#3f9e4d' : '#2e7d3a', dim);
      ctx.beginPath(); ctx.arc(p.x, p.y, 21 * p.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(p.kind === 'palm' ? '#57b866' : '#3f9e4d', dim);
      ctx.beginPath(); ctx.arc(p.x - 5, p.y - 5, 13 * p.s, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      if (night > 0.25) {
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 46);
        g.addColorStop(0, `rgba(255,214,130,${0.5 * night})`);
        g.addColorStop(1, 'rgba(255,214,130,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe1a0';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
    } else if (p.kind === 'stall') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(p.x - 16, p.y - 8, 38, 30);
      ctx.fillStyle = shade(p.color, dim);
      ctx.fillRect(p.x - 18, p.y - 14, 38, 14);
      ctx.fillStyle = shade('#8a6a48', dim);
      ctx.fillRect(p.x - 15, p.y, 32, 20);
    } else if (p.kind === 'container') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-42, -14, 90, 34);
      ctx.fillStyle = shade(p.color, dim);
      ctx.fillRect(-45, -17, 90, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      for (let s = -36; s < 40; s += 12) ctx.fillRect(s, -17, 4, 34);
      ctx.restore();
    } else if (p.kind === 'crane') {
      ctx.strokeStyle = shade('#c9862f', dim);
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(p.x - 40, p.y + 60);
      ctx.lineTo(p.x, p.y - 70);
      ctx.lineTo(p.x + 90, p.y - 70);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x + 70, p.y - 70); ctx.lineTo(p.x + 70, p.y - 18); ctx.stroke();
      ctx.fillStyle = shade('#c65a3a', dim);
      ctx.fillRect(p.x + 48, p.y - 18, 44, 26);
    } else if (p.kind === 'umbrella') {
      ctx.fillStyle = shade(p.color, dim);
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 7, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'bench') {
      ctx.fillStyle = shade('#7a5c3d', dim);
      ctx.fillRect(p.x - 14, p.y - 5, 28, 10);
    }
  }
  // Crates are dynamic (they break), so they draw from their own list.
  for (const c of layout.crates) {
    if (c.health <= 0) continue;
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = shade('#a97c46', dim);
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(70,45,20,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h);
    ctx.stroke();
  }
}

function drawLighthouse(ctx, layout, env) {
  // The harbour-entrance light on Isla Faros' west point.
  const x = 4470;
  const y = 3740;
  if (x < layout.island.x) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 8, y + 12, 30, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d84f3d';
  ctx.beginPath(); ctx.arc(x, y, 24, Math.PI * 0.15, Math.PI * 0.5); ctx.lineTo(x, y); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 24, Math.PI * 1.15, Math.PI * 1.5); ctx.lineTo(x, y); ctx.fill();
  ctx.fillStyle = '#ffd873';
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  if (env.night > 0.3) {
    const sweep = env.time * 0.7;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 190);
    g.addColorStop(0, `rgba(255,230,150,${0.4 * env.night})`);
    g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 190, sweep, sweep + 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,24,30,0.85)';
  ctx.font = '700 16px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FARO SERENA', x, y + 44);
}
