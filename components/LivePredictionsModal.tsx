import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/lib/league';
import { Colors } from '@/constants/Colors';
import { MatchWithPrediction } from '@/lib/types';
import FlagImage from './FlagImage';

interface PredRow {
  member_id: string;
  name: string;
  pred_home: number;
  pred_away: number;
  points: number;
}

interface Props {
  match: MatchWithPrediction | null;
  visible: boolean;
  onClose: () => void;
}

function calcLivePoints(ph: number, pa: number, ah: number, aa: number): number {
  const res = (h: number, a: number) => h > a ? 'H' : h < a ? 'A' : 'D';
  let pts = 0;
  if (res(ph, pa) === res(ah, aa)) pts += 3;
  if (ph === ah && pa === aa) pts += 2;
  if (ph === ah || pa === aa) pts += 1;
  if ((ph - pa) === (ah - aa)) pts += 1;
  return pts;
}

export default function LivePredictionsModal({ match, visible, onClose }: Props) {
  const { activeLeague } = useLeague();
  const [rows, setRows] = useState<PredRow[]>([]);
  const [currentScore, setCurrentScore] = useState<{ home: number; away: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!match) return;
    setLoading(true);
    try {
      // Fetch fresh match score
      const { data: freshMatch } = await supabase
        .from('matches')
        .select('home_score, away_score')
        .eq('id', match.id)
        .single();

      const homeScore = freshMatch?.home_score ?? match.home_score ?? 0;
      const awayScore = freshMatch?.away_score ?? match.away_score ?? 0;
      setCurrentScore({ home: homeScore, away: awayScore });

      // Fetch league members (id → alias map) for the active league
      if (activeLeague) {
        const { data: members } = await supabase
          .from('league_members')
          .select('id, alias')
          .eq('league_id', activeLeague.id);

        const memberMap = new Map<string, string>(
          (members || []).map((m: any) => [m.id, m.alias ?? 'Jugador'])
        );
        const memberIds = Array.from(memberMap.keys());

        if (memberIds.length > 0) {
          const { data: preds } = await supabase
            .from('league_predictions')
            .select('league_member_id, pred_home, pred_away')
            .eq('match_id', match.id)
            .in('league_member_id', memberIds);

          if (preds) {
            const computed: PredRow[] = preds.map((p: any) => ({
              member_id: p.league_member_id,
              name: memberMap.get(p.league_member_id) ?? 'Jugador',
              pred_home: p.pred_home,
              pred_away: p.pred_away,
              points: calcLivePoints(p.pred_home, p.pred_away, homeScore, awayScore),
            }));
            computed.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
            setRows(computed);
          }
        } else {
          setRows([]);
        }
      } else {
        setRows([]);
      }
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [match, activeLeague]);

  useEffect(() => {
    if (visible && match) load();
  }, [visible, match]);

  // Auto-refresh every 60s when live
  useEffect(() => {
    if (!visible || match?.status !== 'live') return;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [visible, match, load]);

  if (!match) return null;

  const isLive = match.status === 'live';

  function pointsColor(pts: number) {
    if (pts >= 7) return '#2e7d32';
    if (pts >= 5) return '#558b2f';
    if (pts >= 3) return '#f57f17';
    if (pts > 0) return '#bf360c';
    return Colors.textSecondary;
  }

  function pointsBg(pts: number) {
    if (pts >= 7) return '#e8f5e9';
    if (pts >= 5) return '#f1f8e9';
    if (pts >= 3) return '#fffde7';
    if (pts > 0) return '#fbe9e7';
    return '#f5f5f5';
  }

  function predResult(ph: number, pa: number) {
    if (ph > pa) return '🏠';
    if (ph < pa) return '✈️';
    return '🤝';
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Predicciones del partido</Text>
          {isLive ? (
            <TouchableOpacity onPress={load} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>↻</Text>
            </TouchableOpacity>
          ) : <View style={styles.closeBtn} />}
        </View>

        {/* Match info */}
        <View style={styles.matchBox}>
          <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
            <Text style={[styles.statusText, isLive && styles.statusTextLive]}>
              {isLive ? '● EN VIVO' : 'FINALIZADO'}
            </Text>
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.teamBlock}>
              <FlagImage flag={match.home_flag} size={36} />
              <Text style={styles.teamName} numberOfLines={2}>{match.home_team}</Text>
            </View>

            <View style={styles.scoreBlock}>
              {currentScore ? (
                <Text style={styles.score}>{currentScore.home} - {currentScore.away}</Text>
              ) : (
                <Text style={styles.score}>- - -</Text>
              )}
              <Text style={styles.scoreLabel}>Marcador actual</Text>
            </View>

            <View style={styles.teamBlock}>
              <FlagImage flag={match.away_flag} size={36} />
              <Text style={styles.teamName} numberOfLines={2}>{match.away_team}</Text>
            </View>
          </View>

          {lastRefresh && isLive && (
            <Text style={styles.refreshTime}>
              Actualizado: {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>Puntos con el marcador actual</Text>
        </View>

        {/* Predictions list */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Nadie tiene predicción para este partido</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={item => item.member_id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <View style={[styles.row, { backgroundColor: pointsBg(item.points) }]}>
                <Text style={styles.rank}>#{index + 1}</Text>

                <View style={styles.nameBlock}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Text style={styles.predText}>
                    {predResult(item.pred_home, item.pred_away)}{' '}
                    {item.pred_home} - {item.pred_away}
                  </Text>
                </View>

                <View style={[styles.ptsBadge, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                  <Text style={[styles.ptsText, { color: pointsColor(item.points) }]}>
                    {item.points >= 7 ? '🎯 ' : item.points >= 3 ? '✓ ' : ''}{item.points} pts
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: Colors.textSecondary, fontWeight: '600' },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  refreshText: { fontSize: 22, color: Colors.primary, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  matchBox: {
    backgroundColor: Colors.white, padding: 20,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    backgroundColor: '#f0f0f0', marginBottom: 16,
  },
  statusBadgeLive: { backgroundColor: '#ffe5e5' },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  statusTextLive: { color: '#d32f2f' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  teamBlock: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  scoreBlock: { flex: 1, alignItems: 'center' },
  score: { fontSize: 32, fontWeight: '800', color: Colors.text },
  scoreLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  refreshTime: { fontSize: 11, color: Colors.textSecondary, marginTop: 12 },
  legend: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legendText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  list: { padding: 12, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, gap: 12,
  },
  rank: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, width: 28 },
  nameBlock: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  predText: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  ptsBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, minWidth: 70, alignItems: 'center' },
  ptsText: { fontSize: 13, fontWeight: '800' },
});
