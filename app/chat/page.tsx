'use client';
import { useEffect, useRef, useState } from 'react';

const API = 'http://34.47.173.239';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  sources?: { village: string; khewat: string; owner?: string }[];
  timestamp: Date;
  loading?: boolean;
}

const suggestions = [
  { icon: '👤', text: 'Who owns khasra 9 in murabba 73 of Khewra?', cat: 'Owner' },
  { icon: '📋', text: 'Show all records for khewat 127 in Rai', cat: 'Khewat' },
  { icon: '⚡', text: 'Pending mutations in खेवडा village', cat: 'Mutation' },
  { icon: '🏘️', text: 'How much land does बलवान own in Sonipat?', cat: 'Search' },
  { icon: '🗺️', text: 'List all khasras in murabba 86 of Baroda', cat: 'Khasra' },
  { icon: '📊', text: 'Total owners in Ganaur tehsil', cat: 'Stats' },
];

const quickActions = [
  { label: 'Search Owner', icon: '👤', prompt: 'Find land records for owner name: ' },
  { label: 'Lookup Khewat', icon: '📋', prompt: 'Show details for khewat number ' },
  { label: 'Check Khasra', icon: '🗺️', prompt: 'Who owns khasra ' },
  { label: 'Mutations', icon: '⚡', prompt: 'Show pending mutations in village ' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [district, setDistrict] = useState('सोनीपत');
  const [tehsil, setTehsil] = useState('');
  const [village, setVillage] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [tehsils, setTehsils] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load districts
  useEffect(() => {
    fetch(`${API}/districts`).then(r => r.json()).then(d => setDistricts(d.districts)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!district) return;
    setTehsil(''); setVillage(''); setVillages([]);
    fetch(`${API}/tehsils?district=${encodeURIComponent(district)}`)
      .then(r => r.json())
      .then(d => setTehsils(d.tehsils.filter((t: string) => !/^[A-Za-z]/.test(t))))
      .catch(() => {});
  }, [district]);

  useEffect(() => {
    if (!district || !tehsil) return;
    setVillage('');
    fetch(`${API}/villages?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`)
      .then(r => r.json()).then(d => setVillages(d.villages)).catch(() => {});
  }, [district, tehsil]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msg,
      timestamp: new Date(),
    };

    const botPlaceholder: Message = {
      id: `b-${Date.now()}`,
      role: 'bot',
      text: '',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, botPlaceholder]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, district, tehsil, village }),
      });
      const data = await res.json();
      const botMsg: Message = {
        id: botPlaceholder.id,
        role: 'bot',
        text: data.response || data.answer || 'No results found for your query.',
        sources: data.sources || [],
        timestamp: new Date(),
      };
      setMessages(prev => prev.map(m => m.id === botPlaceholder.id ? botMsg : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === botPlaceholder.id ? {
        ...m, loading: false, text: 'Connection error. Please check if the server is running and try again.',
      } : m));
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  function clearChat() {
    setMessages([]);
  }

  const glass: React.CSSProperties = {
    background: 'rgba(15,13,10,0.88)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(245,158,11,0.1)',
  };

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, fontSize: 12,
    background: '#1A1714', color: '#F5F0E8',
    border: '1px solid rgba(245,158,11,0.08)',
    outline: 'none', fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif",
    minWidth: 0, flex: 1,
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ─── Sidebar ─── */}
      <div style={{
        width: 280, flexShrink: 0, borderRight: '1px solid rgba(245,158,11,0.06)',
        background: 'rgba(15,13,10,0.5)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} className="hidden lg:flex">

        {/* Context header */}
        <div style={{ padding: '20px 18px 12px' }}>
          <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Search Context
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={district} onChange={e => setDistrict(e.target.value)} style={selectStyle}>
              <option value="">All Districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={tehsil} onChange={e => setTehsil(e.target.value)} style={selectStyle}>
              <option value="">All Tehsils</option>
              {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={village} onChange={e => setVillage(e.target.value)} style={selectStyle}>
              <option value="">All Villages ({villages.length})</option>
              {villages.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(245,158,11,0.06)', margin: '4px 18px' }} />

        {/* Quick Actions */}
        <div style={{ padding: '12px 18px' }}>
          <div style={{ fontSize: 11, color: '#7A6E5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => { setInput(a.prompt); inputRef.current?.focus(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, background: 'transparent', border: 'none',
                  color: '#9C8F7D', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', width: '100%',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; e.currentTarget.style.color = '#F5F0E8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C8F7D'; }}>
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(245,158,11,0.06)', margin: '4px 18px' }} />

        {/* Info */}
        <div style={{ padding: '12px 18px', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#7A6E5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Capabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { t: 'Owner Lookup', d: 'Find who owns any khasra/khewat' },
              { t: 'Lineage Search', d: 'Search by father/grandfather name' },
              { t: 'Share Details', d: 'See ownership percentages' },
              { t: 'Mutation Status', d: 'Check pending/completed mutations' },
              { t: 'Hindi + English', d: 'Ask in either language' },
            ].map((c, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                <div style={{ color: '#F5F0E8', fontWeight: 500 }}>{c.t}</div>
                <div style={{ color: '#7A6E5E', fontSize: 11 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clear chat */}
        {messages.length > 0 && (
          <div style={{ padding: '12px 18px' }}>
            <button onClick={clearChat} style={{
              width: '100%', padding: '10px', borderRadius: 10,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)',
              color: '#EF4444', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}>
              Clear Conversation
            </button>
          </div>
        )}
      </div>

      {/* ─── Main Chat Area ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Chat Header */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(245,158,11,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15,13,10,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              <span style={{ filter: 'grayscale(0)' }}>&#x1F916;</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F0E8' }}>
                Abhivo AI Assistant
              </div>
              <div style={{ fontSize: 11, color: '#56D364', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#56D364',
                  display: 'inline-block', animation: 'pulse 2s infinite',
                }} />
                Online · Powered by V3 Data
              </div>
            </div>
          </div>

          {/* Mobile context toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {district && (
              <div style={{
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)',
                fontSize: 11, color: '#F59E0B', fontFamily: "'Noto Sans Devanagari', sans-serif",
              }}>
                {village || tehsil || district}
              </div>
            )}
            <button onClick={() => setShowContext(!showContext)} className="lg:hidden"
              style={{
                padding: '6px 10px', borderRadius: 8,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)',
                color: '#9C8F7D', fontSize: 12, cursor: 'pointer',
              }}>
              {showContext ? 'Hide' : 'Context'}
            </button>
          </div>
        </div>

        {/* Mobile context panel */}
        {showContext && (
          <div className="lg:hidden" style={{
            padding: '12px 20px', borderBottom: '1px solid rgba(245,158,11,0.06)',
            background: 'rgba(15,13,10,0.5)',
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={district} onChange={e => setDistrict(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">District</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={tehsil} onChange={e => setTehsil(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Tehsil</option>
                {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={village} onChange={e => setVillage(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Village</option>
                {villages.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ─── Messages ─── */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 16px' }}>

          {/* Empty state — suggestions */}
          {messages.length === 0 && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {/* Welcome */}
              <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 40 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))',
                  border: '1px solid rgba(245,158,11,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>
                  <span>&#x1F916;</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F5F0E8', marginBottom: 6 }}>
                  Ask anything about <span className="text-gold-gradient">Haryana Land Records</span>
                </h2>
                <p style={{ fontSize: 14, color: '#7A6E5E', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                  I can look up owners, check khasra details, find mutations, and answer questions in Hindi or English.
                </p>
              </div>

              {/* Suggestion grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s.text)}
                    style={{
                      ...glass, borderRadius: 12, padding: '14px 16px',
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                        {s.cat}
                      </div>
                      <div style={{ fontSize: 13, color: '#F5F0E8', lineHeight: 1.4, fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>
                        {s.text}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((m) => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
              maxWidth: 800,
              margin: m.role === 'user' ? '0 0 16px auto' : '0 auto 16px 0',
            }}>
              <div style={{ maxWidth: '80%', display: 'flex', gap: 10, alignItems: 'flex-start' }}>

                {/* Bot avatar */}
                {m.role === 'bot' && (
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
                    border: '1px solid rgba(245,158,11,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, marginTop: 2,
                  }}>
                    <span>&#x1F916;</span>
                  </div>
                )}

                <div>
                  {/* Message bubble */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))'
                      : '#1A1714',
                    border: `1px solid ${m.role === 'user' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.06)'}`,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                    borderBottomLeftRadius: m.role === 'bot' ? 4 : 14,
                  }}>
                    {m.loading ? (
                      <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#F59E0B', opacity: 0.4,
                            animation: `dotPulse 1.4s ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        color: m.role === 'user' ? '#FBBF24' : '#F5F0E8',
                        fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif",
                      }}>
                        {m.text}
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {m.sources && m.sources.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {m.sources.slice(0, 5).map((s, i) => (
                        <a key={i}
                          href={`/nakal?village=${encodeURIComponent(s.village)}&khewat=${s.khewat}`}
                          style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10,
                            background: 'rgba(88,166,255,0.06)',
                            border: '1px solid rgba(88,166,255,0.1)',
                            color: '#58A6FF', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <span style={{ fontSize: 8 }}>&#x1F4CB;</span>
                          {s.village} KH-{s.khewat}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div style={{ fontSize: 10, color: '#5C5244', marginTop: 4, paddingLeft: 4 }}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* User avatar */}
                {m.role === 'user' && (
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: '#F59E0B', fontWeight: 600, marginTop: 2,
                  }}>
                    U
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Input Bar ─── */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid rgba(245,158,11,0.06)',
          background: 'rgba(15,13,10,0.5)',
        }}>
          {/* Quick reply chips */}
          {messages.length > 0 && messages[messages.length - 1]?.role === 'bot' && !loading && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {['Show on map', 'View nakal', 'More details', 'Search another'].map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 11,
                    background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)',
                    color: '#9C8F7D', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F5F0E8'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9C8F7D'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.08)'; }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            ...glass, borderRadius: 14, padding: '6px 6px 6px 16px',
          }}>
            <input ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about any land record in Haryana..."
              disabled={loading}
              style={{
                flex: 1, padding: '12px 0', fontSize: 15,
                background: 'transparent', color: '#F5F0E8',
                border: 'none', outline: 'none',
                fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif",
                opacity: loading ? 0.5 : 1,
              }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: input.trim()
                  ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
                  : 'rgba(245,158,11,0.08)',
                color: input.trim() ? '#0F0D0A' : '#7A6E5E',
                fontWeight: 700, fontSize: 14, border: 'none',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s', minWidth: 48,
              }}>
              {loading ? (
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>&#x21BB;</span>
              ) : '&#x2192;'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#5C5244' }}>
              Abhivo AI queries 220K+ verified land records across Haryana
            </span>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
