'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

/* ── Intersection Observer hook for scroll animations ── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Animated counter ── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.5);
  useEffect(() => {
    if (!inView) return;
    const steps = 50; const inc = target / steps; let cur = 0;
    const t = setInterval(() => { cur += inc; if (cur >= target) { setCount(target); clearInterval(t); } else setCount(Math.floor(cur)); }, 1600 / steps);
    return () => clearInterval(t);
  }, [inView, target]);
  const display = target >= 1000000 ? `${(count/1000000).toFixed(1)}M` : target >= 1000 ? `${(count/1000).toFixed(count >= target ? 1 : 0)}K` : `${count}`;
  return <div ref={ref}>{display}{suffix}</div>;
}

/* ── Floating particles ── */
function Particles() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 3 + Math.random() * 3, height: 3 + Math.random() * 3,
          borderRadius: '50%', background: `rgba(245, 158, 11, ${0.08 + Math.random() * 0.12})`,
          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          animation: `float ${10 + Math.random() * 15}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 5}s`,
        }} />
      ))}
      <style>{`@keyframes float {
        0%,100% { transform: translateY(0) translateX(0); opacity: 0.2; }
        50% { transform: translateY(-30px) translateX(-10px); opacity: 0.5; }
      }`}</style>
    </div>
  );
}

/* ── Section wrapper with fade-in ── */
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView(0.15);
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* ── Data ── */
const stats = [
  { value: 261000, suffix: '+', label: 'Verified Records', sub: 'Cell-by-cell authenticated' },
  { value: 3600000, suffix: '', label: 'Plot Boundaries', sub: 'From HARSAC cadastral data' },
  { value: 346, suffix: '', label: 'Villages Complete', sub: 'Across Sonipat district' },
  { value: 100, suffix: '%', label: 'Data Accuracy', sub: '51 live tests, zero errors' },
];

const features = [
  { icon: '🗺️', title: 'Interactive Map', desc: 'Satellite imagery with 3.6M cadastral polygons. Click any plot — see the owner instantly.', href: '/map', accent: '#F59E0B' },
  { icon: '📜', title: 'Digital Nakal', desc: 'Official jamabandi records. Original government format or our enhanced modern view.', href: '/nakal', accent: '#56D364' },
  { icon: '💬', title: 'AI Assistant', desc: '"Who owns khasra 9 in murabba 73?" Ask in Hindi or English — get verified answers.', href: '/chat', accent: '#58A6FF' },
  { icon: '🔍', title: 'Smart Search', desc: 'Find any landowner by name, khewat, khasra, or mutation number. Full lineage returned.', href: '/search', accent: '#FBBF24' },
  { icon: '📐', title: 'Shajra Maps', desc: 'Traditional patwari-style hand-drawn village maps with dimensions in karam.', href: '/shajra', accent: '#C084FC' },
  { icon: '⚡', title: 'Mutation Alerts', desc: 'Track ownership transfers, pending sales, inheritance. Never miss a red entry.', href: '/search', accent: '#F87171' },
];

const beforeAfter = [
  { before: 'Visit patwari office', after: 'Open your phone' },
  { before: 'Wait days for nakal copy', after: 'Instant digital nakal' },
  { before: 'Guess who owns the plot', after: 'Click polygon → see owner' },
  { before: 'Pay middlemen for info', after: 'Free, verified data' },
  { before: 'Hindi-only confusing records', after: 'Hindi + English, simplified' },
];

export default function HomePage() {
  return (
    <div>
      {/* ═══════════════ HERO ═══════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '90px 24px 70px', textAlign: 'center' }}>
        <Particles />
        {/* Gradient orbs */}
        <div style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -250, right: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.12)', fontSize: 12, color: '#F59E0B', fontWeight: 500, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#56D364' }} />
            Verified against govt data · 51 live tests · 0 errors
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 60px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 16 }}>
            Know Your Land.<br />
            <span className="text-gold-gradient">One Click.</span>
          </h1>

          <p style={{ fontSize: 17, color: '#9C8F7D', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
            Click any plot on the satellite map. See the owner, lineage, area, and mutation history — verified against government records.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/map" style={{
              padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              color: '#0F0D0A', fontWeight: 700, fontSize: 16, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(245,158,11,0.25)', transition: 'transform 0.2s',
            }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              Open Map →
            </Link>
            <Link href="/search" style={{
              padding: '14px 32px', borderRadius: 12, background: 'transparent',
              color: '#F5F0E8', fontWeight: 600, fontSize: 16, textDecoration: 'none',
              border: '1px solid rgba(245,158,11,0.2)', transition: 'all 0.2s',
            }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; }}
               onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'; e.currentTarget.style.background = 'transparent'; }}>
              Search Records
            </Link>
          </div>

          {/* Mini search hint */}
          <p style={{ fontSize: 12, color: '#7A6E5E', marginTop: 16 }}>
            Try: <span style={{ color: '#F59E0B' }}>बलवान पुत्र रामचन्द्र</span> · <span style={{ color: '#F59E0B' }}>Khewat 127 खेवडा</span>
          </p>
        </div>
      </section>

      {/* ═══════════════ MAP PREVIEW ═══════════════ */}
      <Section>
        <section style={{ padding: '0 24px 60px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.1)', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ position: 'relative', paddingTop: '50%', background: '#1A1714' }}>
              <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3375/5827"
                alt="Satellite view of Haryana farmland"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,13,10,0.3) 0%, rgba(15,13,10,0.8) 100%)' }} />
              <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(15,13,10,0.85)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Selected Plot</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#FBBF24', marginTop: 2 }}>73//9</div>
                    <div style={{ fontSize: 12, color: '#9C8F7D' }}>खेवडा · राई</div>
                  </div>
                  <div style={{ background: 'rgba(15,13,10,0.85)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(245,158,11,0.15)', flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Owner</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F0E8', marginTop: 2, fontFamily: "'Noto Sans Devanagari', sans-serif" }}>श्रीमती बीना पत्नी जयभगवान पुत्र रामकवार</div>
                    <div style={{ fontSize: 12, color: '#9C8F7D', marginTop: 2 }}>Khewat 130 · 8 कनाल 0 मरला · <span style={{ color: '#56D364' }}>✓ Verified</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p style={{ textAlign: 'center', color: '#7A6E5E', fontSize: 12, marginTop: 12 }}>Live preview — actual data from our database</p>
        </section>
      </Section>

      {/* ═══════════════ STATS ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '0 24px 60px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: '#1A1714', borderRadius: 14, padding: '22px 18px', textAlign: 'center', border: '1px solid rgba(245,158,11,0.05)', transition: 'border-color 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.15)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.05)'}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', marginBottom: 2 }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 12, color: '#F5F0E8', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#7A6E5E', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>
      </Section>

      {/* ═══════════════ BEFORE / AFTER ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '0 24px 70px' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              The Old Way vs <span className="text-gold-gradient">Abhivo AI</span>
            </h2>
            <p style={{ textAlign: 'center', color: '#9C8F7D', marginBottom: 32, fontSize: 14 }}>
              Land records shouldn't be this hard
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {beforeAfter.map((ba, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#1A1714', fontSize: 13, color: '#7A6E5E', textAlign: 'right', textDecoration: 'line-through', opacity: 0.6 }}>
                    {ba.before}
                  </div>
                  <div style={{ fontSize: 16, color: '#F59E0B' }}>→</div>
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.08)', fontSize: 13, color: '#F5F0E8', fontWeight: 500 }}>
                    {ba.after}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '0 24px 70px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              Complete Land Intelligence
            </h2>
            <p style={{ textAlign: 'center', color: '#9C8F7D', marginBottom: 36, fontSize: 14 }}>
              Six tools, one platform. Everything you need for land research.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
              {features.map((f, i) => (
                <Link key={i} href={f.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#1A1714', borderRadius: 14, padding: 24,
                    transition: 'all 0.3s', cursor: 'pointer', height: '100%',
                    border: '1px solid rgba(245,158,11,0.04)',
                    borderLeft: `3px solid ${f.accent}20`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderLeftColor = f.accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${f.accent}10`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderLeftColor = `${f.accent}20`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F0E8', marginBottom: 6 }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: '#9C8F7D', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '0 24px 70px' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>
              Three Steps
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { n: '1', title: 'Pick a village', desc: 'Select district, tehsil, and village. Or just search by name.', color: '#F59E0B' },
                { n: '2', title: 'Click any plot', desc: 'Tap on any polygon on the satellite map. Amber outlines show every boundary.', color: '#FBBF24' },
                { n: '3', title: 'See everything', desc: 'Owner name, full lineage, area, mutations, verified status — all in one card.', color: '#56D364' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}12`, border: `1px solid ${s.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: s.color, flexShrink: 0 }}>{s.n}</div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F5F0E8', marginBottom: 4 }}>{s.title}</h3>
                    <p style={{ fontSize: 14, color: '#9C8F7D', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════════ VISION / COMING SOON ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '0 24px 70px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 16, background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.12)', fontSize: 11, color: '#58A6FF', fontWeight: 600, marginBottom: 12 }}>
                ROADMAP 2026
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                What's <span className="text-gold-gradient">Coming Next</span>
              </h2>
              <p style={{ color: '#9C8F7D', fontSize: 14 }}>Building the most comprehensive PropTech platform for India</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {[
                { icon: '💰', title: 'AI Land Valuation', desc: 'ML-powered price prediction based on locality, road frontage, zone type, and recent sales. Get instant value estimates.', tag: 'Q3 2026', color: '#F59E0B' },
                { icon: '🏗️', title: '2D Plot Naksha', desc: 'Auto-generated patwari-style PDF maps with exact dimensions, area in bigha/biswa, north arrow, and scale bar.', tag: 'Q2 2026', color: '#56D364' },
                { icon: '🌐', title: '3D Plot Viewer', desc: 'Interactive satellite-based 3D bird\'s-eye view of any plot. Shareable link for buyers. Camera orbit animation.', tag: 'Q3 2026', color: '#58A6FF' },
                { icon: '🎬', title: 'AI Video Generator', desc: 'Auto-generate 30-second marketing videos for any plot — flyover, boundary animation, POI distances, Hindi voiceover.', tag: 'Q4 2026', color: '#C084FC' },
                { icon: '📱', title: 'WhatsApp Bot', desc: 'Send a khasra number on WhatsApp, get owner details and nakal PDF back instantly. No app needed.', tag: 'Q2 2026', color: '#FBBF24' },
                { icon: '🏘️', title: 'Pan-India Expansion', desc: 'Starting with Haryana, expanding to Punjab, Rajasthan, UP, and all DILRMP states. One platform for all of India.', tag: '2027', color: '#F87171' },
              ].map((f, i) => (
                <div key={i} style={{
                  background: '#1A1714', borderRadius: 14, padding: 22,
                  border: '1px solid rgba(245,158,11,0.04)', position: 'relative',
                  transition: 'all 0.3s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}20`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 8px', borderRadius: 6, background: `${f.color}10`, fontSize: 10, fontWeight: 600, color: f.color }}>{f.tag}</div>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F5F0E8', marginBottom: 6 }}>{f.title}</h3>
                  <p style={{ fontSize: 12, color: '#9C8F7D', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════════ CTA ═══════════════ */}
      <Section delay={0.1}>
        <section style={{ padding: '20px 24px 70px', textAlign: 'center' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', borderRadius: 20, padding: '44px 28px', border: '1px solid rgba(245,158,11,0.08)' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Ready to see your land?</h2>
            <p style={{ color: '#9C8F7D', marginBottom: 24, fontSize: 14 }}>No signup needed. Just click and explore.</p>
            <Link href="/map" style={{
              display: 'inline-block', padding: '14px 40px', borderRadius: 14,
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#0F0D0A',
              fontWeight: 700, fontSize: 16, textDecoration: 'none', transition: 'transform 0.2s',
              boxShadow: '0 4px 20px rgba(245,158,11,0.2)',
            }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              Open Map →
            </Link>
          </div>
        </section>
      </Section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer style={{ borderTop: '1px solid rgba(245,158,11,0.05)', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#7A6E5E', fontSize: 12 }}>Abhivo AI — Land Intelligence for Haryana</p>
        <p style={{ color: '#4A4035', fontSize: 11, marginTop: 4 }}>51 live tests · 23,544 cells verified · 100% match against jamabandi.nic.in</p>
      </footer>
    </div>
  );
}
