#!/usr/bin/env python3
"""
Aggregate r6 Kontur hexagons up to r5 by summing population.
Reads: data/kontur_r6.gpkg (EPSG:3857)
Writes: data/global_r5.geojsonl (EPSG:4326, GeoJSONSeq)

Dependencies: pip install h3 geopandas pandas shapely
"""
import sys
import json
import geopandas as gpd
import pandas as pd
import h3
from shapely.geometry import Polygon

DATA_DIR = "data"
INPUT = f"{DATA_DIR}/kontur_r6.gpkg"
OUTPUT = f"{DATA_DIR}/global_r5.geojsonl"

print("Reading r6 gpkg...", flush=True)
gdf = gpd.read_file(INPUT)

# Kontur gpkg is EPSG:3857 — reproject to 4326 for H3 (lat/lng)
print("Reprojecting to EPSG:4326...", flush=True)
gdf = gdf.to_crs("EPSG:4326")

print(f"Loaded {len(gdf):,} r6 hexagons", flush=True)

# Get centroid of each r6 hex, use it to derive the H3 r5 parent index
print("Computing r5 parent indices...", flush=True)
centroids = gdf.geometry.centroid
gdf["r5_index"] = [
    h3.latlng_to_cell(pt.y, pt.x, 5)
    for pt in centroids
]

# Aggregate: sum population per r5 cell
print("Aggregating population by r5 parent...", flush=True)
agg = gdf.groupby("r5_index", as_index=False)["population"].sum()

print(f"Result: {len(agg):,} r5 hexagons", flush=True)

# Build r5 geometries from H3 index
print("Generating r5 geometries...", flush=True)
def h3_to_polygon(h3_index):
    boundary = h3.cell_to_boundary(h3_index)  # list of (lat, lng) tuples
    return Polygon([(lng, lat) for lat, lng in boundary])

agg["geometry"] = agg["r5_index"].apply(h3_to_polygon)

# Write as GeoJSONSeq (one feature per line)
print(f"Writing {OUTPUT}...", flush=True)
with open(OUTPUT, "w") as f:
    for _, row in agg.iterrows():
        feature = {
            "type": "Feature",
            "geometry": row["geometry"].__geo_interface__,
            "properties": {"population": int(row["population"])},
        }
        f.write(json.dumps(feature) + "\n")

print(f"Done: {OUTPUT}")
