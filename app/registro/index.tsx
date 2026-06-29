import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/lib/league';
import { Colors } from '@/constants/Colors';
import { isPredictionsLocked, LOCK_DATE_STR } from '@/lib/constants';
import {
  getRegistroMembers, getRegistroPodium, getRegistroGroups, getRegistroMatches,
  RegistroMember, RegistroPodium, RegistroGroup, RegistroMatchPred,
} from '@/lib/api';

interface MatchInfo {
  id: number; home_team: string; away_team: string;
  home_flag: string; away_flag: string; group_name: string | null; match_date: string;
  status?: string;
}

const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function RegistroScreen() {
  const { activeLeague } = useLeague();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<RegistroMember[]>([]);
  const [podiums, setPodiums] = useState<Record<string, RegistroPodium>>({});
  const [groups, setGroups] = useState<Record<string, RegistroGroup[]>>({});
  const [matchPreds, setMatchPreds] = useState<Record<string, RegistroMatchPred[]>>({});
  const [matchInfo, setMatchInfo] = useState<Record<number, MatchInfo>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMatchesFor, setShowMatchesFor] = useState<string | null>(null);
  // Datos de premio frescos de la liga (por si el admin los editó)
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [prizeDesc, setPrizeDesc] = useState<string | null>(null);
  const [commission, setCommission] = useState<number>(0);

  const locked = isPredictionsLocked();

  const load = useCallback(async () => {
    if (!activeLeague) return;
    try {
      const [mem, pod, grp, mpr, { data: matches }, { data: leagueRow }] = await Promise.all([
        getRegistroMembers(activeLeague.id),
        getRegistroPodium(activeLeague.id),
        getRegistroGroups(activeLeague.id),
        getRegistroMatches(activeLeague.id),
        supabase.from('matches').select('id, home_team, away_team, home_flag, away_flag, group_name, match_date, status').order('match_date'),
        supabase.from('leagues').select('entry_price, prize_description, organizer_commission').eq('id', activeLeague.id).single(),
      ]);
      setMembers(mem);
      setEntryPrice(Number(leagueRow?.entry_price ?? activeLeague.entry_price ?? 0));
      setPrizeDesc(leagueRow?.prize_description ?? activeLeague.prize_description ?? null);
      setCommission(Number(leagueRow?.organizer_commission ?? 0));

      const podMap: Record<string, RegistroPodium> = {};
      for (const p of pod) podMap[p.member_id] = p;
      setPodiums(podMap);

      const grpMap: Record<string, RegistroGroup[]> = {};
      for (const g of grp) (grpMap[g.member_id] ??= []).push(g);
      setGroups(grpMap);

      const mprMap: Record<string, RegistroMatchPred[]> = {};
      for (const m of mpr) (mprMap[m.member_id] ??= []).push(m);
      setMatchPreds(mprMap);

      const miMap: Record<number, MatchInfo> = {};
      for (const m of (matches as MatchInfo[]) || []) miMap[m.id] = m;
      setMatchInfo(miMap);
    } catch (e) {
      console.error('Error cargando registro:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLeague]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  if (!activeLeague) {
    return <View style={styles.center}><Text style={styles.dim}>Selecciona una quiniela primero.</Text></View>;
  }
  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  // ── Cálculo de premios ──
  const paidCount = members.filter((m) => m.is_paid).length;
  const price = entryPrice;
  const pozo = price * paidCount;
  const fee = pozo * (commission / 100);
  const repartir = pozo - fee;
  const fmt = (n: number) => '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

  const isKnockout = (activeLeague as any)?.is_knockout === true;

  function canSeePreds(memberId: string) {
    return locked || memberId === activeLeague!.member_id;
  }

  // Un partido "ya cerró" (sus predicciones se revelan) si ya inició/terminó
  // o faltan menos de 15 min. En eliminatoria gateamos partido por partido,
  // porque la edición sigue abierta aunque el candado global ya pasó.
  function matchRevealed(matchId: number): boolean {
    const info = matchInfo[matchId];
    if (!info) return false;
    if (info.status && info.status !== 'upcoming') return true;
    const minsUntil = (new Date(info.match_date).getTime() - Date.now()) / 60000;
    return minsUntil < 15;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Encabezado liga */}
      <Text style={styles.leagueName}>{activeLeague.name}</Text>
      <Text style={styles.sub}>Registro oficial · {members.length} quiniela{members.length === 1 ? '' : 's'}</Text>

      {/* Premios */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Premios</Text>

        {/* Descripción del premio (premio fijo o nota) */}
        {prizeDesc ? (
          <View style={styles.prizeNote}>
            <Text style={styles.prizeNoteText}>{prizeDesc}</Text>
          </View>
        ) : null}

        {price > 0 ? (
          <>
            <Row label="Entrada por quiniela" value={fmt(price)} />
            <Row label={`Pozo (${paidCount} pagadas)`} value={fmt(pozo)} />
            {commission > 0 && (
              <>
                <Row label={`Comisión organizador (${commission}%)`} value={'- ' + fmt(fee)} dim />
                <View style={styles.divider} />
                <Row label="A repartir" value={fmt(repartir)} bold gold />
              </>
            )}
            {commission === 0 && (
              <>
                <View style={styles.divider} />
                <Row label="A repartir (sin comisión)" value={fmt(pozo)} bold gold />
              </>
            )}
            {prizeDesc ? <Text style={[styles.dim, { marginTop: 8 }]}>El reparto se detalla arriba 👆</Text> : null}
          </>
        ) : !prizeDesc ? (
          <Text style={styles.dim}>Premio aún no configurado por el organizador.</Text>
        ) : null}
      </View>

      {/* Aviso de visibilidad */}
      {isKnockout ? (
        <View style={styles.noticeLock}>
          <Text style={styles.noticeLockText}>
            🔒 En la eliminatoria, las predicciones de cada partido se revelan 15 min antes de que empiece. Por ahora solo ves las tuyas.
          </Text>
        </View>
      ) : !locked ? (
        <View style={styles.noticeLock}>
          <Text style={styles.noticeLockText}>
            🔒 Las predicciones de los demás se revelan al cierre: {LOCK_DATE_STR}. Por ahora solo ves la tuya.
          </Text>
        </View>
      ) : null}

      {/* Participantes */}
      <Text style={styles.secTitle}>📝 Quinielas registradas</Text>
      {members.map((m) => {
        const isOpen = expanded === m.member_id;
        const isMine = m.member_id === activeLeague.member_id;
        const see = canSeePreds(m.member_id);
        const pod = podiums[m.member_id];
        const grp = (groups[m.member_id] || []).slice().sort(
          (a, b) => GROUP_ORDER.indexOf(a.group_name) - GROUP_ORDER.indexOf(b.group_name)
        );
        const mpreds = matchPreds[m.member_id] || [];
        return (
          <View key={m.member_id} style={[styles.entry, isMine && styles.entryMine]}>
            <TouchableOpacity style={styles.entryHead} onPress={() => setExpanded(isOpen ? null : m.member_id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryAlias}>
                  🎯 {m.alias}{isMine ? ' (tú)' : ''}{m.is_admin ? ' · Admin' : ''}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, m.is_paid ? styles.badgePaid : styles.badgeUnpaid]}>
                    <Text style={styles.badgeText}>{m.is_paid ? '✓ Pagó' : 'Sin pago'}</Text>
                  </View>
                  <Text style={styles.progress}>
                    ⚽ {m.match_count}/{Object.keys(matchInfo).length}  🗂 {m.has_groups ? '✓' : '✗'}  🏆 {m.has_podio ? '✓' : '✗'}
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.entryBody}>
                {!see ? (
                  <Text style={styles.lockedMsg}>🔒 Se revela al cierre ({LOCK_DATE_STR})</Text>
                ) : (
                  <>
                    {/* Podio */}
                    <Text style={styles.blockTitle}>🏆 Podio</Text>
                    {pod ? (
                      <View style={styles.podBox}>
                        <PodRow icon="🥇" label="Campeón" value={pod.champion} />
                        <PodRow icon="🥈" label="Subcampeón" value={pod.runner_up} />
                        <PodRow icon="🥉" label="3er lugar" value={pod.third_place} />
                        <PodRow icon="⚽" label="Goleador" value={pod.top_scorer || '—'} />
                      </View>
                    ) : <Text style={styles.dim}>Sin podio.</Text>}

                    {/* Grupos */}
                    <Text style={styles.blockTitle}>🗂 Grupos (1° y 2°)</Text>
                    {grp.length ? (
                      <View style={styles.grpGrid}>
                        {grp.map((g) => (
                          <View key={g.group_name} style={styles.grpItem}>
                            <Text style={styles.grpName}>Grupo {g.group_name}</Text>
                            <Text style={styles.grpTeam}>1° {g.first_place}</Text>
                            <Text style={styles.grpTeam}>2° {g.second_place}</Text>
                          </View>
                        ))}
                      </View>
                    ) : <Text style={styles.dim}>Sin grupos.</Text>}

                    {/* Partidos — los ajenos solo se ven si el partido ya cerró (15 min antes) */}
                    {(() => {
                      const visiblePreds = isMine
                        ? mpreds
                        : mpreds.filter((mp) => matchRevealed(mp.match_id));
                      const hiddenCount = mpreds.length - visiblePreds.length;
                      return (
                        <>
                          <Text style={styles.blockTitle}>
                            ⚽ Partidos ({visiblePreds.length}{hiddenCount > 0 ? ` · ${hiddenCount} 🔒` : ''})
                          </Text>
                          {mpreds.length === 0 ? (
                            <Text style={styles.dim}>Sin predicciones de partidos.</Text>
                          ) : visiblePreds.length === 0 ? (
                            <Text style={styles.lockedMsg}>
                              🔒 Sus predicciones se revelan 15 min antes de cada partido.
                            </Text>
                          ) : showMatchesFor === m.member_id ? (
                            <View>
                              {visiblePreds
                                .slice()
                                .sort((a, b) => {
                                  const da = matchInfo[a.match_id]?.match_date || '';
                                  const db = matchInfo[b.match_id]?.match_date || '';
                                  return da.localeCompare(db);
                                })
                                .map((mp) => {
                                  const info = matchInfo[mp.match_id];
                                  if (!info) return null;
                                  return (
                                    <View key={mp.match_id} style={styles.matchRow}>
                                      <Text style={styles.matchTeams} numberOfLines={1}>
                                        {info.home_flag} {info.home_team} vs {info.away_team} {info.away_flag}
                                      </Text>
                                      <Text style={styles.matchScore}>{mp.pred_home} - {mp.pred_away}</Text>
                                    </View>
                                  );
                                })}
                              {hiddenCount > 0 && (
                                <Text style={[styles.dim, { marginTop: 6 }]}>
                                  🔒 {hiddenCount} predicción{hiddenCount === 1 ? '' : 'es'} de partidos aún abiertos se revelan 15 min antes.
                                </Text>
                              )}
                              <TouchableOpacity onPress={() => setShowMatchesFor(null)} style={styles.linkBtn}>
                                <Text style={styles.linkBtnText}>Ocultar partidos ▲</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => setShowMatchesFor(m.member_id)} style={styles.linkBtn}>
                              <Text style={styles.linkBtnText}>Ver {visiblePreds.length} predicciones de partidos ▼</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Row({ label, value, bold, gold, dim }: { label: string; value: string; bold?: boolean; gold?: boolean; dim?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, dim && styles.dim]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold, gold && styles.rowValueGold, dim && styles.dim]}>{value}</Text>
    </View>
  );
}

function PodRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.podRow}>
      <Text style={styles.podIcon}>{icon}</Text>
      <Text style={styles.podLabel}>{label}</Text>
      <Text style={styles.podValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.background },
  dim: { fontSize: 13, color: Colors.textSecondary },
  leagueName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: Colors.text },
  rowValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  rowValueBold: { fontSize: 16, fontWeight: '800' },
  rowValueGold: { color: Colors.gold },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  prizeNote: { backgroundColor: '#fff8e1', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ffe082' },
  prizeNoteText: { fontSize: 14, color: '#7a5a00', fontWeight: '600', lineHeight: 20 },
  noticeLock: { backgroundColor: '#fff8e1', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ffecb3', marginBottom: 14 },
  noticeLockText: { fontSize: 12, color: '#8a6d00', fontWeight: '600', lineHeight: 17 },
  secTitle: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginLeft: 2 },
  entry: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden' },
  entryMine: { borderColor: Colors.gold, borderWidth: 1.5 },
  entryHead: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  entryAlias: { fontSize: 15, fontWeight: '700', color: Colors.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgePaid: { backgroundColor: '#e8f5e9' },
  badgeUnpaid: { backgroundColor: '#fff3e0' },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  progress: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  chevron: { fontSize: 14, color: Colors.textSecondary, marginLeft: 8 },
  entryBody: { padding: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  lockedMsg: { fontSize: 13, color: '#8a6d00', fontWeight: '600', textAlign: 'center', paddingVertical: 10 },
  blockTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginTop: 12, marginBottom: 6 },
  podBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 8 },
  podRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  podIcon: { fontSize: 16, width: 22 },
  podLabel: { fontSize: 12, color: Colors.textSecondary, width: 90 },
  podValue: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  grpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grpItem: { backgroundColor: Colors.background, borderRadius: 10, padding: 8, width: '48%' },
  grpName: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  grpTeam: { fontSize: 12, color: Colors.text },
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 8 },
  matchTeams: { fontSize: 12, color: Colors.text, flex: 1 },
  matchScore: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  linkBtn: { paddingVertical: 8, alignItems: 'center' },
  linkBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
