#!/usr/bin/env bash
# Full global pipeline — r6 (z3-z5) + r7 (z6-z9)
# Run from project root: bash scripts/process_global.sh
set -euo pipefail

DATA_DIR="$(dirname "$0")/../data"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "=== Tippecanoe per resolution ==="

# r6: z3-z5 (~36 km² cells, low-mid zoom)
tippecanoe -Z3 -z5 --force -o global_pop_r6_v2.mbtiles --no-tile-size-limit --no-feature-limit -l population \
  --detect-longitude-wraparound global_r6.geojsonl

# r7: z6-z9 (~5.2 km² cells, mid-high zoom)
tippecanoe -Z6 -z9 --force -o global_pop_r7_v2.mbtiles --no-tile-size-limit --no-feature-limit -l population \
  --detect-longitude-wraparound global_r7.geojsonl

echo "=== Merge ==="
tile-join --force --no-tile-size-limit -o pop_v6.mbtiles \
  global_pop_r6_v2.mbtiles global_pop_r7_v2.mbtiles

echo "=== Convert to PMTiles ==="
pmtiles convert pop_v6.mbtiles pop_v6.pmtiles

echo ""
echo "Done! Output: data/pop_v6.pmtiles"
echo "Next: cp data/pop_v6.pmtiles public/test_pop.pmtiles"
