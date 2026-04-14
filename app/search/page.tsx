'use client';
import { useEffect, useState } from 'react';

const API = 'http://34.47.173.239';

type SearchMode = 'owner' | 'khewat' | 'khasra' | 'mutation';

export default function JambandiPage() {
  const [district, setDistrict] = useState('सोनीपत');
  const [tehsil, setTehsil] = useState('');
  const [village, setVillage] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [tehsils, setTehsils] = useState<string[]>([]);
  const [villageNames, setVillageNames] = useState<string[]>([]);
  const [mode, setMode] = useState<SearchMode>('owner');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: 'bot', text: 'नमस्ते! I can help you find any land record. What are you looking for?' }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Load cascading dropdowns
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

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      let url = '';
      if (mode === 'owner') {
        url = `${API}/search/owner?name=${encodeURIComponent(query)}&page_size=20`;
        if (village) url += `&village=${encodeURIComponent(village)}`;
        if (district) url += `&district=${encodeURIComponent(district)}`;
      }
      // Other modes would hit different endpoints
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setLoading(false);
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatMessages(prev => [...prev, { role: 'bot', text: 'Let me search for that...' }]);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, district, tehsil, village })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'bot', text: data.response || data.answer || 'No results found.' }]);
    } catch {
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'bot', text: 'Sorry, could not process your request.' }]);
    }
  }

  const glass = { background: 'rgba(15,13,10,0.88)', backdropFilter: 'blur(16px)', border: '1px solid rgba(245,158,11,0.1)' };
  const selectStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, background: '#1A1714', color: '#F5F0E8', border: '1px solid rgba(245,158,11,0.08)', outline: 'none', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" };
  const modes: { id: SearchMode; label: string; icon: string; placeholder: string }[] = [
    { id: 'owner', label: 'Owner Name', icon: '👤', placeholder: 'e.g. बलवान पुत्र रामचन्द्र' },
    { id: 'khewat', label: 'Khewat No', icon: '📋', placeholder: 'e.g. 127' },
    { id: 'khasra', label: 'Khasra No', icon: '🗺️', placeholder: 'e.g. 9' },
    { id: 'mutation', label: 'Mutation', icon: '⚡', placeholder: 'e.g. 12330' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>🔍 <span className="text-gold-gradient">Jamabandi Search</span></h1>
        <p style={{ color: '#9C8F7D', fontSize: 13, marginTop: 2 }}>Search land records by owner, khewat, khasra, or mutation</p>
      </div>

      {/* Cascading dropdowns */}
      <div style={{ ...glass, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📍 Location</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>District · जिला</label>
            <select value={district} onChange={e => setDistrict(e.target.value)} style={selectStyle}>
              <option value="">Select</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Tehsil · तहसील</label>
            <select value={tehsil} onChange={e => setTehsil(e.target.value)} style={selectStyle}>
              <option value="">Select</option>
              {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Village · गाँव</label>
            <select value={village} onChange={e => setVillage(e.target.value)} style={selectStyle}>
              <option value="">Select ({villageNames.length})</option>
              {villageNames.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Search mode tabs + input */}
      <div style={{ ...glass, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setQuery(''); setResults([]); }}
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: mode === m.id ? 600 : 400, border: 'none', cursor: 'pointer', background: mode === m.id ? 'rgba(245,158,11,0.12)' : 'transparent', color: mode === m.id ? '#FBBF24' : '#9C8F7D', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder={modes.find(m => m.id === mode)?.placeholder}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 15, background: '#1A1714', color: '#F5F0E8', border: '1px solid rgba(245,158,11,0.1)', outline: 'none', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }} />
          <button onClick={search} disabled={loading}
            style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 13, color: '#9C8F7D', marginBottom: 12 }}>{results.length} results found</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{ ...glass, borderRadius: 12, padding: 18, transition: 'border-color 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.1)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#F5F0E8', fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
                      {r.first_owners || r.owner_name || r.village_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#9C8F7D', marginTop: 2 }}>
                      {r.village_name} · {r.tehsil_name} · Khewat {r.khewat_no}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={`/nakal?village=${encodeURIComponent(r.village_name)}&khewat=${r.khewat_no}`}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)', color: '#F59E0B', textDecoration: 'none' }}>
                      View Nakal
                    </a>
                    <a href={`/map?village=${encodeURIComponent(r.village_name)}`}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.12)', color: '#58A6FF', textDecoration: 'none' }}>
                      Show on Map
                    </a>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#7A6E5E' }}>
                  <span>KH: {r.khewat_no}</span>
                  {r.khatoni_no && <span>KT: {r.khatoni_no}</span>}
                  {r.khasra_count && <span>Khasras: {r.khasra_count}</span>}
                  {r.jamabandi_year && <span>Year: {r.jamabandi_year}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!results.length && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A6E5E' }}>
          <p style={{ fontSize: 14 }}>Select location and search to find records</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Or use the <span style={{ color: '#F59E0B', cursor: 'pointer' }} onClick={() => setChatOpen(true)}>AI Assistant 💬</span> for guided search</p>
        </div>
      )}

      {/* ── Chat Overlay ── */}
      {/* Toggle button */}
      <button onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 50,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
          color: '#0F0D0A', fontSize: 24, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {chatOpen ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20, zIndex: 50,
          width: 380, maxHeight: 500, borderRadius: 16,
          ...glass, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderColor: 'rgba(245,158,11,0.15)',
        }}>
          {/* Chat header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(245,158,11,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E8' }}>💬 AI Assistant</div>
              <div style={{ fontSize: 11, color: '#7A6E5E' }}>Ask anything about land records</div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#9C8F7D', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340 }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px', borderRadius: 12,
                background: m.role === 'user' ? 'rgba(245,158,11,0.12)' : '#1A1714',
                color: m.role === 'user' ? '#FBBF24' : '#F5F0E8',
                fontSize: 13, lineHeight: 1.5,
                fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif",
                borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: m.role === 'bot' ? 4 : 12,
              }}>
                {m.text}
              </div>
            ))}
          </div>

          {/* Suggestion chips */}
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Who owns khasra 9 murabba 73?', 'Pending mutations in खेवडा', 'Land of बलवान'].map((s, i) => (
              <button key={i} onClick={() => { setChatInput(s); }}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)', color: '#9C8F7D', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(245,158,11,0.06)', display: 'flex', gap: 6 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any land record..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13, background: '#1A1714', color: '#F5F0E8', border: '1px solid rgba(245,158,11,0.06)', outline: 'none' }} />
            <button onClick={sendChat}
              style={{ padding: '10px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
