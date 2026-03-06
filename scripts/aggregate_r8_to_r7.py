#!/usr/bin/env python3
"""Aggregate r8 H3 cells to r7 by summing population, output GeoJSONSeq.

Usage: python3 scripts/aggregate_r8_to_r7.py \
         data/global_r8.geojsonl data/global_r7.geojsonl
"""
import json
import sys
import h3

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} input_r8.geojsonl output_r7.geojsonl", file=sys.stderr)
        sys.exit(1)

    in_path, out_path = sys.argv[1], sys.argv[2]

    # Pass 1: accumulate population keyed by r7 parent
    print("Pass 1: aggregating r8 -> r7 ...", file=sys.stderr)
    pop = {}
    n = 0
    with open(in_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            feat = json.loads(line)
            props = feat['properties']
            h3_r8 = props['h3']
            population = props.get('population') or 0
            parent = h3.cell_to_parent(h3_r8, 7)
            pop[parent] = pop.get(parent, 0) + population
            n += 1
            if n % 1_000_000 == 0:
                print(f"  {n:,} r8 cells processed, {len(pop):,} r7 parents so far", file=sys.stderr)

    print(f"  Total: {n:,} r8 cells -> {len(pop):,} r7 cells", file=sys.stderr)

    # Pass 2: write r7 GeoJSONSeq
    print("Pass 2: writing r7 GeoJSONSeq ...", file=sys.stderr)
    with open(out_path, 'w') as out:
        for h3_r7, total_pop in pop.items():
            if total_pop <= 0:
                continue
            # h3 v4: cells_to_geo returns a GeoJSON-like dict for a set of cells
            # For a single cell boundary use cell_to_boundary (returns lat/lng pairs)
            boundary = h3.cell_to_boundary(h3_r7)  # list of (lat, lng) tuples
            # GeoJSON uses [lng, lat]
            coords = [[lng, lat] for lat, lng in boundary]
            coords.append(coords[0])  # close ring
            feature = {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {"h3": h3_r7, "population": total_pop},
            }
            out.write(json.dumps(feature) + '\n')

    print(f"Done. Output: {out_path}", file=sys.stderr)

if __name__ == '__main__':
    main()
