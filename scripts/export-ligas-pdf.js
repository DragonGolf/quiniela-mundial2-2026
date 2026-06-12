// Genera un PDF legible por liga con todas las predicciones.
// Uso:  node scripts/export-ligas-pdf.js
// Salida: ./exports/quiniela-<liga>-<fecha>.pdf

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PLAYERS_PER_CHUNK = 11; // columnas de quinielas por tabla (caben en carta horizontal)

async function rest(pathQ) {
  const PAGE = 1000;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const sep = pathQ.includes('?') ? '&' : '?';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}${sep}limit=${PAGE}&offset=${offset}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`${pathQ} → HTTP ${res.status}: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

async function main() {
  const outDir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  const [leagues, matches, groupResults, tourResults] = await Promise.all([
    rest('leagues?select=id,name,code&order=name'),
    rest('matches?select=id,home_team,away_team,home_flag,away_flag,match_date,stage,group_name,status,home_score,away_score&order=match_date'),
    rest('group_results?select=group_name,first_place,second_place'),
    rest('tournament_results?select=champion,runner_up,third_place,top_scorer&id=eq.1'),
  ]);
  const groupNames = [...new Set(matches.filter(m => m.stage === 'group' && m.group_name).map(m => m.group_name))].sort();
  const generated = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const league of leagues) {
    const members = await rest(`league_members?league_id=eq.${league.id}&select=id,alias,is_paid,joined_at,profile:profiles(name)&order=alias`);
    if (members.length === 0) continue;
    const ids = members.map(m => m.id).join(',');
    const [matchPreds, groupPreds, podioPreds] = await Promise.all([
      rest(`league_predictions?league_member_id=in.(${ids})&select=league_member_id,match_id,pred_home,pred_away&order=league_member_id,match_id`),
      rest(`member_group_predictions?league_member_id=in.(${ids})&select=league_member_id,group_name,first_place,second_place&order=league_member_id`),
      rest(`member_podium_predictions?league_member_id=in.(${ids})&select=league_member_id,champion,runner_up,third_place,top_scorer&order=league_member_id`),
    ]);

    const predMap = new Map();
    for (const p of matchPreds) {
      if (!predMap.has(p.league_member_id)) predMap.set(p.league_member_id, new Map());
      predMap.get(p.league_member_id).set(p.match_id, `${p.pred_home}-${p.pred_away}`);
    }
    const groupPredMap = new Map();
    for (const g of groupPreds) {
      if (!groupPredMap.has(g.league_member_id)) groupPredMap.set(g.league_member_id, new Map());
      groupPredMap.get(g.league_member_id).set(g.group_name, g);
    }
    const podioMap = new Map(podioPreds.map(p => [p.league_member_id, p]));
    const tr = tourResults[0] ?? {};
    const grMap = new Map(groupResults.map(r => [r.group_name, r]));

    // ── Construir HTML ──
    let html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>
      @page { size: letter landscape; margin: 10mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { margin: 0; color: #1a1a2e; }
      h1 { font-size: 17px; margin: 0 0 2px; color: #1a3a5c; }
      .sub { font-size: 10px; color: #667; margin-bottom: 10px; }
      h2 { font-size: 13px; margin: 14px 0 5px; color: #1a3a5c; border-bottom: 2px solid #f5a623; padding-bottom: 2px; }
      table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #ccd; padding: 2.5px 4px; font-size: 8.5px; text-align: center; }
      th { background: #1a3a5c; color: #fff; font-size: 8px; }
      td.l { text-align: left; white-space: nowrap; }
      tr:nth-child(even) td { background: #f4f6fa; }
      td.res { background: #fdf3d7 !important; font-weight: 700; }
      .chunk { page-break-before: always; }
      .first { page-break-before: auto; }
      .badge { display: inline-block; background: #e8f5e9; border-radius: 4px; padding: 0 4px; }
    </style></head><body>
    <h1>🏆 Quiniela Mundial 2026 — Liga ${esc(league.name)}</h1>
    <div class="sub">Registro oficial de predicciones · ${members.length} quinielas · Cierre: 11 de junio de 2026, 12:00 PM (México) · Generado: ${generated}</div>`;

    // ── Podio ──
    html += `<h2>🏆 Predicciones finales (podio y goleador)</h2><table><tr><th style="text-align:left">Quiniela</th><th>Pagó</th><th>Campeón</th><th>Subcampeón</th><th>3er Lugar</th><th>Goleador</th></tr>`;
    html += `<tr><td class="l res">RESULTADO REAL</td><td class="res"></td><td class="res">${esc(tr.champion ?? '—')}</td><td class="res">${esc(tr.runner_up ?? '—')}</td><td class="res">${esc(tr.third_place ?? '—')}</td><td class="res">${esc(tr.top_scorer ?? '—')}</td></tr>`;
    for (const m of members) {
      const p = podioMap.get(m.id);
      html += `<tr><td class="l"><b>${esc(m.alias)}</b> (${esc(m.profile?.name)})</td><td>${m.is_paid ? '✓' : '—'}</td><td>${esc(p?.champion ?? '—')}</td><td>${esc(p?.runner_up ?? '—')}</td><td>${esc(p?.third_place ?? '—')}</td><td>${esc(p?.top_scorer ?? '—')}</td></tr>`;
    }
    html += `</table>`;

    // ── Grupos ── (filas = quinielas, columnas = grupos)
    html += `<h2>🗂 Clasificados por grupo (1ro / 2do)</h2><table><tr><th style="text-align:left">Quiniela</th>${groupNames.map(g => `<th>Grupo ${g}</th>`).join('')}</tr>`;
    html += `<tr><td class="l res">RESULTADO REAL</td>${groupNames.map(g => {
      const r = grMap.get(g);
      return `<td class="res">${r?.first_place ? esc(r.first_place) + ' / ' + esc(r.second_place) : '—'}</td>`;
    }).join('')}</tr>`;
    for (const m of members) {
      const gp = groupPredMap.get(m.id);
      html += `<tr><td class="l"><b>${esc(m.alias)}</b></td>${groupNames.map(g => {
        const pred = gp?.get(g);
        return `<td>${pred ? esc(pred.first_place) + ' / ' + esc(pred.second_place) : '—'}</td>`;
      }).join('')}</tr>`;
    }
    html += `</table>`;

    // ── Partidos ── (filas = partidos, columnas = quinielas en bloques)
    for (let start = 0; start < members.length; start += PLAYERS_PER_CHUNK) {
      const chunk = members.slice(start, start + PLAYERS_PER_CHUNK);
      const range = members.length > PLAYERS_PER_CHUNK ? ` (quinielas ${start + 1}–${Math.min(start + PLAYERS_PER_CHUNK, members.length)} de ${members.length})` : '';
      html += `<div class="${start === 0 ? 'first' : 'chunk'}"><h2>⚽ Predicciones por partido${range}</h2><table>
        <tr><th style="text-align:left">Partido</th><th>Fecha</th><th>Resultado</th>${chunk.map(m => `<th>${esc(m.alias)}</th>`).join('')}</tr>`;
      for (const match of matches) {
        const real = match.status !== 'upcoming' && match.home_score != null ? `${match.home_score}-${match.away_score}` : '—';
        html += `<tr><td class="l">${esc(match.home_flag)} ${esc(match.home_team)} vs ${esc(match.away_team)} ${esc(match.away_flag)}</td><td>${fmtDate(match.match_date)}</td><td class="res">${real}</td>`;
        for (const m of chunk) {
          html += `<td>${predMap.get(m.id)?.get(match.id) ?? '—'}</td>`;
        }
        html += `</tr>`;
      }
      html += `</table></div>`;
    }

    html += `</body></html>`;

    const safeName = league.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]/g, '').trim().replace(/\s+/g, '-');
    const htmlFile = path.join(outDir, `_tmp-${safeName}.html`);
    const pdfFile = path.join(outDir, `quiniela-${safeName}-${dateStr}.pdf`);
    fs.writeFileSync(htmlFile, html, 'utf8');
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      `--print-to-pdf=${pdfFile}`, `file:///${htmlFile.replace(/\\/g, '/')}`,
    ], { stdio: 'pipe' });
    fs.unlinkSync(htmlFile);
    console.log(`✅ ${league.name}: ${members.length} quinielas → ${pdfFile}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
