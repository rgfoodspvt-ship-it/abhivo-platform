'use client';
import { useEffect, useState } from 'react';
import { fetchAPI } from '@/lib/api';

interface District {
  code: string; name: string; records: number; villages: number;
  v3_parsed: number; speed_per_hour: number; last_update: string | null;
  recent_1h: number; active: boolean;
}

interface Dashboard {
  districts: District[]; total_records: number; total_v3: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = () => {
    fetchAPI<Dashboard>('/scraper-dashboard').then(d => {
      setData(d);
      setLastRefresh(new Date());
    }).catch(e => console.error(e));
  };

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div style={{ fontSize: 14, color: '#9C8F7D' }}>Loading dashboard...</div>
    </div>
  );

  const active = data.districts.filter(d => d.active);
  const totalSpeed = data.districts.reduce((s, d) => s + d.speed_per_hour, 0);

  const fmt = (n: number) => n.toLocaleString('en-IN');

  const card: React.CSSProperties = {
    background: 'rgba(26,23,20,0.9)', borderRadius: 14,
    border: '1px solid rgba(245,158,11,0.08)', padding: '16px 20px',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F5F0E8', margin: 0 }}>
            Scraper <span style={{ color: '#F59E0B' }}>Dashboard</span>
          </h1>
          <p style={{ fontSize: 11, color: '#9C8F7D', margin: '4px 0 0' }}>
            Auto-refreshes every 15s · Last: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={load} style={{
          padding: '8px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 600,
          fontSize: 12, cursor: 'pointer',
        }}>Refresh</button>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { v: fmt(data.total_records), l: 'Total Records', sub: 'land_records2' },
          { v: fmt(data.total_v3), l: 'V3 Parsed', sub: 'land_records_v3' },
          { v: `${active.length} / ${data.districts.length}`, l: 'Active Scrapers', sub: active.map(d => d.name).join(', ') || 'None' },
          { v: `${fmt(totalSpeed)}/hr`, l: 'Speed', sub: 'records per hour' },
        ].map(s => (
          <div key={s.l} style={card}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>{s.v}</div>
            <div style={{ fontSize: 11, color: '#9C8F7D', marginTop: 2 }}>{s.l}</div>
            <div style={{ fontSize: 9, color: '#7A6E5E', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* District table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(245,158,11,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F0E8' }}>Districts</span>
          <span style={{ fontSize: 10, color: '#9C8F7D' }}>{data.districts.length} with data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(245,158,11,0.08)' }}>
              {['Status', 'District', 'Code', 'Records', 'Villages', 'V3 Parsed', 'Speed', 'Last 1hr', 'Last Update'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9C8F7D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.districts.map(d => (
              <tr key={d.code} style={{ borderBottom: '1px solid rgba(245,158,11,0.04)' }}>
                <td style={{ padding: '10px 12px' }}>
                  {d.active ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#56D364', boxShadow: '0 0 6px rgba(86,211,100,0.5)' }} />
                  ) : d.records > 0 ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#9C8F7D' }} />
                  ) : (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#333' }} />
                  )}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: d.active ? '#F59E0B' : '#F5F0E8' }}>{d.name}</td>
                <td style={{ padding: '10px 12px', color: '#9C8F7D', fontFamily: 'monospace' }}>{d.code}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F5F0E8', fontFamily: 'monospace' }}>{fmt(d.records)}</td>
                <td style={{ padding: '10px 12px', color: '#F5F0E8' }}>{d.villages}</td>
                <td style={{ padding: '10px 12px', color: d.v3_parsed > 0 ? '#56D364' : '#7A6E5E', fontFamily: 'monospace' }}>
                  {d.v3_parsed > 0 ? fmt(d.v3_parsed) : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {d.active ? (
                    <span style={{ color: '#56D364', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(d.speed_per_hour)}/hr</span>
                  ) : (
                    <span style={{ color: '#7A6E5E' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: d.recent_1h > 0 ? '#FBBF24' : '#7A6E5E', fontFamily: 'monospace' }}>
                  {d.recent_1h > 0 ? `+${fmt(d.recent_1h)}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#9C8F7D' }}>
                  {d.last_update ? new Date(d.last_update).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All 22 districts overview */}
      <div style={{ marginTop: 24, ...card }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F0E8', marginBottom: 12 }}>Haryana — All Districts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {['Ambala','Bhiwani','Faridabad','Fatehabad','Gurugram','Hisar','Jhajjar','Jind','Kaithal','Karnal',
            'Kurukshetra','Mahendragarh','Nuh','Palwal','Panchkula','Rohtak','Rewari','Sonipat','Sirsa','Yamunanagar','Panipat','CharkhiDadri'].map(name => {
            const d = data.districts.find(x => x.name === name);
            const pct = d ? Math.min(100, Math.round(d.records / 2000)) : 0; // rough progress
            return (
              <div key={name} style={{
                padding: '8px 10px', borderRadius: 8, fontSize: 11,
                background: d?.active ? 'rgba(86,211,100,0.06)' : d ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${d?.active ? 'rgba(86,211,100,0.15)' : d ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)'}`,
              }}>
                <div style={{ fontWeight: 600, color: d?.active ? '#56D364' : d ? '#F5F0E8' : '#7A6E5E', fontSize: 11 }}>{name}</div>
                <div style={{ fontSize: 10, color: '#9C8F7D', marginTop: 2 }}>
                  {d ? `${fmt(d.records)} rec` : 'Not started'}
                </div>
                {d?.active && <div style={{ fontSize: 9, color: '#56D364', marginTop: 1 }}>{fmt(d.speed_per_hour)}/hr</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: '#7A6E5E', textAlign: 'center' }}>
        Private dashboard · Not linked in navigation
      </div>
    </div>
  );
}
