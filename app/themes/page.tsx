'use client';
import { useState } from 'react';

const themes = [
  {
    name: 'Dark + Warm Amber',
    bg: '#0F0D0A', card: '#1A1714', accent: '#F59E0B', accentLight: '#FBBF24',
    text: '#F5F0E8', muted: '#9C8F7D', glow: 'rgba(245,158,11,0.15)',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
    orb1: 'rgba(245,158,11,0.08)', orb2: 'rgba(251,191,36,0.05)',
    desc: 'Your pick — dark, wheat harvest, warm Indian',
  },
  {
    name: 'Warm Cream + Terracotta',
    bg: '#FAF6F0', card: '#FFFFFF', accent: '#C4652A', accentLight: '#E07B3A',
    text: '#2C1810', muted: '#8B7355', glow: 'rgba(196,101,42,0.1)',
    gradient: 'linear-gradient(135deg, #C4652A, #E07B3A)',
    orb1: 'rgba(196,101,42,0.06)', orb2: 'rgba(196,101,42,0.03)',
    desc: 'Light, earthy, clay-soil feel, Indian architecture',
  },
  {
    name: 'Soft Sand + Forest Green',
    bg: '#F5F0E8', card: '#FFFFFF', accent: '#2D6A4F', accentLight: '#40916C',
    text: '#1B2A1F', muted: '#6B7F72', glow: 'rgba(45,106,79,0.1)',
    gradient: 'linear-gradient(135deg, #2D6A4F, #40916C)',
    orb1: 'rgba(45,106,79,0.05)', orb2: 'rgba(64,145,108,0.03)',
    desc: 'Light, farmland green, patwari register paper',
  },
  {
    name: 'Pearl White + Deep Amber',
    bg: '#FEFCF8', card: '#FFFFFF', accent: '#B8860B', accentLight: '#DAA520',
    text: '#1A1A1A', muted: '#7A7060', glow: 'rgba(184,134,11,0.1)',
    gradient: 'linear-gradient(135deg, #B8860B, #DAA520)',
    orb1: 'rgba(184,134,11,0.05)', orb2: 'rgba(218,165,32,0.03)',
    desc: 'Light, premium gold, Apple-clean minimal',
  },
  {
    name: 'Ivory + Indigo',
    bg: '#FFFEF5', card: '#FFFFFF', accent: '#4338CA', accentLight: '#6366F1',
    text: '#1E1B4B', muted: '#6B7280', glow: 'rgba(67,56,202,0.1)',
    gradient: 'linear-gradient(135deg, #4338CA, #6366F1)',
    orb1: 'rgba(67,56,202,0.04)', orb2: 'rgba(99,102,241,0.03)',
    desc: 'Light, modern tech, startup feel, unique',
  },
  {
    name: 'Parchment + Burnt Sienna',
    bg: '#F2EBE0', card: '#FDFAF5', accent: '#A0522D', accentLight: '#CD853F',
    text: '#3E2723', muted: '#8D6E63', glow: 'rgba(160,82,45,0.1)',
    gradient: 'linear-gradient(135deg, #A0522D, #CD853F)',
    orb1: 'rgba(160,82,45,0.05)', orb2: 'rgba(205,133,63,0.03)',
    desc: 'Light, aged document, heritage, revenue record',
  },
];

function ThemePreview({ t, active, onClick }: { t: typeof themes[0]; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: t.bg, borderRadius: 20, padding: 32, cursor: 'pointer',
      border: active ? `2px solid ${t.accent}` : '2px solid transparent',
      transition: 'all 0.3s', position: 'relative', overflow: 'hidden',
    }}>
      {/* Orb */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle, ${t.orb1} 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Badge */}
      <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 16, background: t.accent + '15', border: `1px solid ${t.accent}30`, fontSize: 11, color: t.accent, fontWeight: 500, marginBottom: 16 }}>
        {t.name}
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 28, fontWeight: 800, color: t.text, lineHeight: 1.2, marginBottom: 8 }}>
        Every Plot in Haryana,<br />
        <span style={{ background: t.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>One Click Away</span>
      </h2>
      <p style={{ fontSize: 13, color: t.muted, marginBottom: 20 }}>{t.desc}</p>

      {/* Search bar mini */}
      <div style={{ background: `${t.card}CC`, backdropFilter: 'blur(12px)', border: `1px solid ${t.accent}25`, borderRadius: 12, padding: 4, display: 'flex', gap: 6, boxShadow: `0 0 15px ${t.glow}` }}>
        <div style={{ flex: 1, padding: '10px 14px', fontSize: 13, color: t.muted }}>Search owner, khewat...</div>
        <div style={{ padding: '10px 20px', borderRadius: 10, background: t.gradient, color: t.bg, fontWeight: 600, fontSize: 13 }}>Search</div>
      </div>

      {/* Stats mini */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
        {[{ v: '261K+', l: 'Records' }, { v: '3.6M', l: 'Polygons' }, { v: '346', l: 'Villages' }].map((s, i) => (
          <div key={i} style={{ background: t.card, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `1px solid ${t.accent}10` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{s.v}</div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Feature card mini */}
      <div style={{ background: t.card, borderRadius: 12, padding: 16, marginTop: 12, border: `1px solid ${t.accent}08` }}>
        <div style={{ fontSize: 18, marginBottom: 6 }}>🗺️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Cadastral Map</div>
        <div style={{ fontSize: 12, color: t.muted }}>Click any plot to see owner details</div>
      </div>
    </div>
  );
}

export default function ThemesPage() {
  const [selected, setSelected] = useState(0);

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Pick a Theme</h1>
      <p style={{ textAlign: 'center', color: '#8B949E', marginBottom: 40 }}>Click to compare. Selected: <span style={{ color: themes[selected].accent, fontWeight: 600 }}>{themes[selected].name}</span></p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {themes.map((t, i) => (
          <ThemePreview key={i} t={t} active={selected === i} onClick={() => setSelected(i)} />
        ))}
      </div>
    </div>
  );
}
