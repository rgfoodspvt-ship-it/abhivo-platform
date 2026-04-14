# Session Summary — April 13, 2026

## Scraper Status
- **Sonipat (18)**: 227,248 records, 350 villages — DONE, V3 parsed: 280,659
- **Gurugram (05)**: 140,813 records, 266 villages — 99% done, NOT parsed
- **Rohtak (16)**: 110,000+ records, 116/147 villages — ACTIVE, ~1,900/hr
- **Faridabad (03)**: 77,862 records, 191 villages — running on other Mac
- **Palwal (21)**: 200+ records, just started — running on other Mac
- District code mapping FIXED: 21=Palwal (was wrongly labeled Panipat), 14=Panipat (was Palwal)

## Shajra — Current State
### Working
- Orange wash fill, black borders, khasra numbers, area (kanal-marla)
- Murabba number red with double underline in largest plot
- Karam dimensions on edges
- Compass top-right
- Heading centered
- V3 shajra-data API for owners, land type, mutations, acquired status
- Owner names NOW showing in table (fixed: uses v3Data instead of broken /map/lookup)
- Plot clipping against acquired polygons
- Duplicate village filter (cluster by median longitude)
- Outlier polygon filter (skip polygons >3x plot span from center)

### Road — Still Needs Work
Current approach: OSM road data (includes trunk/primary/secondary/tertiary/unclassified with 5+ coords)
Issues:
- Many highways tagged as `unclassified` in OSM — not reliably findable
- Road coordinates may fall outside canvas map area
- `inMap` check (100px margin) too tight for edge-of-map roads
- Different villages have different road configurations — no single approach works

### Recommendations for Next Session
1. Combine V3 acquired data + OSM roads — if either source shows a road, draw it
2. Increase inMap margin or remove check entirely
3. Consider fetching roads in GEO coords first, then check if any road point is within 500m of any selected plot (not pixel-based)

## Key Files
- **ShajraCanvas**: `/Users/rgfoods/Documents/abhivo-ai/components/ShajraCanvas.tsx`
- **Shajra page**: `/Users/rgfoods/Documents/abhivo-ai/app/shajra/page.tsx`
- **Frontend**: `/Users/rgfoods/Documents/abhivo-ai/`
- **GCP API**: `/home/rgfoodspvt/land-api/main.py`
- **DB**: postgres @ 10.160.0.4 / 35.200.220.67, LandRecords@2026
- **Deploy**: rsync → build → systemctl restart abhivo-ai
- **Dashboard**: http://34.47.173.239/dashboard
