'use client';
import { useEffect, useRef, useState } from 'react';

interface Polygon3D {
  khasra_no: string; murabba_no: string; geometry: string;
  area_sqyd: number; area_kanal: number;
  centroid_lat: number; centroid_lon: number; perimeter_m: number;
  edges: { edge_num: number; length_m: number; length_karam: number; mid_lat: number; mid_lon: number }[];
}
interface Adjacent { khasra_no: string; murabba_no: string; geometry: string; }
interface Props {
  polygons: Polygon3D[];
  adjacentPolygons: Adjacent[];
  combinedBbox: number[]; // [minLon, minLat, maxLon, maxLat]
  combinedCentroid: { lat: number; lon: number };
  onScreenshot?: (dataUrl: string) => void;
}

export default function BirdsEyeView({ polygons, adjacentPolygons, combinedBbox, combinedCentroid, onScreenshot }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const [animating, setAnimating] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapObj) return;
    import('maplibre-gl').then(maplibregl => {
      import('maplibre-gl/dist/maplibre-gl.css');
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: {
          version: 8,
          sources: {
            'satellite': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, maxzoom: 20 },
          },
          layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        },
        center: [combinedCentroid.lon, combinedCentroid.lat],
        zoom: 16,
        pitch: 55,
        bearing: -20,
        maxPitch: 85,
      });

      map.on('load', () => {
        // Adjacent polygons — white outline
        const adjFeatures = adjacentPolygons.filter(a => a.geometry).map(a => ({
          type: 'Feature' as const, geometry: JSON.parse(a.geometry),
          properties: { khasra_no: a.khasra_no }
        }));
        map.addSource('adjacent', { type: 'geojson', data: { type: 'FeatureCollection', features: adjFeatures } });
        map.addLayer({ id: 'adj-line', type: 'line', source: 'adjacent', paint: { 'line-color': 'rgba(255,255,255,0.4)', 'line-width': 0.8 } });

        // Selected polygons — green fill + gold outline
        const selFeatures = polygons.filter(p => p.geometry).map(p => ({
          type: 'Feature' as const, geometry: JSON.parse(p.geometry),
          properties: { khasra_no: p.khasra_no, murabba_no: p.murabba_no, area_sqyd: p.area_sqyd }
        }));
        map.addSource('selected', { type: 'geojson', data: { type: 'FeatureCollection', features: selFeatures } });
        map.addLayer({ id: 'sel-fill', type: 'fill', source: 'selected', paint: { 'fill-color': 'rgba(46,125,82,0.35)' } });
        map.addLayer({ id: 'sel-line', type: 'line', source: 'selected', paint: { 'line-color': '#C9922A', 'line-width': 2.5 } });
        map.addLayer({ id: 'sel-label', type: 'symbol', source: 'selected',
          layout: { 'text-field': ['concat', ['get', 'murabba_no'], '//', ['get', 'khasra_no']], 'text-size': 12, 'text-allow-overlap': true },
          paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 }
        });

        // Fit bounds
        if (combinedBbox.length === 4) {
          map.fitBounds([[combinedBbox[0], combinedBbox[1]], [combinedBbox[2], combinedBbox[3]]], { padding: 60, pitch: 55, bearing: -20, duration: 1000 });
        }

        // Add dimension markers
        const allEdges: any[] = [];
        polygons.forEach(p => p.edges?.forEach(e => {
          if (e.length_m > 2) allEdges.push(e);
        }));
        allEdges.forEach(e => {
          const el = document.createElement('div');
          el.innerHTML = `<span style="background:rgba(0,0,0,0.7);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;white-space:nowrap">${e.length_m}m · ${e.length_karam} करम</span>`;
          const marker = new maplibregl.Marker({ element: el }).setLngLat([e.mid_lon, e.mid_lat]).addTo(map);
          markersRef.current.push(marker);
        });

        // Start orbit animation after 1.5s
        setTimeout(() => {
          if (!animating) return;
          let start = performance.now();
          const duration = 12000;
          const startBearing = map.getBearing();
          function orbit(ts: number) {
            if (!animating) return;
            const elapsed = ts - start;
            const t = Math.min(elapsed / duration, 1);
            map.setBearing(startBearing + t * 180);
            if (t < 1) requestAnimationFrame(orbit);
          }
          requestAnimationFrame(orbit);
        }, 1500);

        setMapObj(map);
      });
    });
  }, []);

  // Toggle labels
  useEffect(() => {
    markersRef.current.forEach(m => {
      m.getElement().style.display = showLabels ? 'block' : 'none';
    });
  }, [showLabels]);

  function takeScreenshot() {
    if (!mapObj) return;
    mapObj.getCanvas().toBlob((blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onScreenshot?.(dataUrl);
        // Also auto-download
        const a = document.createElement('a');
        a.href = dataUrl; a.download = 'shajra-3d-screenshot.png'; a.click();
      };
      reader.readAsDataURL(blob);
    });
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 500, borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(245,158,11,0.15)' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {/* Controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 10 }}>
        <button onClick={() => setAnimating(!animating)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', backdropFilter: 'blur(4px)',
        }}>{animating ? '⏸ Pause' : '▶ Resume'}</button>
        <button onClick={() => setShowLabels(!showLabels)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', backdropFilter: 'blur(4px)',
        }}>{showLabels ? '🏷 Hide Labels' : '🏷 Show Labels'}</button>
        <button onClick={takeScreenshot} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: '#F59E0B', color: '#0F0D0A', border: 'none',
        }}>📷 Screenshot</button>
      </div>
      {/* Info badge */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11 }}>
        {polygons.length} plots · {polygons.reduce((s, p) => s + p.area_sqyd, 0).toLocaleString()} sqyd
      </div>
    </div>
  );
}
