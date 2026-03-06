import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

// Register PMTiles protocol
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const PMTILES_URL = 'https://pub-631f847ed1d5469483425ea9fbf7ab47.r2.dev/pop_v6.pmtiles';
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';


const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [20, 20],
  zoom: 2,
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

map.on('load', () => {
  // Strip basemap to: background + water fills + admin borders + labels
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
      'fill-extrusion-color': [
        'step', ['zoom'],
        // z3–z5: r6 cells (~36 km²), base thresholds (r6 = z3-z5)
        ['interpolate', ['linear'], ['get', 'population'],
          500,    '#deecc0',
          5000,   '#a8c87a',
          15000,  '#78a84e',
          40000,  '#4a8030',
          100000, '#285520',
          300000, '#0e3010'],
        6,
        // z6–z9: r7 cells (~5.2 km²), very aggressive stretch (light extended far, dark pushed way up)
        ['interpolate', ['linear'], ['get', 'population'],
          70,    '#deecc0',
          600,   '#a8c87a',
          2000,  '#78a84e',
          5000,  '#4a8030',
          15000, '#285520',
          35000, '#0e3010'],
      ],
      'fill-extrusion-opacity': 0.9,
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'],
        3, ['*', ['sqrt', ['get', 'population']], 250],  // r6 starts
        5, ['*', ['sqrt', ['get', 'population']], 120],
        6, ['*', ['sqrt', ['get', 'population']], 210],  // r7 starts
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

  // Nudge fix for pitched camera tile coverage
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
});

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
