'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const API = 'http://34.47.173.239';

/* ── Types ── */
interface PlotInfo {
  khewat_no: string; khasra_no: string; village: string; tehsil: string;
  area_acres: number; area_sqm?: number; owners?: string; khewat?: string;
  year?: string; record_id?: number; discrepancy_pct?: number;
  satellite_area_sqm?: number; record_area_sqm?: number;
  land_type_en?: string; murabba?: string; khasra?: string;
  village_name?: string;
  _loading?: boolean; _lngLat?: [number, number];
}

/* ── Bookmarks ── */
function getBookmarks(): PlotInfo[] {
  try { return JSON.parse(localStorage.getItem('abhivo_bookmarks') || '[]'); } catch { return []; }
}
function toggleBookmark(plot: PlotInfo) {
  const bm = getBookmarks();
  const key = `${plot.village}|${plot.khewat_no}|${plot.khasra_no}`;
  const exists = bm.findIndex(b => `${b.village}|${b.khewat_no}|${b.khasra_no}` === key);
  if (exists >= 0) bm.splice(exists, 1); else bm.push(plot);
  localStorage.setItem('abhivo_bookmarks', JSON.stringify(bm));
  return exists < 0;
}
function isBookmarked(plot: PlotInfo) {
  const key = `${plot.village}|${plot.khewat_no}|${plot.khasra_no}`;
  return getBookmarks().some(b => `${b.village}|${b.khewat_no}|${b.khasra_no}` === key);
}

/* ── Area formatter ── */
function formatArea(acres: number, unit: string) {
  if (unit === 'kanal') { const k = Math.floor(acres * 8); const m = Math.round((acres * 8 % 1) * 20); return `${k} कनाल ${m} मरला`; }
  if (unit === 'acres') return `${acres.toFixed(2)} acres`;
  if (unit === 'sqyd') return `${Math.round(acres * 4840)} sq yd`;
  return `${Math.round(acres * 4046.86)} sq m`;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<any>(null);
  const [district, setDistrict] = useState('सोनीपत');
  const [tehsil, setTehsil] = useState('');
  const [village, setVillage] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [tehsils, setTehsils] = useState<string[]>([]);
  const [villageNames, setVillageNames] = useState<string[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<PlotInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [plotCount, setPlotCount] = useState(0);
  const [areaUnit, setAreaUnit] = useState('kanal');
  const [layer, setLayer] = useState<'satellite' | 'street' | 'cadastral'>('satellite');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [searchText, setSearchText] = useState('');
  const popupRef = useRef<any>(null);

  // Load data
  useEffect(() => { fetch(`${API}/districts`).then(r => r.json()).then(d => setDistricts(d.districts)).catch(() => {}); }, []);
  useEffect(() => {
    if (!district) return; setTehsil(''); setVillage(''); setVillageNames([]);
    fetch(`${API}/tehsils?district=${encodeURIComponent(district)}`).then(r => r.json())
      .then(d => setTehsils(d.tehsils.filter((t: string) => !/^[A-Za-z]/.test(t)))).catch(() => {});
  }, [district]);
  useEffect(() => {
    if (!district || !tehsil) return; setVillage('');
    fetch(`${API}/villages?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`)
      .then(r => r.json()).then(d => setVillageNames(d.villages)).catch(() => {});
  }, [district, tehsil]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    import('maplibre-gl').then(maplibregl => {
      import('maplibre-gl/dist/maplibre-gl.css');
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: { version: 8, sources: {
          'sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, maxzoom: 20 },
        }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf' },
        center: [76.9, 29.0], zoom: 8,
      });
      setMapObj(map);
    });
  }, []);

  // Load village
  const loadVillage = useCallback(async (vName: string) => {
    if (!mapObj || !vName) return;
    setVillage(vName); setLoading(true); setSelectedPlot(null); setPlotCount(0);
    try {
      const data = await (await fetch(`${API}/map/polygons?village=${encodeURIComponent(vName)}&district=${encodeURIComponent(district)}`)).json();

      ['polygons-labels', 'polygons-line', 'polygons-fill', 'polygons-highlight'].forEach(l => { if (mapObj.getLayer(l)) mapObj.removeLayer(l); });
      if (mapObj.getSource('polygons')) mapObj.removeSource('polygons');
      if (mapObj.getSource('highlight')) mapObj.removeSource('highlight');

      const amberColors = ['#F59E0B', '#D97706', '#B45309', '#92400E', '#FBBF24', '#FCD34D', '#CA8A04', '#A16207', '#854D0E', '#EAB308', '#FACC15', '#FDE047'];
      const colored = data.features.map((f: any) => {
        let h = 0; const m = f.properties.khewat_no || '0';
        for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) & 0xffff;
        return { ...f, properties: { ...f.properties, _color: amberColors[h % amberColors.length] } };
      });

      mapObj.addSource('polygons', { type: 'geojson', data: { type: 'FeatureCollection', features: colored } });
      mapObj.addLayer({ id: 'polygons-fill', type: 'fill', source: 'polygons', paint: { 'fill-color': ['get', '_color'], 'fill-opacity': 0.18 } });
      mapObj.addLayer({ id: 'polygons-line', type: 'line', source: 'polygons', paint: { 'line-color': '#F59E0B', 'line-width': 1, 'line-opacity': 0.5 } });
      mapObj.addLayer({ id: 'polygons-labels', type: 'symbol', source: 'polygons', layout: {
        'text-field': ['concat', ['get', 'khewat_no'], '//', ['get', 'khasra_no']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 9, 18, 12],
        'text-allow-overlap': false,
      }, paint: { 'text-color': '#FBBF24', 'text-halo-color': 'rgba(15,13,10,0.9)', 'text-halo-width': 1.5 } });

      // Highlight source for selected polygon
      mapObj.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      mapObj.addLayer({ id: 'polygons-highlight', type: 'line', source: 'highlight', paint: { 'line-color': '#FBBF24', 'line-width': 3, 'line-opacity': 1 } });

      // Fit bounds
      try {
        const coords = data.features.flatMap((f: any) => {
          const c = f.geometry?.coordinates; if (!c) return [];
          return f.geometry.type === 'MultiPolygon' ? c.flat(1).flat(0) : c[0] || [];
        }).filter((c: number[]) => Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]));
        if (coords.length) {
          const lngs = coords.map((c: number[]) => c[0]), lats = coords.map((c: number[]) => c[1]);
          mapObj.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60 });
        }
      } catch {}

      setPlotCount(data.features.length);

      // Click handler
      if ((mapObj as any)._click) mapObj.off('click', 'polygons-fill', (mapObj as any)._click);
      const clickHandler = async (e: any) => {
        let f = e.features?.[0];
        if (!f?.properties) { const bbox: [any, any] = [[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]]; f = mapObj.queryRenderedFeatures(bbox, { layers: ['polygons-fill'] })?.[0]; }
        if (!f?.properties) { setSelectedPlot(null); return; }
        const p = f.properties;
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        // Highlight selected polygon
        mapObj.getSource('highlight')?.setData({ type: 'FeatureCollection', features: [f] });

        setSelectedPlot({ ...p, _loading: true, _lngLat: lngLat });
        setBookmarked(isBookmarked(p as PlotInfo));

        try {
          const lookup = await (await fetch(`${API}/map/lookup?khasra_no=${encodeURIComponent(p.khasra_no)}&tehsil=${encodeURIComponent(p.tehsil || tehsil)}&village=${encodeURIComponent(p.village)}&murabba=${encodeURIComponent(p.khewat_no)}`)).json();
          if (lookup.found && lookup.results?.length) {
            const r = lookup.results[0];
            setSelectedPlot({ ...p, ...r, _loading: false, _lngLat: lngLat });
          } else {
            setSelectedPlot({ ...p, _loading: false, _lngLat: lngLat });
          }
        } catch { setSelectedPlot({ ...p, _loading: false, _lngLat: lngLat }); }
      };
      (mapObj as any)._click = clickHandler;
      mapObj.on('click', 'polygons-fill', clickHandler);
      mapObj.on('mouseenter', 'polygons-fill', () => { mapObj.getCanvas().style.cursor = 'pointer'; });
      mapObj.on('mouseleave', 'polygons-fill', () => { mapObj.getCanvas().style.cursor = ''; });

      // Close popup on map click (not on polygon)
      mapObj.on('click', (e: any) => {
        const features = mapObj.queryRenderedFeatures(e.point, { layers: ['polygons-fill'] });
        if (!features.length) { setSelectedPlot(null); mapObj.getSource('highlight')?.setData({ type: 'FeatureCollection', features: [] }); }
      });

    } catch (e) { console.error(e); }
    setLoading(false);
  }, [mapObj, district, tehsil]);

  // Cycle area units
  const cycleUnit = () => setAreaUnit(u => u === 'kanal' ? 'acres' : u === 'acres' ? 'sqyd' : u === 'sqyd' ? 'sqm' : 'kanal');

  const glass = { background: 'rgba(15,13,10,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(245,158,11,0.1)' };
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
    color: active ? '#FBBF24' : '#9C8F7D', cursor: 'pointer', whiteSpace: 'nowrap',
    ...glass, borderColor: active ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.06)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Map (100% screen) */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Floating Search Bar + Location Pills (compact row) ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ ...glass, borderRadius: 10, padding: 3, display: 'flex', gap: 3, flex: '1 1 280px', maxWidth: 360, boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search owner, khewat..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '8px 12px', fontSize: 13, color: '#F5F0E8', fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }} />
          <button style={{ padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
            🔍
          </button>
        </div>

        {/* Location Pills (same row) */}
        {/* District */}
        <div style={{ position: 'relative' }}>
          <select value={district} onChange={e => setDistrict(e.target.value)}
            style={{ ...pillStyle(!!district), appearance: 'none', paddingRight: 28 }}>
            <option value="">District</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9C8F7D', pointerEvents: 'none' }}>▾</span>
        </div>

        {/* Tehsil */}
        {district && (
          <div style={{ position: 'relative' }}>
            <select value={tehsil} onChange={e => setTehsil(e.target.value)}
              style={{ ...pillStyle(!!tehsil), appearance: 'none', paddingRight: 28 }}>
              <option value="">Tehsil</option>
              {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9C8F7D', pointerEvents: 'none' }}>▾</span>
          </div>
        )}

        {/* Village */}
        {tehsil && (
          <div style={{ position: 'relative' }}>
            <select value={village} onChange={e => loadVillage(e.target.value)}
              style={{ ...pillStyle(!!village), appearance: 'none', paddingRight: 28 }}>
              <option value="">Village ({villageNames.length})</option>
              {villageNames.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9C8F7D', pointerEvents: 'none' }}>▾</span>
          </div>
        )}

        {/* Plot count badge */}
        {plotCount > 0 && (
          <div style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', fontSize: 11, color: '#F59E0B', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {plotCount.toLocaleString()} plots
          </div>
        )}
      </div>

      {/* ── Loading indicator ── */}
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 20, ...glass, borderRadius: 14, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="shimmer" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <span style={{ fontSize: 14, color: '#9C8F7D' }}>Loading plots...</span>
        </div>
      )}

      {/* ── Layer Toggle (bottom-left) ── */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, zIndex: 10, display: 'flex', gap: 4, ...glass, borderRadius: 12, padding: 4 }}>
        {[
          { id: 'satellite' as const, icon: '🌍', label: 'Satellite' },
          { id: 'street' as const, icon: '🗺️', label: 'Street' },
          { id: 'cadastral' as const, icon: '📐', label: 'Plots Only' },
        ].map(l => (
          <button key={l.id} onClick={() => setLayer(l.id)} title={l.label}
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 16, border: 'none', cursor: 'pointer', background: layer === l.id ? 'rgba(245,158,11,0.15)' : 'transparent', color: layer === l.id ? '#FBBF24' : '#9C8F7D', transition: 'all 0.2s' }}>
            {l.icon}
          </button>
        ))}
      </div>

      {/* ── Zoom + Bookmark (bottom-right) ── */}
      <div style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => setShowBookmarks(!showBookmarks)} title="Bookmarks"
          style={{ ...glass, borderRadius: 10, padding: 10, fontSize: 18, border: 'none', cursor: 'pointer', color: showBookmarks ? '#FBBF24' : '#9C8F7D' }}>
          ⭐
        </button>
        <button onClick={() => mapObj?.zoomIn()} title="Zoom in"
          style={{ ...glass, borderRadius: 10, padding: '8px 12px', fontSize: 18, border: 'none', cursor: 'pointer', color: '#9C8F7D' }}>+</button>
        <button onClick={() => mapObj?.zoomOut()} title="Zoom out"
          style={{ ...glass, borderRadius: 10, padding: '8px 12px', fontSize: 18, border: 'none', cursor: 'pointer', color: '#9C8F7D' }}>−</button>
      </div>

      {/* ── Popup Card (anchored to polygon) ── */}
      {selectedPlot && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, width: '92%', maxWidth: 360,
          ...glass, borderRadius: 16, padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.15)',
        }}>
          {/* Close button */}
          <button onClick={() => { setSelectedPlot(null); mapObj?.getSource('highlight')?.setData({ type: 'FeatureCollection', features: [] }); }}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#9C8F7D', cursor: 'pointer', fontSize: 16 }}>✕</button>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FBBF24', letterSpacing: '-0.5px' }}>
                {selectedPlot.khewat_no}//{selectedPlot.khasra_no}
              </div>
              <div style={{ fontSize: 12, color: '#7A6E5E', marginTop: 2 }}>
                {selectedPlot.village} · {selectedPlot.tehsil}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Bookmark */}
              <button onClick={() => { const saved = toggleBookmark(selectedPlot); setBookmarked(saved); }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: bookmarked ? '#F59E0B' : '#7A6E5E' }}>
                {bookmarked ? '⭐' : '☆'}
              </button>
              {/* Verified badge */}
              {selectedPlot.discrepancy_pct != null && selectedPlot.discrepancy_pct <= 5 && (
                <div style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(86,211,100,0.1)', border: '1px solid rgba(86,211,100,0.2)', fontSize: 10, color: '#56D364', fontWeight: 600 }}>✓ Verified</div>
              )}
            </div>
          </div>

          {/* Area + Murabba */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div onClick={cycleUnit} style={{ flex: 1, background: '#1A1714', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
              <div style={{ fontSize: 9, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Area <span style={{ fontSize: 8, color: '#F59E0B' }}>↻ tap</span></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E8', marginTop: 2 }}>
                {formatArea(selectedPlot.area_acres || 0, areaUnit)}
              </div>
            </div>
            <div style={{ background: '#1A1714', borderRadius: 10, padding: '8px 10px', minWidth: 70 }}>
              <div style={{ fontSize: 9, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Murabba</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E8', marginTop: 2 }}>{selectedPlot.khewat_no}</div>
            </div>
          </div>

          {/* Owner */}
          {selectedPlot._loading ? (
            <div className="shimmer" style={{ height: 44, borderRadius: 10, marginBottom: 10 }} />
          ) : selectedPlot.owners ? (
            <div style={{ background: '#1A1714', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Owner</div>
              <div style={{ fontSize: 14, color: '#F5F0E8', lineHeight: 1.6, fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>
                {selectedPlot.owners}
              </div>
            </div>
          ) : null}

          {/* Khewat + Year */}
          {selectedPlot.khewat && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
              <div><span style={{ color: '#7A6E5E' }}>Khewat </span><span style={{ color: '#F5F0E8', fontWeight: 500 }}>{selectedPlot.khewat}</span></div>
              {selectedPlot.year && <div><span style={{ color: '#7A6E5E' }}>Year </span><span style={{ color: '#F5F0E8', fontWeight: 500 }}>{selectedPlot.year}</span></div>}
              {selectedPlot.land_type_en && <div><span style={{ color: '#7A6E5E' }}>{selectedPlot.land_type_en}</span></div>}
            </div>
          )}

          {/* Nakal buttons */}
          {(selectedPlot.khewat || selectedPlot.village) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/nakal?village=${encodeURIComponent(selectedPlot.village || selectedPlot.village_name || '')}&khewat=${encodeURIComponent(selectedPlot.khewat || selectedPlot.khewat_no || '')}`} target="_blank" rel="noopener"
                style={{ flex: 1, textAlign: 'center', padding: '11px 16px', borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Jamabandi
              </a>
              <a href={`${API}/nakal/html?village=${encodeURIComponent(selectedPlot.village || selectedPlot.village_name || '')}&khewat=${encodeURIComponent(selectedPlot.khewat || selectedPlot.khewat_no || '')}&district=${encodeURIComponent(district)}`} target="_blank" rel="noopener"
                style={{ flex: 1, textAlign: 'center', padding: '11px 16px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(245,158,11,0.2)', color: '#F5F0E8', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                Nakal
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Bookmarks Panel ── */}
      {showBookmarks && (
        <div style={{ position: 'absolute', bottom: 80, right: 16, zIndex: 15, width: 280, maxHeight: 300, overflowY: 'auto', ...glass, borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E8', marginBottom: 10 }}>⭐ Saved Plots</h3>
          {getBookmarks().length === 0 ? (
            <p style={{ fontSize: 13, color: '#7A6E5E' }}>No bookmarks yet. Click ☆ on any plot to save.</p>
          ) : (
            getBookmarks().map((b, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(245,158,11,0.06)', fontSize: 13, cursor: 'pointer', color: '#F5F0E8' }}
                onClick={() => { setShowBookmarks(false); }}>
                <span style={{ color: '#FBBF24', fontWeight: 600 }}>{b.khewat_no}//{b.khasra_no}</span> · {b.village}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
