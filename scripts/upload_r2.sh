#!/usr/bin/env bash
# Phase D: Upload final PMTiles to Cloudflare R2
# Prerequisites: npm install -g wrangler && wrangler login
set -euo pipefail

BUCKET="population-tiles"
FILE="$(dirname "$0")/../data/pop_final.pmtiles"
OBJECT="pop_final.pmtiles"

echo "=== Creating R2 bucket (skip if already exists) ==="
wrangler r2 bucket create "$BUCKET" || true

echo "=== Uploading $FILE ==="
wrangler r2 object put "$BUCKET/$OBJECT" --file "$FILE"

echo ""
echo "Upload complete."
echo "Next steps:"
echo "  1. In Cloudflare dashboard → R2 → $BUCKET → Settings → enable Public R2.dev subdomain"
echo "  2. Set CORS policy to allow GET with headers: Range, If-Match, If-None-Match"
echo "  3. Update PMTILES_URL in main.js with the public R2.dev URL"
