#!/usr/bin/env bash
# Phase A: Test pipeline on South/Southeast Asia region
# Run from project root: bash scripts/process_test.sh
set -euo pipefail

DATA_DIR="$(dirname "$0")/../data"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "=== Phase A: Download ==="
wget -nc "https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/kontur_population_20231101_r4.gpkg.gz" -O kontur_r4.gpkg.gz
wget -nc "https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/kontur_population_20231101_r6.gpkg.gz" -O kontur_r6.gpkg.gz
wget -nc "https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/kontur_population_20231101.gpkg.gz"    -O kontur_r8.gpkg.gz

echo "=== Decompress ==="
[ -f kontur_r4.gpkg ] || gunzip -k kontur_r4.gpkg.gz
[ -f kontur_r6.gpkg ] || gunzip -k kontur_r6.gpkg.gz
[ -f kontur_r8.gpkg ] || gunzip -k kontur_r8.gpkg.gz

echo "=== Inspect field names (r4) ==="
ogrinfo -al -so kontur_r4.gpkg | head -30

echo "=== Export test region (South Asia: 60–100E, 5–40N) ==="
# -spat <xmin> <ymin> <xmax> <ymax>
ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 \
  -spat 60 5 100 40 -spat_srs EPSG:4326 \
  test_r4.geojsonl kontur_r4.gpkg

ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 \
  -spat 60 5 100 40 -spat_srs EPSG:4326 \
  test_r6.geojsonl kontur_r6.gpkg

ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 \
  -spat 60 5 100 40 -spat_srs EPSG:4326 \
  test_r8.geojsonl kontur_r8.gpkg

echo "=== Tippecanoe per resolution ==="
# --no-tile-size-limit = --drop-densest-as-needed (drop tiles that are too dense, keeping tile size manageable)
# -l  = source layer name used in main.js 'source-layer': 'population'
tippecanoe -Z0 -z3 -o test_pop_r4.mbtiles --no-tile-size-limit -l population \
  --detect-longitude-wraparound test_r4.geojsonl

tippecanoe -Z4 -z6 -o test_pop_r6.mbtiles --no-tile-size-limit -l population \
  --detect-longitude-wraparound test_r6.geojsonl

tippecanoe -Z7 -z9 -o test_pop_r8.mbtiles --no-tile-size-limit -l population \
  --detect-longitude-wraparound test_r8.geojsonl

echo "=== Merge with tile-join ==="
tile-join -o test_pop_combined.mbtiles \
  test_pop_r4.mbtiles test_pop_r6.mbtiles test_pop_r8.mbtiles

echo "=== Convert to PMTiles ==="
pmtiles convert test_pop_combined.mbtiles test_pop.pmtiles

echo ""
echo "Done! Output: data/test_pop.pmtiles"
echo "Next: run 'npm run dev' and point PMTILES_URL at this file to validate."
