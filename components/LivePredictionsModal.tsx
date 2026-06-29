import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/lib/league';
import { Colors } from '@/constants/Colors';
import { MatchWithPrediction } from '@/lib/types';
import { getMatchPredictionsGrouped, MatchPredLeague } from '@/lib/api';
import FlagImage from './FlagImage';

interface Props {
  match: MatchWithPrediction | null;
  visible: boolean;
  onClose: () => void;
}

function calcLivePoints(ph: number, pa: number, ah: number, aa: number): number {
  const res = (h: number, a: number) => (h > a ? 'H' : h < a ? 'A' : 'D');
  let pts = 0;
  if (res(ph, pa) === res(ah, aa)) pts += 3;
  if (ph === ah && pa === aa) pts += 2;
  if (ph === ah || pa === aa) pts += 1;
  if (ph - pa === ah - aa) pts += 1;
  return pts;
}

export default function LivePredictionsModal({ match, visible, onClose }: Props) {
  const { activeLeague } = useLeague();
  const [leagues, setLeagues] = useState<MatchPredLeague[]>([]);
  // Marcador actual (default 0-0: "puntos posibles si queda así")
  const [score, setScore] = useState<{ home: number; away: number }>({ home: 0, away: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!match) return;
    setLoading(true);
    try {
      // Marcador fresco (si no inició aún, se trata como 0-0)
      const { data: freshMatch } = await supabase
        .from('matches')
        .select('home_score, away_score')
        .eq('id', match.id)
        .single();
      const homeScore = freshMatch?.home_score ?? match.home_score ?? 0;
      const awayScore = freshMatch?.away_score ?? match.away_score ?? 0;
      setScore({ home: homeScore, away: awayScore });

      // Predicciones agrupadas, pero SOLO la liga activa (las ligas no se ven entre sí)
      const grouped = await getMatchPredictionsGrouped(match.id);
      const onlyActive = activeLeague
        ? grouped.filter((g) => g.league_id === activeLeague.id)
        : grouped;
      setLeagues(onlyActive);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Error cargando predicciones del partido:', e);
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [match, activeLeague]);

  useEffect(() => {
    if (visible && match) load();
  }, [visible, match]);

  // Auto-refresh cada 60s cuando está en vivo
  useEffect(() => {
    if (!visible || match?.status !== 'live') return;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [visible, match, load]);

  if (!match) return null;

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  // Las predicciones de los DEMÁS solo se revelan cuando el partido cerró
  // (ya inició/terminó, o faltan menos de 15 min). Antes: nadie las ve.
  const minsUntil = (new Date(match.match_date).getTime() - Date.now()) / 60000;
  const revealed = isLive || isFinished || minsUntil < 15;

  // Mi predicción y mis puntos (primera fila is_mine que se encuentre)
  let myRow: { ph: number; pa: number } | null = null;
  for (const lg of leagues) {
    const mine = lg.rows.find((r) => r.is_mine);
    if (mine) { myRow = { ph: mine.pred_home, pa: mine.pred_away }; break; }
  }
  // Siempre se calcula con el marcador actual (0-0 si aún no inicia)
  const myPoints = myRow ? calcLivePoints(myRow.ph, myRow.pa, score.home, score.away) : null;

  function ptsBg(p: number) {
    if (p >= 7) return '#d6f5e0';
    if (p >= 4) return '#fdeccd';
    if (p > 0) return '#e9edf2';
    return '#fde2e6';
  }
  function ptsColor(p: number) {
    if (p >= 7) return '#13864a';
    if (p >= 4) return '#9a6a08';
    if (p > 0) return '#4a5568';
    return '#b3243a';
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Scoreboard */}
        <View style={styles.scorebar}>
          <View style={styles.topRow}>
            <Text style={styles.stage} numberOfLines={1}>
              {match.group_name ? `Grupo ${match.group_name}` : 'Mundial 2026'}
            </Text>
            <View style={styles.headerRight}>
              {isLive ? (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>EN VIVO</Text>
                </View>
              ) : (
                <View style={[styles.livePill, isFinished ? styles.finPill : styles.upPill]}>
                  <Text style={styles.livePillText}>{isFinished ? 'FINALIZADO' : 'PRÓXIMO'}</Text>
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.team}>
              <FlagImage flag={match.home_flag} size={42} />
              <Text style={styles.teamName} numberOfLines={1}>{match.home_team}</Text>
            </View>
            <View style={styles.scoreMid}>
              <Text style={styles.scoreNums}>{score.home} <Text style={styles.scoreDash}>-</Text> {score.away}</Text>
              <Text style={styles.scoreLabel}>
                {isLive ? 'Marcador en vivo' : isFinished ? 'Resultado final' : 'Aún no inicia (0-0)'}
              </Text>
            </View>
            <View style={styles.team}>
              <FlagImage flag={match.away_flag} size={42} />
              <Text style={styles.teamName} numberOfLines={1}>{match.away_team}</Text>
            </View>
          </View>
          {match.venue ? (
            <Text style={styles.venueText} numberOfLines={1}>📍 {match.venue}</Text>
          ) : null}
        </View>

        {/* Mi predicción */}
        {myRow && (
          <View style={styles.myBand}>
            <View>
              <Text style={styles.myLbl}>Tu predicción</Text>
              <Text style={styles.myPred}>
                {match.home_team} {myRow.ph} - {myRow.pa} {match.away_team}
              </Text>
            </View>
            {myPoints !== null && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.myLbl}>{isFinished ? 'Ganaste' : 'Si queda así'}</Text>
                <View style={[styles.myPtsBadge, { backgroundColor: myPoints > 0 ? Colors.gold : 'rgba(255,255,255,0.18)' }]}>
                  <Text style={[styles.myPtsText, { color: myPoints > 0 ? '#1a1a2e' : '#fff' }]}>
                    {myPoints} pts {myPoints >= 7 ? '✓' : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Lista por liga */}
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : !revealed ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
            <Text style={styles.emptyText}>
              Las predicciones de los demás se revelan{'\n'}<Text style={{ fontWeight: '800' }}>15 minutos antes</Text> del partido.
            </Text>
            <Text style={[styles.emptyText, { marginTop: 8, fontSize: 13 }]}>
              Mientras tanto, nadie puede ver lo que pusieron los otros — para que sea justo.
            </Text>
          </View>
        ) : leagues.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Aún no hay predicciones para este partido en tus ligas</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.secTitle}>📋 Predicciones de este partido</Text>
            <Text style={styles.hint}>
              {isLive
                ? `Puntos con el marcador en vivo ${score.home}-${score.away}. Se actualiza solo cada minuto.`
                : isFinished
                ? 'Puntos finales de este partido.'
                : `Puntos posibles si el partido queda ${score.home}-${score.away}. Cambian con cada gol.`}
            </Text>

            {leagues.map((lg) => {
              // calcular puntos (siempre, con marcador actual 0-0 de base) y ordenar
              const rows = lg.rows
                .map((r) => ({
                  ...r,
                  pts: calcLivePoints(r.pred_home, r.pred_away, score.home, score.away),
                }))
                .sort((a, b) => b.pts - a.pts || a.alias.localeCompare(b.alias));
              const topPts = rows.length ? rows[0].pts : null;

              return (
                <View key={lg.league_id} style={styles.league}>
                  <View style={styles.lhead}>
                    <Text style={styles.lname} numberOfLines={1}>{lg.league_name}</Text>
                    <Text style={styles.lcount}>{rows.length} quiniela{rows.length === 1 ? '' : 's'}</Text>
                  </View>

                  {/* encabezados */}
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { flex: 1 }]}>Quiniela</Text>
                    <Text style={[styles.th, styles.thC, { width: 64 }]}>Predijo</Text>
                    <Text style={[styles.th, styles.thC, { width: 56 }]}>Puntos</Text>
                  </View>

                  {rows.map((r) => {
                    const isLeader = topPts !== null && r.pts === topPts && r.pts > 0;
                    return (
                      <View key={r.member_id} style={[styles.tr, r.is_mine && styles.trMine]}>
                        <Text style={[styles.qname, r.is_mine && styles.qnameMine]} numberOfLines={1}>
                          {r.alias}{isLeader ? ' 👑' : ''}{r.is_mine ? ' (tú)' : ''}
                        </Text>
                        <Text style={[styles.qpred, styles.thC, { width: 64 }]}>
                          {r.pred_home} - {r.pred_away}
                        </Text>
                        <View style={{ width: 56, alignItems: 'center' }}>
                          <View style={[styles.ptsPill, { backgroundColor: ptsBg(r.pts) }]}>
                            <Text style={[styles.ptsPillText, { color: ptsColor(r.pts) }]}>{r.pts}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {lastRefresh && isLive && (
              <Text style={styles.refreshTime}>
                Actualizado: {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scorebar: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 14 : 14, paddingBottom: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  stage: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  upPill: { backgroundColor: 'rgba(255,255,255,0.2)' },
  finPill: { backgroundColor: Colors.finished },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  livePillText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)' },
  closeText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scoreMid: { flex: 1, alignItems: 'center' },
  scoreNums: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  scoreDash: { color: 'rgba(255,255,255,0.5)' },
  scoreLabel: { fontSize: 11, color: Colors.gold, fontWeight: '700', marginTop: 2 },
  venueText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 8 },
  myBand: { backgroundColor: '#16314e', paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  myPred: { fontSize: 14, color: '#fff', fontWeight: '800', marginTop: 2 },
  myPtsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 3 },
  myPtsText: { fontSize: 13, fontWeight: '800' },
  body: { padding: 14, paddingBottom: 24 },
  secTitle: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 4, marginBottom: 6 },
  hint: { fontSize: 11, color: Colors.textSecondary, marginHorizontal: 4, marginBottom: 12, lineHeight: 16 },
  league: { backgroundColor: Colors.card, borderRadius: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  lhead: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9 },
  lname: { fontSize: 14, fontWeight: '800', color: '#fff', flex: 1 },
  lcount: { fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  thRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  th: { fontSize: 10, color: Colors.textSecondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  thC: { textAlign: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  trMine: { backgroundColor: '#fff8e8' },
  qname: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  qnameMine: { color: '#9a6a08' },
  qpred: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  ptsPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, minWidth: 30, alignItems: 'center' },
  ptsPillText: { fontSize: 13, fontWeight: '800' },
  ptsPending: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  refreshTime: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
