'use client';
import { useState } from 'react';
import Link from 'next/link';

const leftLinks = [
  { href: '/records', label: 'Records' },
  { href: '/map', label: 'Map' },
  { href: '/nakal', label: 'Nakal' },
];

const rightLinks = [
  { href: '/chat', label: 'AI Chat' },
  { href: '/shajra', label: 'Shajra' },
];

const allLinks = [...leftLinks, ...rightLinks];

export function Navbar() {
  const [open, setOpen] = useState(false);

  const linkStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    color: '#9C8F7D', textDecoration: 'none', transition: 'all 0.2s',
    letterSpacing: '0.2px', whiteSpace: 'nowrap', ...extra,
  });

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(15, 13, 10, 0.85)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(245, 158, 11, 0.08)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
      }}>

        {/* Left links */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }} className="hidden md:flex">
          {leftLinks.map(l => (
            <Link key={l.href} href={l.href} style={linkStyle()}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F0E8'; e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9C8F7D'; e.currentTarget.style.background = 'transparent'; }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Center logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, gap: 6 }}>
          <img src="/abhivo-logo.png" alt="Abhivo" style={{ height: 34, width: 34, objectFit: 'contain', objectPosition: 'center top' }} />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.1em', color: '#F5F0E8' }}>ABHIVO</span>
        </Link>

        {/* Right links + actions */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }} className="hidden md:flex">
          {rightLinks.map(l => (
            <Link key={l.href} href={l.href} style={linkStyle()}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F0E8'; e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9C8F7D'; e.currentTarget.style.background = 'transparent'; }}>
              {l.label}
            </Link>
          ))}

          {/* Language toggle */}
          <button style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: '#9C8F7D', background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.1)', cursor: 'pointer',
            marginLeft: 8, transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'; e.currentTarget.style.color = '#F5F0E8'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.1)'; e.currentTarget.style.color = '#9C8F7D'; }}>
            हि / EN
          </button>

          {/* Login */}
          <Link href="/login" style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            color: '#F5F0E8', background: 'transparent',
            border: '1px solid rgba(245,158,11,0.15)', textDecoration: 'none',
            marginLeft: 4, transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.background = 'rgba(245,158,11,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.15)'; e.currentTarget.style.background = 'transparent'; }}>
            Log in
          </Link>

          {/* Sign up */}
          <Link href="/signup" style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            color: '#0F0D0A', background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            textDecoration: 'none', marginLeft: 4, transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(245,158,11,0.15)',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            Sign up
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="md:hidden" style={{
          background: 'none', border: 'none', color: '#F5F0E8', fontSize: 22,
          cursor: 'pointer', padding: 8,
        }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden" style={{
          padding: '12px 24px 20px',
          borderTop: '1px solid rgba(245,158,11,0.06)',
          background: 'rgba(15, 13, 10, 0.95)',
        }}>
          {allLinks.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              style={{
                display: 'block', padding: '14px 0', color: '#9C8F7D',
                textDecoration: 'none', fontSize: 16, fontWeight: 500,
                borderBottom: '1px solid rgba(245,158,11,0.04)',
              }}>
              {l.label}
            </Link>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link href="/login" style={{
              flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
              fontSize: 14, fontWeight: 600, color: '#F5F0E8',
              border: '1px solid rgba(245,158,11,0.15)', textDecoration: 'none',
            }}>Log in</Link>
            <Link href="/signup" style={{
              flex: 1, padding: '12px 0', borderRadius: 10, textAlign: 'center',
              fontSize: 14, fontWeight: 700, color: '#0F0D0A',
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', textDecoration: 'none',
            }}>Sign up</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
