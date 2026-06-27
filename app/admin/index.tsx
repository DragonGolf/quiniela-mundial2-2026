import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { triggerMatchSync, adminUpdateMatch, adminClearMatch, getTournamentResults, saveTournamentResults, getGroupTeams, saveGroupResult, getGroupResults, getLeagueMembers, setLeagueMemberPaidById, deleteLeagueEntry, moveLeagueEntry, getAllLeagues, getAdminLeagues, updateLeaguePrize, AdminLeaguePrize, getKnockoutMultipliers, setKnockoutMultiplier, KnockoutMultiplier, createKnockoutContinuation } from '@/lib/api';
import { exportPaymentList } from '@/lib/export';
import { GroupResult, LeagueMember } from '@/lib/types';
import { TournamentResult, Match } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { Colors, StatusLabels } from '@/constants/Colors';

// Entry con info de liga incluida
interface EntryWithLeague extends LeagueMember {
  profile: { name: string };
  league: { name: string; code: string };
}

// Agrupa entradas por usuario (nombre real)
interface UserWithEntries {
  userId: string;
  realName: string;
  entries: EntryWithLeague[];
}

export default function AdminScreen() {
  const { profile } = useAuth();
  const { activeLeague } = useLeague();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [newStatus, setNewStatus] = useState<'upcoming' | 'live' | 'finished'>('live');
  const [tournamentResult, setTournamentResult] = useState<TournamentResult | null>(null);
  const [trChampion, setTrChampion] = useState('');
  const [trRunnerUp, setTrRunnerUp] = useState('');
  const [trThird, setTrThird] = useState('');
  const [trScorer, setTrScorer] = useState('');
  const [savingTr, setSavingTr] = useState(false);
  const [trMsg, setTrMsg] = useState('');
  const [groupTeams, setGroupTeams] = useState<Record<string, { team: string; flag: string }[]>>({});
  const [groupResults, setGroupResults] = useState<Record<string, { first: string; second: string }>>({});
  const [savingGroups, setSavingGroups] = useState(false);
  const [groupMsg, setGroupMsg] = useState('');
  const [usersWithEntries, setUsersWithEntries] = useState<UserWithEntries[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [paidMsg, setPaidMsg] = useState('');
  const [matchMsg, setMatchMsg] = useState('');
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalGroupMatches, setTotalGroupMatches] = useState(0);
  const [totalKnockoutMatches, setTotalKnockoutMatches] = useState(0);
  // memberId → { matchPreds, hasGroups, hasPodio }
  const [predStats, setPredStats] = useState<Record<string, { matchPreds: number; hasGroups: boolean; hasPodio: boolean }>>({});
  // userId → email
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  // userId expandido para ver detalle
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [exportingPayments, setExportingPayments] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [moveEntryId, setMoveEntryId] = useState<string | null>(null); // entry.id being moved
  const [allLeagues, setAllLeagues] = useState<{ id: string; name: string; code: string }[]>([]);
  const [movingId, setMovingId] = useState<string | null>(null);
  // Ligas colapsadas (por leagueId) en la sección de pagos
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
  // Ligas de eliminatoria (para el panel "quién avanzó")
  const [koLeagues, setKoLeagues] = useState<{ id: string; name: string }[]>([]);
  // Multiplicadores de eliminatoria
  const [koMults, setKoMults] = useState<KnockoutMultiplier[]>([]);
  const [koDraft, setKoDraft] = useState<Record<string, string>>({});
  const [savingKo, setSavingKo] = useState(false);
  const [koMsg, setKoMsg] = useState('');
  // Premios por liga (admin global)
  const [adminLeaguesList, setAdminLeaguesList] = useState<AdminLeaguePrize[]>([]);
  const [prizeEditId, setPrizeEditId] = useState<string | null>(null);
  const [pzPrice, setPzPrice] = useState('');
  const [pzDesc, setPzDesc] = useState('');
  const [pzComm, setPzComm] = useState('');
  const [pzSaving, setPzSaving] = useState(false);
  const [pzMsg, setPzMsg] = useState('');

  useEffect(() => {
    if (profile && !profile.is_admin) {
      router.back();
    }
  }, [profile]);

  async function load() {
    const [{ data: matchData }, tr, teams, groupRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: true }),
      getTournamentResults(),
      getGroupTeams(),
      getGroupResults(),
    ]);

    setMatches(matchData || []);
    setTotalMatches((matchData || []).length);
    // Totales por tipo: grupo (ligas normales) vs eliminatoria (ligas KO)
    setTotalGroupMatches((matchData || []).filter((m: any) => m.stage === 'group').length);
    setTotalKnockoutMatches((matchData || []).filter((m: any) => m.stage !== 'group').length);
    setGroupTeams(teams);
    setTournamentResult(tr);
    if (tr) {
      setTrChampion(tr.champion || '');
      setTrRunnerUp(tr.runner_up || '');
      setTrThird(tr.third_place || '');
      setTrScorer((tr as any).top_scorer || '');
    }
    const resMap: Record<string, { first: string; second: string }> = {};
    for (const r of groupRes) resMap[r.group_name] = { first: r.first_place || '', second: r.second_place || '' };
    setGroupResults(resMap);

    // Cargar miembros vía RPC (SECURITY DEFINER, bypassa RLS)
    const { data: allMembersRaw, error: membersError } = await supabase.rpc('admin_get_all_members');
    if (membersError) {
      console.error('admin_get_all_members error:', membersError);
    }

    // Normaliza los datos del RPC al formato que espera el resto del código
    const allMembers = ((allMembersRaw as any[]) ?? []).map((m: any) => ({
      id: m.id,
      league_id: m.league_id,
      user_id: m.user_id,
      alias: m.alias,
      is_paid: m.is_paid,
      is_admin: m.is_admin,
      joined_at: m.joined_at,
      profile: { name: m.profile_name ?? 'Jugador' },
      league: { id: m.league_id, name: m.league_name ?? '', code: m.league_code ?? '' },
      match_preds: Number(m.match_preds ?? 0),
      group_preds: Number(m.group_preds ?? 0),
      podium_preds: Number(m.podium_preds ?? 0),
    }));

    console.log('admin_get_all_members returned', allMembers.length, 'rows, error:', membersError?.message);

    // Agrupa miembros por usuario (siempre, aunque esté vacío)
    const userMap = new Map<string, UserWithEntries>();
    for (const m of allMembers as EntryWithLeague[]) {
      const uid = m.user_id;
      if (!userMap.has(uid)) {
        userMap.set(uid, { userId: uid, realName: (m.profile as any)?.name ?? 'Jugador', entries: [] });
      }
      userMap.get(uid)!.entries.push(m);
    }
    setUsersWithEntries(Array.from(userMap.values()).sort((a, b) => a.realName.localeCompare(b.realName)));

    // Conteos de predicciones directo del RPC (evita el límite de 1000 filas)
    const stats: Record<string, { matchPreds: number; hasGroups: boolean; hasPodio: boolean }> = {};
    for (const m of allMembers as any[]) {
      stats[m.id] = {
        matchPreds: m.match_preds,
        hasGroups: m.group_preds > 0,
        hasPodio: m.podium_preds > 0,
      };
    }
    setPredStats(stats);

    if (allMembers.length > 0) {
      // Fetch emails via admin RPC
      const { data: emailData } = await supabase.rpc('admin_get_user_emails');
      if (emailData) {
        const em: Record<string, string> = {};
        for (const row of emailData) em[row.id] = row.email ?? '';
        setEmailMap(em);
      }
    }

    // Todas las ligas (para editar premios desde aquí)
    try {
      const leagues = await getAdminLeagues();
      setAdminLeaguesList(leagues);
    } catch (e) {
      console.error('getAdminLeagues error:', e);
    }

    // Ligas de eliminatoria (para "quién avanzó")
    try {
      const { data: kol } = await supabase.from('leagues').select('id, name').eq('is_knockout', true).order('name');
      setKoLeagues((kol as any[]) || []);
    } catch (e) { console.error('knockout leagues error:', e); }

    // Multiplicadores de eliminatoria
    try {
      const mults = await getKnockoutMultipliers();
      setKoMults(mults);
      const draft: Record<string, string> = {};
      for (const m of mults) draft[m.stage] = String(m.multiplier);
      setKoDraft(draft);
    } catch (e) {
      console.error('getKnockoutMultipliers error:', e);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const [creatingKoFor, setCreatingKoFor] = useState<string | null>(null);
  const [koCreateMsg, setKoCreateMsg] = useState('');
  async function handleCreateKnockout(leagueId: string) {
    setCreatingKoFor(leagueId);
    setKoCreateMsg('');
    try {
      await createKnockoutContinuation(leagueId);
      const leagues = await getAdminLeagues();
      setAdminLeaguesList(leagues);
      setKoCreateMsg('✅ Fase eliminatoria creada. Sus jugadores ya verán el aviso para avanzar.');
      setTimeout(() => setKoCreateMsg(''), 4000);
    } catch (e: any) {
      setKoCreateMsg('❌ ' + (e?.message || 'Error'));
    } finally {
      setCreatingKoFor(null);
    }
  }

  async function handleSaveKoMults() {
    setSavingKo(true);
    setKoMsg('');
    try {
      for (const m of koMults) {
        const v = parseFloat(koDraft[m.stage]);
        if (!isNaN(v) && v !== m.multiplier) await setKnockoutMultiplier(m.stage, v);
      }
      const mults = await getKnockoutMultipliers();
      setKoMults(mults);
      setKoMsg('✅ Multiplicadores guardados');
      setTimeout(() => setKoMsg(''), 2500);
    } catch (e: any) {
      setKoMsg('❌ ' + (e?.message || 'Error'));
    } finally {
      setSavingKo(false);
    }
  }

  function openPrizeEdit(l: AdminLeaguePrize) {
    if (prizeEditId === l.id) { setPrizeEditId(null); return; }
    setPrizeEditId(l.id);
    setPzPrice(l.entry_price ? String(l.entry_price) : '');
    setPzDesc(l.prize_description ?? '');
    setPzComm(l.organizer_commission ? String(l.organizer_commission) : '');
    setPzMsg('');
  }

  async function savePrizeEdit(leagueId: string) {
    setPzSaving(true);
    setPzMsg('');
    try {
      await updateLeaguePrize(leagueId, parseFloat(pzPrice) || 0, pzDesc.trim(), parseFloat(pzComm) || 0);
      setPzMsg('✅ Guardado');
      const leagues = await getAdminLeagues();
      setAdminLeaguesList(leagues);
      setTimeout(() => { setPrizeEditId(null); setPzMsg(''); }, 1000);
    } catch (e: any) {
      setPzMsg('❌ ' + (e?.message || 'No se pudo guardar'));
    } finally {
      setPzSaving(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult('');
    try {
      const { inserted, updated } = await triggerMatchSync();
      await load();
      setSyncResult(`✅ Listo: ${inserted} partidos nuevos, ${updated} actualizados`);
    } catch (e: any) {
      setSyncResult(`❌ Error: ${e.message || 'No se pudo sincronizar'}`);
    } finally {
      setSyncing(false);
    }
  }

  function openEdit(match: Match) {
    setEditing(match);
    setHomeScore(match.home_score != null ? String(match.home_score) : '');
    setAwayScore(match.away_score != null ? String(match.away_score) : '');
    setNewStatus(match.status as any);
  }

  async function handleSaveTournamentResults() {
    setSavingTr(true);
    setTrMsg('');
    try {
      await saveTournamentResults(trChampion || null, trRunnerUp || null, trThird || null, trScorer || null);
      setTrMsg('✅ Resultados guardados');
      await load();
    } catch (e: any) {
      setTrMsg('❌ Error: ' + e.message);
    } finally {
      setSavingTr(false);
    }
  }

  async function handleToggleEntryPaid(memberId: string, currentPaid: boolean) {
    setTogglingId(memberId);
    setPaidMsg('');
    try {
      await setLeagueMemberPaidById(memberId, !currentPaid);
      setUsersWithEntries(prev => prev.map(u => ({
        ...u,
        entries: u.entries.map(e => e.id === memberId ? { ...e, is_paid: !currentPaid } : e),
      })));
      setPaidMsg('✅ Guardado');
      setTimeout(() => setPaidMsg(''), 2000);
    } catch (e: any) {
      setPaidMsg('❌ Error: ' + (e?.message || JSON.stringify(e)));
    } finally {
      setTogglingId(null);
    }
  }

  async function openMoveModal(entryId: string) {
    if (allLeagues.length === 0) {
      const leagues = await getAllLeagues();
      setAllLeagues(leagues);
    }
    setMoveEntryId(entryId);
    setConfirmDeleteId(null);
  }

  async function handleMove(newLeagueId: string) {
    if (!moveEntryId) return;
    setMovingId(moveEntryId);
    try {
      await moveLeagueEntry(moveEntryId, newLeagueId);
      setMoveEntryId(null);
      setPaidMsg('✅ Quiniela movida');
      setTimeout(() => setPaidMsg(''), 2500);
      await load(); // recargar para reflejar el cambio
    } catch (e: any) {
      setPaidMsg('❌ Error: ' + (e?.message || ''));
    } finally {
      setMovingId(null);
    }
  }

  async function handleAdminDelete(memberId: string) {
    setDeletingEntryId(memberId);
    try {
      await deleteLeagueEntry(memberId);
      setUsersWithEntries(prev => prev
        .map(u => ({ ...u, entries: u.entries.filter(e => e.id !== memberId) }))
        .filter(u => u.entries.length > 0)
      );
      setConfirmDeleteId(null);
      setPaidMsg('✅ Quiniela eliminada');
      setTimeout(() => setPaidMsg(''), 2500);
    } catch (e: any) {
      setPaidMsg('❌ Error al eliminar: ' + (e?.message || ''));
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function handleSaveGroupResults() {
    setSavingGroups(true);
    setGroupMsg('');
    try {
      const entries = Object.entries(groupResults).filter(([, { first, second }]) => first && second);
      await Promise.all(entries.map(([g, { first, second }]) => saveGroupResult(g, first, second)));
      setGroupMsg(`✅ ${entries.length} grupos guardados`);
    } catch (e: any) {
      setGroupMsg('❌ Error: ' + e.message);
    } finally {
      setSavingGroups(false);
    }
  }

  async function handleUpdateMatch() {
    if (!editing) return;
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a)) {
      setMatchMsg('❌ Ingresa marcadores válidos');
      return;
    }
    setMatchMsg('Guardando...');
    try {
      await adminUpdateMatch(editing.id, h, a, newStatus);
      setMatchMsg('');
      setEditing(null);
      await load();
    } catch (e: any) {
      setMatchMsg('❌ Error: ' + (e?.message || JSON.stringify(e)));
    }
  }

  async function handleClearMatch() {
    if (!editing) return;
    setMatchMsg('Quitando marcador...');
    try {
      await adminClearMatch(editing.id);
      setMatchMsg('');
      setEditing(null);
      await load();
    } catch (e: any) {
      setMatchMsg('❌ Error: ' + (e?.message || JSON.stringify(e)));
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.gold} /></View>;
  }

  const paidCount = usersWithEntries.reduce((sum, u) => sum + u.entries.filter(e => e.is_paid).length, 0);
  const totalEntries = usersWithEntries.reduce((sum, u) => sum + u.entries.length, 0);

  const listHeader = (
    <>
      {/* Payment management */}
      <View style={styles.trSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.trTitle}>💳 Gestión de Pagos</Text>
          <Text style={styles.paidCounter}>{paidCount}/{totalEntries} pagados</Text>
        </View>
        <Text style={styles.trHint}>Todos los jugadores registrados · Toca para aprobar/quitar pago por quiniela</Text>
        <TouchableOpacity
          style={styles.exportPayBtn}
          onPress={async () => {
            setExportingPayments(true);
            try { await exportPaymentList(); } catch (e: any) { console.error(e); }
            finally { setExportingPayments(false); }
          }}
          disabled={exportingPayments}
        >
          {exportingPayments
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.exportPayBtnText}>📥 Descargar lista de pagos (.xlsx)</Text>
          }
        </TouchableOpacity>
        {paidMsg ? (
          <Text style={[styles.paidMsg, { color: paidMsg.startsWith('✅') ? '#2e7d32' : Colors.accent }]}>{paidMsg}</Text>
        ) : null}
        {usersWithEntries.length === 0 ? (
          <Text style={styles.trHint}>No hay jugadores registrados aún.</Text>
        ) : (() => {
          // Agrupar por liga — un usuario puede aparecer en múltiples ligas
          const ligaMap = new Map<string, { leagueId: string; leagueName: string; leagueCode: string; rows: Array<{ entry: EntryWithLeague; realName: string }> }>();
          for (const user of usersWithEntries) {
            for (const entry of user.entries) {
              const lid = (entry.league as any)?.id ?? entry.league_id ?? 'unknown';
              const lname = (entry.league as any)?.name ?? 'Sin liga';
              const lcode = (entry.league as any)?.code ?? '';
              if (!ligaMap.has(lid)) ligaMap.set(lid, { leagueId: lid, leagueName: lname, leagueCode: lcode, rows: [] });
              ligaMap.get(lid)!.rows.push({ entry, realName: user.realName });
            }
          }
          const ligaGroups = Array.from(ligaMap.values()).sort((a, b) => a.leagueName.localeCompare(b.leagueName));

          return (
          <>
          {/* Controles colapsar/expandir todas */}
          <View style={styles.collapseControls}>
            <TouchableOpacity
              style={styles.collapseCtrlBtn}
              onPress={() => {
                const all: Record<string, boolean> = {};
                for (const g of ligaGroups) all[g.leagueId] = true;
                setCollapsedLeagues(all);
              }}
            >
              <Text style={styles.collapseCtrlText}>▸ Colapsar todas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.collapseCtrlBtn}
              onPress={() => setCollapsedLeagues({})}
            >
              <Text style={styles.collapseCtrlText}>▾ Expandir todas</Text>
            </TouchableOpacity>
          </View>
          {ligaGroups.map(liga => {
            const ligaPaid = liga.rows.filter(r => r.entry.is_paid).length;
            // ¿Es liga de eliminatoria? → el total es de partidos de eliminatoria
            const isKoLiga = koLeagues.some(k => k.id === liga.leagueId);
            const ligaTotal = isKoLiga ? totalKnockoutMatches : totalGroupMatches;
            const isCollapsed = collapsedLeagues[liga.leagueId] ?? false;
            return (
              <View key={liga.leagueId} style={styles.ligaSection}>
                {/* Encabezado de liga (tap para colapsar/expandir) */}
                <TouchableOpacity
                  style={styles.ligaSectionHeader}
                  onPress={() => setCollapsedLeagues(prev => ({ ...prev, [liga.leagueId]: !isCollapsed }))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ligaCollapseIcon}>{isCollapsed ? '▸' : '▾'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ligaSectionName}>{liga.leagueName}</Text>
                    <Text style={styles.ligaSectionCode}>Código: {liga.leagueCode} · {liga.rows.length} jugador{liga.rows.length === 1 ? '' : 'es'}</Text>
                  </View>
                  <View style={styles.ligaPaidBadge}>
                    <Text style={styles.ligaPaidBadgeText}>{ligaPaid}/{liga.rows.length} pagados</Text>
                  </View>
                </TouchableOpacity>

                {/* Filas de jugadores en esta liga */}
                {!isCollapsed && liga.rows.map(({ entry, realName }) => {
                  const ps = predStats[entry.id] ?? { matchPreds: 0, hasGroups: false, hasPodio: false };
                  const hasAny = ps.matchPreds > 0 || (!isKoLiga && (ps.hasGroups || ps.hasPodio));
                  // En eliminatoria solo cuentan los partidos (no grupos)
                  const allDone = isKoLiga
                    ? (ligaTotal > 0 && ps.matchPreds >= ligaTotal)
                    : (ps.matchPreds === ligaTotal && ps.hasGroups && ps.hasPodio);
                  const email = emailMap[entry.user_id] ?? '';
                  const isExpanded = expandedUser === entry.id;
                  return (
                    <View key={entry.id} style={styles.entryRow}>
                      <View style={styles.entryInfo}>
                        {/* Nombre + tap para ver email */}
                        <TouchableOpacity onPress={() => setExpandedUser(isExpanded ? null : entry.id)} style={styles.entryNameRow}>
                          <Text style={styles.entryRealName}>{realName}</Text>
                          <Text style={styles.entryExpandHint}>{isExpanded ? ' ▲' : ' ▼'}</Text>
                        </TouchableOpacity>
                        {isExpanded && (
                          <Text style={styles.entryEmail} selectable>{email || '—'}</Text>
                        )}
                        <Text style={styles.entryAlias}>🎯 {entry.alias || 'Sin nombre'}{entry.is_admin ? ' · Admin' : ''}</Text>
                        <View style={styles.predRow}>
                          <View style={[styles.predDot, allDone ? styles.predDotGreen : hasAny ? styles.predDotYellow : styles.predDotRed]} />
                          <Text style={styles.predText}>
                            ⚽ {ps.matchPreds}/{ligaTotal}
                            {isKoLiga ? '' : `  🗂 ${ps.hasGroups ? '✓' : '✗'}`}
                            {'  '}🏆 {ps.hasPodio ? '✓' : '✗'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity
                          style={[styles.paidToggle, entry.is_paid && styles.paidToggleOn]}
                          onPress={() => handleToggleEntryPaid(entry.id, entry.is_paid)}
                          disabled={togglingId === entry.id}
                        >
                          {togglingId === entry.id
                            ? <ActivityIndicator size="small" color={Colors.white} />
                            : <Text style={[styles.paidToggleText, entry.is_paid && styles.paidToggleTextOn]}>
                                {entry.is_paid ? '✓ Pagó' : 'Sin pago'}
                              </Text>
                          }
                        </TouchableOpacity>
                        {/* Botón mover liga */}
                        <TouchableOpacity
                          style={styles.moveBtn}
                          onPress={() => openMoveModal(entry.id)}
                          disabled={movingId === entry.id}
                        >
                          {movingId === entry.id
                            ? <ActivityIndicator size="small" color={Colors.primary} />
                            : <Text style={styles.moveBtnText}>↗</Text>
                          }
                        </TouchableOpacity>
                        {/* Botón eliminar */}
                        {confirmDeleteId === entry.id ? (
                          <View style={styles.deleteConfirmRow}>
                            <Text style={styles.deleteConfirmText}>¿Eliminar?</Text>
                            <TouchableOpacity
                              style={styles.deleteConfirmYes}
                              onPress={() => handleAdminDelete(entry.id)}
                              disabled={deletingEntryId === entry.id}
                            >
                              {deletingEntryId === entry.id
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.deleteConfirmYesText}>Sí</Text>
                              }
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteConfirmNo}
                              onPress={() => setConfirmDeleteId(null)}
                            >
                              <Text style={styles.deleteConfirmNoText}>No</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => setConfirmDeleteId(entry.id)}
                          >
                            <Text style={styles.deleteBtnText}>🗑</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          </>
          );
        })()}
      </View>

      {/* Quién avanzó a Eliminatoria */}
      {koLeagues.length > 0 && (
        <View style={styles.trSection}>
          <Text style={styles.trTitle}>🏆 Quién avanzó a Eliminatoria</Text>
          <Text style={styles.trHint}>Jugadores que se unieron a cada fase eliminatoria. "Sin pago" = pendiente de cobrar.</Text>
          {koLeagues.map((kl) => {
            const rows: { alias: string; name: string; paid: boolean }[] = [];
            for (const u of usersWithEntries) {
              for (const e of u.entries) {
                if (((e.league as any)?.id ?? e.league_id) === kl.id) {
                  rows.push({ alias: e.alias || u.realName, name: u.realName, paid: e.is_paid });
                }
              }
            }
            rows.sort((a, b) => a.alias.localeCompare(b.alias));
            const paidN = rows.filter((r) => r.paid).length;
            return (
              <View key={kl.id} style={styles.koAdvBlock}>
                <View style={styles.koAdvHead}>
                  <Text style={styles.koAdvName}>{kl.name}</Text>
                  <Text style={styles.koAdvCount}>{rows.length} avanzaron · {paidN} pagados</Text>
                </View>
                {rows.length === 0 ? (
                  <Text style={styles.trHint}>Nadie se ha unido aún.</Text>
                ) : rows.map((r, i) => (
                  <View key={i} style={styles.koAdvRow}>
                    <Text style={styles.koAdvPlayer}>{r.alias}{r.name !== r.alias ? ` · ${r.name}` : ''}</Text>
                    <View style={[styles.koAdvBadge, r.paid ? styles.koAdvPaid : styles.koAdvUnpaid]}>
                      <Text style={styles.koAdvBadgeText}>{r.paid ? '✓ Pagó' : 'Sin pago'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Multiplicadores de eliminatoria */}
      {koMults.length > 0 && (
        <View style={styles.trSection}>
          <Text style={styles.trTitle}>🏆 Puntos de Eliminatoria (multiplicadores)</Text>
          <Text style={styles.trHint}>Cuánto se multiplican los puntos base (máx 7) en cada ronda de las ligas de eliminatoria.</Text>
          {(['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final', 'third_place'] as const).map((stage) => {
            const labels: Record<string, string> = {
              round_of_32: 'Ronda de 32', round_of_16: 'Octavos', quarterfinal: 'Cuartos',
              semifinal: 'Semifinal', final: 'Final', third_place: '3er lugar',
            };
            if (!koMults.find((m) => m.stage === stage)) return null;
            return (
              <View key={stage} style={styles.koRow}>
                <Text style={styles.koLabel}>{labels[stage]}</Text>
                <Text style={styles.koX}>×</Text>
                <TextInput
                  style={styles.koInput}
                  value={koDraft[stage] ?? ''}
                  onChangeText={(t) => setKoDraft((p) => ({ ...p, [stage]: t }))}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={Colors.textSecondary}
                />
                <Text style={styles.koMax}>máx {Math.round(7 * (parseFloat(koDraft[stage]) || 0))} pts</Text>
              </View>
            );
          })}
          {koMsg ? <Text style={[styles.paidMsg, { color: koMsg.startsWith('✅') ? '#2e7d32' : Colors.accent }]}>{koMsg}</Text> : null}
          <TouchableOpacity style={styles.trSaveBtn} onPress={handleSaveKoMults} disabled={savingKo}>
            {savingKo ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.trSaveBtnText}>Guardar multiplicadores</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Premios por liga */}
      <View style={styles.trSection}>
        <Text style={styles.trTitle}>💰 Premios por liga</Text>
        <Text style={styles.trHint}>Edita el precio, premio y comisión de cualquier liga (aunque no tengas quiniela en ella)</Text>
        {adminLeaguesList.length === 0 ? (
          <Text style={styles.trHint}>No hay ligas.</Text>
        ) : adminLeaguesList.map((l) => (
          <View key={l.id} style={styles.pzLeague}>
            <TouchableOpacity style={styles.pzHead} onPress={() => openPrizeEdit(l)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pzName}>{l.name}</Text>
                <Text style={styles.pzMeta}>
                  {l.entry_price > 0 ? `$${l.entry_price.toLocaleString('es-MX')} entrada` : 'Premio fijo'}
                  {' · '}{l.organizer_commission > 0 ? `${l.organizer_commission}% comisión` : 'sin comisión'}
                </Text>
              </View>
              <Text style={styles.pzChevron}>{prizeEditId === l.id ? '▲' : '✏️'}</Text>
            </TouchableOpacity>
            {prizeEditId === l.id && (
              <View style={styles.pzBox}>
                <Text style={styles.pzLabel}>Precio de entrada ($) — 0 si es premio fijo</Text>
                <TextInput style={styles.pzInput} value={pzPrice} onChangeText={setPzPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textSecondary} />
                <Text style={[styles.pzLabel, { marginTop: 10 }]}>Descripción del premio</Text>
                <TextInput style={[styles.pzInput, { height: 76, textAlignVertical: 'top' }]} value={pzDesc} onChangeText={setPzDesc} multiline maxLength={300} placeholder="Ej: 60% 1ro, 30% 2do, 10% 3ro" placeholderTextColor={Colors.textSecondary} />
                <Text style={[styles.pzLabel, { marginTop: 10 }]}>Comisión (%) — 0 si no se cobra</Text>
                <TextInput style={styles.pzInput} value={pzComm} onChangeText={setPzComm} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textSecondary} />
                {pzMsg ? <Text style={styles.pzMsg}>{pzMsg}</Text> : null}
                <View style={styles.pzBtns}>
                  <TouchableOpacity style={styles.pzCancel} onPress={() => setPrizeEditId(null)}>
                    <Text style={styles.pzCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pzSave} onPress={() => savePrizeEdit(l.id)} disabled={pzSaving}>
                    {pzSaving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.pzSaveText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {/* Crear fase eliminatoria de esta liga */}
            <TouchableOpacity
              style={styles.koCreateBtn}
              onPress={() => handleCreateKnockout(l.id)}
              disabled={creatingKoFor === l.id}
            >
              {creatingKoFor === l.id
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.koCreateText}>🏆 Crear/abrir fase eliminatoria de esta liga</Text>}
            </TouchableOpacity>
          </View>
        ))}
        {koCreateMsg ? <Text style={[styles.paidMsg, { color: koCreateMsg.startsWith('✅') ? '#2e7d32' : Colors.accent }]}>{koCreateMsg}</Text> : null}
      </View>

      {/* Tournament results */}
      <View style={styles.trSection}>
        <Text style={styles.trTitle}>🏆 Resultados Finales del Torneo</Text>
        <Text style={styles.trHint}>Llena al terminar el torneo para calcular puntos del podio y goleador</Text>
        {[
          { label: '🏆 Campeón', value: trChampion, set: setTrChampion },
          { label: '🥈 Subcampeón', value: trRunnerUp, set: setTrRunnerUp },
          { label: '🥉 3er Lugar', value: trThird, set: setTrThird },
          { label: '⚽ Goleador', value: trScorer, set: setTrScorer },
        ].map(({ label, value, set }) => (
          <View key={label} style={styles.trRow}>
            <Text style={styles.trLabel}>{label}</Text>
            <TextInput
              style={styles.trInput}
              value={value}
              onChangeText={set}
              placeholder={label.includes('Goleador') ? 'Nombre del jugador' : 'Nombre del equipo'}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        ))}
        {trMsg ? <Text style={[styles.paidMsg, { color: trMsg.startsWith('✅') ? '#2e7d32' : Colors.accent }]}>{trMsg}</Text> : null}
        <TouchableOpacity style={styles.trSaveBtn} onPress={handleSaveTournamentResults} disabled={savingTr}>
          {savingTr ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.trSaveBtnText}>Guardar Resultados</Text>}
        </TouchableOpacity>
      </View>

      {/* Group results */}
      <View style={styles.trSection}>
        <Text style={styles.trTitle}>🗂 Resultados por Grupo</Text>
        <Text style={styles.trHint}>Llena al terminar la fase de grupos (4 pts por equipo que clasificó correcto)</Text>
        {Object.keys(groupTeams).sort().map(groupName => {
          const sel = groupResults[groupName] || { first: '', second: '' };
          const teams = groupTeams[groupName] || [];
          return (
            <View key={groupName} style={styles.groupResultRow}>
              <Text style={styles.groupLabel}>Grupo {groupName}</Text>
              <View style={styles.groupSelectors}>
                <View style={styles.groupSelectorCol}>
                  <Text style={styles.groupSelectorTitle}>🥇 1ro</Text>
                  {teams.map(({ team, flag }) => (
                    <TouchableOpacity
                      key={team}
                      style={[styles.groupTeamBtn, sel.first === team && styles.groupTeamBtnFirst]}
                      onPress={() => setGroupResults(prev => ({ ...prev, [groupName]: { ...sel, first: team } }))}
                    >
                      <Text style={styles.groupTeamBtnText}>{flag} {team.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.groupSelectorCol}>
                  <Text style={styles.groupSelectorTitle}>🥈 2do</Text>
                  {teams.map(({ team, flag }) => (
                    <TouchableOpacity
                      key={team}
                      style={[styles.groupTeamBtn, sel.second === team && styles.groupTeamBtnSecond]}
                      onPress={() => setGroupResults(prev => ({ ...prev, [groupName]: { ...sel, second: team } }))}
                    >
                      <Text style={styles.groupTeamBtnText}>{flag} {team.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
        {groupMsg ? <Text style={[styles.paidMsg, { color: groupMsg.startsWith('✅') ? '#2e7d32' : Colors.accent }]}>{groupMsg}</Text> : null}
        <TouchableOpacity style={styles.trSaveBtn} onPress={handleSaveGroupResults} disabled={savingGroups}>
          {savingGroups ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.trSaveBtnText}>Guardar Resultados de Grupos</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
        {syncing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.syncBtnText}>🔄 Sincronizar partidos con API</Text>}
      </TouchableOpacity>
      {syncResult ? (
        <View style={[styles.resultBox, syncResult.startsWith('❌') && styles.resultBoxError]}>
          <Text style={styles.resultText}>{syncResult}</Text>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>Partidos ({matches.length})</Text>
      <Text style={styles.hint}>Toca un partido para actualizar su marcador manualmente</Text>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.matchRow} onPress={() => openEdit(item)}>
            <View style={styles.matchInfo}>
              <Text style={styles.matchTeams}>
                {item.home_flag} {item.home_team} vs {item.away_team} {item.away_flag}
              </Text>
              <Text style={styles.matchDate}>
                {new Date(item.match_date).toLocaleDateString('es-MX')}
              </Text>
            </View>
            <View style={[styles.statusBadge,
              item.status === 'live' && styles.statusLive,
              item.status === 'finished' && styles.statusFinished,
            ]}>
              <Text style={styles.statusText}>{StatusLabels[item.status]}</Text>
            </View>
            {item.home_score != null && (
              <Text style={styles.matchScore}>{item.home_score}-{item.away_score}</Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Move league modal */}
      <Modal visible={!!moveEntryId} transparent animationType="slide" onRequestClose={() => setMoveEntryId(null)}>
        <View style={styles.overlay}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>↗ Mover a otra liga</Text>
            <Text style={[styles.trHint, { textAlign: 'center', marginBottom: 16 }]}>
              Selecciona la liga de destino para esta quiniela
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {allLeagues
                .filter(l => {
                  // hide current league of this entry
                  const entry = usersWithEntries.flatMap(u => u.entries).find(e => e.id === moveEntryId);
                  return entry ? l.name !== entry.league.name : true;
                })
                .map(liga => (
                  <TouchableOpacity
                    key={liga.id}
                    style={styles.leagueOptionRow}
                    onPress={() => handleMove(liga.id)}
                    disabled={!!movingId}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leagueOptionName}>{liga.name}</Text>
                      <Text style={styles.leagueOptionCode}>Código: {liga.code}</Text>
                    </View>
                    {movingId ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={{ fontSize: 18, color: Colors.primary }}>›</Text>}
                  </TouchableOpacity>
                ))
              }
              {allLeagues.length === 0 && (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
              )}
            </ScrollView>
            <TouchableOpacity style={styles.editCancel} onPress={() => setMoveEntryId(null)}>
              <Text style={styles.editCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Actualizar Partido</Text>
            {editing && (
              <Text style={styles.editMatch}>
                {editing.home_flag} {editing.home_team} vs {editing.away_team} {editing.away_flag}
              </Text>
            )}

            <View style={styles.scoreRow}>
              <TextInput
                style={styles.scoreInput}
                value={homeScore}
                onChangeText={setHomeScore}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
              />
              <Text style={styles.scoreDash}>-</Text>
              <TextInput
                style={styles.scoreInput}
                value={awayScore}
                onChangeText={setAwayScore}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
              />
            </View>

            <Text style={styles.statusLabel}>Estado del partido:</Text>
            <View style={styles.statusOptions}>
              {(['upcoming', 'live', 'finished'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, newStatus === s && styles.statusOptionActive]}
                  onPress={() => setNewStatus(s)}
                >
                  <Text style={[styles.statusOptionText, newStatus === s && styles.statusOptionTextActive]}>
                    {StatusLabels[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {matchMsg ? <Text style={{ textAlign: 'center', marginBottom: 10, fontWeight: '600', color: matchMsg.startsWith('❌') ? 'red' : Colors.textSecondary }}>{matchMsg}</Text> : null}

            {/* Quitar marcador / reiniciar a próximo */}
            <TouchableOpacity style={styles.clearScoreBtn} onPress={handleClearMatch}>
              <Text style={styles.clearScoreBtnText}>🗑 Quitar marcador (dejar como próximo)</Text>
            </TouchableOpacity>

            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.editCancel} onPress={() => { setEditing(null); setMatchMsg(''); }}>
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSave} onPress={handleUpdateMatch}>
                <Text style={styles.editSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trSection: { margin: 16, marginBottom: 8, backgroundColor: Colors.card, borderRadius: 12, padding: 16 },
  trTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  trHint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  trRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  trLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, width: 110 },
  trInput: {
    flex: 1, height: 38, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 10, fontSize: 13, color: Colors.text, backgroundColor: Colors.background,
  },
  trSaveBtn: {
    height: 44, borderRadius: 10, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  trSaveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  clearScoreBtn: {
    height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: '#d32f2f',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  clearScoreBtnText: { fontSize: 13, fontWeight: '700', color: '#d32f2f' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  adminTag: { fontSize: 10, color: Colors.gold, fontWeight: '700', backgroundColor: '#fff3cd', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  paidToggle: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, minWidth: 80, alignItems: 'center' },
  paidToggleOn: { backgroundColor: Colors.green, borderColor: Colors.green },
  // Liga sections in payment panel
  ligaSection: {
    backgroundColor: '#f8f9fa', borderRadius: 12, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  ligaSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10,
  },
  ligaCollapseIcon: { fontSize: 16, fontWeight: '800', color: Colors.gold, width: 16, textAlign: 'center' },
  collapseControls: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  collapseCtrlBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  collapseCtrlText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  ligaSectionName: { fontSize: 15, fontWeight: '800', color: Colors.white },
  ligaSectionCode: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  ligaPaidBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  ligaPaidBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  entryRealName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  entryExpandHint: { fontSize: 11, color: Colors.textSecondary },
  entryEmail: { fontSize: 12, color: Colors.primary, marginBottom: 3, fontStyle: 'italic' },
  entryActions: { alignItems: 'flex-end', gap: 6 },
  koAdvBlock: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  koAdvHead: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8 },
  koAdvName: { fontSize: 14, fontWeight: '800', color: Colors.white },
  koAdvCount: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  koAdvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  koAdvPlayer: { flex: 1, fontSize: 13, color: Colors.text },
  koAdvBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  koAdvPaid: { backgroundColor: '#e8f5e9' },
  koAdvUnpaid: { backgroundColor: '#fff3e0' },
  koAdvBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  koRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  koLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, width: 110 },
  koX: { fontSize: 16, color: Colors.textSecondary, fontWeight: '700' },
  koInput: {
    width: 60, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 10, fontSize: 15, color: Colors.text, backgroundColor: Colors.background, textAlign: 'center',
  },
  koMax: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  koCreateBtn: {
    margin: 8, marginTop: 0, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.gold, alignItems: 'center',
  },
  koCreateText: { fontSize: 12, fontWeight: '700', color: '#9a6a08' },
  pzLeague: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  pzHead: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: Colors.background },
  pzName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  pzMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pzChevron: { fontSize: 15, marginLeft: 8 },
  pzBox: { padding: 12 },
  pzLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  pzInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, minHeight: 40,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: Colors.text, backgroundColor: Colors.background,
  },
  pzMsg: { fontSize: 12, fontWeight: '600', color: Colors.text, marginTop: 8, textAlign: 'center' },
  pzBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pzCancel: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  pzCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  pzSave: { flex: 1, height: 40, borderRadius: 8, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  pzSaveText: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  moveBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#e8f4fd', alignItems: 'center', justifyContent: 'center',
  },
  moveBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '700' },
  leagueOptionRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background, marginBottom: 8,
  },
  leagueOptionName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  leagueOptionCode: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16 },
  deleteConfirmRow: { alignItems: 'center', gap: 4 },
  deleteConfirmText: { fontSize: 11, color: '#c62828', fontWeight: '700' },
  deleteConfirmYes: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: '#c62828', minWidth: 36, alignItems: 'center',
  },
  deleteConfirmYesText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteConfirmNo: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: '#e0e0e0', minWidth: 36, alignItems: 'center',
  },
  deleteConfirmNoText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  exportPayBtn: {
    backgroundColor: '#1565c0', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', marginBottom: 12, marginTop: 4,
  },
  exportPayBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  paidToggleText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  paidToggleTextOn: { color: Colors.white },
  groupResultRow: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 12 },
  groupLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  groupSelectors: { flexDirection: 'row', gap: 8 },
  groupSelectorCol: { flex: 1, gap: 4 },
  groupSelectorTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
  groupTeamBtn: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  groupTeamBtnFirst: { borderColor: Colors.gold, backgroundColor: '#fffde7' },
  groupTeamBtnSecond: { borderColor: Colors.textSecondary, backgroundColor: '#f5f5f5' },
  groupTeamBtnText: { fontSize: 11, color: Colors.text, fontWeight: '500' },
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  syncBtn: {
    margin: 16, height: 52, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  syncBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
  resultBox: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: '#e8f5e9' },
  resultBoxError: { backgroundColor: '#fff0f0' },
  resultText: { fontSize: 14, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  list: { paddingHorizontal: 8, paddingBottom: 32 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 10, padding: 12, marginBottom: 6,
  },
  matchInfo: { flex: 1 },
  matchTeams: { fontSize: 14, fontWeight: '600', color: Colors.text },
  matchDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#e8f0fe', marginLeft: 8,
  },
  statusLive: { backgroundColor: '#ffe5e5' },
  statusFinished: { backgroundColor: '#f0f0f0' },
  statusText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  matchScore: { fontSize: 16, fontWeight: '800', color: Colors.text, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  editTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  editMatch: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  scoreInput: {
    width: 72, height: 60, borderRadius: 12, borderWidth: 2, borderColor: Colors.gold,
    fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center', backgroundColor: '#fffdf0',
  },
  scoreDash: { fontSize: 28, fontWeight: '700', color: Colors.textSecondary },
  statusLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  statusOptions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusOption: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  statusOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusOptionText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  statusOptionTextActive: { color: Colors.white },
  editButtons: { flexDirection: 'row', gap: 12 },
  editCancel: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  editCancelText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  editSave: { flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { fontSize: 16, color: Colors.white, fontWeight: '700' },
  // Payment section
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  paidCounter: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  paidMsg: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 4 },
  userBlock: { backgroundColor: Colors.background, borderRadius: 10, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  userHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f8f9ff', gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  userLeaguesSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  entryCount: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  expandChevron: { fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },
  userDetail: { backgroundColor: '#f0f4ff', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userDetailLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  userDetailValue: { fontSize: 12, color: Colors.text, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  entryInfo: { flex: 1 },
  entryAlias: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  entryLeagueName: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  predRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  predDot: { width: 7, height: 7, borderRadius: 4 },
  predDotGreen: { backgroundColor: '#4caf50' },
  predDotYellow: { backgroundColor: '#ff9800' },
  predDotRed: { backgroundColor: '#f44336' },
  predText: { fontSize: 11, color: Colors.textSecondary },
  noLeagueBox: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  noLeagueText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  goLigasBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  goLigasBtnText: { fontSize: 14, color: Colors.white, fontWeight: '700' },
});
