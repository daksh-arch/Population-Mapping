import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

// Register PMTiles protocol
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const PMTILES_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? '/test_pop.pmtiles'
  : 'https://pub-631f847ed1d5469483425ea9fbf7ab47.r2.dev/pop_v6.pmtiles';
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// ── Colour palettes ──────────────────────────────────────────────
// Each palette defines colour stops for r6 (z3-z5) and r7 (z6-z9).
// r7 thresholds ≈ r6 ÷ 7 (cell area ratio). All use Carto Positron.
const PALETTES = [
  {
    name: 'OG Green',
    r6: [[500,'#deecc0'],[5000,'#a8c87a'],[15000,'#78a84e'],[40000,'#4a8030'],[100000,'#285520'],[300000,'#0e3010']],
    r7: [[70,'#deecc0'],[600,'#a8c87a'],[2000,'#78a84e'],[5000,'#4a8030'],[15000,'#285520'],[35000,'#0e3010']],
  },
  {
    // OS GeoDataViz s2 — calibrated sequential greens
    name: 'OS Greens',
    r6: [[500,'#edf8e9'],[5000,'#c7e9c0'],[15000,'#a1d99b'],[40000,'#74c476'],[100000,'#238b45'],[300000,'#005a32']],
    r7: [[70,'#edf8e9'],[600,'#c7e9c0'],[2000,'#a1d99b'],[5000,'#74c476'],[15000,'#238b45'],[35000,'#005a32']],
  },
  {
    // OS GeoDataViz m1 — lime-to-teal-to-navy multi-hue
    name: 'Teal',
    r6: [[500,'#b7e6a5'],[5000,'#7bccc4'],[15000,'#4eb3d3'],[40000,'#2b8cbe'],[100000,'#0868ac'],[300000,'#003147']],
    r7: [[70,'#b7e6a5'],[600,'#7bccc4'],[2000,'#4eb3d3'],[5000,'#2b8cbe'],[15000,'#0868ac'],[35000,'#003147']],
  },
  {
    // OS GeoDataViz m3 — yellow-orange-red heat map
    name: 'Heat',
    r6: [[500,'#fff3b2'],[5000,'#fed976'],[15000,'#feb24c'],[40000,'#fd8d3c'],[100000,'#e31a1c'],[300000,'#b10026']],
    r7: [[70,'#fff3b2'],[600,'#fed976'],[2000,'#feb24c'],[5000,'#fd8d3c'],[15000,'#e31a1c'],[35000,'#b10026']],
  },
  {
    // OS GeoDataViz s1 — sequential blues
    name: 'Blues',
    r6: [[500,'#e4f1f7'],[5000,'#c6dbef'],[15000,'#9ecae1'],[40000,'#6baed6'],[100000,'#2171b5'],[300000,'#0d4a70']],
    r7: [[70,'#e4f1f7'],[600,'#c6dbef'],[2000,'#9ecae1'],[5000,'#6baed6'],[15000,'#2171b5'],[35000,'#0d4a70']],
  },
  {
    // Greyscale — 4 stops
    name: 'Greyscale',
    r6: [[500,'#ebebeb'],[5000,'#d7d7d7'],[40000,'#adadad'],[300000,'#323232']],
    r7: [[70,'#ebebeb'],[360,'#d7d7d7'],[2150,'#adadad'],[14300,'#323232']],
  },
  {
    // Viridis — perceptually uniform, colour-blind safe
    name: 'Viridis',
    r6: [[500,'#fde725'],[5000,'#90d743'],[15000,'#35b779'],[40000,'#21908c'],[100000,'#31688e'],[300000,'#440154']],
    r7: [[70,'#fde725'],[600,'#90d743'],[2000,'#35b779'],[5000,'#21908c'],[15000,'#31688e'],[35000,'#440154']],
  },
  {
    // Magma — black-purple-orange-yellow, dramatic
    name: 'Magma',
    r6: [[500,'#fcfdbf'],[5000,'#fec287'],[15000,'#f1605d'],[40000,'#b63679'],[100000,'#721f81'],[300000,'#000004']],
    r7: [[70,'#fcfdbf'],[600,'#fec287'],[2000,'#f1605d'],[5000,'#b63679'],[15000,'#721f81'],[35000,'#000004']],
  },
  {
    // Inferno — black-purple-red-yellow, high contrast
    name: 'Inferno',
    r6: [[500,'#fcffa4'],[5000,'#fca50a'],[15000,'#dd513a'],[40000,'#932667'],[100000,'#420a68'],[300000,'#000004']],
    r7: [[70,'#fcffa4'],[600,'#fca50a'],[2000,'#dd513a'],[5000,'#932667'],[15000,'#420a68'],[35000,'#000004']],
  },
  {
    // Warm sand — muted gold-to-brown, earthy
    name: 'Sand',
    r6: [[500,'#fff8e7'],[5000,'#f0d9a0'],[15000,'#d4a85a'],[40000,'#a8722a'],[100000,'#7a4e1a'],[300000,'#3d2008']],
    r7: [[70,'#fff8e7'],[600,'#f0d9a0'],[2000,'#d4a85a'],[5000,'#a8722a'],[15000,'#7a4e1a'],[35000,'#3d2008']],
  },
];

let currentPaletteIndex = 0;

function buildColorExpr(palette) {
  const r6 = ['interpolate', ['linear'], ['get', 'population']];
  palette.r6.forEach(([stop, color]) => { r6.push(stop, color); });
  const r7 = ['interpolate', ['linear'], ['get', 'population']];
  palette.r7.forEach(([stop, color]) => { r7.push(stop, color); });
  return ['step', ['zoom'], r6, 6, r7];
}

function applyPalette(index) {
  currentPaletteIndex = ((index % PALETTES.length) + PALETTES.length) % PALETTES.length;
  const palette = PALETTES[currentPaletteIndex];
  if (map.getLayer('population-3d')) {
    map.setPaintProperty('population-3d', 'fill-extrusion-color', buildColorExpr(palette));
  }
  const label = document.getElementById('palette-label');
  if (label) label.textContent = palette.name;
}


const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [20, 20],
  zoom: 3,
  pitch: 45,
  bearing: 0,
  minZoom: 3,
  maxZoom: 9,
  maxPitch: 60,
  fadeDuration: 0,
  antialias: false,
  attributionControl: true,
  maxTileCacheSize: 50,   // tiles in memory (default is ~500+)
  workerCount: 1,          // tile decode workers (default 2)
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

const loader = document.getElementById('loader');

// Adds/re-adds population source + layer after any style load.
// Called on initial load and after setStyle() for basemap switches.
function addPopulationLayer() {
  // Strip noisy fill layers, keep: background, water, admin lines, labels
  map.getStyle().layers.forEach(layer => {
    if (layer.type === 'background') return;
    if (layer.type === 'symbol') return;
    const id = layer.id.toLowerCase();
    if (layer.type === 'fill' && (id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('lake'))) return;
    if (layer.type === 'line' && (id.includes('admin') || id.includes('boundary') || id.includes('border'))) return;
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  });

  map.addSource('population', {
    type: 'vector',
    url: `pmtiles://${PMTILES_URL}`,
    attribution: '© <a href="https://www.kontur.io/">Kontur</a>',
  });

  const firstSymbolId = map.getStyle().layers.find(l => l.type === 'symbol')?.id;

  map.addLayer({
    id: 'population-3d',
    type: 'fill-extrusion',
    source: 'population',
    'source-layer': 'population',
    filter: ['>', ['get', 'population'], ['step', ['zoom'], 500, 6, 100]],
    paint: {
      'fill-extrusion-color': buildColorExpr(PALETTES[currentPaletteIndex]),
      'fill-extrusion-opacity': 0.9,
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'],
        3, ['*', ['sqrt', ['get', 'population']], 250],
        5, ['*', ['sqrt', ['get', 'population']], 120],
        6, ['*', ['sqrt', ['get', 'population']], 210],
        8, ['*', ['sqrt', ['get', 'population']], 210],
        9, 0,
      ],
      'fill-extrusion-base': 0,
    },
  }, firstSymbolId);

  map.setLight({
    anchor: 'viewport',
    color: '#ffffff',
    intensity: 0.25,
    position: [1.15, 215, 40],
  });
}

map.on('load', () => {
  map.resize();

  map.once('idle', () => {
    loader.classList.add('fade-out');
    setTimeout(() => loader.classList.add('hidden'), 850);
  });

  addPopulationLayer();

  // Nudge fix for pitched camera tile coverage (one-time setup, persists across style changes)
  let nudgePending = false;
  let nudgeTimeout = null;

  const scheduleNudge = () => {
    if (nudgePending) return;
    nudgePending = true;
    nudgeTimeout = setTimeout(() => { nudgePending = false; }, 10000);
    map.once('idle', () => {
      clearTimeout(nudgeTimeout);
      map.off('moveend', scheduleNudge);
      map.panBy([1, 0], { animate: false });
      map.panBy([-1, 0], { animate: false });
      nudgePending = false;
      map.on('moveend', scheduleNudge);
    });
  };

  scheduleNudge();
  map.on('moveend', scheduleNudge);

  window.__map = map;
  window.__enterMap = enterMap;

  initLanding();
  initPaletteSwitcher();
});

function initPaletteSwitcher() {
  const prev = document.getElementById('palette-prev');
  const next = document.getElementById('palette-next');
  const label = document.getElementById('palette-label');
  if (!prev || !next || !label) return;

  label.textContent = PALETTES[currentPaletteIndex].name;
  prev.addEventListener('click', () => applyPalette(currentPaletteIndex - 1));
  next.addEventListener('click', () => applyPalette(currentPaletteIndex + 1));
}

// ── Scrollytelling ──────────────────────────────────────────────

function initLanding() {
  const landing = document.getElementById('landing');
  const mapDim = document.getElementById('map-dim');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const enterBtn = document.getElementById('enter-btn');

  // Fly map to panel's data attributes on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const zoom = parseFloat(el.dataset.zoom);
      const [lng, lat] = el.dataset.center.split(',').map(Number);
      const bearing = parseFloat(el.dataset.bearing || 0);
      map.flyTo({ center: [lng, lat], zoom, bearing, pitch: 45, duration: 1800, essential: true });
    });
  }, { threshold: 0.6 });

  panels.forEach(p => observer.observe(p));

  enterBtn.addEventListener('click', enterMap);

  // Hide scroll indicator after scroll
  let scrolledOnce = false;
  landing.addEventListener('scroll', () => {
    if (!scrolledOnce && landing.scrollTop > 50) {
      scrolledOnce = true;
      document.querySelectorAll('.scroll-indicator').forEach(el => {
        el.style.display = 'none';
      });
    }
  });
}

function enterMap() {
  const landing = document.getElementById('landing');
  const mapDim = document.getElementById('map-dim');
  const exploreUI = document.getElementById('explore-ui');
  const skipBtn = document.getElementById('skip-btn');

  // Fade out dim, hide landing
  mapDim.classList.add('hidden');
  landing.classList.add('hidden');
  if (skipBtn) skipBtn.classList.add('hidden');
  exploreUI.classList.remove('hidden');

  // Fly to a good starting view
  map.flyTo({ center: [85, 24], zoom: 4, pitch: 50, bearing: 0, duration: 2000, essential: true });
}

// Info modal
const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const infoClose = document.getElementById('info-close');

infoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
infoClose.addEventListener('click', () => infoModal.classList.add('hidden'));
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) infoModal.classList.add('hidden');
});
