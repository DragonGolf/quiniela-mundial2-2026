import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

interface BracketMatch {
  id: string; round: string; ord: number; match_date: string | null;
  home_team: string; away_team: string; home_score: number | null; away_score: number | null;
  status: string; venue: string | null;
}

const ROUNDS: { key: string; label: string }[] = [
  { key: 'round_of_32', label: 'Ronda de 32' },
  { key: 'round_of_16', label: 'Octavos de Final' },
  { key: 'quarterfinal', label: 'Cuartos de Final' },
  { key: 'semifinal', label: 'Semifinal' },
  { key: 'third_place', label: '3er Lugar' },
  { key: 'final', label: 'Final' },
];

// Traduce los placeholders de ESPN a español
function ph(name: string): string {
  if (!name) return 'Por definir';
  let s = name;
  s = s.replace(/Group ([A-L]) Winner/gi, '1° Grupo $1');
  s = s.replace(/Group ([A-L]) 2nd Place/gi, '2° Grupo $1');
  s = s.replace(/Third Place Group ([A-L/]+)/gi, '3° de Grupo $1');
  s = s.replace(/Round of 32 (\d+) Winner/gi, 'Ganador R32 #$1');
  s = s.replace(/Round of 16 (\d+) Winner/gi, 'Ganador 8vos #$1');
  s = s.replace(/Quarterfinal (\d+) Winner/gi, 'Ganador CF #$1');
  s = s.replace(/Semifinal (\d+) Winner/gi, 'Ganador SF #$1');
  s = s.replace(/Semifinal (\d+) Loser/gi, 'Perdedor SF #$1');
  return s;
}

function isPlaceholder(name: string): boolean {
  return /Winner|Place|Loser|Group [A-L]/i.test(name || '');
}

export default function BracketScreen() {
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('bracket').select('*').order('round').order('ord');
    setMatches((data as BracketMatch[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>El bracket aparecerá cuando se definan los cruces de la fase eliminatoria.</Text>
      </View>
    );
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {ROUNDS.map((r) => {
        const ms = matches.filter((m) => m.round === r.key);
        if (ms.length === 0) return null;
        return (
          <View key={r.key} style={styles.roundBlock}>
            <Text style={styles.roundTitle}>{r.label}</Text>
            {ms.map((m) => {
              const played = m.status !== 'upcoming' && m.home_score != null;
              const homeWon = played && (m.home_score! > m.away_score!);
              const awayWon = played && (m.away_score! > m.home_score!);
              return (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.teamRow}>
                    <Text style={[styles.team, isPlaceholder(m.home_team) && styles.teamPh, homeWon && styles.teamWin]} numberOfLines={1}>
                      {ph(m.home_team)}
                    </Text>
                    <Text style={[styles.score, homeWon && styles.teamWin]}>{played ? m.home_score : ''}</Text>
                  </View>
                  <View style={styles.teamRow}>
                    <Text style={[styles.team, isPlaceholder(m.away_team) && styles.teamPh, awayWon && styles.teamWin]} numberOfLines={1}>
                      {ph(m.away_team)}
                    </Text>
                    <Text style={[styles.score, awayWon && styles.teamWin]}>{played ? m.away_score : ''}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    {m.status === 'live' && <Text style={styles.live}>● EN VIVO</Text>}
                    <Text style={styles.meta} numberOfLines={1}>
                      {fmtDate(m.match_date)}{m.venue ? `  📍 ${m.venue}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: Colors.background },
  empty: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  roundBlock: { marginBottom: 18 },
  roundTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 2 },
  matchCard: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  team: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  teamPh: { fontWeight: '500', color: Colors.textSecondary, fontStyle: 'italic' },
  teamWin: { color: Colors.green, fontWeight: '800' },
  score: { fontSize: 16, fontWeight: '800', color: Colors.text, width: 28, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  live: { fontSize: 11, fontWeight: '800', color: Colors.accent },
  meta: { flex: 1, fontSize: 11, color: Colors.textSecondary },
});
