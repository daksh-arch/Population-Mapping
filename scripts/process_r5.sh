#!/usr/bin/env bash
# Generate pop_v2.pmtiles: r5 (z0-z3) + existing r6 (z4-z6) + r8 (z7-z9)
# Reuses data/global_pop_r6.mbtiles and data/global_pop_r8.mbtiles from v1 run
# Run from project root: bash scripts/process_r5.sh
set -euo pipefail

DATA_DIR="$(dirname "$0")/../data"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "=== Aggregate r6 -> r5 (Python) ==="
# Kontur doesn't publish r5 — aggregate from r6 by summing population per H3 parent
# Requires: pip install h3 geopandas pandas shapely
cd "$(dirname "$0")/.."
python3 scripts/aggregate_r5.py
cd "$DATA_DIR"

echo "=== Tippecanoe r5 (z0-z3) ==="
tippecanoe -Z0 -z3 --force -o global_pop_r5.mbtiles --no-tile-size-limit -l population \
  --detect-longitude-wraparound global_r5.geojsonl

echo "=== Merge r5 + existing r6 + r8 ==="
tile-join --force -o pop_v2.mbtiles \
  global_pop_r5.mbtiles global_pop_r6.mbtiles global_pop_r8.mbtiles

echo "=== Convert to PMTiles ==="
pmtiles convert pop_v2.mbtiles pop_v2.pmtiles

echo ""
echo "Done! Output: data/pop_v2.pmtiles"
echo "To test locally: cp data/pop_v2.pmtiles public/test_pop.pmtiles"
echo "  then update PMTILES_URL comment in main.js if needed"
