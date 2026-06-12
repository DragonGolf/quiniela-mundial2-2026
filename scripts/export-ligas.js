// Genera un archivo Excel por liga con TODAS las predicciones (transparencia).
// Uso:  node scripts/export-ligas.js
// Salida: ./exports/quiniela-<liga>-<fecha>.xlsx

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';

async function rest(pathQ) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${pathQ} → HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function autoWidth(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const widths = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        const len = String(cell.v).split('\n')[0].length;
        if (len > max) max = len;
      }
    }
    widths.push({ wch: Math.min(max + 2, 38) });
  }
  ws['!cols'] = widths;
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
  const tourResult = tourResults[0] ?? {};
  const groupResultMap = new Map(groupResults.map(r => [r.group_name, r]));
  const groupNames = [...new Set(matches.filter(m => m.stage === 'group' && m.group_name).map(m => m.group_name))].sort();
  const generated = new Date().toLocaleString('es-MX');
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const league of leagues) {
    const members = await rest(`league_members?league_id=eq.${league.id}&select=id,alias,is_paid,is_admin,joined_at,user_id,profile:profiles(name)&order=alias`);
    if (members.length === 0) { console.log(`(${league.name}: sin miembros, omitida)`); continue; }
    const ids = members.map(m => m.id).join(',');

    const [matchPreds, groupPreds, podioPreds] = await Promise.all([
      rest(`league_predictions?league_member_id=in.(${ids})&select=league_member_id,match_id,pred_home,pred_away,points&limit=20000`),
      rest(`member_group_predictions?league_member_id=in.(${ids})&select=league_member_id,group_name,first_place,second_place&limit=2000`),
      rest(`member_podium_predictions?league_member_id=in.(${ids})&select=league_member_id,champion,runner_up,third_place,top_scorer&limit=500`),
    ]);

    const predMap = new Map();
    for (const p of matchPreds) {
      if (!predMap.has(p.league_member_id)) predMap.set(p.league_member_id, new Map());
      predMap.get(p.league_member_id).set(p.match_id, p);
    }
    const groupPredMap = new Map();
    for (const g of groupPreds) {
      if (!groupPredMap.has(g.league_member_id)) groupPredMap.set(g.league_member_id, new Map());
      groupPredMap.get(g.league_member_id).set(g.group_name, g);
    }
    const podioPredMap = new Map(podioPreds.map(p => [p.league_member_id, p]));

    const wb = XLSX.utils.book_new();
    const paidCount = members.filter(m => m.is_paid).length;

    // ── Hoja 1: Participantes ──
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Quiniela Mundial 2026 — REGISTRO OFICIAL DE PREDICCIONES'],
      ['Liga:', league.name],
      ['Código:', league.code],
      ['Generado:', generated],
      ['Cierre de predicciones:', '11 de junio de 2026, 12:00 PM (México)'],
      ['Total quinielas:', members.length],
      ['Pagadas:', paidCount],
      [],
      ['#', 'Alias (quiniela)', 'Nombre real', 'Pagado', 'Admin', 'Pred. partidos', 'Grupos', 'Podio'],
      ...members.map((m, i) => [
        i + 1,
        m.alias ?? 'Sin alias',
        m.profile?.name ?? '',
        m.is_paid ? 'Sí' : 'No',
        m.is_admin ? 'Sí' : '',
        predMap.get(m.id)?.size ?? 0,
        groupPredMap.get(m.id)?.size ?? 0,
        podioPredMap.has(m.id) ? 'Sí' : 'No',
      ]),
    ]);
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    autoWidth(ws1);
    XLSX.utils.book_append_sheet(wb, ws1, 'Participantes');

    // ── Hoja 2: Pred Partidos (matriz) ──
    const matchHeaders = matches.map(m => `${m.home_team} vs ${m.away_team} (${fmtDateTime(m.match_date)})`);
    const resultHeaders = matches.map(m =>
      m.status !== 'upcoming' && m.home_score != null ? `${m.home_score}-${m.away_score}` : '-'
    );
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Alias', 'Nombre real', 'Pagado', ...matchHeaders],
      ['RESULTADO REAL', '', '', ...resultHeaders],
      ...members.map(m => {
        const preds = predMap.get(m.id);
        return [
          m.alias ?? '', m.profile?.name ?? '', m.is_paid ? 'Sí' : 'No',
          ...matches.map(match => {
            const p = preds?.get(match.id);
            return p != null ? `${p.pred_home}-${p.pred_away}` : '-';
          }),
        ];
      }),
    ]);
    ws2['!freeze'] = { xSplit: 3, ySplit: 2 };
    autoWidth(ws2);
    XLSX.utils.book_append_sheet(wb, ws2, 'Pred Partidos');

    // ── Hoja 3: Pred Grupos ──
    const groupColHeaders = [];
    for (const g of groupNames) { groupColHeaders.push(`Grupo ${g} 1ro`, `Grupo ${g} 2do`); }
    const groupResultRow = [];
    for (const g of groupNames) {
      const res = groupResultMap.get(g);
      groupResultRow.push(res?.first_place ?? '-', res?.second_place ?? '-');
    }
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Alias', 'Nombre real', 'Pagado', ...groupColHeaders],
      ['RESULTADO REAL', '', '', ...groupResultRow],
      ...members.map(m => {
        const gp = groupPredMap.get(m.id);
        return [
          m.alias ?? '', m.profile?.name ?? '', m.is_paid ? 'Sí' : 'No',
          ...groupNames.flatMap(g => {
            const pred = gp?.get(g);
            return [pred?.first_place ?? '-', pred?.second_place ?? '-'];
          }),
        ];
      }),
    ]);
    ws3['!freeze'] = { xSplit: 3, ySplit: 2 };
    autoWidth(ws3);
    XLSX.utils.book_append_sheet(wb, ws3, 'Pred Grupos');

    // ── Hoja 4: Pred Podio ──
    const ws4 = XLSX.utils.aoa_to_sheet([
      ['Alias', 'Nombre real', 'Pagado', 'Campeón', 'Subcampeón', '3er Lugar', 'Goleador'],
      ['RESULTADO REAL', '', '', tourResult.champion ?? '-', tourResult.runner_up ?? '-', tourResult.third_place ?? '-', tourResult.top_scorer ?? '-'],
      ...members.map(m => {
        const pod = podioPredMap.get(m.id);
        return [
          m.alias ?? '', m.profile?.name ?? '', m.is_paid ? 'Sí' : 'No',
          pod?.champion ?? '-', pod?.runner_up ?? '-', pod?.third_place ?? '-', pod?.top_scorer ?? '-',
        ];
      }),
    ]);
    ws4['!freeze'] = { xSplit: 3, ySplit: 2 };
    autoWidth(ws4);
    XLSX.utils.book_append_sheet(wb, ws4, 'Pred Podio');

    const safeName = league.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]/g, '').trim().replace(/\s+/g, '-');
    const file = path.join(outDir, `quiniela-${safeName}-${dateStr}.xlsx`);
    XLSX.writeFile(wb, file);
    console.log(`✅ ${league.name}: ${members.length} quinielas → ${file}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
