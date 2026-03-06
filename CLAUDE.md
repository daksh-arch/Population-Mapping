# Human Terrain — 3D Global Population Density

## Project Overview
Interactive 3D map visualising global population density using H3 hexagons extruded by population count. Built with MapLibre GL JS + PMTiles. Directly inspired by Matt Daniels' "Human Terrain" project on The Pudding, mirroring his multi-resolution tippecanoe pipeline but using Kontur H3 hexagon data instead of GHSL raster.

**Live**: Deployed on Vercel. PMTiles will be hosted on Cloudflare R2.
**Dev**: `npm run dev` → `http://localhost:5173`

---

## Tech Stack
| Layer | Tool |
|---|---|
| Map renderer | MapLibre GL JS v5 |
| Tile format | PMTiles v4 (HTTP range requests, no tile server needed) |
| Data format | Vector tiles (MVT) inside PMTiles |
| Build tool | Vite |
| Hosting | Vercel (app) + Cloudflare R2 (tiles) |
| Data processing | GDAL (ogr2ogr), tippecanoe, tile-join, pmtiles CLI |

---

## Key Files
```
main.js               — map init, source/layer config, color + height expressions,
                        landing scroll logic, viewport population counter, region callouts
index.html            — landing panels + explore UI structure
style.css             — fullscreen map, scrollytelling panels, explore UI, callout cards
scripts/
  process_test.sh     — Phase A: South Asia test region pipeline
  process_global.sh   — Phase C: full global pipeline (current: r6 z3-z5, r7 z6-z9)
  upload_r2.sh        — Phase D: Cloudflare R2 upload
data/                 — geojsonl sources + intermediate mbtiles + final pmtiles
public/               — static assets (test_pop.pmtiles = pop_v6.pmtiles, 688 MB)
```

---

## Reference: Original Mapbox Blog Post
**URL**: https://blog.mapbox.com/3d-mapping-global-population-density-how-i-built-it-141785c91107
**Author**: Matt Daniels (The Pudding) — Oct 29, 2018
**Title**: "3D mapping global population density: How I built it"

> NOTE: This URL has a TLS certificate issue. To fetch it use: `curl -k -L <url>`

### Key technical details from the blog:

**Data source**: Global Human Settlement Layer (GHSL) from EU JRC
- Downloaded via Google Earth Engine
- 3 scales: **250m** (native), **1000m**, **5000m**
- Field name in dataset: `DN`

**Pipeline**: `TIF → shapefile → GeoJSON → MBTiles`
```bash
# Step 1: TIF to shapefile
gdal_polygonize.py input.tif -mask input.tif -f "ESRI Shapefile" output DN

# Step 2: shapefile to GeoJSON
ogr2ogr -f GeoJSON output.json -t_srs EPSG:4326 input.shp \
  --config OGR_ENABLE_PARTIAL_REPROJECTION TRUE -skipfailures

# Step 3: tippecanoe per scale (KEY: separate run per zoom range)
tippecanoe -z4  -o output_5k.mbtiles  -pd -l output_5k  input_5k.json ...
tippecanoe -Z5 -z6 -o output_1k.mbtiles -pd -l output_1k input_1k.json ...
tippecanoe -Z7 -z10 -o output_250m.mbtiles -pd -l output_250m input_250m.json ...

# Step 4: tile-join to merge all into one file
tile-join -o output_combined.mbtiles output_1k.mbtiles output_5k.mbtiles output_250m.mbtiles
```

**Zoom mapping** (Pudding original):
| Scale | Zoom range | tippecanoe flags |
|---|---|---|
| 5000m | z0–z4 | `-z4` |
| 1000m | z5–z6 | `-Z5 -z6` |
| 250m | z7–z10 | `-Z7 -z10` |

**Height**: data-driven on `DN` field (population count)
**Color**: data-driven styling in Mapbox Studio
**`-pd` flag**: "dynamically drop some fraction of features from large tiles to keep them under the 500K size limit" — we discovered this causes patchy rendering and replaced it with `--no-tile-size-limit`

---

## Our Data Source (vs blog)
We use **Kontur Population 2023** instead of GHSL — it's pre-built H3 hexagons, no raster conversion needed.

| File | H3 Res | Actual cell size | Download URL |
|---|---|---|---|
| `kontur_population_20231101_r4.gpkg.gz` | r4 | ~1,770 km² | S3 EU Central |
| `kontur_population_20231101_r6.gpkg.gz` | r6 | ~36 km² | S3 EU Central |
| `kontur_population_20231101.gpkg.gz` | r8 | ~0.74 km² | S3 EU Central |

Base S3 URL: `https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/`

**Field name**: `population` (confirmed via ogrinfo — NOT `DN` like GHSL)
**Layer name**: `population`
**CRS**: EPSG:3857 Pseudo-Mercator (NOT 4326 — critical for ogr2ogr)

---

## Resolution / Zoom Plan (current: pop_v6.pmtiles)

| Map Zoom | H3 Res | Cell size | Source | Tippecanoe range |
|---|---|---|---|---|
| z3–z5 | r6 | ~36 km² | `global_r6.geojsonl` | `-Z3 -z5` |
| z6–z9 | r7 | ~5.2 km² | `global_r7.geojsonl` | `-Z6 -z9` |

> r5 (z0–z2) was dropped — map minZoom is 3, so it was never visible.
> Previous version (pop_v5.pmtiles): r5 z0-z2, r6 z3-z6, r7 z7-z9.

### H3 cell sizes reference
| Res | Area |
|---|---|
| r4 | ~1,770 km² |
| r5 | ~252 km² |
| r6 | ~36 km² |
| r7 | ~5.2 km² |
| r8 | ~0.74 km² |
Each resolution is ~7x finer than the previous.

---

## Tippecanoe Flags (critical)
```bash
--no-tile-size-limit   # NEVER drop features — use this always
                       # DO NOT use -pd: causes patchy/flickering in dense areas
-l population          # source-layer name must match main.js 'source-layer'
--detect-longitude-wraparound
--force                # overwrite existing output
-Z<n>                  # minimum zoom (uppercase Z)
-z<n>                  # maximum zoom (lowercase z)
```

## tile-join Flags (critical)
```bash
--no-tile-size-limit   # MUST pass this to tile-join too — it has its OWN 500KB limit
                       # separate from tippecanoe's limit. Omitting it silently drops
                       # the largest tiles (dense areas: North India, S. Asia, etc.)
--force                # overwrite existing output
```

**Full tile-join command:**
```bash
tile-join --force --no-tile-size-limit \
  -o pop_final.mbtiles \
  global_pop_r5_new.mbtiles \
  global_pop_r6_new.mbtiles \
  global_pop_r7_new.mbtiles
```

---

## ogr2ogr Critical Notes
```bash
# GPKG is EPSG:3857 — MUST use -spat_srs when passing geographic bbox
ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 \
  -spat 60 5 100 40 -spat_srs EPSG:4326 \   # <-- required, else 0 features
  output.geojsonl input.gpkg

# Tippecanoe reads GeoJSONSeq, NOT .gpkg directly — always convert first
```

---

## main.js Configuration

### Current state (dev — r6/r7 global tileset in public/)
```js
const PMTILES_URL = '/test_pop.pmtiles';  // served from public/ by Vite (688 MB, pop_v6.pmtiles)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
pitch: 45,
minZoom: 3,
maxZoom: 9,
'source-layer': 'population',
// filter scaled per resolution — r6 base, r7 ÷7
filter: ['>', ['get', 'population'], ['step', ['zoom'], 500, 6, 70]],
```

### Target (after R2 upload)
```js
const PMTILES_URL = 'https://[bucket].[account].r2.dev/pop_v6.pmtiles';
minZoom: 3,
maxZoom: 9,
```

### Basemap Layer Stripping (positron)
Keep: background, water, all line layers, all symbol layers.
Hide: fill layers that aren't water/ocean/background (parks, landuse, buildings add noise under extrusions).

### Height Expression
sqrt(population) × multiplier. Flattens to 0 at z9.
```js
'fill-extrusion-height': [
  'interpolate', ['linear'], ['zoom'],
  3, ['*', ['sqrt', ['get', 'population']], 300],  // r6 starts (current)
  5, ['*', ['sqrt', ['get', 'population']], 120],  // r6 taper
  6, ['*', ['sqrt', ['get', 'population']], 210],  // r7 starts
  8, ['*', ['sqrt', ['get', 'population']], 210],
  9, 0,                                            // fully flat at max zoom
]
```

**Original (revert to this if needed):** z3 multiplier = `250`

> TODO (finishing touches): multipliers feel roughly right but need tuning. Key transition
> is z5→z6 where r6→r7 swap happens. At z6 spikes may feel too tall/short compared to z5.

### Color Scheme
Thresholds scaled per resolution so same visual density = same population density on the ground.
r7 thresholds = r6 ÷ 7. `fill-extrusion-opacity`: 0.9 constant.
```js
// filter (zoom-stepped, r6→r7 at z6):
['>', ['get', 'population'], ['step', ['zoom'], 500, 6, 70]]

// color ramp — step on zoom at z6, interpolate on population:
// z3–z5 (r6 base): 500 → #deecc0 … 300000 → #0e3010
// z6–z9 (r7 ÷7):   70  → #deecc0 …  14300 → #0e3010
// colors: #deecc0 / #a8c87a / #78a84e / #4a8030 / #285520 / #0e3010
```

> TODO (finishing touches): color thresholds need review at z5/z6 transition.
> r6 top threshold is 300k (was 100k in earlier version — may be too permissive).
> Also consider whether 6-stop ramp is right or if 5 stops would be cleaner.

### Alternative Color Palettes (tested, ready to swap in)

**Greyscale** (4 stops — desaturated img3/lavender-slate luminance values):
```js
// z3–z5 (r6): 500→#ebebeb, 5000→#d7d7d7, 40000→#adadad, 300000→#323232
// z6–z9 (r7):  70→#ebebeb,  360→#d7d7d7,  2150→#adadad,  14300→#323232
```

---

## Visual Design
- **Basemap**: Carto Positron (light/cream). Full basemap kept except noisy fill layers (parks, landuse, buildings).
- **Style**: Matches The Pudding "Human Terrain" — off-white land, clean city labels, only dense urban cores show green (current: OG green palette).
- **Overlay**: `style.css` — `background: #f5f4f0`, dark text, serif font for title.

## Known Issues / Gotchas
1. **`-pd` causes feature dropping** — dense tiles (W. Europe, S. Asia) get features silently dropped, causing patchy flickering. Always use `--no-tile-size-limit`.
2. **tile-join ALSO has a 500KB limit** — `--no-tile-size-limit` must be passed to tile-join separately, not just tippecanoe. Omitting it causes large tiles (Pakistan, N. India, S. Asia at z4-z5) to be silently dropped — visible as perfectly rectangular black patches on the map. Fixed by re-running tile-join with the flag and re-converting to PMTiles.
3. **GPKG is EPSG:3857** — `-spat` without `-spat_srs EPSG:4326` returns 0 features silently.
4. **`curl -C -` resume corrupts gzip** — if `gzip -t` fails after resumed download, delete and re-download fresh with no `-C` flag.
5. **Tippecanoe can't read .gpkg** — must convert to GeoJSONSeq via ogr2ogr first.
6. **tile-join warns about mismatched maxzooms** — safe to ignore when intentionally merging different zoom ranges.
7. **Mapbox blog TLS issue** — `curl -k -L <url>` to bypass certificate verification.
8. **`fill-extrusion` ignores rgba alpha** — setting `fill-extrusion-color` to `rgba(..., 0)` renders as solid black, not transparent. Fix: use a `filter` to drop low-pop cells entirely, use solid hex colors, and drive transparency via `fill-extrusion-opacity` as a separate data-driven property.
9. **MapLibre pitched camera tile coverage** — with pitch >0, MapLibre underestimates far-horizon tile coverage. Fixed via a nudge (`panBy([1,0])` + `panBy([-1,0])`) after `idle` fires on any camera movement event. The nudge must temporarily remove the `moveend` listener to avoid an infinite loop, and needs a timeout safety release in case `idle` never fires (stalled tile).

---

## Data Pipeline — Current State

All local processing complete. Files in `data/`:
| File | Size | Status |
|---|---|---|
| `global_pop_r6_v2.mbtiles` | ~? MB | ✅ z3-z5 |
| `global_pop_r7_v2.mbtiles` | ~? MB | ✅ z6-z9 |
| `pop_v6.mbtiles` | ~688 MB | ✅ merged (--no-tile-size-limit) |
| `pop_v6.pmtiles` | 688 MB | ✅ final output |

`public/test_pop.pmtiles` = copy of `pop_v6.pmtiles` for local dev.

Previous versions (keep for reference):
- `pop_v5.pmtiles` — 607 MB, r5/r6/r7, old zoom ranges

---

## Frontend — Current State

### Landing / scrollytelling (index.html + style.css + main.js)
- 9 scroll-snap panels, dark dim overlay over map
- Each panel flies map camera to relevant region via `data-zoom`, `data-center`, `data-bearing`
- "Enter the map" button dismisses landing, fades dim, shows explore UI
- **Narrative tone**: data journalism (The Pudding / NYT style)

### Explore UI
- **Viewport population counter** (bottom-center): sums `queryRenderedFeatures` on `population-3d` layer, deduplicates by feature id, shows formatted total + % of 8.045B world population
- **Region callout cards**: appear when map center is within radius of 6 defined regions (Ganges, Pearl River Delta, Java, Nile, Yangtze, Bangladesh). Dismissable, won't reshow in session.

### Region callouts defined in main.js (`REGION_CALLOUTS` array)
Each entry: `{ id, center[lng,lat], radius(deg), minZoom, region, fact }`

---

## TODO (finishing touches — next session)
- [ ] **Height multipliers** — tune z3 (250) and z6 (210) at the r6→r7 transition; check if spikes feel consistent crossing z5→z6
- [ ] **Color thresholds** — review r6 top stop (300k vs 100k), consider 5-stop vs 6-stop ramp
- [ ] **Narrative panels** — review copy in each scroll panel; add/remove panels; tune camera positions per panel
- [ ] **Scroll indicator** — add animated down-arrow on first panel
- [ ] **Mobile** — test on small screens; panel font sizes + layout
- [ ] **Cloudflare R2** — set up bucket, upload `pop_v6.pmtiles`, enable public URL, set CORS
- [ ] **Deploy** — update `PMTILES_URL` in main.js to R2 URL, `npm run build && vercel deploy`
