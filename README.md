# Human Terrain — 3D Global Population Density

An interactive 3D map of global population density. Every spike is a place. Taller means denser.

**Live**: [population-mapping.vercel.app](https://population-mapping.vercel.app)

---

## What it is

8 billion people rendered as a 3D landscape. H3 hexagonal grid cells extruded by population count — scroll through the landing panels or jump straight to the map and explore freely.

Inspired by Matt Daniels' [Human Terrain](https://pudding.cool/2018/10/city_3d/) project on The Pudding.

## Tech stack

| Layer | Tool |
|---|---|
| Map renderer | MapLibre GL JS v5 |
| Tile format | PMTiles v4 (HTTP range requests — no tile server) |
| Data | Kontur Population 2023 (H3 hexagons) |
| Build | Vite |
| Hosting | Vercel (app) + Cloudflare R2 (tiles) |

## Data

Population data from [Kontur Population 2023](https://www.kontur.io/portfolio/population-dataset/) — pre-built H3 hexagon grid with population counts per cell.

Two resolutions are used:
- **H3 r6** (~36 km² cells) at map zoom 3–5
- **H3 r7** (~5.2 km² cells) at map zoom 6–9

Tiles processed with [tippecanoe](https://github.com/felt/tippecanoe) and served as a single 688 MB PMTiles file via Cloudflare R2.

## Run locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Requires `public/test_pop.pmtiles` (688 MB, not in repo). Download separately or point `PMTILES_URL` in `main.js` at the live R2 URL.
