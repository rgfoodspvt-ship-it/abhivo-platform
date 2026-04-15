'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getDistricts, getTehsils, getVillages, getPolygons, lookupKhasra, fetchAPI } from '@/lib/api';
import ShajraCanvas from '@/components/ShajraCanvas';
import dynamic from 'next/dynamic';
const BirdsEyeView = dynamic(() => import('@/components/BirdsEyeView'), { ssr: false });

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://34.47.173.239';

interface PolygonFeature {
  geometry: { coordinates: any; type: string };
  properties: { khasra_no: string; khewat_no: string; area_acres?: number; village?: string; tehsil?: string; [key: string]: any };
}

function getRing(f: PolygonFeature): number[][] | null {
  const g = f.geometry;
  if (!g?.coordinates) return null;
  if (g.type === 'MultiPolygon') return g.coordinates[0]?.[0] || null;
  return g.coordinates[0] || null;
}

export default function ShajraPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const [district, setDistrict] = useState('सोनीपत');
  const [tehsil, setTehsil] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [tehsils, setTehsils] = useState<string[]>([]);
  const [villageNames, setVillageNames] = useState<string[]>([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [features, setFeatures] = useState<PolygonFeature[]>([]);
  const [selected, setSelected] = useState<Map<string, PolygonFeature>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [showReport, setShowReport] = useState(false);

  // Khewat mode
  const [mode, setMode] = useState<'khasra' | 'khewat'>('khasra');
  const [khewatNo, setKhewatNo] = useState('');
  const [khewatData, setKhewatData] = useState<any>(null);
  const [khewatLoading, setKhewatLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'2d' | '3d' | 'video'>('2d');
  const [data3D, setData3D] = useState<any>(null);
  const [screenshot3D, setScreenshot3D] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState('');
  const [videoStatus, setVideoStatus] = useState('');
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [selMurabba, setSelMurabba] = useState('');
  const [ownerData, setOwnerData] = useState<Record<string, any>>({});
  const [neighborData, setNeighborData] = useState<{name:string;direction:string}[]>([]);

  // Murabba stats from lightweight API
  const [murabbaList, setMurabbaList] = useState<{murabba:string;khasras:number;acres:number}[]>([]);
  const filteredKhasras = selMurabba ? features.filter(f => f.properties.khewat_no === selMurabba) : [];

  // Viewport-based polygon loading
  const loadedIdsRef = useRef<Set<number>>(new Set());
  const allFeaturesRef = useRef<PolygonFeature[]>([]);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportLoading, setViewportLoading] = useState(false);
  const selectedVillageRef = useRef(selectedVillage);
  // Track the geographic center of the selected village to handle duplicate village names
  const villageCenterRef = useRef<{lat: number; lon: number} | null>(null);

  // Keep village ref in sync
  useEffect(() => { selectedVillageRef.current = selectedVillage; }, [selectedVillage]);

  // Load districts
  useEffect(() => { getDistricts().then(d => setDistricts(d.districts)); }, []);
  // Tehsils — filter Hindi only
  useEffect(() => {
    if (district) getTehsils(district).then(d => {
      setTehsils(d.tehsils.filter(t => !/^[A-Za-z]/.test(t)));
    });
  }, [district]);
  // Villages
  useEffect(() => {
    if (district && tehsil) getVillages(district, tehsil).then(d => setVillageNames(d.villages));
  }, [district, tehsil]);

  // Viewport polygon loader — REPLACES source each time (no accumulation)
  const loadViewportPolygons = useCallback(async (map: any) => {
    if (!map) return;
    const zoom = Math.floor(map.getZoom());
    if (zoom < 12) return;
    const bounds = map.getBounds();
    const url = `${BASE}/map/polygons/viewport?min_lat=${bounds.getSouth()}&min_lon=${bounds.getWest()}&max_lat=${bounds.getNorth()}&max_lon=${bounds.getEast()}&zoom=${zoom}`;
    setViewportLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      const mColors = ['#F59E0B','#FBBF24','#B47708','#D4A017','#E8B810','#C49A08','#DBA520','#F0C420',
        '#E8A317','#D4940A','#F5B50B','#C8A208','#E0B020','#D09010','#F0A808','#C4A010'];
      const viewportFeatures: PolygonFeature[] = (data.features || []).map((f: any) => {
        let h = 0;
        const m = f.properties.khewat_no || '0';
        for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) & 0xffff;
        f.properties._color = mColors[h % mColors.length];
        if (!f.properties.area_acres && f.properties.area_sqyd) {
          f.properties.area_acres = f.properties.area_sqyd / 4840;
        }
        if (!f.properties.village && f.properties.hindi_village) {
          f.properties.village = f.properties.hindi_village;
        }
        return f;
      });
      // Replace — only current viewport polygons exist in the source
      allFeaturesRef.current = viewportFeatures;
      setFeatures(viewportFeatures);
      const src = map.getSource('plots');
      if (src) {
        src.setData({ type: 'FeatureCollection', features: viewportFeatures });
      }
    } catch (e) { console.warn('Viewport load error:', e); }
    setViewportLoading(false);
  }, []);

  // Debounced viewport load trigger
  const scheduleViewportLoad = useCallback((map: any) => {
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => loadViewportPolygons(map), 300);
  }, [loadViewportPolygons]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    import('maplibre-gl/dist/maplibre-gl.css');
    import('maplibre-gl').then(maplibregl => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0F0D0A' } }] },
        center: [76.9, 29.0], zoom: 8,
      });
      map.on('load', () => {
        // Satellite tiles
        map.addSource('satellite', { type: 'raster', tiles: [
          'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        ], tileSize: 256, maxzoom: 20 });
        map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 1 } });
        // Bhuvan village boundaries
        map.addSource('bhuvan-vill', { type: 'raster', tiles: [
          'https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms?service=WMS&version=1.1.1&request=GetMap&layers=basemap:HR_Vill&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true'
        ], tileSize: 256 });
        map.addLayer({ id: 'bhuvan-vill-layer', type: 'raster', source: 'bhuvan-vill', paint: { 'raster-opacity': 0.3 } });
        // Bhuvan roads
        map.addSource('bhuvan-roads', { type: 'raster', tiles: [
          'https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms?service=WMS&version=1.1.1&request=GetMap&layers=mmi:HR_ROAD_NETWORK_Q4_2022&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true'
        ], tileSize: 256 });
        map.addLayer({ id: 'bhuvan-roads-layer', type: 'raster', source: 'bhuvan-roads', paint: { 'raster-opacity': 0.35 } });

        // ── Permanent polygon layers (initially empty) ──
        map.addSource('plots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'plots-fill', type: 'fill', source: 'plots', paint: {
          'fill-color': ['coalesce', ['get', '_color'], '#F59E0B'],
          'fill-opacity': 0.25
        }});
        map.addLayer({ id: 'plots-line', type: 'line', source: 'plots', paint: {
          'line-color': '#F5F0E8', 'line-width': 1.5, 'line-opacity': 0.7
        }});
        map.addLayer({ id: 'plots-labels', type: 'symbol', source: 'plots',
          layout: {
            'text-field': ['concat', ['get', 'khewat_no'], '//', ['get', 'khasra_no']],
            'text-size': ['interpolate', ['linear'], ['zoom'], 13, 7, 16, 11, 18, 15],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#F5F0E8',
            'text-halo-color': 'rgba(15,13,10,0.8)',
            'text-halo-width': 1.5,
          }
        });

        // ── Selected plots layers ──
        map.addSource('selected-plots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'sel-glow', type: 'line', source: 'selected-plots', paint: {
          'line-color': '#F59E0B', 'line-width': 6, 'line-opacity': 0.3, 'line-blur': 4
        }});
        map.addLayer({ id: 'sel-fill', type: 'fill', source: 'selected-plots', paint: {
          'fill-color': '#FBBF24', 'fill-opacity': 0.6
        }});
        map.addLayer({ id: 'sel-line', type: 'line', source: 'selected-plots', paint: {
          'line-color': '#F59E0B', 'line-width': 4, 'line-opacity': 1.0
        }});
        map.addLayer({ id: 'sel-labels', type: 'symbol', source: 'selected-plots',
          layout: {
            'text-field': ['concat', ['get', 'khewat_no'], '//', ['get', 'khasra_no']],
            'text-size': 14, 'text-allow-overlap': true, 'text-font': ['Open Sans Bold'],
          },
          paint: { 'text-color': '#F59E0B', 'text-halo-color': 'rgba(15,13,10,0.9)', 'text-halo-width': 2 }
        });

        // ── Click handler for polygon selection ──
        // Key is ALWAYS the database polygon id — globally unique
        // Uses geographic proximity to handle duplicate village names (e.g., खुर्मपुर in 2 tehsils)
        map.on('click', 'plots-fill', (e: any) => {
          const f = e.features?.[0];
          if (!f?.properties || !f?.geometry) return;
          const pid = f.properties.id;
          if (!pid) return;
          const clickVillage = f.properties.hindi_village || f.properties.village || '';
          if (!clickVillage) return;

          // Get click location for proximity check
          const clickLat = parseFloat(f.properties.centroid_lat) || e.lngLat.lat;
          const clickLon = parseFloat(f.properties.centroid_lon) || e.lngLat.lng;

          const curVillage = selectedVillageRef.current;
          const center = villageCenterRef.current;
          const key = String(pid);

          const feature: PolygonFeature = {
            geometry: f.geometry,
            properties: { ...f.properties, area_acres: f.properties.area_acres || (f.properties.area_sqyd ? f.properties.area_sqyd / 4840 : 0) }
          };

          // Check if this click is near the current selection center (within ~5km = 0.05°)
          const isNearCurrent = center
            ? (Math.abs(clickLat - center.lat) < 0.05 && Math.abs(clickLon - center.lon) < 0.05)
            : false;

          // Different village OR same village name but far away → clear and start fresh
          const isDifferentLocation = curVillage && (
            clickVillage !== curVillage || (center && !isNearCurrent)
          );

          if (isDifferentLocation) {
            setSelectedVillage(clickVillage);
            selectedVillageRef.current = clickVillage;
            villageCenterRef.current = { lat: clickLat, lon: clickLon };
            setSelMurabba('');
            const fresh = new Map<string, PolygonFeature>();
            fresh.set(key, feature);
            setSelected(fresh);
            return;
          }

          // First click → set village and center
          if (!curVillage) {
            setSelectedVillage(clickVillage);
            selectedVillageRef.current = clickVillage;
            villageCenterRef.current = { lat: clickLat, lon: clickLon };
          }

          // Toggle selection
          setSelected(prev => {
            const n = new Map(prev);
            if (n.has(key)) n.delete(key);
            else n.set(key, feature);
            return n;
          });
        });

        // Hover handlers
        map.on('mouseenter', 'plots-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'plots-fill', () => { map.getCanvas().style.cursor = ''; });

        // Popup on hover
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
        map.on('mousemove', 'plots-fill', (e: any) => {
          const f = e.features?.[0];
          if (!f) return;
          const sqyd = parseFloat(f.properties.area_sqyd) || 0;
          const k = Math.floor(sqyd / 605.857), m = Math.round((sqyd / 605.857 % 1) * 20);
          const village = f.properties.hindi_village || '';
          popup.setLngLat(e.lngLat).setHTML(
            `<div style="font-size:12px;line-height:1.4;background:#1A1714;color:#F5F0E8;padding:8px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.15)">
              <strong style="color:#F59E0B">${f.properties.khewat_no}//${f.properties.khasra_no}</strong><br>
              ${k} कनाल ${m} मरला${village ? `<br><span style="color:#9C8F7D;font-size:10px">${village}</span>` : ''}
            </div>`
          ).addTo(map);
        });
        map.on('mouseleave', 'plots-fill', () => popup.remove());

        // ── Viewport-based loading on pan/zoom ──
        map.on('moveend', () => scheduleViewportLoad(map));
      });
      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      setMapObj(map);
    });
  }, [scheduleViewportLoad]);

  // Zoom to murabba when selected
  useEffect(() => {
    if (!mapObj || !selMurabba || !features.length) return;
    const mFeats = features.filter(f => f.properties.khewat_no === selMurabba);
    if (!mFeats.length) return;
    const coords = mFeats.flatMap(f => getRing(f) || []);
    if (coords.length) {
      const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      mapObj.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 17 });
    }
    // Highlight murabba plots
    if (mapObj.getLayer('plots-fill')) {
      mapObj.setPaintProperty('plots-fill', 'fill-color', ['case',
        ['==', ['get', '_selected'], 1], '#FBBF24',
        ['get', '_color']
      ]);
      mapObj.setPaintProperty('plots-fill', 'fill-opacity', ['case',
        ['==', ['get', '_selected'], 1], 0.65,
        ['==', ['get', 'khewat_no'], selMurabba], 0.4,
        0.08
      ]);
    }
    if (mapObj.getLayer('plots-line')) {
      mapObj.setPaintProperty('plots-line', 'line-color', ['case',
        ['==', ['get', '_selected'], 1], '#F59E0B',
        '#F5F0E8'
      ]);
      mapObj.setPaintProperty('plots-line', 'line-width', ['case',
        ['==', ['get', '_selected'], 1], 4, 2
      ]);
      mapObj.setPaintProperty('plots-line', 'line-opacity', ['case',
        ['==', ['get', '_selected'], 1], 1.0,
        ['==', ['get', 'khewat_no'], selMurabba], 1, 0.3
      ]);
    }
  }, [selMurabba, mapObj, features]);

  async function loadVillage(vName: string) {
    if (!mapObj || !vName) return;
    setSelectedVillage(vName); setLoading(true); setLoadingStage('गांव ढूंढ रहे हैं...'); setSelected(new Map()); setSelMurabba('');
    try {
      // Step 1: Load murabba list + neighbors + centroid in parallel
      const [mData, nData, centroid] = await Promise.all([
        fetchAPI<{count:number;murabbas:{murabba:string;khasras:number;acres:number}[]}>(`/map/murabbas?village=${encodeURIComponent(vName)}&district=${encodeURIComponent(district)}`).catch(() => ({count:0, murabbas:[]})),
        fetchAPI<{neighbors:{name:string;direction:string}[]}>(`/map/neighbors?village=${encodeURIComponent(vName)}&district=${encodeURIComponent(district)}`).catch(() => ({neighbors:[]})),
        fetchAPI<{lat:number;lon:number}>(`/map/village-centroid?village=${encodeURIComponent(vName)}&district_code=18`).catch(() => ({lat:29.0, lon:76.9})),
      ]);
      setMurabbaList(mData.murabbas || []);
      setNeighborData(nData.neighbors || []);

      // Step 2: Clear existing polygons and fly to village centroid
      setLoadingStage('नक्शा पर जा रहे हैं...');
      loadedIdsRef.current.clear();
      allFeaturesRef.current = [];
      setFeatures([]);
      const src = mapObj.getSource('plots');
      if (src) src.setData({ type: 'FeatureCollection', features: [] });

      // Set village center for proximity checks
      villageCenterRef.current = { lat: centroid.lat, lon: centroid.lon };

      // Fly to centroid — moveend event will trigger viewport polygon loading
      mapObj.flyTo({ center: [centroid.lon, centroid.lat], zoom: 15, duration: 1500 });

      // Field paths — background load
      setTimeout(async () => { try {
        const pathData = await fetchAPI<{count:number;paths:{from:string;to:string;width_karam:number;coords:number[][];type:string}[]}>(`/map/paths?village=${encodeURIComponent(vName)}&district=${encodeURIComponent(district)}`);
        if (pathData.paths.length) {
          ['field-paths-wide','field-paths-line','field-paths-labels'].forEach(l => { if (mapObj.getLayer(l)) mapObj.removeLayer(l); });
          if (mapObj.getSource('field-paths')) mapObj.removeSource('field-paths');
          const pathFeatures = pathData.paths.map(p => ({
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: p.coords },
            properties: { label: p.type + ' (' + p.width_karam + ' क॰)', width: p.width_karam, type: p.type }
          }));
          mapObj.addSource('field-paths', { type: 'geojson', data: { type: 'FeatureCollection', features: pathFeatures } });
          mapObj.addLayer({ id: 'field-paths-wide', type: 'line', source: 'field-paths', paint: {
            'line-color': ['case', ['<=', ['get', 'width'], 3], '#d4a574', ['<=', ['get', 'width'], 6], '#c4956a', '#a07850'],
            'line-width': ['interpolate', ['linear'], ['get', 'width'], 1, 3, 4, 6, 8, 10],
            'line-opacity': 0.4
          }}, 'plots-fill');
          mapObj.addLayer({ id: 'field-paths-line', type: 'line', source: 'field-paths', paint: {
            'line-color': '#B47708', 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': 0.6
          }}, 'plots-fill');
          mapObj.addLayer({ id: 'field-paths-labels', type: 'symbol', source: 'field-paths',
            layout: { 'text-field': ['get', 'label'], 'text-size': 9, 'symbol-placement': 'line', 'text-allow-overlap': false },
            paint: { 'text-color': '#D4A574', 'text-halo-color': 'rgba(15,13,10,0.7)', 'text-halo-width': 1 }
          });
        }
      } catch (e) { console.log('Paths:', e); } }, 100);

      // Layers are now initialized in map.on('load') — no need to recreate them
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // Select khasra from dropdown
  function selectKhasra(khasraNo: string) {
    if (!khasraNo || !selMurabba) return;
    const curVillage = selectedVillageRef.current || '';
    const feat = allFeaturesRef.current.find(f =>
      f.properties.khasra_no === khasraNo && f.properties.khewat_no === selMurabba
      && f.properties.id
      && (!curVillage || (f.properties.hindi_village || f.properties.village || '') === curVillage));
    if (feat) {
      const key = String(feat.properties.id);
      setSelected(prev => { const n = new Map(prev); n.set(key, feat); return n; });
      if (mapObj && feat.geometry) {
        const coords = getRing(feat) || [];
        const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
        mapObj.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, maxZoom: 18 });
      }
    }
  }

  // V3 enriched data for shajra report
  const [v3Data, setV3Data] = useState<{plots: any[]; acquired: string[]}>({plots: [], acquired: []});

  // Generate report — fetch V3 data + owners
  async function generateReport() {
    setShowReport(true);
    const plots = [...selected.values()];

    // Fetch V3 enriched data (owners, land type, mutations, acquired status)
    const murabbas = [...new Set(plots.map(f => f.properties.khewat_no))].join(',');
    try {
      const v3 = await fetchAPI<{plots: any[]; acquired: string[]}>(`/map/shajra-data?village=${encodeURIComponent(selectedVillage)}&district=${encodeURIComponent(district)}&murabbas=${encodeURIComponent(murabbas)}`);
      setV3Data(v3);
    } catch (e) { console.warn('V3 data fetch failed:', e); }

    // Also fetch individual owner data (fallback)
    const owners: Record<string, any> = {};
    for (let i = 0; i < plots.length; i += 5) {
      const batch = plots.slice(i, i + 5);
      await Promise.all(batch.map(async f => {
        const key = f.properties.khasra_no + '_' + f.properties.khewat_no;
        try {
          const data = await lookupKhasra(f.properties.khasra_no, f.properties.tehsil || tehsil, f.properties.village || selectedVillage, f.properties.khewat_no);
          if (data.found && data.results?.length) owners[key] = data.results[0];
        } catch {}
      }));
      setOwnerData({ ...owners });
    }
  }

  // Khewat mode: search and generate report
  async function searchKhewat() {
    if (!khewatNo || !selectedVillage) return;
    setKhewatLoading(true);
    try {
      const data = await fetchAPI<any>(`/map/khewat-shajra-data?village=${encodeURIComponent(selectedVillage)}&district_code=18&khewat_no=${encodeURIComponent(khewatNo)}`);
      setKhewatData(data);
      // Convert polygons to features for ShajraCanvas
      if (data.polygons?.length) {
        const khewatFeatures: PolygonFeature[] = data.polygons.map((p: any) => ({
          geometry: JSON.parse(p.geometry),
          properties: { khasra_no: p.khasra, khewat_no: p.murabba, area_acres: (p.area_sqyd || 0) / 4840 }
        }));
        // Auto-select all khasras
        const newSelected = new Map<string, PolygonFeature>();
        khewatFeatures.forEach(f => {
          const key = f.properties.khasra_no + '_' + f.properties.khewat_no;
          newSelected.set(key, f);
        });
        setSelected(newSelected);
        setFeatures(prev => [...prev, ...khewatFeatures.filter(kf => !prev.some(pf => pf.properties.khasra_no === kf.properties.khasra_no && pf.properties.khewat_no === kf.properties.khewat_no))]);
        // Build v3Data from khewat response
        const v3Plots = data.polygons.map((p: any) => ({
          murabba: p.murabba, khasra: p.khasra,
          area_kanal: p.area_kanal, area_marla: p.area_marla,
          land_type: p.land_type, owners: data.owners?.map((o: any) => o.name).join(', '),
          acquired: false,
        }));
        setV3Data({ plots: v3Plots, acquired: [] });
        setShowReport(true);
      }
    } catch (e) { console.error('Khewat search failed:', e); }
    setKhewatLoading(false);
  }

  // Generate video
  async function generateVideo() {
    setVideoGenerating(true); setVideoStatus('वीडियो बन रहा है...');
    try {
      const kns = [...selected.values()].map(f => f.properties.khewat_no + '//' + f.properties.khasra_no);
      const res = await fetch('/video/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ village: selectedVillage, district_code: '18', khasra_nos: kns, khewat_no: mode === 'khewat' ? khewatNo : '', asking_price_lakh: 0, property_type: 'कृषि भूमि', language: 'hindi', notable_features: [], agent_name: '', agent_phone: '' })
      });
      const { job_id } = await res.json();
      setVideoJobId(job_id);
      // Poll status
      const poll = setInterval(async () => {
        const sr = await fetch(`/video/status/${job_id}`);
        const st = await sr.json();
        if (st.status === 'done') {
          clearInterval(poll); setVideoStatus('done'); setVideoGenerating(false);
        } else if (st.status === 'failed') {
          clearInterval(poll); setVideoStatus('failed: ' + (st.error || '')); setVideoGenerating(false);
        } else {
          setVideoStatus('वीडियो बन रहा है... (2-3 मिनट)');
        }
      }, 5000);
    } catch (e) { setVideoStatus('Error'); setVideoGenerating(false); }
  }

  // Load 3D data
  async function load3DView() {
    setViewTab('3d');
    setData3D(null); // always re-fetch for current selection
    try {
      let url = '';
      if (mode === 'khewat' && khewatNo && selectedVillage) {
        url = `/map/3d-data?village=${encodeURIComponent(selectedVillage)}&district_code=18&khewat_no=${encodeURIComponent(khewatNo)}`;
      } else if (selected.size > 0) {
        // Send all selected khasras as comma-separated murabba~khasra pairs
        const pairs = [...selected.values()].map(f => `${f.properties.khewat_no}~${f.properties.khasra_no}`).join(',');
        url = `/map/3d-data?village=${encodeURIComponent(selectedVillage)}&district_code=18&khasras=${encodeURIComponent(pairs)}`;
      }
      if (url) {
        const d = await fetchAPI<any>(url);
        setData3D(d);
      }
    } catch (e) { console.error('3D data failed:', e); }
  }

  // Update map selection highlight
  useEffect(() => {
    if (!mapObj) return;
    const selSrc = mapObj.getSource('selected-plots') as any;
    if (selSrc) {
      selSrc.setData({ type: 'FeatureCollection', features: [...selected.values()] });
    }
    const plotsSrc = mapObj.getSource('plots') as any;
    if (!plotsSrc) return;
    // Build set of selected polygon ids for fast lookup
    const selIds = new Set([...selected.values()].map(f => String(f.properties.id || '')).filter(Boolean));
    const mColors = ['#F59E0B','#FBBF24','#B47708','#D4A017','#E8B810','#C49A08','#DBA520','#F0C420',
      '#E8A317','#D4940A','#F5B50B','#C8A208','#E0B020','#D09010','#F0A808','#C4A010'];
    const updatedFeatures = features.map(f => {
      let h = 0;
      const m = f.properties.khewat_no || '0';
      for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) & 0xffff;
      const isSelected = selIds.has(String(f.properties.id || ''));
      return { ...f, properties: { ...f.properties, _color: mColors[h % mColors.length], _selected: isSelected ? 1 : 0 } };
    });
    plotsSrc.setData({ type: 'FeatureCollection', features: updatedFeatures });
    if (mapObj.getLayer('plots-fill')) {
      mapObj.setPaintProperty('plots-fill', 'fill-color', ['case',
        ['==', ['get', '_selected'], 1], '#FBBF24', ['get', '_color']
      ]);
      mapObj.setPaintProperty('plots-fill', 'fill-opacity', ['case',
        ['==', ['get', '_selected'], 1], 0.65,
        selMurabba ? ['case', ['==', ['get', 'khewat_no'], selMurabba], 0.4, 0.08] : 0.25
      ]);
    }
    if (mapObj.getLayer('plots-line')) {
      mapObj.setPaintProperty('plots-line', 'line-color', ['case',
        ['==', ['get', '_selected'], 1], '#F59E0B', '#F5F0E8'
      ]);
      mapObj.setPaintProperty('plots-line', 'line-width', ['case',
        ['==', ['get', '_selected'], 1], 4, 2
      ]);
      mapObj.setPaintProperty('plots-line', 'line-opacity', ['case',
        ['==', ['get', '_selected'], 1], 1.0,
        selMurabba ? ['case', ['==', ['get', 'khewat_no'], selMurabba], 1, 0.3] : 0.7
      ]);
    }
  }, [selected, mapObj, features, selMurabba]);

  const selectedPlots = [...selected.values()];
  const selIds = new Set(selectedPlots.map(f => String(f.properties.id || '')).filter(Boolean));
  const selectedMurabbas = new Set(selectedPlots.map(f => f.properties.khewat_no));
  const reportVillage = selectedVillage || selectedPlots[0]?.properties?.hindi_village || selectedPlots[0]?.properties?.village || '';
  const reportFeatures = features.filter(f =>
    selectedMurabbas.has(f.properties.khewat_no) &&
    (!reportVillage || (f.properties.hindi_village || f.properties.village || '') === reportVillage)
  );
  const totalAcres = selectedPlots.reduce((s, f) => s + (f.properties.area_acres || 0), 0);
  const selectedByMurabba = selectedPlots.reduce((acc, f) => {
    const m = f.properties.khewat_no;
    if (!acc[m]) acc[m] = [];
    acc[m].push(f);
    return acc;
  }, {} as Record<string, PolygonFeature[]>);

  // Glass style for sidebar elements
  const dd: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
    background: 'rgba(26,23,20,0.9)', color: '#F5F0E8',
    border: '1px solid rgba(245,158,11,0.1)', outline: 'none',
    fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif", fontWeight: 500,
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* ===== SIDEBAR ===== */}
      <div style={{
        width: '38%', minWidth: 340, maxWidth: 480, flexShrink: 0,
        background: 'rgba(15,13,10,0.95)', borderRight: '1px solid rgba(245,158,11,0.08)',
        overflowY: 'auto', backdropFilter: 'blur(12px)',
      }}>
        {/* Header + Dropdowns */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(245,158,11,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F5F0E8', marginBottom: 4 }}>
            <span style={{ color: '#F59E0B' }}>Shajra</span> · शजरा किश्तवार
          </h2>
          <p style={{ fontSize: 11, color: '#9C8F7D', marginBottom: 12 }}>भूखंड चुनें और शजरा नक्शा बनाएं</p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            <button onClick={() => setMode('khasra')} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: mode === 'khasra' ? '#F59E0B' : 'rgba(245,158,11,0.1)',
              color: mode === 'khasra' ? '#0F0D0A' : '#9C8F7D',
              border: mode === 'khasra' ? 'none' : '1px solid rgba(245,158,11,0.15)',
            }}>खसरा चुनें</button>
            <button onClick={() => setMode('khewat')} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: mode === 'khewat' ? '#F59E0B' : 'rgba(245,158,11,0.1)',
              color: mode === 'khewat' ? '#0F0D0A' : '#9C8F7D',
              border: mode === 'khewat' ? 'none' : '1px solid rgba(245,158,11,0.15)',
            }}>खेवट देखें</button>
          </div>

          <select value={district} onChange={e => { setDistrict(e.target.value); setTehsil(''); setSelectedVillage(''); setFeatures([]); }} style={{ ...dd, marginBottom: 8 }}>
            <option value="">District · जिला</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={tehsil} onChange={e => { setTehsil(e.target.value); setSelectedVillage(''); setFeatures([]); }} style={{ ...dd, marginBottom: 8 }} disabled={!district}>
            <option value="">Tehsil · तहसील</option>
            {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={selectedVillage} onChange={e => loadVillage(e.target.value)} style={{ ...dd, marginBottom: 8 }} disabled={!tehsil}>
            <option value="">Village · गाँव ({villageNames.length})</option>
            {villageNames.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          {/* Khewat mode: search input */}
          {mode === 'khewat' && selectedVillage && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={khewatNo} onChange={e => setKhewatNo(e.target.value)} placeholder="खेवट संख्या" style={{ ...dd, flex: 1 }} onKeyDown={e => e.key === 'Enter' && searchKhewat()} />
              <button onClick={searchKhewat} disabled={khewatLoading || !khewatNo} style={{
                padding: '10px 16px', borderRadius: 10, background: '#F59E0B', color: '#0F0D0A',
                fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', opacity: khewatLoading ? 0.6 : 1,
              }}>{khewatLoading ? '...' : 'नक्शा बनाएं'}</button>
            </div>
          )}

          {/* Khewat result summary */}
          {mode === 'khewat' && khewatData && (
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, marginBottom: 8, border: '1px solid rgba(245,158,11,0.1)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>खेवट {khewatData.khewat_no}</div>
              <div style={{ fontSize: 11, color: '#9C8F7D', marginTop: 2 }}>
                {khewatData.khasras_with_polygon} खसरे · {Math.round(khewatData.total_area_sqyd).toLocaleString()} वर्ग गज
              </div>
              <div style={{ fontSize: 10, color: '#9C8F7D', marginTop: 2 }}>
                {khewatData.owners?.slice(0, 3).map((o: any) => o.name).join(', ')}
              </div>
              {khewatData.khasras_without_polygon?.length > 0 && (
                <div style={{ fontSize: 9, color: '#EF4444', marginTop: 4 }}>
                  नक्शा उपलब्ध नहीं: {khewatData.khasras_without_polygon.join(', ')}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 20, height: 20, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 12, color: '#9C8F7D' }}>{loadingStage}</p>
              {[1,2,3].map(i => <div key={i} style={{ height: 28, background: 'rgba(245,158,11,0.04)', borderRadius: 6, marginTop: 6 }} className="shimmer" />)}
            </div>
          )}
        </div>

        {/* Murabba + Khasra filter */}
        {features.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(245,158,11,0.06)' }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9C8F7D', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Filter · फ़िल्टर</label>
            <select value={selMurabba} onChange={e => setSelMurabba(e.target.value)} style={{ ...dd, marginBottom: 8 }}>
              <option value="">मुरब्बा चुनें ({murabbaList.length})</option>
              {murabbaList.map(m => (
                <option key={m.murabba} value={m.murabba}>
                  मुरब्बा {m.murabba} — {m.khasras} खसरे · {Math.floor(m.acres*8)} कनाल {Math.round((m.acres*8%1)*20)} मरला
                </option>
              ))}
            </select>
            {selMurabba && (
              <select onChange={e => selectKhasra(e.target.value)} defaultValue="" style={dd}>
                <option value="">खसरा चुनें ({filteredKhasras.length})</option>
                {filteredKhasras.map(f => {
                  const a = f.properties.area_acres || 0;
                  const kanal = Math.floor(a * 8), marla = Math.round((a * 8 % 1) * 20);
                  const fid = String(f.properties.id || '');
                  const isSelected = selIds.has(fid);
                  return (
                    <option key={fid || f.properties.khasra_no} value={f.properties.khasra_no}>
                      {isSelected ? '✓ ' : '  '}{selMurabba}//{f.properties.khasra_no} — {kanal} कनाल {marla} मरला
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        )}

        {/* Selected plots */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9C8F7D', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected · चयनित</label>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Map())} style={{ fontSize: 11, color: '#9C8F7D', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
            )}
          </div>

          {selected.size > 0 ? (
            <>
              {/* Generate button */}
              <button onClick={generateReport} style={{
                width: '100%', padding: '14px 0', fontWeight: 700, fontSize: 16, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A',
                boxShadow: '0 4px 20px rgba(245,158,11,0.25)', marginBottom: 16,
              }}>
                शजरा नक्शा बनाएं · Generate Shajra
              </button>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{selected.size}</div>
                  <div style={{ fontSize: 9, color: '#9C8F7D', textTransform: 'uppercase' }}>भूखंड · Plots</div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{Math.floor(totalAcres * 8)} कनाल {Math.round((totalAcres * 8 % 1) * 20)} मरला</div>
                  <div style={{ fontSize: 9, color: '#9C8F7D', textTransform: 'uppercase' }}>कुल क्षेत्रफल</div>
                </div>
              </div>

              {/* Selected plots grouped by murabba */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {Object.entries(selectedByMurabba).sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0)).map(([m, plots]) => {
                  const mAcres = plots.reduce((s, f) => s + (f.properties.area_acres || 0), 0);
                  const mKanal = Math.floor(mAcres * 8), mMarla = Math.round((mAcres * 8 % 1) * 20);
                  return (
                    <div key={m} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', marginBottom: 4, fontFamily: 'monospace' }}>
                        मुरब्बा {m} · {plots.length} भूखंड · {mKanal} कनाल {mMarla} मरला
                      </div>
                      {plots.map(f => {
                        const key = f.properties.khasra_no + '_' + f.properties.khewat_no;
                        const a = f.properties.area_acres || 0;
                        const kanal = Math.floor(a * 8), marla = Math.round((a * 8 % 1) * 20);
                        return (
                          <div key={key} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(26,23,20,0.8)', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 2,
                            border: '1px solid rgba(245,158,11,0.04)',
                          }}>
                            <span>
                              <span style={{ color: '#F59E0B', fontWeight: 700 }}>{m}//{f.properties.khasra_no}</span>
                              <span style={{ color: '#9C8F7D', marginLeft: 8 }}>{kanal} कनाल {marla} मरला</span>
                            </span>
                            <button onClick={() => setSelected(prev => { const n = new Map(prev); n.delete(key); return n; })}
                              style={{ color: '#9C8F7D', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#9C8F7D', textAlign: 'center', padding: '20px 0' }}>
              नक्शे पर भूखंड चुनें<br />या ऊपर मुरब्बा → खसरा फ़िल्टर करें
            </p>
          )}
        </div>
      </div>

      {/* ===== MAP ===== */}
      <div style={{ flex: 1, position: 'relative', minHeight: '100%' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* Viewport loading indicator */}
        {viewportLoading && (
          <div style={{
            position: 'absolute', top: 12, right: 60, zIndex: 20,
            padding: '6px 14px', borderRadius: 8,
            background: 'rgba(15,13,10,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(245,158,11,0.15)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: '#F59E0B',
          }}>
            <div style={{
              width: 14, height: 14, border: '2px solid rgba(245,158,11,0.3)',
              borderTop: '2px solid #F59E0B', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            भूखंड लोड हो रहे हैं...
          </div>
        )}

        {/* Village badge */}
        {selectedVillage && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(15,13,10,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(245,158,11,0.1)',
          }}>
            <div style={{ fontWeight: 700, color: '#F5F0E8', fontSize: 14 }}>शजरा — {selectedVillage}</div>
            <div style={{ fontSize: 10, color: '#9C8F7D' }}>{tehsil} · {district} · {features.length} plots</div>
          </div>
        )}

        {/* Selected count badge */}
        {selected.size > 0 && (
          <div style={{
            position: 'absolute', bottom: 16, left: 12, zIndex: 10,
            padding: '10px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            color: '#0F0D0A', fontWeight: 700, fontSize: 13,
            boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
          }}>
            {selected.size} भूखंड · {Math.floor(totalAcres*8)} कनाल {Math.round((totalAcres*8%1)*20)} मरला
          </div>
        )}
      </div>

      {/* ===== REPORT OVERLAY ===== */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#fff', overflowY: 'auto', color: '#333' }}>
          {/* Report header */}
          <div className="no-print" style={{
            position: 'sticky', top: 0, zIndex: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 24px',
            background: '#0F0D0A', borderBottom: '2px solid #F59E0B',
          }}>
            <span style={{ fontWeight: 700, color: '#F59E0B', fontSize: 15 }}>शजरा Report — {selectedVillage}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{ padding: '8px 20px', borderRadius: 8, background: '#F59E0B', color: '#0F0D0A', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>Print</button>
              <button onClick={() => setShowReport(false)} style={{ padding: '8px 20px', borderRadius: 8, background: '#333', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>Close</button>
            </div>
          </div>

          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #F59E0B', paddingBottom: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
                  <span style={{ color: '#F59E0B' }}>Abhivo</span><span style={{ color: '#333' }}> AI</span>
                </h1>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.15em' }}>LAND · LEGACY · GROWTH</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#333', margin: 0 }}>
                  {mode === 'khewat' && khewatData ? `शजरा खेवट संख्या ${khewatData.khewat_no}` : 'शजरा नक्शा · Shajra Report'}
                </h2>
                {mode === 'khewat' && khewatData?.owners?.length > 0 && (
                  <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                    {khewatData.owners.slice(0, 5).map((o: any) => `${o.name} ${o.relation || ''} ${o.father || ''}`).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
                <div>{new Date().toLocaleDateString('en-IN')}</div>
                <div>{selected.size} plots</div>
              </div>
            </div>

            {/* Village info */}
            <div style={{ display: 'flex', gap: 32, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 24px', marginBottom: 24, fontSize: 14, fontWeight: 600, color: '#333' }}>
              <span><span style={{ color: '#8B5E00' }}>गाँव:</span> {selectedVillage}</span>
              <span><span style={{ color: '#8B5E00' }}>तहसील:</span> {tehsil}</span>
              <span><span style={{ color: '#8B5E00' }}>जिला:</span> {district}</span>
            </div>

            {/* View tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button onClick={() => setViewTab('2d')} style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: viewTab === '2d' ? '#333' : '#eee', color: viewTab === '2d' ? '#fff' : '#333', border: 'none',
              }}>2D नक्शा</button>
              <button onClick={load3DView} style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: viewTab === '3d' ? '#333' : '#eee', color: viewTab === '3d' ? '#fff' : '#333', border: 'none',
              }}>3D दृश्य</button>
              <button onClick={() => setViewTab('video' as any)} style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: viewTab === 'video' ? '#333' : '#eee', color: viewTab === 'video' ? '#fff' : '#333', border: 'none',
              }}>📹 वीडियो</button>
            </div>

            {/* 2D Shajra Map */}
            {viewTab === '2d' && (
            <div style={{ border: '2px solid #F59E0B', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ background: 'rgba(245,158,11,0.06)', padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#8B5E00', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>भूखंड नक्शा · शजरा किश्तवार</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: '#555' }}>मुरब्बा {[...new Set(selectedPlots.map(f => f.properties.khewat_no))].join(', ')}</span>
              </div>
              <ShajraCanvas
                features={selectedPlots}
                selectedKeys={new Set(selectedPlots.map(f => f.properties.khasra_no + '_' + f.properties.khewat_no))}
                village={selectedVillage}
                tehsil={tehsil}
                district={district}
                v3Data={v3Data}
              />
            </div>
            )}

            {/* 3D Bird's Eye View */}
            {viewTab === '3d' && (
            <div style={{ marginBottom: 24 }}>
              {data3D?.polygons?.length ? (
                <BirdsEyeView
                  polygons={data3D.polygons}
                  adjacentPolygons={data3D.adjacent_polygons || []}
                  combinedBbox={data3D.combined_bbox || []}
                  combinedCentroid={data3D.combined_centroid || { lat: 0, lon: 0 }}
                  onScreenshot={(url) => setScreenshot3D(url)}
                />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>
                  {data3D ? '3D data not available for this selection' : 'Loading 3D view...'}
                </div>
              )}
            </div>
            )}

            {/* Video Generator */}
            {viewTab === 'video' && (
            <div style={{ marginBottom: 24, padding: 24, border: '2px solid #F59E0B', borderRadius: 10, background: 'rgba(245,158,11,0.02)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 12 }}>📹 AI वीडियो बनाएं</h3>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>चयनित भूखंडों का 25-30 सेकंड का मार्केटिंग वीडियो बनाएं — हिंदी वॉइसओवर के साथ</p>
              {!videoGenerating && videoStatus !== 'done' && (
                <button onClick={generateVideo} style={{
                  padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', border: 'none',
                }}>🎬 वीडियो बनाएं</button>
              )}
              {videoGenerating && <p style={{ fontSize: 13, color: '#F59E0B' }}>{videoStatus}</p>}
              {videoStatus === 'done' && videoJobId && (
                <div style={{ marginTop: 12 }}>
                  <a href={`/video/download/${videoJobId}`} style={{
                    display: 'inline-block', padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: '#F59E0B', color: '#0F0D0A', textDecoration: 'none',
                  }}>⬇ वीडियो डाउनलोड करें</a>
                </div>
              )}
              {videoStatus.startsWith('failed') && <p style={{ fontSize: 12, color: '#EF4444' }}>{videoStatus}</p>}
            </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { v: selected.size, l: 'चयनित भूखंड' },
                { v: `${Math.floor(totalAcres * 8)} कनाल ${Math.round((totalAcres * 8 % 1) * 20)} मरला`, l: 'कुल क्षेत्रफल' },
                { v: totalAcres.toFixed(2), l: 'एकड़' },
                { v: Math.round(totalAcres * 4840).toLocaleString(), l: 'वर्ग गज' },
              ].map(s => (
                <div key={s.l} style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#8B5E00' }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Table grouped by murabba */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
              <thead>
                <tr style={{ background: 'rgba(245,158,11,0.06)' }}>
                  {['#', 'मुरब्बा//खसरा', 'कनाल-मरला', 'एकड़', 'वर्ग गज', 'खेवट', 'मालिक'].map(h => (
                    <th key={h} style={{ border: '2px solid #F59E0B', padding: '8px 12px', color: '#8B5E00', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(selectedByMurabba).sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0)).map(([m, plots]) => {
                  const mAcres = plots.reduce((s, f) => s + (f.properties.area_acres || 0), 0);
                  return [
                    <tr key={`h-${m}`}>
                      <td colSpan={7} style={{ background: 'rgba(245,158,11,0.06)', fontWeight: 700, color: '#8B5E00', fontSize: 11, padding: '8px 12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                        मुरब्बा {m} — {plots.length} भूखंड · {Math.floor(mAcres*8)} कनाल {Math.round((mAcres*8%1)*20)} मरला
                      </td>
                    </tr>,
                    ...plots.map((f, i) => {
                      const a = f.properties.area_acres || 0;
                      const key = f.properties.khasra_no + '_' + f.properties.khewat_no;
                      const owner = ownerData[key];
                      // Also check V3 data for owners
                      const v3Plots = v3Data?.plots?.filter(p => p.murabba === f.properties.khewat_no && f.properties.khasra_no.startsWith(p.khasra.split('/')[0])) || [];
                      const v3Owner = v3Plots.map(p => p.owners).filter(Boolean).join(', ').substring(0, 60);
                      const v3Khewat = v3Plots[0]?.khewat || '';
                      const displayOwner = owner?.owners?.slice(0, 50) || v3Owner || '—';
                      const displayKhewat = owner?.khewat || v3Khewat || '—';
                      return (
                        <tr key={key} style={{ background: i % 2 ? 'rgba(245,158,11,0.02)' : 'transparent' }}>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'center', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>
                            <span style={{ color: '#B47708' }}>{m}//</span>{f.properties.khasra_no}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Math.floor(a * 8)}-{Math.round((a * 8 % 1) * 20)}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'right', color: '#555' }}>{a.toFixed(3)}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'right' }}>{Math.round(a * 4840).toLocaleString()}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{displayKhewat}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px 8px', fontSize: 11, color: '#333' }}>{displayOwner}</td>
                        </tr>
                      );
                    })
                  ];
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
              <span>Abhivo AI · HSAC EODB + WebHALRIS + Bhuvan ISRO</span>
              <span>{selectedVillage} · {district}</span>
            </div>
            <div style={{ fontSize: 9, color: '#ccc', marginTop: 8 }}>
              यह शजरा केवल सूचनार्थ है। सरकारी कार्य हेतु सम्बंधित तहसील में सम्पर्क करें।
            </div>
          </div>
        </div>
      )}

      {/* Keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
