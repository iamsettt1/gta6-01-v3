// city-map-screen.js — Puerto Serena: Neon Tide
// One job: the map and progress screens. The full-city map — all
// eight district names, roads, water, the island, mission markers and
// the player blip — drawn from the real layout; the story panel with
// all ten missions and their rewards; the pause screen that combines
// them; and the missions board (key J) with races and the export list.

import { CONFIG, hudFont, titleFont, clamp } from './config.js';
import { drawPlate } from './renderer-camera.js';
import { completionPercent } from './side-activities.js';
import { listStoryMissions } from './missions-story.js';

// Draw the whole city into the given rectangle, labelled like a real
// city map. opts: {markers: bool, playerBlip: bool, dark: bool}.
export function drawFullCityMap(ctx, x, y, w, h, G, opts = {}) {
  const world = CONFIG.world;
  const sx = w / world.width;
  const sy = h / world.height;
  const s = Math.min(sx, sy);
  const ox = x + (w - world.width * s) / 2;
  const oy = y + (h - world.height * s) / 2;
  const px = (wx) => ox + wx * s;
  const py = (wy) => oy + wy * s;

  // Map plate and sea.
  drawPlate(ctx, x - 8, y - 8, w + 16, h + 16, 0.9, 16);
  ctx.fillStyle = '#14607f';
  ctx.fillRect(px(0), py(0), world.width * s, world.height * s);
  // Landmass.
  ctx.fillStyle = '#d8c493';
  ctx.fillRect(px(420), py(180), (5800 - 420) * s, (3480 - 180) * s);
  // Districts, tinted. (Names are painted last, over the roads.)
  for (const d of G.layout.districts) {
    ctx.fillStyle = d.ground;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(px(d.rect.x), py(d.rect.y), d.rect.w * s, d.rect.h * s);
    ctx.globalAlpha = 1;
  }
  // Island.
  ctx.fillStyle = '#a8c07a';
  ctx.fillRect(px(G.layout.island.x), py(G.layout.island.y), G.layout.island.w * s, G.layout.island.h * s);
  // Roads.
  ctx.strokeStyle = '#3d4148';
  ctx.lineWidth = Math.max(2.4, 92 * s);
  for (const ax of G.layout.avenues) {
    ctx.beginPath(); ctx.moveTo(px(ax), py(200)); ctx.lineTo(px(ax), py(3460)); ctx.stroke();
  }
  for (const syLine of G.layout.streets) {
    ctx.beginPath(); ctx.moveTo(px(440), py(syLine)); ctx.lineTo(px(5780), py(syLine)); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(px(G.layout.island.x), py(3860)); ctx.lineTo(px(G.layout.island.x + G.layout.island.w), py(3860)); ctx.stroke();
  // Bridges.
  ctx.fillStyle = '#6b6f76';
  for (const b of G.layout.bridges) ctx.fillRect(px(b.x), py(b.y), b.w * s, b.h * s);
  // District names, fitted to each district's on-map width and split
  // over two lines when long, painted over the road grid like the
  // labels on a printed city map.
  ctx.textAlign = 'center';
  for (const d of G.layout.districts) {
    const cx = px(d.rect.x + d.rect.w / 2);
    const cy = py(d.rect.y + d.rect.h / 2);
    const words = d.name.toUpperCase().split(' ');
    const lines = words.length >= 3
      ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
      : [words.join(' ')];
    const longest = Math.max(...lines.map((l) => l.length));
    const fit = (d.rect.w * s * 0.94) / (longest * 0.58);
    const fontPx = clamp(fit, 11, 24);
    ctx.font = hudFont(fontPx, 900);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,22,16,0.8)';
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, i) => {
      const ly = cy + (i - (lines.length - 1) / 2) * (fontPx + 3);
      ctx.strokeText(line, cx, ly);
      ctx.fillText(line, cx, ly);
    });
  }
  // Compass and scale dressing.
  ctx.fillStyle = '#ffffff';
  ctx.font = hudFont(20, 900);
  ctx.textAlign = 'left';
  ctx.fillText('N ↑', px(110), py(90));
  ctx.fillText('BAHÍA SERENA', px(2500), py(4020));

  if (opts.markers !== false) {
    // Mission giver (pink M) and objective (gold diamond).
    const next = G.director.nextMission(G.progress);
    if (next) {
      const gx = px(next.def.giverAt.x);
      const gy = py(next.def.giverAt.y);
      ctx.fillStyle = '#ff4fd8';
      ctx.beginPath(); ctx.arc(gx, gy, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0e16';
      ctx.font = hudFont(19, 900);
      ctx.textAlign = 'center';
      ctx.fillText('M', gx, gy + 6);
    }
    if (G.objective && G.objective.marker) {
      const mx = px(G.objective.marker.x);
      const my = py(G.objective.marker.y);
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath();
      ctx.moveTo(mx, my - 12); ctx.lineTo(mx + 9, my); ctx.lineTo(mx, my + 12); ctx.lineTo(mx - 9, my);
      ctx.closePath(); ctx.fill();
    }
    // Sun shells remaining, as gold dots.
    ctx.fillStyle = '#ffd873';
    G.activities.shellSpots.forEach((spot, i) => {
      if (G.progress.shellsFound[i]) return;
      ctx.beginPath(); ctx.arc(px(spot.x), py(spot.y), 4, 0, Math.PI * 2); ctx.fill();
    });
  }
  if (opts.playerBlip !== false) {
    const focus = G.player.focus();
    const bx = px(focus.x);
    const by = py(focus.y);
    const pulse = 10 + Math.sin(G.time * 4) * 2.4;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(bx, by, pulse + 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a0e16';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  return { px, py, s };
}

// The story panel: all ten missions with state and rewards, plus the
// stats row. Used by the pause screen and the progress screenshot.
export function drawStoryPanel(ctx, x, y, w, G) {
  const missions = listStoryMissions();
  const current = G.director.nextMission(G.progress);
  ctx.textAlign = 'left';
  ctx.font = titleFont(40, 900);
  ctx.fillStyle = '#ffc94d';
  ctx.fillText('THE NEON TIDE STORY', x, y + 40);
  let ry = y + 86;
  missions.forEach((m, i) => {
    const done = G.progress.missionsDone[i];
    const isCurrent = current && current.index === i;
    if (isCurrent) {
      ctx.fillStyle = 'rgba(255,201,77,0.16)';
      ctx.beginPath(); ctx.roundRect(x - 10, ry - 27, w + 20, 40, 8); ctx.fill();
    }
    ctx.font = hudFont(25, 900);
    ctx.fillStyle = done ? '#7be495' : isCurrent ? '#ffc94d' : '#7787a0';
    const mark = done ? '✔' : isCurrent ? '▶' : '🔒';
    ctx.fillText(mark, x, ry);
    ctx.fillStyle = done ? '#c8d2e0' : isCurrent ? '#ffffff' : '#7787a0';
    ctx.font = hudFont(25, 800);
    ctx.fillText(`${i + 1}. ${m.name}`, x + 40, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = done ? '#7be495' : '#9fb2c8';
    ctx.fillText(`$${m.reward.cash}`, x + w, ry);
    ctx.textAlign = 'left';
    ry += 38;
  });
  // Stats rows, sized to the panel so nothing runs off the edge.
  const races = G.progress.racesWon.filter(Boolean).length;
  const shells = G.progress.shellsFound.filter(Boolean).length;
  const exportsDone = G.progress.exportsDone.filter(Boolean).length;
  const completion = completionPercent(G.progress);
  ry += 8;
  ctx.font = hudFont(25, 900);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`CASH $${G.progress.cash.toLocaleString('en-US')}  ·  RESPECT LV ${G.progress.respectLevel}`, x, ry);
  ry += 34;
  ctx.fillText(`RACES WON ${races}/4  ·  SUN SHELLS ${shells}/15`, x, ry);
  ry += 34;
  ctx.fillText(`EXPORTS ${exportsDone}/6  ·  MISSIONS ${G.progress.missionsDone.filter(Boolean).length}/10`, x, ry);
  ry += 38;
  ctx.font = hudFont(28, 900);
  ctx.fillStyle = '#ffc94d';
  ctx.fillText(`COMPLETION ${completion}%`, x, ry);
  // Completion bar on its own line beneath the figure.
  ry += 10;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.roundRect(x, ry, w, 20, 10); ctx.fill();
  ctx.fillStyle = '#ffc94d';
  if (completion > 0) {
    ctx.beginPath(); ctx.roundRect(x + 2, ry + 2, Math.max(10, (w - 4) * completion / 100), 16, 8); ctx.fill();
  }
  return ry + 20;
}

// The pause screen: living city behind a translucent panel, the full
// map on the left half, the story and stats on the right.
export function drawPauseScreen(ctx, G) {
  const view = { w: CONFIG.view.width, h: CONFIG.view.height };
  ctx.fillStyle = 'rgba(6, 9, 16, 0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.font = titleFont(44, 900);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED — PUERTO SERENA', view.w / 2, 56);
  drawFullCityMap(ctx, 36, 84, 600, 620, G, {});
  drawPlate(ctx, 664, 76, 580, 636, 0.88, 16);
  drawStoryPanel(ctx, 692, 96, 524, G);
  ctx.textAlign = 'center';
  ctx.font = hudFont(23, 800);
  ctx.fillStyle = '#e8f2ff';
  ctx.fillText('ESC / M — RESUME   ·   J — MISSIONS BOARD   ·   P — PHONE', view.w / 2, 748);
  ctx.font = hudFont(20, 600);
  ctx.fillStyle = '#9fb2c8';
  ctx.fillText('Progress saves at the Serena Safehouse (E). The city keeps breathing while you plan.', view.w / 2, 778);
}

// The progress screenshot composition is the pause screen itself:
// map left, story right, living city visible around the panel.
export function drawProgressScreen(ctx, G) {
  drawPauseScreen(ctx, G);
}

// The missions board (key J): story chain, races, exports, shells.
export function drawMissionsBoard(ctx, G) {
  const view = { w: CONFIG.view.width, h: CONFIG.view.height };
  ctx.fillStyle = 'rgba(6, 9, 16, 0.66)';
  ctx.fillRect(0, 0, view.w, view.h);
  drawPlate(ctx, 90, 60, view.w - 180, view.h - 120, 0.92, 18);
  ctx.textAlign = 'center';
  ctx.font = titleFont(42, 900);
  ctx.fillStyle = '#ffc94d';
  ctx.fillText('MISSIONS BOARD', view.w / 2, 118);
  // Left column: the story.
  drawStoryPanel(ctx, 130, 140, 520, G);
  // Right column: activities.
  let ry = 226;
  const rx = 700;
  ctx.textAlign = 'left';
  ctx.font = hudFont(27, 900);
  ctx.fillStyle = '#37e6ff';
  ctx.fillText('STREET RACES', rx, ry);
  ry += 36;
  G.activities.courses.forEach((course, i) => {
    const won = G.progress.racesWon[i];
    const best = G.progress.raceBest[i];
    ctx.font = hudFont(23, 700);
    ctx.fillStyle = won ? '#7be495' : '#e8f2ff';
    ctx.fillText(`${won ? '✔' : '·'} ${course.name}${best ? ` — best ${best}s` : ''} · gold ${course.gold}s`, rx, ry);
    ry += 32;
  });
  ry += 18;
  ctx.font = hudFont(27, 900);
  ctx.fillStyle = '#37e6ff';
  ctx.fillText('EXPORT LIST — EXPORT SERENA', rx, ry);
  ry += 36;
  G.activities.exports.forEach((car, i) => {
    const done = G.progress.exportsDone[i];
    ctx.font = hudFont(23, 700);
    ctx.fillStyle = done ? '#7be495' : '#e8f2ff';
    ctx.fillText(`${done ? '✔' : '·'} ${car.name} — $850`, rx, ry);
    ry += 32;
  });
  ry += 18;
  ctx.font = hudFont(23, 700);
  ctx.fillStyle = '#e8f2ff';
  const shells = G.progress.shellsFound.filter(Boolean).length;
  ctx.fillText(`Sun shells: ${shells}/15 hidden across the districts and Isla Faros`, rx, ry);
  ry += 32;
  ctx.fillText('Taxi fares: stop beside a hailing pedestrian (TAXI bubble).', rx, ry);
  ry += 32;
  ctx.fillText('Paint shop: Brillo Paint & Body, Centro Aurelio — clears heat.', rx, ry);
  ctx.textAlign = 'center';
  ctx.font = hudFont(23, 800);
  ctx.fillStyle = '#ffc94d';
  ctx.fillText('J / ESC — CLOSE', view.w / 2, view.h - 84);
}
