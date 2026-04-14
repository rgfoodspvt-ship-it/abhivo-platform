'use client';
import { useEffect, useRef, useState } from 'react';

const API = 'http://34.47.173.239';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  loading?: boolean;
}

const suggestions = [
  { icon: '👤', text: 'Who owns khasra 9 murabba 73 खेवडा?' },
  { icon: '📋', text: 'Khewat 127 ka malik' },
  { icon: '⚡', text: 'Pending mutations राई' },
  { icon: '🏘️', text: 'बलवान की ज़मीन' },
];

export default function RecordsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [district, setDistrict] = useState('सोनीपत');
  const [tehsil, setTehsil] = useState('');
  const [village, setVillage] = useState('');
  const [khewatNo, setKhewatNo] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [tehsils, setTehsils] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [khewats, setKhewats] = useState<string[]>([]);
  const [khasrasList, setKhasrasList] = useState<{label: string; khasra: string; murabba: string; area: string; land_type: string; khewat: string}[]>([]);
  const [villageStats, setVillageStats] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'khewat' | 'owner' | 'khasra' | 'mutation'>('khewat');

  useEffect(() => {
    fetch(`${API}/districts`).then(r => r.json()).then(d => setDistricts((d.districts || []).filter((x: string) => x && !/^[A-Za-z]/.test(x)))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!district) return;
    setTehsil(''); setVillage(''); setVillages([]); setKhewats([]); setVillageStats(null); setSearchResults([]);
    fetch(`${API}/tehsils?district=${encodeURIComponent(district)}`)
      .then(r => r.json()).then(d => setTehsils(d.tehsils?.filter((t: string) => !/^[A-Za-z]/.test(t)) || [])).catch(() => {});
  }, [district]);
  useEffect(() => {
    if (!district || !tehsil) return;
    setVillage(''); setKhewats([]); setVillageStats(null); setSearchResults([]);
    fetch(`${API}/villages?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`)
      .then(r => r.json()).then(d => setVillages((d.villages || []).filter((v: string) => !/^[A-Za-z]/.test(v)))).catch(() => {});
  }, [district, tehsil]);
  useEffect(() => {
    if (!district || !village) return;
    setKhewats([]); setKhewatNo(''); setKhasrasList([]); setVillageStats(null); setSearchResults([]);
    fetch(`${API}/village-stats?district=${encodeURIComponent(district)}&village=${encodeURIComponent(village)}`)
      .then(r => r.json()).then(d => setVillageStats(d)).catch(() => {});
    fetch(`${API}/khewats?district=${encodeURIComponent(district)}&village=${encodeURIComponent(village)}`)
      .then(r => r.json()).then(d => setKhewats(d.khewats || [])).catch(() => {});
    fetch(`${API}/khasras-v3?village=${encodeURIComponent(village)}`)
      .then(r => r.json()).then(d => setKhasrasList(d.khasras || [])).catch(() => {});
  }, [district, village]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  async function sendChat(text?: string) {
    const msg = (text || chatInput).trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: msg };
    const botP: Message = { id: `b-${Date.now()}`, role: 'bot', text: '', loading: true };
    setMessages(prev => [...prev, userMsg, botP]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: msg, district, village }) });
      const data = await res.json();
      setMessages(prev => prev.map(m => m.id === botP.id ? { ...m, loading: false, text: data.answer || 'No results found.' } : m));
    } catch { setMessages(prev => prev.map(m => m.id === botP.id ? { ...m, loading: false, text: 'Connection error.' } : m)); }
    setChatLoading(false);
    inputRef.current?.focus();
  }

  async function doSearch() {
    if (!ownerQuery.trim() && searchMode !== 'khewat') return;
    setSearchLoading(true); setSearchResults([]);
    try {
      let url = '';
      if (searchMode === 'owner') { url = `${API}/search/owner?name=${encodeURIComponent(ownerQuery)}&page_size=100`; if (village) url += `&village=${encodeURIComponent(village)}`; if (district) url += `&district=${encodeURIComponent(district)}`; }
      else if (searchMode === 'khasra') { url = `${API}/search/khasra?khasra_no=${encodeURIComponent(ownerQuery)}`; if (village) url += `&village=${encodeURIComponent(village)}`; }
      else if (searchMode === 'mutation') { url = `${API}/search/mutation?mutation_no=${encodeURIComponent(ownerQuery)}`; if (village) url += `&village=${encodeURIComponent(village)}`; }
      if (url) { const res = await fetch(url); const data = await res.json(); setSearchResults(data.results || []); }
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }

  const dd: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 15,
    backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)', outline: 'none',
    fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif", fontWeight: 600,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C8F7D' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--bg-primary)' }}>

      {/* ═══ CHAT ═══ */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Chat header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="/abhivo-logo.png" alt="Abhivo" style={{ height: 32 }} />
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendChat(s.text)}
                    style={{ padding: '8px 14px', borderRadius: 20, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: "'Noto Sans Devanagari', sans-serif", transition: 'border-color 0.2s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                    {s.icon} {s.text}
                  </button>
                ))}
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                {m.role === 'bot' && <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#0F0D0A', flexShrink: 0, marginRight: 10, marginTop: 3 }}>A</div>}
                <div style={{ maxWidth: '85%' }}>
                  {m.loading ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>...</span>
                  ) : m.role === 'user' ? (
                    <div style={{ padding: '10px 16px', borderRadius: 20, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.1)', fontSize: 15, color: '#F5F0E8', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>{m.text}</div>
                  ) : (
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif", whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input — Claude style */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: '4px 4px 4px 20px', display: 'flex', alignItems: 'center' }}>
            <input ref={inputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any land record..."
              disabled={chatLoading}
              style={{ flex: 1, padding: '14px 0', fontSize: 16, background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }} />
            <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
              style={{ width: 40, height: 40, borderRadius: 20, background: chatInput.trim() ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'rgba(245,158,11,0.06)', color: chatInput.trim() ? '#0F0D0A' : 'var(--text-muted)', fontWeight: 700, fontSize: 18, border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              &#x2191;
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BROWSE ═══ */}
      <div style={{ padding: '28px 20px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>

          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>Browse Records</div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            {[
              { id: 'khewat' as const, label: 'By Khewat' },
              { id: 'owner' as const, label: 'By Owner Name' },
              { id: 'khasra' as const, label: 'By Khasra No.' },
              { id: 'mutation' as const, label: 'By Mutation' },
            ].map(m => (
              <button key={m.id} onClick={() => { setSearchMode(m.id); setSearchResults([]); setOwnerQuery(''); }}
                style={{ flex: 1, padding: '14px 8px', fontSize: 13, fontWeight: searchMode === m.id ? 700 : 400, background: searchMode === m.id ? 'rgba(245,158,11,0.1)' : 'transparent', color: searchMode === m.id ? '#FBBF24' : 'var(--text-muted)', border: 'none', borderRight: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 500 }}>जिला · District</label>
              <select value={district} onChange={e => setDistrict(e.target.value)} style={dd}><option value="">Select</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 500 }}>तहसील · Tehsil</label>
              <select value={tehsil} onChange={e => setTehsil(e.target.value)} style={dd}><option value="">Select</option>{tehsils.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 500 }}>गाँव · Village</label>
              <select value={village} onChange={e => setVillage(e.target.value)} style={dd}><option value="">Select</option>{villages.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
          </div>

          {/* Mode field + action */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              {searchMode === 'khewat' && <select value={khewatNo} onChange={e => setKhewatNo(e.target.value)} style={dd}><option value="">{khewats.length ? 'Select Khewat' : 'Select village first'}</option>{khewats.map(k => <option key={k} value={k}>{k}</option>)}</select>}
              {searchMode === 'owner' && <input value={ownerQuery} onChange={e => setOwnerQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="e.g. balwan or बलवान" style={dd} />}
              {searchMode === 'khasra' && (
                <select value={ownerQuery} onChange={e => { setOwnerQuery(e.target.value); const sel = khasrasList.find(k => k.label === e.target.value); if (sel?.khewat && village) window.open(`/nakal?village=${encodeURIComponent(village)}&khewat=${encodeURIComponent(sel.khewat)}`, '_blank'); }} style={dd}>
                  <option value="">{khasrasList.length ? 'Select Khasra' : 'Select village first'}</option>
                  {khasrasList.map((k, i) => { const isRed = k.khasra?.startsWith('[RED]') || k.label?.includes('[RED]'); return <option key={i} value={k.label}>{k.label.replace('[RED]', '')} — {k.area} {k.land_type} (खेवट {k.khewat}){isRed ? ' ⚠ लंबित' : ''}</option>; })}
                </select>
              )}
              {searchMode === 'mutation' && <input value={ownerQuery} onChange={e => setOwnerQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="e.g. 12330" style={dd} />}
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
              {searchMode === 'khewat' ? (<>
                <button onClick={() => { if (village && khewatNo) window.open(`/nakal?village=${encodeURIComponent(village)}&khewat=${encodeURIComponent(khewatNo)}`, '_blank'); }} disabled={!village || !khewatNo} style={{ padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 14, border: 'none', cursor: village && khewatNo ? 'pointer' : 'default', opacity: village && khewatNo ? 1 : 0.3, whiteSpace: 'nowrap' }}>Jamabandi</button>
                <button onClick={() => { if (village && khewatNo) window.open(`${API}/nakal/html?village=${encodeURIComponent(village)}&khewat=${encodeURIComponent(khewatNo)}&district=${encodeURIComponent(district)}`, '_blank'); }} disabled={!village || !khewatNo} style={{ padding: '12px 24px', borderRadius: 12, background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, border: '1px solid var(--glass-border)', cursor: village && khewatNo ? 'pointer' : 'default', opacity: village && khewatNo ? 1 : 0.3, whiteSpace: 'nowrap' }}>Nakal</button>
              </>) : (
                <button onClick={doSearch} disabled={!ownerQuery.trim()} style={{ padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', opacity: ownerQuery.trim() ? 1 : 0.3, whiteSpace: 'nowrap' }}>Search</button>
              )}
            </div>
          </div>

          {/* Stats */}
          {villageStats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              {[{ v: villageStats.khewats?.toLocaleString(), l: 'Khewats' }, { v: villageStats.owners?.toLocaleString(), l: 'Owners' }, { v: villageStats.khasras?.toLocaleString(), l: 'Khasras' }].map((s, i) => (
                <div key={i} className="glass-sm" style={{ padding: '14px 20px', flex: '1 1 120px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
              <div className="glass-sm" style={{ padding: '14px 20px', flex: '2 1 200px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{village}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tehsil} · {district}</div>
              </div>
            </div>
          )}

          {/* Results */}
          {searchLoading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Searching...</div>}
          {searchResults.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{searchResults.length} results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((r, i) => (
                  <a key={i} href={`/nakal?village=${encodeURIComponent(r.village_name)}&khewat=${encodeURIComponent(r.khewat_no)}`}
                    className="glass-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', textDecoration: 'none', color: 'var(--text-primary)', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
                        {searchMode === 'mutation' ? `#${r.mutation_no} ${r.mutation_type || ''}` : searchMode === 'khasra' ? `Khasra ${r.khasra_no} · ${r.area || ''}` : (r.first_owners || r.owner_name)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.village_name} · {r.tehsil_name || ''} · Khewat {r.khewat_no}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Jamabandi</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>|</span>
                      <span onClick={(e) => { e.preventDefault(); window.open(`${API}/nakal/html?village=${encodeURIComponent(r.village_name)}&khewat=${encodeURIComponent(r.khewat_no)}&district=${encodeURIComponent(district)}`, '_blank'); }} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Nakal</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!village && !searchResults.length && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>Select district, tehsil, and village to browse records</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
