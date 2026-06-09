import * as XLSX from 'xlsx';
import { supabase } from './supabase';

// Nombre de pestaña válido para Excel (≤31 chars, sin caracteres prohibidos, único)
function safeSheetName(name: string, used: Set<string>): string {
  let s = (name || 'Liga').replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 28) || 'Liga';
  let candidate = s;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${s.slice(0, 25)} ${n++}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

const PAY_HEADERS = ['#', 'Nombre', 'Correo', 'Liga', 'Código', 'Alias quiniela', 'Pagado', 'Admin', 'Fecha ingreso', 'Monto pagado', 'Fecha pago', 'Notas'];
const PAY_COLS = [
  { wch: 4 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 18 },
  { wch: 8 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
];

interface PayMember {
  id: string; alias: string; is_paid: boolean; is_admin: boolean;
  joined_at: string; user_id: string; league_id: string;
  league_name: string; league_code: string; profile_name: string;
}

function buildPayRows(list: PayMember[], emailMap: Record<string, string>) {
  return list.map((m, i) => [
    i + 1,
    m.profile_name ?? '',
    emailMap[m.user_id] ?? '',
    m.league_name ?? '',
    m.league_code ?? '',
    m.alias ?? '',
    m.is_paid ? 'Sí' : 'No',
    m.is_admin ? 'Sí' : '',
    m.joined_at ? new Date(m.joined_at).toLocaleDateString('es-MX') : '',
    '', '', '', // Monto pagado / Fecha pago / Notas (llenar manualmente)
  ]);
}

export async function exportPaymentList() {
  // Usar RPC admin_get_all_members (bypassa RLS) en vez de select directo
  const [{ data: rawMembers, error: memErr }, { data: emailData }] = await Promise.all([
    supabase.rpc('admin_get_all_members'),
    supabase.rpc('admin_get_user_emails'),
  ]);
  if (memErr) { console.error('admin_get_all_members error:', memErr); }

  const members: PayMember[] = ((rawMembers as any[]) ?? []).map((m) => ({
    id: m.id, alias: m.alias, is_paid: m.is_paid, is_admin: m.is_admin,
    joined_at: m.joined_at, user_id: m.user_id, league_id: m.league_id,
    league_name: m.league_name ?? 'Sin liga', league_code: m.league_code ?? '',
    profile_name: m.profile_name ?? '',
  }));
  if (members.length === 0) return;

  const emailMap: Record<string, string> = {};
  for (const row of emailData ?? []) emailMap[row.id] = row.email ?? '';

  const generated = new Date().toLocaleString('es-MX');
  const wb = XLSX.utils.book_new();
  const paidCount = members.filter(m => m.is_paid).length;

  // ── Hoja 1: GENERAL (todas las ligas) ──
  const wsGen = XLSX.utils.aoa_to_sheet([
    ['Lista de Pagos GENERAL — Quiniela Mundial 2026'],
    [`Generado: ${generated}`],
    [`Total participantes: ${members.length}   |   Pagados: ${paidCount}   |   Pendientes: ${members.length - paidCount}`],
    [],
    PAY_HEADERS,
    ...buildPayRows(members, emailMap),
  ]);
  wsGen['!cols'] = PAY_COLS;
  wsGen['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  XLSX.utils.book_append_sheet(wb, wsGen, 'General');

  // ── Hoja 2: Resumen por Liga ──
  const ligaMap: Record<string, { nombre: string; codigo: string; total: number; pagados: number }> = {};
  for (const m of members) {
    const key = m.league_id;
    if (!ligaMap[key]) ligaMap[key] = { nombre: m.league_name, codigo: m.league_code, total: 0, pagados: 0 };
    ligaMap[key].total++;
    if (m.is_paid) ligaMap[key].pagados++;
  }
  const ligas = Object.entries(ligaMap)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Resumen por Liga'],
    [],
    ['Liga', 'Código', 'Total', 'Pagados', 'Pendientes', '% Pago'],
    ...ligas.map(l => [
      l.nombre, l.codigo, l.total, l.pagados, l.total - l.pagados,
      `${Math.round((l.pagados / l.total) * 100)}%`,
    ]),
    [],
    ['TOTAL', '', members.length, paidCount, members.length - paidCount, `${Math.round((paidCount / members.length) * 100)}%`],
  ]);
  ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen Ligas');

  // ── Una hoja por liga ──
  const usedNames = new Set<string>(['general', 'resumen ligas']);
  for (const liga of ligas) {
    const ligaMembers = members.filter(m => m.league_id === liga.id);
    const ligaPaid = ligaMembers.filter(m => m.is_paid).length;
    const ws = XLSX.utils.aoa_to_sheet([
      [`Liga: ${liga.nombre}  (Código: ${liga.codigo})`],
      [`Pagados: ${ligaPaid} / ${ligaMembers.length}   |   Pendientes: ${ligaMembers.length - ligaPaid}`],
      [],
      PAY_HEADERS,
      ...buildPayRows(ligaMembers, emailMap),
    ]);
    ws['!cols'] = PAY_COLS;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(liga.nombre, usedNames));
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `pagos-quiniela-${dateStr}.xlsx`);
}

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    group: 'Grupo', round_of_32: 'R32', round_of_16: 'R16',
    quarterfinal: 'CF', semifinal: 'SF', third_place: '3er lugar', final: 'Final',
  };
  return map[stage] ?? stage;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function autoWidth(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const widths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        const len = String(cell.v).length;
        if (len > max) max = len;
      }
    }
    widths.push(Math.min(max + 2, 40));
  }
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

export async function exportLeagueToExcel(leagueId: string, leagueName: string, leagueCode: string) {
  // ── 1. Fetch members & matches in parallel ─────────────────────
  const [membersRes, matchesRes] = await Promise.all([
    supabase
      .from('league_members')
      .select('id, alias, is_paid, is_admin, joined_at, user_id, profile:profiles(name)')
      .eq('league_id', leagueId)
      .order('joined_at'),
    supabase
      .from('matches')
      .select('id, home_team, away_team, home_flag, away_flag, match_date, stage, group_name, home_score, away_score, status')
      .order('match_date'),
  ]);

  const members = membersRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const memberIds = members.map(m => m.id);
  const userIds = [...new Set(members.map(m => m.user_id))];

  // ── 2. Fetch all prediction types in parallel ──────────────────
  const [matchPredsRes, groupPredsRes, podioPredsRes] = await Promise.all([
    supabase
      .from('league_predictions')
      .select('league_member_id, match_id, pred_home, pred_away, points, updated_at')
      .in('league_member_id', memberIds),
    supabase
      .from('member_group_predictions')
      .select('league_member_id, group_name, first_place, second_place, updated_at')
      .in('league_member_id', memberIds),
    supabase
      .from('member_podium_predictions')
      .select('league_member_id, champion, runner_up, third_place, top_scorer, updated_at')
      .in('league_member_id', memberIds),
  ]);

  const matchPreds = matchPredsRes.data ?? [];
  const groupPreds = groupPredsRes.data ?? [];
  const podioPreds = podioPredsRes.data ?? [];

  // Maps
  const predMap = new Map<string, Map<number, any>>(); // memberId → matchId → pred
  for (const p of matchPreds) {
    if (!predMap.has(p.league_member_id)) predMap.set(p.league_member_id, new Map());
    predMap.get(p.league_member_id)!.set(p.match_id, p);
  }

  // groupPredMap: memberId → groupName → { first, second }
  const groupPredMap = new Map<string, Map<string, any>>();
  for (const g of groupPreds) {
    if (!groupPredMap.has(g.league_member_id)) groupPredMap.set(g.league_member_id, new Map());
    groupPredMap.get(g.league_member_id)!.set(g.group_name, g);
  }

  // podioPredMap: memberId → prediction
  const podioPredMap = new Map<string, any>();
  for (const p of podioPreds) podioPredMap.set(p.league_member_id, p);

  const memberMap = new Map(members.map(m => [m.id, m]));
  const matchMap = new Map(matches.map(m => [m.id, m]));

  // Get sorted group names
  const groupNames = [...new Set(
    matches.filter(m => m.stage === 'group' && m.group_name).map(m => m.group_name as string)
  )].sort();

  const wb = XLSX.utils.book_new();
  const generated = new Date().toLocaleString('es-MX');

  // ── Sheet 1: Participantes ─────────────────────────────────────
  const paidCount = members.filter(m => m.is_paid).length;
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['Quiniela Mundial 2026'],
    ['Liga:', leagueName],
    ['Código:', leagueCode],
    ['Generado:', generated],
    ['Total participantes:', members.length],
    ['Pagados:', paidCount],
    ['Sin pago:', members.length - paidCount],
    [],
    ['#', 'Alias (quiniela)', 'Nombre real', 'Pagado', 'Admin', 'Fecha de ingreso', 'Predicciones hechas'],
    ...members.map((m, i) => [
      i + 1,
      m.alias ?? 'Sin alias',
      (m.profile as any)?.name ?? '',
      m.is_paid ? 'Sí' : 'No',
      m.is_admin ? 'Sí' : '',
      fmtDate(m.joined_at),
      predMap.get(m.id)?.size ?? 0,
    ]),
  ]);
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  autoWidth(ws1);
  XLSX.utils.book_append_sheet(wb, ws1, 'Participantes');

  // ── Sheet 2: Predicciones de partidos (matriz) ─────────────────
  const matchHeaders = matches.map(m =>
    `${m.home_flag ?? ''} ${m.home_team} vs ${m.away_team} ${m.away_flag ?? ''}\n${fmtDateTime(m.match_date)}`
  );
  const resultHeaders = matches.map(m =>
    m.status !== 'upcoming' && m.home_score != null ? `${m.home_score}-${m.away_score}` : '-'
  );

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Alias', 'Nombre real', 'Pagado', 'Total pred', ...matchHeaders],
    ['RESULTADO REAL', '', '', '', ...resultHeaders],
    ...members.map(m => {
      const preds = predMap.get(m.id);
      return [
        m.alias ?? '',
        (m.profile as any)?.name ?? '',
        m.is_paid ? '✓' : '✗',
        preds?.size ?? 0,
        ...matches.map(match => {
          const p = preds?.get(match.id);
          return p != null ? `${p.pred_home}-${p.pred_away}` : '-';
        }),
      ];
    }),
  ]);
  ws2['!freeze'] = { xSplit: 4, ySplit: 2 };
  autoWidth(ws2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Pred Partidos');

  // ── Sheet 3: Predicciones de grupos ───────────────────────────
  // Columns: Alias | Nombre | Grupo A 1ro | Grupo A 2do | Grupo B 1ro | ...
  const groupColHeaders: string[] = [];
  for (const g of groupNames) {
    groupColHeaders.push(`Grupo ${g} — 1er lugar`);
    groupColHeaders.push(`Grupo ${g} — 2do lugar`);
  }

  // Fetch actual group results to show in header
  const { data: groupResults } = await supabase
    .from('group_results')
    .select('group_name, first_place, second_place');
  const groupResultMap = new Map((groupResults ?? []).map((r: any) => [r.group_name, r]));

  const groupResultRow: string[] = [];
  for (const g of groupNames) {
    const res = groupResultMap.get(g);
    groupResultRow.push(res?.first_place ?? '-');
    groupResultRow.push(res?.second_place ?? '-');
  }

  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Alias', 'Nombre real', 'Pagado', ...groupColHeaders],
    ['RESULTADO REAL', '', '', ...groupResultRow],
    ...members.map(m => {
      const gPreds = groupPredMap.get(m.id);
      return [
        m.alias ?? '',
        (m.profile as any)?.name ?? '',
        m.is_paid ? '✓' : '✗',
        ...groupNames.flatMap(g => {
          const pred = gPreds?.get(g);
          return [pred?.first_place ?? '-', pred?.second_place ?? '-'];
        }),
      ];
    }),
  ]);
  ws3['!freeze'] = { xSplit: 3, ySplit: 2 };
  autoWidth(ws3);
  XLSX.utils.book_append_sheet(wb, ws3, 'Pred Grupos');

  // ── Sheet 4: Predicciones de podio ────────────────────────────
  // Fetch actual tournament results
  const { data: tourResult } = await supabase
    .from('tournament_results')
    .select('champion, runner_up, third_place, top_scorer')
    .eq('id', 1)
    .single();

  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Alias', 'Nombre real', 'Pagado', 'Campeón', 'Subcampeón', '3er Lugar', 'Goleador'],
    [
      'RESULTADO REAL', '', '',
      tourResult?.champion ?? '-',
      tourResult?.runner_up ?? '-',
      tourResult?.third_place ?? '-',
      tourResult?.top_scorer ?? '-',
    ],
    ...members.map(m => {
      const pod = podioPredMap.get(m.id);
      return [
        m.alias ?? '',
        (m.profile as any)?.name ?? '',
        m.is_paid ? '✓' : '✗',
        pod?.champion ?? '-',
        pod?.runner_up ?? '-',
        pod?.third_place ?? '-',
        pod?.top_scorer ?? '-',
      ];
    }),
  ]);
  ws4['!freeze'] = { xSplit: 3, ySplit: 2 };
  autoWidth(ws4);
  XLSX.utils.book_append_sheet(wb, ws4, 'Pred Podio');

  // ── Sheet 5: Registro de auditoría (partidos) ──────────────────
  const auditRows = matchPreds
    .slice()
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .map(p => {
      const member = memberMap.get(p.league_member_id);
      const match = matchMap.get(p.match_id);
      return [
        fmtTs(p.updated_at),
        member?.alias ?? '',
        (member?.profile as any)?.name ?? '',
        member?.is_paid ? 'Sí' : 'No',
        match ? `${match.home_team} vs ${match.away_team}` : '',
        match ? stageLabel(match.stage) : '',
        match ? fmtDateTime(match.match_date) : '',
        p.pred_home,
        p.pred_away,
        `${p.pred_home}-${p.pred_away}`,
        p.points ?? 0,
      ];
    });

  const ws5 = XLSX.utils.aoa_to_sheet([
    ['Última modificación', 'Alias', 'Nombre real', 'Pagado', 'Partido', 'Fase', 'Fecha partido', 'Pred local', 'Pred visitante', 'Predicción', 'Puntos'],
    ...auditRows,
  ]);
  autoWidth(ws5);
  XLSX.utils.book_append_sheet(wb, ws5, 'Registro');

  // ── Download ───────────────────────────────────────────────────
  const safeName = leagueName.replace(/[^a-zA-Z0-9\-_]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `quiniela-${safeName}-${dateStr}.xlsx`);
}
