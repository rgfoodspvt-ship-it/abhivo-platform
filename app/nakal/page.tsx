'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API = 'http://34.47.173.239';

/* ── Exact govt 12-column headers (from jamabandi.nic.in) ── */
const COL_HEADERS_HI = [
  'खेवट या\nजमाबंदी\nन.',
  'खतौनी\nन.',
  'नाम तरफ या पत्ती',
  'विवरण सहित मालिक नाम',
  'विवरण सहित काश्तकार',
  'कुंए या सिंचाई\nके अन्य साधन\nका नाम',
  'नम्बर खसरा या\nमुरब्बे और किले\nका नम्बर',
  'रक्बा और किस्म\nजमीन',
  'दर और संख्या के\nब्यौरे के साथ\nलगान जो मुजारा\nदेता है',
  'हिस्सा या\nहकीयत का\nपैमाना और\nबाछ का ढंग',
  'माल और सवाई\nके ब्यौरे\nसहित मांग',
  'अभियुक्ति'
];
const COL_HEADERS_EN = [
  'Khewat/\nJamabandi', 'Khatoni', 'Taraf\nPatti',
  'Owner\nDetails', 'Cultivator', 'Irrigation',
  'Khasra/\nMurabba', 'Area/\nLand Type', 'Revenue',
  'Possession', 'Tax', 'Mutations'
];

export default function NakalPage() {
  return <Suspense><NakalInner /></Suspense>;
}

function NakalInner() {
  const params = useSearchParams();
  const [village, setVillage] = useState(params.get('village') || '');
  const [khewat, setKhewat] = useState(params.get('khewat') || '');
  const [mode, setMode] = useState<'enhanced' | 'original'>('enhanced');
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [record, setRecord] = useState<any>({});
  const [v3Owners, setV3Owners] = useState<any[]>([]);
  const [v3Khasras, setV3Khasras] = useState<any[]>([]);
  const [v3Mutations, setV3Mutations] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showEnglish, setShowEnglish] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Auto-search if URL params present
  useEffect(() => {
    if (params.get('village') && params.get('khewat')) {
      setVillage(params.get('village')!);
      setKhewat(params.get('khewat')!);
      setTimeout(() => search(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    const v = village || params.get('village');
    const k = khewat || params.get('khewat');
    if (!v || !k) return;
    setLoading(true); setError(''); setRawRows([]);

    try {
      const res = await fetch(`${API}/nakal/rows?village=${encodeURIComponent(v)}&khewat=${encodeURIComponent(k)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rows?.length > 0) {
          setRawRows(data.rows);
          setRecord(data.record || {});
          setV3Owners(data.v3_owners || []);
          setV3Khasras(data.v3_khasras || []);
          setV3Mutations(data.v3_mutations || []);
        } else {
          setError('No nakal found for this village and khewat');
        }
      } else {
        setError('Record not found');
      }
    } catch {
      setError('Connection error — server may be offline');
    }
    setLoading(false);
  }

  function downloadPdf() {
    // Open the server-rendered PDF in new tab
    const v = record.village_name || village;
    const k = record.khewat_no || khewat;
    window.open(`${API}/nakal/html?village=${encodeURIComponent(v)}&khewat=${encodeURIComponent(k)}&district=सोनीपत`, '_blank');
  }

  function printNakal() {
    window.print();
  }

  const glass: React.CSSProperties = { background: 'rgba(15,13,10,0.88)', backdropFilter: 'blur(16px)', border: '1px solid rgba(245,158,11,0.1)' };

  // ── Cell renderers ──
  function isRed(val: string) { return val?.startsWith('[RED]'); }
  function clean(val: string) { return isRed(val) ? val.slice(5) : val; }

  function renderGovtCell(val: string, col: number) {
    if (!val) return null;
    const red = isRed(val);
    const c = clean(val);

    // Red entries
    if (red) {
      if (c.includes('लाल आरम्भ') || c.includes('लाल समाप्त')) return <span style={{ color: '#999', fontSize: 9 }}>{c}</span>;
      return <span style={{ color: '#C41E3A', fontWeight: 600 }}>{c}</span>;
    }
    // Col 7: murabba headers
    if (col === 6 && val.match(/^[\d\/]+\/\/$/)) return <span style={{ color: '#C41E3A', fontWeight: 700 }}>{val}</span>;
    // Separators
    if (val.match(/^-{3,}$/)) return <span style={{ color: '#ccc' }}>{'─'.repeat(6)}</span>;

    return <>{val}</>;
  }

  // Group khasras by murabba for enhanced view
  const khasrasByMurabba: Record<string, any[]> = {};
  v3Khasras.forEach(k => {
    const m = k.murabba_no || 'Other';
    if (!khasrasByMurabba[m]) khasrasByMurabba[m] = [];
    khasrasByMurabba[m].push(k);
  });

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 16px' }}>

      {/* ── Header ── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}><span className="text-gold-gradient">Digital Nakal</span></h1>
          <p style={{ color: '#7A6E5E', fontSize: 12, marginTop: 2 }}>Jamabandi records — 99.95% verified against government data</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['enhanced', 'original'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: mode === m ? 600 : 400, border: 'none', cursor: 'pointer', background: mode === m ? 'rgba(245,158,11,0.12)' : 'transparent', color: mode === m ? '#FBBF24' : '#7A6E5E', transition: 'all 0.2s' }}>
              {m === 'enhanced' ? 'Enhanced' : 'Govt Format'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="no-print" style={{ ...glass, borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 9, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 3 }}>Village</label>
          <input value={village} onChange={e => setVillage(e.target.value)} placeholder="e.g. खेवडा"
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14, background: '#1A1714', color: '#F5F0E8', border: '1px solid rgba(245,158,11,0.08)', outline: 'none', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <label style={{ fontSize: 9, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 3 }}>Khewat</label>
          <input value={khewat} onChange={e => setKhewat(e.target.value)} placeholder="127"
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14, background: '#1A1714', color: '#F5F0E8', border: '1px solid rgba(245,158,11,0.08)', outline: 'none' }} />
        </div>
        <button onClick={search} disabled={loading}
          style={{ padding: '8px 22px', borderRadius: 8, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
          {loading ? '...' : 'View'}
        </button>
        <button onClick={() => setShowEnglish(!showEnglish)}
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid rgba(245,158,11,0.08)', background: showEnglish ? 'rgba(245,158,11,0.06)' : 'transparent', color: '#7A6E5E', cursor: 'pointer' }}>
          {showEnglish ? 'हि' : 'EN'}
        </button>
      </div>

      {error && <div style={{ textAlign: 'center', color: '#C75B39', padding: 16 }}>{error}</div>}

      {/* ── Empty state ── */}
      {!rawRows.length && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>&#x1F4DC;</div>
          <p style={{ color: '#7A6E5E', fontSize: 13 }}>Enter village and khewat to view nakal</p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { v: 'खेवडा', k: '127' },
              { v: 'राई', k: '100' },
              { v: 'गोहाना', k: '500' },
              { v: 'Gamri', k: '121' },
            ].map((ex, i) => (
              <button key={i} onClick={() => { setVillage(ex.v); setKhewat(ex.k); }}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.08)', color: '#9C8F7D', cursor: 'pointer' }}>
                {ex.v} · {ex.k}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── ENHANCED MODE — Paid Nakal Style ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {rawRows.length > 0 && mode === 'enhanced' && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '40px 50px', color: '#000', fontFamily: "'Noto Sans Devanagari', 'Mangal', serif", position: 'relative', overflow: 'hidden', width: '100%' }}>

          {/* Watermark */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, borderRadius: '50%', background: 'rgba(200, 230, 200, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: 'rgba(0,0,0,0.04)', textAlign: 'center', lineHeight: 1.2 }}>
              Abhivo AI<br /><span style={{ fontSize: 20 }}>Land Intelligence</span>
            </div>
          </div>

          {/* Content above watermark */}
          <div style={{ position: 'relative', zIndex: 1 }}>

            {/* ── Header — matching paid nakal ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
              {/* Abhivo Logo */}
              <div style={{ width: 70, flexShrink: 0 }}>
                <img src="/abhivo-logo-light.png" alt="Abhivo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
              </div>

              {/* Center — title + receipt */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#444', letterSpacing: 1 }}>ABHIVO-{Date.now().toString(36).toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#C41E3A', marginTop: 2 }}>नक़ल जमाबंदी (पड़त पटवार)</div>
              </div>

              {/* Right — Haryana emblem placeholder */}
              <div style={{ width: 70, flexShrink: 0, textAlign: 'right' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #2E7D32', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#2E7D32', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
                  हरियाणा<br />सरकार
                </div>
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0 28px', fontSize: 15, flexWrap: 'wrap' }}>
              {[
                { l: 'गाँव :', v: record.village_name || village },
                { l: 'हदबस्त न. :', v: record.hadbast_no },
                { l: 'जिला :', v: record.district_name || 'सोनीपत' },
                { l: 'तहसील :', v: record.tehsil_name },
                { l: 'साल :', v: record.jamabandi_year },
              ].filter(f => f.v).map((f, i) => (
                <span key={i}>
                  <span style={{ color: '#000', fontWeight: 400 }}>{f.l}</span>{' '}
                  <span style={{ color: '#000', fontWeight: 700, fontSize: 16 }}>{f.v}</span>
                </span>
              ))}
            </div>

            {/* 12-column table — paid nakal style */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Noto Sans Devanagari', 'Mangal', serif" }}>
                <thead>
                  {/* Column numbers — bordered cells, compact */}
                  <tr>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i} style={{ padding: '3px 2px', border: '1px solid #999', fontSize: 10, fontWeight: 700, textAlign: 'center', color: '#333' }}>{i + 1}</th>
                    ))}
                  </tr>
                  {/* Column headers — bordered cells, bold */}
                  <tr>
                    {(showEnglish ? COL_HEADERS_EN : COL_HEADERS_HI).map((h, i) => (
                      <th key={i} style={{ padding: '10px 6px', border: '1px solid #999', fontSize: 12, fontWeight: 700, textAlign: 'left', verticalAlign: 'top', whiteSpace: 'pre-line', lineHeight: 1.5, color: '#000' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.map((row, i) => (
                    <tr key={i}>
                      {row.slice(0, 12).map((cell, j) => {
                        const val = cell || '';
                        const red = val.startsWith('[RED]');
                        const c = red ? val.slice(5) : val;
                        const isMurabba = j === 6 && val.match(/^[\d\/]+\/\/$/);
                        const isSep = val.match(/^-{3,}$/);

                        return (
                          <td key={j} style={{
                            padding: '3px 8px',
                            borderLeft: j === 0 ? '1px solid #999' : 'none',
                            borderRight: j === 11 ? '1px solid #999' : 'none',
                            borderBottom: 'none', borderTop: 'none',
                            verticalAlign: 'top', lineHeight: 2.3, fontSize: 13,
                            color: red ? '#C41E3A' : isMurabba ? '#C41E3A' : '#000',
                            fontWeight: (red || isMurabba) ? 700 : 400,
                          }}>
                            {red ? <span style={{ color: '#C41E3A', fontWeight: 700 }}>{c}</span>
                              : isSep ? <span style={{ color: '#999' }}>{val}</span>
                              : c}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Bottom border */}
                  <tr>
                    <td colSpan={12} style={{ borderTop: '1px solid #888', padding: 0 }} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Footer — matching paid nakal ── */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
                <div>
                  <div>Generated by <b>Abhivo AI</b> from verified WebHALRIS data</div>
                  <div style={{ marginTop: 2 }}>Report Generation Date: {new Date().toLocaleString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>Village: {record.village_name || village} | Khewat: {record.khewat_no || khewat}</div>
                  <div style={{ marginTop: 2 }}>{rawRows.length} rows | District: {record.district_name || 'सोनीपत'}</div>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 9, color: '#888', lineHeight: 1.5 }}>
                <b>Disclaimer:</b> Data is sourced from jamabandi.nic.in (WebHALRIS). This is NOT an officially certified document.
                For legal purposes, obtain a certified copy from the respective Tehsil office.
                यह नकल केवल सूचनार्थ है। सरकारी कार्य हेतु सम्बधिंत तहसील में सम्पर्क करे।
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            <button onClick={downloadPdf}
              style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Download PDF
            </button>
            <button onClick={printNakal}
              style={{ padding: '10px 22px', borderRadius: 10, background: '#1A1714', color: '#9C8F7D', fontWeight: 600, fontSize: 13, border: '1px solid rgba(245,158,11,0.1)', cursor: 'pointer' }}>
              Print
            </button>
            <button onClick={() => setMode('original')}
              style={{ padding: '10px 22px', borderRadius: 10, background: '#1A1714', color: '#9C8F7D', fontWeight: 600, fontSize: 13, border: '1px solid rgba(245,158,11,0.1)', cursor: 'pointer' }}>
              Govt Format
            </button>
            <a href={`/map?village=${encodeURIComponent(record.village_name || village)}`}
              style={{ padding: '10px 22px', borderRadius: 10, background: '#1A1714', color: '#58A6FF', fontWeight: 600, fontSize: 13, border: '1px solid rgba(88,166,255,0.1)', cursor: 'pointer', textDecoration: 'none' }}>
              Map
            </a>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── ORIGINAL (GOVT) MODE — WebHALRIS ROR Format ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {rawRows.length > 0 && mode === 'original' && (
        <div ref={printRef} style={{ background: '#fff', borderRadius: 8, padding: '20px 16px', color: '#000', fontFamily: "'Noto Sans Devanagari', Verdana, sans-serif" }}>

          {/* ── WebHALRIS Header with logo space ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 4 }}>
            {/* Logo */}
            <div style={{ width: 80, flexShrink: 0, paddingTop: 4 }}>
              <img src="/abhivo-logo-light.png" alt="Abhivo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            </div>
            {/* Title */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'Navy' }}>जमाबंदी नकल</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'Navy', marginTop: 2 }}>पटवारी कानूनगो फोर्म न. 10</div>
            </div>
            {/* Spacer to balance */}
            <div style={{ width: 80, flexShrink: 0 }} />
          </div>

          {/* Meta row — matching govt layout */}
          <table style={{ margin: '10px auto 6px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ fontSize: 14 }}>
                {[
                  { l: 'गांव:', v: record.village_name || village },
                  { l: 'हदबस्त न.:', v: record.hadbast_no },
                  { l: 'तहसील:', v: record.tehsil_name },
                  { l: 'जिला:', v: record.district_name || 'सोनीपत' },
                  { l: 'साल:', v: record.jamabandi_year },
                ].filter(f => f.v).map((f, i) => (
                  <td key={i} style={{ padding: '2px 24px 2px 0', border: 'none' }}>
                    <span style={{ color: 'DarkBlue', fontWeight: 700 }}>{f.l}</span>{' '}
                    <span style={{ color: '#000', fontWeight: 700 }}>{f.v}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: 10, color: 'Red', fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            Nakal Generated by Abhivo AI · {new Date().toLocaleDateString('en-IN')}
          </div>

          {/* ── 12-Column Table — exact WebHALRIS style ── */}
          <div style={{ overflowX: 'auto' }}>
            {/* @ts-expect-error -- HTML table attrs */}
            <table cellSpacing="0" cellPadding="0" border="3" rules="all" style={{
              width: '100%', borderCollapse: 'collapse',
              borderColor: 'Black', borderWidth: 3, borderStyle: 'solid',
              background: '#CCCCCC',
              color: 'Black', fontSize: 13, minWidth: 1000,
            }}>
              <thead>
                <tr style={{ background: 'White', fontSize: 13, fontWeight: 700, color: 'Black' }}>
                  {(showEnglish ? COL_HEADERS_EN : COL_HEADERS_HI).map((h, i) => (
                    <th key={i} scope="col" style={{
                      padding: '6px 4px', border: '1px solid Black',
                      textAlign: 'center', verticalAlign: 'top',
                      whiteSpace: 'pre-line', lineHeight: 1.35,
                      fontWeight: 700, color: 'Black', background: 'White',
                      fontSize: 13,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.map((row, i) => (
                  <tr key={i} style={{ background: 'White', fontSize: 13 }}>
                    {row.slice(0, 12).map((cell, j) => {
                      const val = cell || '';
                      const red = val.startsWith('[RED]');
                      const c = red ? val.slice(5) : val;
                      const isMurabba = j === 6 && val.match(/^[\d\/]+\/\/$/);
                      const isSep = val.match(/^-{3,}$/);

                      return (
                        <td key={j} style={{
                          padding: '3px 5px', border: '1px solid Black',
                          verticalAlign: 'top', lineHeight: 1.5,
                          color: red ? 'Red' : isMurabba ? 'Red' : 'Black',
                          fontWeight: (red || isMurabba) ? 700 : 400,
                          fontSize: 13,
                        }}>
                          {red ? <span style={{ color: 'Red', fontWeight: 700 }}>{c}</span> : isSep ? val : c}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Disclaimer — exact govt text ── */}
          <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: '#000', lineHeight: 1.5 }}>
            यह नकल केवल सूचनार्थ है। सरकारी कार्य हेतु या प्रमाणित एवं हस्ताक्षर सहित नकल के लिये सम्बधिंत तहसील में सम्पर्क करे।
          </div>
          <div style={{ marginTop: 4, fontSize: 9, color: '#666', lineHeight: 1.4 }}>
            Source: jamabandi.nic.in (WebHALRIS) · Generated by Abhivo AI · {rawRows.length} rows
          </div>

          {/* Actions */}
          <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, marginBottom: 32 }}>
            <button onClick={downloadPdf}
              style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Download PDF
            </button>
            <button onClick={printNakal}
              style={{ padding: '10px 22px', borderRadius: 10, background: '#1A1714', color: '#9C8F7D', fontWeight: 600, fontSize: 13, border: '1px solid rgba(245,158,11,0.1)', cursor: 'pointer' }}>
              Print
            </button>
            <button onClick={() => setMode('enhanced')}
              style={{ padding: '10px 22px', borderRadius: 10, background: '#1A1714', color: '#9C8F7D', fontWeight: 600, fontSize: 13, border: '1px solid rgba(245,158,11,0.1)', cursor: 'pointer' }}>
              Enhanced View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
