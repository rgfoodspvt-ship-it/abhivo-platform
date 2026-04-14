'use client';
import { useEffect, useRef, useState } from 'react';
import rough from 'roughjs';

interface PF { geometry: { coordinates: any; type: string }; properties: { khasra_no: string; khewat_no: string; area_acres?: number; [k: string]: any }; }
interface V3Plot { murabba: string; khasra: string; area_kanal?: number; area_marla?: number; land_type?: string; owners?: string; acquired?: boolean; [k: string]: any; }
interface V3Data { plots: V3Plot[]; acquired: string[]; }

function getRing(f: PF): number[][] | null {
  const g = f.geometry; if (!g?.coordinates) return null;
  return g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] || null : g.coordinates[0] || null;
}
function centroid(c: number[][]): [number, number] {
  const n = c.length;
  if (n < 3) return [c.reduce((s, p) => s + p[1], 0) / n, c.reduce((s, p) => s + p[0], 0) / n];
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < n - 1; i++) { const cr = c[i][0]*c[i+1][1] - c[i+1][0]*c[i][1]; A += cr; cx += (c[i][0]+c[i+1][0])*cr; cy += (c[i][1]+c[i+1][1])*cr; }
  A *= 0.5; if (Math.abs(A) < 1e-10) return [c.reduce((s, p) => s + p[1], 0) / n, c.reduce((s, p) => s + p[0], 0) / n];
  return [cy / (6 * A), cx / (6 * A)];
}
function hav(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000, dL = (lat2-lat1)*Math.PI/180, dG = (lng2-lng1)*Math.PI/180;
  return 2*R*Math.asin(Math.min(1, Math.sqrt(Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2)));
}
function pxArea(pts: number[][]) { let a = 0; for (let i = 0; i < pts.length-1; i++) a += pts[i][0]*pts[i+1][1] - pts[i+1][0]*pts[i][1]; return Math.abs(a)/2; }

interface Props { features: PF[]; selectedKeys: Set<string>; village: string; tehsil: string; district: string; v3Data?: V3Data; }

export default function ShajraCanvas({ features, selectedKeys, village, tehsil, district, v3Data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ref.current || !features.length || !selectedKeys.size) return;
    const go = async () => {
      const C = ref.current!;
      const rc = rough.canvas(C);
      const ctx = C.getContext('2d')!;

      // ── SELECTED ONLY ──
      const sel: PF[] = [];
      features.forEach(f => { if (!getRing(f)) return; const k = f.properties.khasra_no+'_'+f.properties.khewat_no; if (selectedKeys.has(k)) sel.push(f); });
      if (!sel.length) { setErr('No plots'); return; }

      // ── V3 ──
      const acquiredParents = new Set<string>();
      const v3Map: Record<string, { acqMarla: number; totalMarla: number }> = {};
      if (v3Data?.plots) {
        const tot: Record<string, { t: number; a: number; s: Set<string> }> = {};
        for (const p of v3Data.plots) {
          const pk = p.khasra.split('/')[0], key = p.murabba+'_'+pk, sk = p.murabba+'//'+p.khasra;
          const m = (p.area_kanal||0)*20+(p.area_marla||0);
          if (!tot[key]) tot[key] = { t:0, a:0, s:new Set() };
          if (!tot[key].s.has(sk)) { tot[key].s.add(sk); tot[key].t += m; if (p.acquired) tot[key].a += m; }
        }
        for (const [k,t] of Object.entries(tot)) { v3Map[k] = { acqMarla:t.a, totalMarla:t.t }; if (t.a > 0) acquiredParents.add(k); }
      }
      if (v3Data?.acquired) { for (const ak of v3Data.acquired) { const [m,k] = ak.split('//'); if (m&&k) acquiredParents.add(m+'_'+k.split('/')[0]); } }

      // ── ROAD POLYGONS — collected after bounds are calculated ──
      const roadGeo: number[][][] = [];

      // ── MURABBAS ──
      const murabbas = [...new Set(sel.map(f => f.properties.khewat_no))];
      const lgPerMur: Record<string, number> = {};
      murabbas.forEach(m => { let best = -1, bestA = 0; sel.forEach((f,i) => { if (f.properties.khewat_no !== m) return; const a = pxArea(getRing(f)!.map(c => [c[0]*1e6, c[1]*1e6])); if (a > bestA) { bestA = a; best = i; } }); if (best >= 0) lgPerMur[m] = best; });

      // ── BOUNDS: tight around selected + road ──
      let bx0 = 180, bx1 = -180, by0 = 90, by1 = -90;
      const addBounds = (ring: number[][]) => ring.forEach(c => { bx0=Math.min(bx0,c[0]); bx1=Math.max(bx1,c[0]); by0=Math.min(by0,c[1]); by1=Math.max(by1,c[1]); });
      sel.forEach(f => addBounds(getRing(f)!));
      // Include road polygons ONLY if they touch the selected plot bounding box
      const selSpanX = (bx1-bx0) || 0.001, selSpanY = (by1-by0) || 0.001;
      const roadMargin = Math.min(selSpanX, selSpanY) * 0.3; // 30% of smaller span
      roadGeo.forEach(r => {
        const touches = r.some(c => c[0]>=bx0-roadMargin && c[0]<=bx1+roadMargin && c[1]>=by0-roadMargin && c[1]<=by1+roadMargin);
        if (touches) addBounds(r);
      });
      // Now collect road polygons (after bounds known, filter outliers)
      const selCLng = (bx0+bx1)/2, selCLat = (by0+by1)/2;
      const selSpan = Math.max(bx1-bx0, by1-by0) || 0.001;
      features.forEach(f => {
        const ring = getRing(f); if (!ring) return;
        const k = f.properties.khasra_no+'_'+f.properties.khewat_no;
        if (selectedKeys.has(k)) return;
        if (!acquiredParents.has(f.properties.khewat_no+'_'+f.properties.khasra_no)) return;
        const cLng = ring.reduce((s,c)=>s+c[0],0)/ring.length;
        const cLat = ring.reduce((s,c)=>s+c[1],0)/ring.length;
        if (Math.abs(cLng-selCLng) > selSpan*3 || Math.abs(cLat-selCLat) > selSpan*3) return;
        roadGeo.push(ring);
      });

      // Wider padding to include nearby roads
      const pad = 0.25;
      let minLng = bx0-(bx1-bx0)*pad, maxLng = bx1+(bx1-bx0)*pad;
      let minLat = by0-(by1-by0)*pad, maxLat = by1+(by1-by0)*pad;

      // ── CANVAS: plots should FILL the space ──
      const W = 1200;
      const geoAsp = (maxLat-minLat)/(maxLng-minLng);
      const mapAsp = Math.max(0.5, Math.min(1.0, geoAsp));
      const HEADER = 80, FOOTER = 60;
      const MW = W - 120, MH = Math.round(MW * mapAsp);
      const H = HEADER + MH + FOOTER;
      C.width = W; C.height = H;
      const ML = 60, MT = HEADER;

      const scX = MW/(maxLng-minLng), scY = MH/(maxLat-minLat);
      const tx = (lng: number) => ML + (lng-minLng)*scX;
      const ty = (lat: number) => MT + MH - (lat-minLat)*scY;

      // Road pixel polys
      const nearRoads = roadGeo.map(r => r.map(c => [tx(c[0]),ty(c[1])])).filter(pts => pts.some(p => p[0]>=ML-30 && p[0]<=ML+MW+30 && p[1]>=MT-30 && p[1]<=MT+MH+30));

      // ════════════════════════════════════════
      //              DRAW
      // ════════════════════════════════════════

      // 1. WHITE PAPER
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

      // 2. HEADING
      ctx.font = 'bold 20px serif'; ctx.fillStyle = '#000'; ctx.textAlign = 'center';
      ctx.fillText(`\u0928\u0915\u094D\u0932 \u0936\u091C\u0930\u093E \u0915\u093F\u0936\u094D\u0924\u0935\u093E\u0930 \u0917\u094D\u0930\u093E\u092E ${village}  \u0909\u092A\u0924\u0939\u0938\u0940\u0932 ${tehsil}  \u091C\u093F\u0932\u093E ${district}`, W/2, 32);
      rc.line(80, 42, W-80, 42, { stroke: '#000', strokeWidth: 1.2, roughness: 0.7 });
      ctx.font = '13px serif'; ctx.textAlign = 'left';
      ctx.fillText(`\u092A\u0948\u092E\u093E\u0928\u093E\u2014 ${Math.round(hav(minLat,minLng,minLat,maxLng)*3.281/MW*100/50)*50} \u092B\u093C\u0940\u091F \u092E\u0947\u0902`, ML, 62);

      // 3. MAP BORDER
      rc.rectangle(ML, MT, MW, MH, { stroke: '#000', strokeWidth: 3, roughness: 1.5 });
      ctx.save(); ctx.beginPath(); ctx.rect(ML+1, MT+1, MW-2, MH-2); ctx.clip();

      // 4. ROAD — use OSM road data for correct position/angle
      {
        let osmRoads: any[] = [];
        const rPad = Math.max(0.01, (by1-by0)*0.5);
        try { const r = await fetch(`/map/roads?bbox=${by0-rPad},${bx0-rPad},${by1+rPad},${bx1+rPad}`).then(r => r.ok ? r.json() : {roads:[]}); osmRoads = r.roads || []; } catch {}
        // Only trunk/primary/secondary roads
        // Show ALL road types — highways, village roads, tracks, paths
        const major = osmRoads.filter((r: any) => r.coords.length >= 2);
        // Find roads that pass near the selected plots (within 100px of any selected plot centroid)
        const selCents = sel.map(f => { const r = getRing(f)!; return [tx(r.reduce((s,c)=>s+c[0],0)/r.length), ty(r.reduce((s,c)=>s+c[1],0)/r.length)]; });

        major.forEach((road: any) => {
          const pts = road.coords.map((c: number[]) => [tx(c[0]), ty(c[1])]);
          if (pts.length < 2) return;
          // Show if any road point falls within or near the map area (generous margin)
          const inMap = pts.some((p: number[]) => p[0] >= ML-200 && p[0] <= ML+MW+200 && p[1] >= MT-200 && p[1] <= MT+MH+200);
          if (!inMap) return;

          // Road half-width by type
          const isTrunk = ['trunk','primary','trunk_link'].includes(road.type);
          const isMajor = ['secondary','tertiary','secondary_link','tertiary_link'].includes(road.type);
          const hw = isTrunk ? Math.max(15, MW*0.025) : isMajor ? Math.max(10, MW*0.018) : Math.max(7, MW*0.01);

          // Build offset polylines
          const leftP: number[][] = [], rightP: number[][] = [];
          for (let i = 0; i < pts.length; i++) {
            const prev = pts[Math.max(0,i-1)], next = pts[Math.min(pts.length-1,i+1)];
            const dx = next[0]-prev[0], dy = next[1]-prev[1], len = Math.sqrt(dx*dx+dy*dy)||1;
            leftP.push([pts[i][0]-dy/len*hw, pts[i][1]+dx/len*hw]);
            rightP.push([pts[i][0]+dy/len*hw, pts[i][1]-dx/len*hw]);
          }

          // Corridor polygon
          const corridor = [...leftP, ...([...rightP].reverse())];
          ctx.save();
          ctx.beginPath(); corridor.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.clip();
          ctx.fillStyle = 'rgba(200,150,150,0.12)'; ctx.fill();
          // Red hatching
          const cxs=corridor.map(p=>p[0]), cys=corridor.map(p=>p[1]);
          for (let hx = Math.min(...cxs); hx < Math.max(...cxs); hx += 5) {
            ctx.beginPath(); ctx.moveTo(hx, Math.min(...cys)-5); ctx.lineTo(hx+hw, Math.max(...cys)+5);
            ctx.strokeStyle='#c41e3a'; ctx.lineWidth=0.7; ctx.stroke();
          }
          ctx.restore();
          // Two border lines
          ctx.beginPath(); leftP.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]));
          ctx.strokeStyle='#000'; ctx.lineWidth=2.5; ctx.stroke();
          ctx.beginPath(); rightP.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]));
          ctx.strokeStyle='#000'; ctx.lineWidth=2.5; ctx.stroke();
          // Label
          const mi = Math.floor(pts.length/2);
          if (pts[mi][0]>ML && pts[mi][0]<ML+MW && pts[mi][1]>MT && pts[mi][1]<MT+MH) {
            const pr=pts[Math.max(0,mi-1)], nx=pts[Math.min(pts.length-1,mi+1)];
            let la=Math.atan2(nx[1]-pr[1],nx[0]-pr[0]); if(la>Math.PI/2)la-=Math.PI; if(la<-Math.PI/2)la+=Math.PI;
            ctx.save(); ctx.translate(pts[mi][0],pts[mi][1]); ctx.rotate(la);
            ctx.font='bold 11px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            const nm = road.name || '\u0938\u0921\u093C\u0915';
            const rlw=ctx.measureText(nm).width;
            ctx.fillStyle='#fff'; ctx.fillRect(-rlw/2-4,-8,rlw+8,16);
            ctx.fillStyle='#8b1a1a'; ctx.fillText(nm,0,0);
            ctx.restore();
          }
        });
      }

      // 5. SELECTED KHASRAS — STRONG orange fill, thick black borders
      sel.forEach(f => {
        const pts = getRing(f)!.map(c => [tx(c[0]), ty(c[1])]);
        const pk = f.properties.khewat_no+'_'+f.properties.khasra_no;
        const hasRoad = acquiredParents.has(pk) && nearRoads.length > 0;

        // Clip against road if this plot has acquisition
        if (hasRoad) {
          ctx.save();
          ctx.beginPath();
          pts.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath();
          for (const rp of nearRoads) { const r = [...rp].reverse(); r.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath(); }
          ctx.clip('evenodd');
        }

        // STRONG ORANGE FILL — like real patwari watercolor wash
        ctx.beginPath(); pts.forEach((p,i) => i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath();
        ctx.fillStyle = 'rgba(235, 140, 30, 0.55)'; ctx.fill();
        ctx.fillStyle = 'rgba(210, 120, 15, 0.2)'; ctx.fill();
        ctx.fillStyle = 'rgba(245, 160, 50, 0.15)'; ctx.fill();

        // THICK BLACK BORDER — hand-drawn
        let seed = 0; for (let i = 0; i < f.properties.khasra_no.length; i++) seed = seed*31 + f.properties.khasra_no.charCodeAt(i);
        const d = pts.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'Z';
        rc.path(d, { stroke: '#000', strokeWidth: 2.5, roughness: 1.2, seed, fill: 'none' });

        if (hasRoad) ctx.restore();
      });

      ctx.restore(); // end map clip

      // 6. COMPASS — top right, BIGGER, clear
      const compR = 45;
      const compX = ML+MW-compR-25, compY = MT+compR+25;
      ctx.beginPath(); ctx.arc(compX, compY, compR+10, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      rc.circle(compX, compY, compR*2, { stroke: '#000', strokeWidth: 1.8, roughness: 0.9 });
      rc.line(compX, compY-compR+5, compX, compY+compR-5, { stroke: '#000', strokeWidth: 1.2, roughness: 0.6 });
      rc.line(compX-compR+5, compY, compX+compR-5, compY, { stroke: '#000', strokeWidth: 1.2, roughness: 0.6 });
      // North arrow — bold
      ctx.beginPath(); ctx.moveTo(compX, compY-compR+5); ctx.lineTo(compX-8, compY-compR+20); ctx.lineTo(compX+8, compY-compR+20); ctx.closePath();
      ctx.fillStyle = '#000'; ctx.fill();
      // Labels
      ctx.font = 'bold 14px serif'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u0909\u0924\u094D\u0924\u0930', compX, compY-compR-8);
      ctx.fillText('\u0926\u0915\u094D\u0937\u093F\u0923', compX, compY+compR+12);
      ctx.textAlign = 'right'; ctx.fillText('\u092A\u0936\u094D\u091A\u093F\u092E', compX-compR-5, compY);
      ctx.textAlign = 'left'; ctx.fillText('\u092A\u0942\u0930\u094D\u0935', compX+compR+5, compY);

      // 7. KHASRA NUMBERS + MURABBA + EDGE DIMENSIONS
      const placed: {x:number;y:number;w:number;h:number}[] = [];
      const fits = (x:number,y:number,w:number,h:number) => !placed.some(p => Math.abs(p.x-x)<(p.w+w)/2 && Math.abs(p.y-y)<(p.h+h)/2);

      sel.forEach((f, idx) => {
        const ring = getRing(f)!;
        const [lat,lng] = centroid(ring);
        const pcx = tx(lng), pcy = ty(lat);
        const pts = ring.map(c => [tx(c[0]),ty(c[1])]);
        const area = pxArea(pts);
        const isLg = lgPerMur[f.properties.khewat_no] === idx;

        // KHASRA NUMBER — sized to fit inside the plot
        const label = f.properties.khasra_no;
        // Scale font based on plot pixel area — small plots get small text
        const fs = Math.max(10, Math.min(48, Math.sqrt(area) * 0.32));
        // Check if label fits inside the plot bounding box
        const bx0p = Math.min(...pts.map(p=>p[0])), bx1p = Math.max(...pts.map(p=>p[0]));
        const by0p = Math.min(...pts.map(p=>p[1])), by1p = Math.max(...pts.map(p=>p[1]));
        const plotW = bx1p - bx0p, plotH = by1p - by0p;
        ctx.font = `bold ${Math.round(fs)}px serif`;
        let tw = ctx.measureText(label).width;
        // Shrink font if label wider than plot
        let actualFs = fs;
        while (tw > plotW * 0.85 && actualFs > 8) { actualFs -= 2; ctx.font = `bold ${Math.round(actualFs)}px serif`; tw = ctx.measureText(label).width; }
        // Skip label entirely if plot is too small
        if (plotW < 15 || plotH < 15) { /* skip */ }
        else {
        const off = actualFs * 0.5;
        const cands = isLg
          ? [[pcx, pcy+off*0.7], [pcx, pcy+off*0.3], [pcx, pcy+off*1.2]]
          : [[pcx, pcy], [pcx, pcy-off*0.5], [pcx, pcy+off*0.5]];
        let lx = pcx, ly = pcy;
        for (const [px,py] of cands) { if (fits(px,py,tw+6,actualFs+4)) { lx=px; ly=py; break; } }
        placed.push({x:lx, y:ly, w:tw+6, h:actualFs+4});
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; ctx.fillText(label, lx, ly);

        // AREA — kanal-marla below khasra
        const pk = f.properties.khewat_no+'_'+f.properties.khasra_no;
        const v3 = v3Map[pk];
        if (v3 && v3.totalMarla > 0) {
          const afs = Math.max(11, Math.round(fs*0.38));
          const rm = v3.totalMarla - v3.acqMarla;
          const txt = `${Math.floor(rm/20)}-${rm%20}`;
          ctx.font = `${afs}px serif`; ctx.fillStyle = '#333'; ctx.textAlign = 'center';
          ctx.fillText(txt, lx, ly + fs/2 + afs/2 + 3);
        }

        // MURABBA — red, big, double underline
        if (isLg) {
          const ml = f.properties.khewat_no + '//';
          const mfs = Math.round(fs * 1.15);
          ctx.font = `bold ${mfs}px serif`;
          const mtw = ctx.measureText(ml).width;
          const my = ly - fs/2 - mfs/2 - 6;
          placed.push({x:lx, y:my, w:mtw+10, h:mfs+8});
          ctx.textAlign = 'center'; ctx.fillStyle = '#c41e3a';
          ctx.fillText(ml, lx, my);
          rc.line(lx-mtw/2, my+mfs/2+4, lx+mtw/2, my+mfs/2+4, { stroke: '#c41e3a', strokeWidth: 2.5, roughness: 0.6 });
          rc.line(lx-mtw/2, my+mfs/2+9, lx+mtw/2, my+mfs/2+9, { stroke: '#c41e3a', strokeWidth: 1.5, roughness: 0.8 });
        }

        // EDGE DIMENSIONS — karam, on every edge, scaled font
        for (let i = 0; i < ring.length-1; i++) {
          const meters = hav(ring[i][1], ring[i][0], ring[i+1][1], ring[i+1][0]);
          const karam = Math.round(meters / 1.67);
          if (karam < 2) continue;
          const x1 = tx(ring[i][0]), y1 = ty(ring[i][1]), x2 = tx(ring[i+1][0]), y2 = ty(ring[i+1][1]);
          const mx = (x1+x2)/2, my = (y1+y2)/2, dx = x2-x1, dy = y2-y1, ln = Math.sqrt(dx*dx+dy*dy);
          if (ln < 15) continue;
          const edgeFs = Math.max(9, Math.min(13, ln * 0.12));
          const nx = -dy/ln*10, ny = dx/ln*10;
          let ang = Math.atan2(dy, dx); if (ang>Math.PI/2) ang-=Math.PI; if (ang<-Math.PI/2) ang+=Math.PI;
          if (!fits(mx+nx, my+ny, 22, 12)) continue;
          placed.push({x:mx+nx, y:my+ny, w:22, h:12});
          ctx.save(); ctx.translate(mx+nx, my+ny); ctx.rotate(ang);
          ctx.font = `bold ${Math.round(edgeFs)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000'; ctx.fillText(String(karam), 0, 0);
          ctx.restore();
        }
        } // end else (skip tiny plots)
      });

      // 8. FOOTER
      ctx.font = '11px serif'; ctx.fillStyle = '#000'; ctx.textAlign = 'left';
      ctx.fillText(`${village} \u00B7 ${tehsil} \u00B7 ${district}`, ML, H-25);
      ctx.textAlign = 'right';
      ctx.fillText('Abhivo AI \u00B7 HSAC EODB + WebHALRIS', W-ML, H-25);
      ctx.font = '8px serif'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center';
      ctx.fillText('\u092F\u0939 \u0936\u091C\u0930\u093E \u0915\u0947\u0935\u0932 \u0938\u0942\u091A\u0928\u093E\u0930\u094D\u0925 \u0939\u0948\u0964 \u092F\u0939 \u0915\u094B\u0908 \u0938\u0930\u0915\u093E\u0930\u0940 \u092F\u093E \u0915\u093E\u0928\u0942\u0928\u0940 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0928\u0939\u0940\u0902 \u0939\u0948\u0964', W/2, H-10);

      // 9. OUTER BORDER
      rc.rectangle(4, 4, W-8, H-8, { stroke: '#000', strokeWidth: 2.5, roughness: 1 });

      setErr('');
    };
    go().catch(e => { setErr(e.message); console.error(e); });
  }, [features, selectedKeys, village, tehsil, district, v3Data]);

  return (
    <div>
      <canvas ref={ref} style={{ width: '100%', display: 'block' }} />
      {err && <div style={{ fontSize: 12, color: '#EF4444', padding: 8 }}>{err}</div>}
    </div>
  );
}
