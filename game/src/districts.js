// districts.js — Puerto Serena: Neon Tide
// One job: define the eight named districts of Puerto Serena — where
// each one lies, how its buildings are coloured, which props dress its
// streets and which original business names appear on its signage.

export function listDistricts() {
  return [
    {
      id: 'centro',
      name: 'Centro Aurelio',
      rect: { x: 2150, y: 550, w: 1500, h: 1400 },
      ground: '#cbb98f',
      roofPalette: ['#8f4f3d', '#a05a41', '#77543f', '#96503c', '#6f4a3a'],
      wallPalette: ['#d9a066', '#c98d54', '#e0aa72', '#b57e4c'],
      towerChance: 0.62,
      props: ['palm', 'lamp', 'bench'],
      signs: ['Banco Aurelio', 'Hotel Mirador', 'Café Dorado', 'Torre Serena', 'Joyas Luna'],
      blurb: 'Downtown towers and wide golden avenues.',
    },
    {
      id: 'mercado',
      name: 'Mercado Brisa',
      rect: { x: 750, y: 850, w: 1400, h: 1300 },
      ground: '#d3ac72',
      roofPalette: ['#b3562f', '#c96f35', '#a34a2e', '#cf7d3a'],
      wallPalette: ['#e8b06a', '#dfa05e', '#f0bc7c', '#d99a55'],
      towerChance: 0.08,
      props: ['stall', 'lamp', 'crate', 'bench'],
      signs: ['Mercado Brisa', 'Frutas del Sol', 'Pescadería Azul', 'Flores Mar', 'Pan Caliente'],
      blurb: 'Market streets, stalls and bright awnings.',
    },
    {
      id: 'marina',
      name: 'Puerto Serena Marina',
      rect: { x: 3350, y: 2350, w: 1500, h: 1050 },
      ground: '#b9a888',
      roofPalette: ['#5d6d75', '#4f625f', '#6b7a72', '#556270'],
      wallPalette: ['#9db3ad', '#8ba39b', '#a9bcb2'],
      towerChance: 0.05,
      props: ['container', 'crane', 'crate', 'lamp'],
      signs: ['Astillero Serena', 'Capitanía', 'Marina Club', 'Redes & Anclas', 'Depósito 7'],
      blurb: 'Harbour, cranes, containers and docks.',
    },
    {
      id: 'neon',
      name: 'Barrio Neón',
      rect: { x: 3650, y: 450, w: 1400, h: 1300 },
      ground: '#8d8296',
      roofPalette: ['#4c4258', '#5a4a63', '#413a52', '#66506b'],
      wallPalette: ['#7d6f8f', '#6f6284', '#8a779c'],
      towerChance: 0.3,
      props: ['neonsign', 'lamp', 'bench'],
      signs: ['Club Marea Rosa', 'Neón Azul', 'Bar La Ola', 'Karaoke Sirena', 'Hotel Faro Rosa', 'Discoteca Coral'],
      blurb: 'Nightlife: neon signs, clubs, wet streets.',
    },
    {
      id: 'playa',
      name: 'Playa Serena',
      rect: { x: 550, y: 2450, w: 2100, h: 1000 },
      ground: '#e6cd8d',
      roofPalette: ['#c97e4e', '#d9905c', '#bd7445'],
      wallPalette: ['#f2c184', '#ecc07f', '#f6cc90'],
      towerChance: 0.12,
      props: ['palm', 'bench', 'lamp', 'umbrella'],
      signs: ['Paseo Serena', 'Helados Brisa', 'Surf Serena', 'Chiringuito Sol', 'Hotel Brisa Marina'],
      blurb: 'Beachfront promenade, palms, sand and sea.',
    },
    {
      id: 'colinas',
      name: 'Colinas Verdes',
      rect: { x: 650, y: 200, w: 1500, h: 650 },
      ground: '#93bd6d',
      roofPalette: ['#9c5a40', '#8a4f3a', '#a86444'],
      wallPalette: ['#e6cf9e', '#dcc48f', '#efdbab'],
      towerChance: 0.0,
      props: ['tree', 'lamp', 'bench'],
      signs: ['Colinas Verdes', 'Villa Serena', 'Jardín Alto', 'Mirador Verde'],
      blurb: 'Leafy hills suburb above the bay.',
    },
    {
      id: 'industrial',
      name: 'Zona Industrial',
      rect: { x: 4850, y: 1750, w: 1000, h: 1500 },
      ground: '#a49a86',
      roofPalette: ['#6e6a5e', '#7c7668', '#5f6157', '#756f60'],
      wallPalette: ['#a8a294', '#98927f', '#b0aa9a'],
      towerChance: 0.0,
      props: ['container', 'crate', 'lamp', 'barrel'],
      signs: ['Cárdenas Logistics', 'Taller Rueda', 'Export Serena', 'Depósito Norte', 'Gruas Puerto'],
      blurb: 'Warehouses, yards and the export-list garage.',
    },
    {
      id: 'isla',
      name: 'Isla Faros',
      rect: { x: 4350, y: 3600, w: 1400, h: 520 },
      ground: '#a8c07a',
      roofPalette: ['#8a5138', '#9c5f40', '#7c4a34'],
      wallPalette: ['#e8d3a0', '#dfc68f', '#f0dcab'],
      towerChance: 0.0,
      props: ['palm', 'tree', 'crate', 'lamp'],
      signs: ['Faro Serena', 'Cala del Contrabando', 'Isla Faros'],
      blurb: 'An island of lighthouse light and smugglers’ coves.',
    },
  ];
}

// Find the district whose rectangle contains the point, or null.
export function districtAt(x, y, districts) {
  for (const d of districts) {
    const r = d.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return d;
  }
  return null;
}

// District display name for a point, with a fallback for open water.
export function districtNameAt(x, y, districts) {
  const d = districtAt(x, y, districts);
  if (d) return d.name;
  return 'Bahía Serena';
}

// Landmark anchors the missions and activities build on. Coordinates
// sit on or beside the road grid defined in city-map.js.
export function listLandmarks() {
  return {
    safehouse: { x: 1150, y: 2620, name: 'Serena Safehouse' },
    marinaOffice: { x: 3560, y: 2560, name: 'Marina Solís — Harbour Office' },
    marinaDock: { x: 3750, y: 3470, name: 'Marina Docks' },
    vaultYard: { x: 4300, y: 2900, name: 'Cárdenas Vault Yard' },
    paintShop: { x: 3050, y: 1250, name: 'Brillo Paint & Body' },
    exportGarage: { x: 5300, y: 2350, name: 'Export Serena Garage' },
    neonClub: { x: 4250, y: 1150, name: 'Club Marea Rosa' },
    courierRoute: { x: 1450, y: 1450, name: 'Mercado Brisa Stalls' },
    raceStart: { x: 2550, y: 1750, name: 'Centro Aurelio Grid' },
    lighthouse: { x: 4470, y: 3740, name: 'Faro Serena' },
    islandCove: { x: 4560, y: 3660, name: 'Cala del Contrabando' },
    bridgeWest: { x: 4625, y: 3520, name: 'Puente Oeste' },
    bridgeEast: { x: 5275, y: 3520, name: 'Puente Este' },
    beachKiosk: { x: 1750, y: 3150, name: 'Chiringuito Sol' },
    hillLookout: { x: 1250, y: 420, name: 'Mirador Verde' },
  };
}
