# ABHIVO AI — CLAUDE CODE WORKING SPECIFICATION
# Updated: April 2026
# READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.

---

## CRITICAL: WHAT ALREADY EXISTS — DO NOT REBUILD

The platform is LIVE at http://34.47.173.239
Frontend: Next.js on GCP port 3001
Backend: FastAPI/uvicorn on GCP port 8000
Database: PostgreSQL on GCP (10.160.0.4 internal)
Proxy: Nginx on port 80

### Working Features (DO NOT TOUCH unless asked)
- /shajra — 2D patwari-style shajra drawing (ShajraCanvas.tsx, rough.js) — has खसरा mode AND खेवट mode
- /map — interactive cadastral map, click plot → owner info
- /nakal — digital jamabandi nakal
- /records — search by owner/khewat/khasra/mutation
- /chat — Hindi/English/Hinglish AI chatbot (Claude Haiku)
- /dashboard — live scraper stats

### Database Tables (PostgreSQL + PostGIS)
- land_records2 — raw scraped HTML (one row per khewat HTML page)
- land_records_v3 — parsed: village, tehsil, district, khewat_no (one row per khewat)
- land_owners_v3 — owner_name, father_name, share, relation, record_id FK
- land_khasra_v3 — murabba_no, khasra_no, area_kanal, area_marla, land_type, irrigation, record_id FK
- land_mutations_v3 — mutation_type, number, pending, amount, record_id FK
- khasra_polygons — khasra_no, khewat_no (=murabba), hindi_village, district_code, geojson (TEXT), geom (geometry 4326)

### PostGIS IS installed and enabled
PostGIS 3.2 confirmed working. Use spatial SQL freely throughout the codebase.

Geometry column: geom (type: geometry, SRID: 4326) in khasra_polygons
Old text column: geojson — still exists but geom is the source of truth for spatial ops

Auto-computed columns now available on every row:
- area_sqm — area in square metres (original HSAC column, not PostGIS)
- area_sqyd — area in square yards (original HSAC column)
- area_kanal_calc — area in kanal (PostGIS computed: 1 kanal = 505.857 sqm)
- centroid_lat, centroid_lon — polygon centre point (PostGIS computed)
- perimeter_m — boundary length in metres (PostGIS computed)

Spatial index: GIST index on geom column (fast queries confirmed)

Rules for all new code going forward:
- Area: use area_sqyd column directly, or ST_Area(geom::geography) * 1.19599
- Distance: use ST_Distance(geom::geography, target::geography)
- Nearby parcels: use ST_DWithin(geom::geography, target::geography, radius_metres)
- Adjacent parcels: use ST_Touches(geom, other_geom) or ST_DWithin with 2m radius
- Return geometry to frontend: use ST_AsGeoJSON(geom) not the old text column
- Nearest neighbour (fast): use ORDER BY geom <-> target_point LIMIT 1
- Edge dimensions: use ST_NPoints, ST_PointN, ST_ExteriorRing on geom column
- Polygon centroid: use centroid_lat and centroid_lon columns directly

### Data Status
- Sonipat: COMPLETE — 7,32,951 polygons, 317 villages, 2,80,659 V3 parsed records
- Gurugram: 1,40,813 scraped, V3 parsing NOT done, no polygons
- Rohtak: ~1,38,000 scraped, V3 parsing NOT done, no polygons
- Faridabad: 77,862 scraped, V3 parsing NOT done, no polygons
- Palwal: ~5,000 scraped, not complete
- Hisar/Ambala/Rewari/Bhiwani/Fatehabad/Kaithal: polygons only, no scraping

---

## KHASRA vs KHEWAT — IMPORTANT DISTINCTION

Khasra = one land parcel = one polygon = one shape on the map
Khewat = ownership account = groups multiple khasras owned by same person/family
One khewat can contain khasras spread across different murabbas

All features must work for BOTH khasra and khewat input.
When khewat is the input: fetch all associated khasras, render them together.

---

## FEATURE 1: KHEWAT-LEVEL SHAJRA DRAWING — COMPLETE

### Khewat Shajra — COMPLETE
Endpoint: GET /map/khewat-shajra-data?village=X&district_code=18&khewat_no=121
Frontend: /shajra has toggle — खसरा mode and खेवट mode
Works for any khewat number in Sonipat district.
Returns all khasra polygons for the khewat with combined area, owner list, PostGIS geometry.
Khasras without polygon data shown as warning below the map.

## FEATURE 1 (original spec for reference): KHEWAT-LEVEL SHAJRA DRAWING

Current shajra works at khasra level only. Add khewat-level mode.

### New API endpoint
GET /map/khewat-shajra-data
Params: village (str), district_code (str), khewat_no (str)

```sql
SELECT 
    p.geometry,
    p.khasra_no,
    p.murabba_no,
    k.area_kanal,
    k.area_marla,
    k.land_type,
    k.irrigation,
    r.khewat_no,
    r.village_name,
    r.tehsil_name,
    r.district_name
FROM khasra_polygons p
JOIN land_khasra_v3 k 
    ON p.hindi_village = k.village_name 
    AND TRIM(CAST(p.murabba_no AS TEXT)) = TRIM(CAST(k.murabba_no AS TEXT))
    AND TRIM(CAST(p.khasra_no AS TEXT)) = TRIM(CAST(k.khasra_no AS TEXT))
JOIN land_records_v3 r ON k.record_id = r.id
WHERE r.village_name = :village
    AND r.khewat_no = :khewat_no
    AND r.district_code = :district_code
```

Also return separately:
- All owners: SELECT * FROM land_owners_v3 WHERE record_id = r.id
- All mutations: SELECT * FROM land_mutations_v3 WHERE record_id = r.id
- Total area in kanal-marla
- Count of khasras with polygon vs without polygon

### Frontend changes — /shajra page
Add mode toggle: "खसरा चुनें" | "खेवट / मालिकान"

Khewat mode UI:
1. Village dropdown (existing component)
2. Khewat number input (text search against land_records_v3)
3. Submit → fetch from new API → pass polygon array to ShajraCanvas

ShajraCanvas changes for khewat mode:
- Header: "नक्ल शजरा खेवट संख्या [X] ग्राम [Y] तहसील [Z] जिला [W]"
- Show all co-owner names below header
- Auto-fit bounding box to all khasras (they may be geographically scattered)
- Each polygon labeled: khasra number + murabba number
- Total area in footer
- List below canvas: khasras that had no polygon geometry

---

## FEATURE 2: 3D BIRD'S-EYE MAP VIEW

New interactive 3D view for any khasra or khewat.
Camera descends from high altitude, lands on plot, orbits slowly.
Highlighted polygon: green fill, gold outline.
Adjacent parcels: faint white outlines for context.

### Technology: Mapbox GL JS with terrain
Use mapbox.terrain-v2 for elevation. Style: satellite-v9.
Works for both single khasra and multiple khasras (khewat).

### New API endpoint
GET /map/3d-data
Params: village, district_code, khasra_no OR khewat_no

Returns:
```json
{
  "polygons": [...GeoJSON features with all properties...],
  "centroid": {"lat": 28.9, "lon": 77.0},
  "bbox": [minLon, minLat, maxLon, maxLat],
  "dimensions": [
    {
      "edge_index": 0,
      "length_m": 18.4,
      "length_karam": 9.2,
      "midpoint_lat": 28.901,
      "midpoint_lon": 77.001,
      "bearing": 45.2,
      "is_road_facing": true
    }
  ],
  "adjacent_polygons": {...GeoJSON FeatureCollection...},
  "metadata": {
    "khasra_no": "142/3",
    "khewat_no": "45",
    "village": "kundli",
    "owner_names": ["Ramesh Kumar", "Suresh Kumar"],
    "total_area_sqyd": 200.4,
    "land_type": "residential"
  }
}
```

Compute dimensions in Python — pure Haversine math, no PostGIS:
```python
from math import radians, sin, cos, sqrt, atan2, degrees
import json

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = radians(lat2-lat1)
    dlon = radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def get_dimensions(polygon_geojson_text):
    coords = json.loads(polygon_geojson_text)['coordinates'][0]
    edges = []
    for i in range(len(coords)-1):
        lon1,lat1 = coords[i]
        lon2,lat2 = coords[i+1]
        length_m = haversine_m(lat1,lon1,lat2,lon2)
        length_karam = length_m / 5.0292  # 1 karam = 5.0292 metres
        mid_lat = (lat1+lat2)/2
        mid_lon = (lon1+lon2)/2
        bearing = degrees(atan2(lon2-lon1, lat2-lat1)) % 360
        edges.append({
            'edge_index': i,
            'length_m': round(length_m,2),
            'length_karam': round(length_karam,2),
            'midpoint_lat': mid_lat,
            'midpoint_lon': mid_lon,
            'bearing': round(bearing,1)
        })
    return edges
```

### Frontend component: BirdsEyeView.tsx
New tab on /shajra page: "2D नक्शा" | "3D दृश्य"

```typescript
// Mapbox GL JS map, pitch:60, bearing:-20
// terrain source: mapbox://mapbox.terrain-v2
// fill layer: selected polygon(s) green rgba(46,125,82,0.4)
// line layer: selected polygon(s) gold #C9922A 2.5px
// line layer: adjacent polygons white rgba(255,255,255,0.2) 0.8px
// Markers at edge midpoints: dimension labels (length in metres + karam)
// Animation: camera.flyTo centroid → camera.easeTo orbit 180deg over 10s
// Screenshot button: map.getCanvas().toBlob() → download PNG
// This PNG saved as Scene 1 background in video (Feature 4)
```

---

## FEATURE 3: ML LAND VALUATION

Show estimated price range for any khasra or khewat.
Display: ₹X L – ₹Y L · ₹/sq yard · vs locality average · Confidence

### Step 1: Build khasra_features table (do this first)
```sql
CREATE TABLE IF NOT EXISTS khasra_features (
    khasra_no TEXT,
    murabba_no TEXT,
    village_name TEXT,
    district_code TEXT,
    area_sqm FLOAT,
    area_sqyd FLOAT,
    perimeter_m FLOAT,
    road_frontage_m FLOAT,
    is_corner_plot BOOLEAN,
    land_type TEXT,
    num_owners INT,
    has_mutation BOOLEAN,
    has_acquisition BOOLEAN,
    dist_highway_m FLOAT,
    dist_metro_m FLOAT,
    dist_school_m FLOAT,
    dist_hospital_m FLOAT,
    dist_bus_stop_m FLOAT,
    nearest_school_name TEXT,
    nearest_school_lat FLOAT,
    nearest_school_lon FLOAT,
    nearest_metro_name TEXT,
    nearest_metro_lat FLOAT,
    nearest_metro_lon FLOAT,
    nearest_highway_name TEXT,
    nearest_highway_lat FLOAT,
    nearest_highway_lon FLOAT,
    circle_rate_sqyd FLOAT,
    zone_type TEXT,
    estimated_price_sqyd FLOAT,
    price_confidence TEXT,
    computed_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (khasra_no, murabba_no, village_name, district_code)
);
```

### Step 2: OSM POI computation script
File: scripts/compute_poi_features.py
- Parse GeoJSON text from khasra_polygons → shapely polygon (pure Python, no PostGIS)
- Download OSM data for Sonipat once using osmnx → cache as GeoPackage
- For each polygon: compute centroid, find nearest POIs using shapely
- Batch 500 at a time, show progress
- Store in khasra_features

### Step 3: Valuation API
GET /valuation/{district_code}/{village}/{khasra_no}
- Look up khasra_features for this parcel
- If estimated_price_sqyd exists: use ML model prediction
- If not: use circle_rate × multiplier (1.4-2.5 depending on zone/type)
- Return range, median, confidence, locality average

### Step 4: Dealer estimate collection
New page: /admin/estimate (password protected)
Registered dealers submit: village + khewat/khasra + price estimate
Admin approves → populates estimated_price_sqyd
Need 100+ estimates for Sonipat before training ML model

---

## FEATURE 4: AI VIDEO GENERATOR

Auto-generate property marketing video from khasra or khewat selection.

### Agent questionnaire — /video/create
6 fields only:
1. Property selector: village + khewat OR khasra (reuse existing dropdowns)
2. Property type: Residential Plot | Agricultural | Commercial | Farm
3. Asking price in ₹ lakhs
4. Notable features (checkboxes): Corner plot, Near highway, Park facing,
   DDJAY eligible, Boundary wall, Electricity, Borewell, Paved road access
5. Agent name
6. Agent phone
Language: Hindi | English toggle

### Video scenes (Remotion components)
```
Scene 1 (0-8s):   MapFlyover.tsx
  - Background: Mapbox Static satellite PNG from /map/3d-data bbox
  - CSS: Ken Burns zoom from 0.9 to 1.15 scale over 8s
  - Overlay: khasra polygon SVG fades in (green + gold outline)
  - Title text: village name fades in, bottom of screen

Scene 2 (8-14s):  BoundaryDraw.tsx
  - SVG polygon path animates: stroke-dashoffset 100% → 0% over 3s
  - Fill fades in: green rgba(46,125,82,0.3)
  - Road-facing edge draws in gold, separate animation
  - Dimension labels appear per edge (same data as ShajraCanvas uses)
  - Area label appears in centre: "200 वर्ग गज"

Scene 3 (14-20s): POIArrows.tsx
  - Map background zooms out to show 3km radius
  - 3 animated dashed arrows from centroid toward POI coordinates
  - Each arrow: draws itself in 1s → label appears at end
  - Highway arrow: gold — "KMP Expressway — 1.4 km"
  - Metro arrow: blue — "Kundli Metro — 800 m"
  - School arrow: green — "St Mary's School — 600 m"
  - Distances from khasra_features table (already computed)

Scene 4 (20-26s): PropertyCard.tsx
  - Dark card slides up from bottom
  - Grid: Area | Zone | Land type | Price
  - Notable features as pills
  - Agent name + phone
  - Abhivo logo top-right

Scene 5 (26-32s): CTAScene.tsx
  - Abhivo full logo
  - "abhivo.com पर और ज़मीन देखें"
  - Fade to black
```

### Remotion setup
```bash
mkdir video_renderer && cd video_renderer
npx create-remotion-app . --template=blank
npm install
# Add to package.json remotion scripts:
# "render": "npx remotion render PropertyVideo"
```

### Backend pipeline
```python
# backend/services/video_generator.py

async def generate_video(job_id: str, params: dict):
    # 1. Fetch data
    khasra_data = await get_khasra_or_khewat_data(params)
    features = await get_khasra_features(params)
    
    # 2. Mapbox static satellite image
    satellite_png = await fetch_mapbox_static(
        bbox=khasra_data['bbox'],
        polygon_geojson=khasra_data['polygons']
    )
    save to /tmp/{job_id}_sat.png
    
    # 3. Render Remotion video
    props = {**khasra_data, **features, **params, 
             'satellite_image_path': f'/tmp/{job_id}_sat.png'}
    
    subprocess.run([
        'npx', 'remotion', 'render', 'PropertyVideo',
        f'/tmp/{job_id}_raw.mp4',
        f'--props={json.dumps(props)}'
    ])
    
    # 4. ElevenLabs voiceover
    script = generate_hindi_script(props)
    voice_mp3 = await elevenlabs_tts(script)
    save to /tmp/{job_id}_voice.mp3
    
    # 5. FFmpeg mix
    subprocess.run([
        'ffmpeg', '-y',
        '-i', f'/tmp/{job_id}_raw.mp4',
        '-i', f'/tmp/{job_id}_voice.mp3',
        '-i', 'assets/music/background_1.mp3',
        '-filter_complex', '[1:a][2:a]amix=inputs=2:duration=first:weights=4 1[a]',
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac',
        f'/tmp/{job_id}_final.mp4'
    ])
    
    # 6. Save URL + update job status
    await update_job_status(job_id, 'done', f'/videos/{job_id}_final.mp4')
```

### Hindi script template
```python
def generate_hindi_script(d: dict) -> str:
    p = []
    p.append(f"{d['village_name']} में {d['area_sqyd']:.0f} वर्ग गज का {d['property_type']} उपलब्ध है।")
    if d.get('is_corner_plot'): p.append("यह कोना प्लॉट है।")
    if d.get('road_frontage_m'): p.append(f"सड़क से {d['road_frontage_m']:.0f} मीटर का फ्रंटेज है।")
    if d.get('dist_highway_m',9999) < 3000: p.append(f"{d['nearest_highway_name']} केवल {d['dist_highway_m']:.0f} मीटर दूर।")
    if d.get('dist_metro_m',9999) < 5000: p.append(f"नजदीकी स्टेशन {d['nearest_metro_name']}, {d['dist_metro_m']:.0f} मीटर दूर।")
    if d.get('dist_school_m',9999) < 2000: p.append(f"{d['nearest_school_name']} स्कूल {d['dist_school_m']:.0f} मीटर दूर।")
    p.append(f"कीमत: {d['asking_price_lakh']} लाख रुपये।")
    p.append(f"संपर्क: {d['agent_name']}, {d['agent_phone']}।")
    return " ".join(p)
```

### Job queue (Celery + Redis)
```python
# backend/tasks.py
from celery import Celery
app = Celery('abhivo', broker=os.getenv('REDIS_URL'))

@app.task
def generate_video_task(job_id: str, params: dict):
    asyncio.run(generate_video(job_id, params))
```

---

## SCRAPING — DO NOT BREAK

Scraper runs on Mac (Playwright + ChatGPT captcha). Writes to land_records2 on GCP.
V3 parser converts land_records2 → the 4 v3 tables.

Priority for V3 parsing: Gurugram (1,40,813 records ready) → Rohtak → Faridabad

---

## ENV VARIABLES TO ADD

```
MAPBOX_TOKEN=pk.xxxx          # mapbox.com free tier
ELEVENLABS_KEY=xxxx            # elevenlabs.io free tier
REDIS_URL=redis://localhost:6379/0
```

---

## BUILD ORDER

### Sprint 1 (Now — 2 weeks)
1. Add GET /map/khewat-shajra-data endpoint
2. Add khewat mode toggle + UI to /shajra frontend
3. Test with 10 real khewat numbers from Sonipat
4. Add GET /map/3d-data endpoint (Python Haversine dimensions)
5. Build BirdsEyeView.tsx (Mapbox GL JS 3D, pitch 60)

### Sprint 2 (3-4 weeks)
6. Run compute_poi_features.py for Sonipat
7. Build valuation API (circle rate fallback initially)
8. Show valuation card on shajra + map popup
9. Run V3 parser on Gurugram raw data

### Sprint 3 (4-6 weeks)
10. Set up Remotion video_renderer/
11. Build 5 scene components
12. Build video generation pipeline + Celery + FFmpeg
13. Build /video/create agent form
14. End-to-end test: form → MP4 download

---

## QUESTIONS TO ASK FOUNDER BEFORE STARTING

1. In ShajraCanvas.tsx — are edge dimensions (karam lengths) computed in 
   the frontend JS or in the Python backend? Need to reuse that logic.

2. Exact column name for khewat number in land_records_v3? 
   Is it khewat_no, murabba_no, or something else?

3. Does /map/polygons currently return adjacent khasra polygons or just 
   the ones for the selected village?

4. Is there already a khasra number normalisation function somewhere? 
   Which file?

5. What column stores the raw geometry in khasra_polygons? 
   Is it `geometry`, `geojson`, `polygon_data`, or something else?

Do not assume. Read existing code files before writing new code.
Match existing code patterns, naming conventions, and API response formats.
