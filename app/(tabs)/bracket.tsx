import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

interface BMatch {
  id: string; round: string; ord: number; match_date: string | null;
  home_team: string; away_team: string; home_score: number | null; away_score: number | null;
  status: string; venue: string | null;
}

const MAIN_ROUNDS = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final'];
const ROUND_LABEL: Record<string, string> = {
  round_of_32: 'Ronda de 32', round_of_16: 'Octavos', quarterfinal: 'Cuartos',
  semifinal: 'Semis', final: 'Final', third_place: '3er Lugar',
};
const CHILD: Record<string, string> = {
  round_of_16: 'round_of_32', quarterfinal: 'round_of_16', semifinal: 'quarterfinal', final: 'semifinal',
};

const CARD_W = 132, CARD_H = 52, SLOT = 64, CONN = 26;
const COL_W = CARD_W + CONN;

function ph(name: string): string {
  if (!name) return 'Por definir';
  return name
    .replace(/Group ([A-L]) Winner/gi, '1° Gpo $1')
    .replace(/Group ([A-L]) 2nd Place/gi, '2° Gpo $1')
    .replace(/Third Place Group ([A-L/]+)/gi, '3° Gpo $1')
    .replace(/Round of 32 (\d+) Winner/gi, 'Gana R32-$1')
    .replace(/Round of 16 (\d+) Winner/gi, 'Gana 8vo-$1')
    .replace(/Quarterfinal (\d+) Winner/gi, 'Gana CF-$1')
    .replace(/Semifinal (\d+) Winner/gi, 'Gana SF-$1')
    .replace(/Semifinal (\d+) Loser/gi, 'Pierde SF-$1');
}
function isPh(n: string) { return /Winner|Place|Loser|Group [A-L]/i.test(n || ''); }
function feederNum(text: string): number | null {
  const m = (text || '').match(/(\d+)\s+Winner/i);
  return m ? parseInt(m[1]) : null;
}

export default function BracketScreen() {
  const [all, setAll] = useState<BMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('bracket').select('*').order('round').order('ord');
    setAll((data as BMatch[]) || []);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (all.length === 0) return <View style={styles.center}><Text style={styles.empty}>El bracket aparecerá cuando se definan los cruces de la eliminatoria.</Text></View>;

  // Agrupar por ronda y resolver orden de árbol (los feeders quedan adyacentes)
  const byRound: Record<string, BMatch[]> = {};
  for (const m of all) (byRound[m.round] ??= []).push(m);
  for (const r of Object.keys(byRound)) byRound[r].sort((a, b) => a.ord - b.ord);
  // "Round of 32 N Winner": la N de ESPN sigue el orden de sus IDs de evento
  // dentro de la ronda (secuenciales), NO el orden por fecha. Rankear por id.
  const byIdRank: Record<string, BMatch[]> = {};
  for (const r of Object.keys(byRound)) {
    byIdRank[r] = [...byRound[r]].sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }
  const byNum = (round: string, num: number) => (byIdRank[round] || [])[num - 1];

  // Resolver el partido de la ronda anterior que alimenta un slot.
  // Con placeholder ("Gana R32-11") se usa el número; cuando el partido ya se
  // jugó el slot muestra el equipo REAL (ej. "Canada") → buscar el partido de
  // la ronda anterior donde jugó ese equipo (cada equipo aparece solo una vez).
  const findChild = (childRound: string, slotText: string): BMatch | null => {
    const n = feederNum(slotText);
    if (n) return byNum(childRound, n) ?? null;
    if (!slotText || isPh(slotText)) return null;
    return (byRound[childRound] || []).find(
      (m) => m.home_team === slotText || m.away_team === slotText
    ) ?? null;
  };

  // Construir orden por nivel desde la final hacia abajo
  const treeOrder: Record<string, BMatch[]> = {};
  treeOrder['final'] = byRound['final'] || [];
  for (let i = MAIN_ROUNDS.length - 1; i > 0; i--) {
    const round = MAIN_ROUNDS[i];        // ej. final
    const child = CHILD[round];          // ej. semifinal
    const parents = treeOrder[round] || [];
    const ordered: BMatch[] = [];
    let ok = true;
    for (const p of parents) {
      const c1 = findChild(child, p.home_team);
      const c2 = findChild(child, p.away_team);
      if (c1) ordered.push(c1); else ok = false;
      if (c2 && c2 !== c1) ordered.push(c2); else if (!c2) ok = false;
    }
    treeOrder[child] = ok && ordered.length === (byRound[child] || []).length ? ordered : (byRound[child] || []);
  }

  // Posiciones verticales (centradas entre feeders)
  const pos: Record<string, number[]> = {};
  const base = treeOrder['round_of_32'] || [];
  pos['round_of_32'] = base.map((_, i) => i * SLOT + SLOT / 2);
  for (let i = 1; i < MAIN_ROUNDS.length; i++) {
    const round = MAIN_ROUNDS[i], child = MAIN_ROUNDS[i - 1];
    const cp = pos[child];
    pos[round] = (treeOrder[round] || []).map((_, j) => ((cp[2 * j] ?? 0) + (cp[2 * j + 1] ?? cp[2 * j] ?? 0)) / 2);
  }
  const totalH = Math.max((base.length || 1) * SLOT, 200);
  const totalW = MAIN_ROUNDS.length * COL_W;

  function Card({ m, x, y }: { m: BMatch; x: number; y: number }) {
    const played = m.status !== 'upcoming' && m.home_score != null;
    const hWon = played && m.home_score! > m.away_score!;
    const aWon = played && m.away_score! > m.home_score!;
    return (
      <View style={[styles.card, { left: x, top: y - CARD_H / 2 }]}>
        {m.status === 'live' && <View style={styles.liveDot} />}
        <View style={styles.cardRow}>
          <Text style={[styles.cTeam, isPh(m.home_team) && styles.cPh, hWon && styles.cWin]} numberOfLines={1}>{ph(m.home_team)}</Text>
          <Text style={[styles.cScore, hWon && styles.cWin]}>{played ? m.home_score : ''}</Text>
        </View>
        <View style={styles.cardDiv} />
        <View style={styles.cardRow}>
          <Text style={[styles.cTeam, isPh(m.away_team) && styles.cPh, aWon && styles.cWin]} numberOfLines={1}>{ph(m.away_team)}</Text>
          <Text style={[styles.cScore, aWon && styles.cWin]}>{played ? m.away_score : ''}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      {/* Encabezados de ronda */}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ width: totalW }}>
        <View>
          <View style={[styles.headerRow, { width: totalW }]}>
            {MAIN_ROUNDS.map((r) => (
              <Text key={r} style={[styles.colHeader, { width: COL_W }]}>{ROUND_LABEL[r]}</Text>
            ))}
          </View>
          <View style={{ width: totalW, height: totalH }}>
            {/* Líneas conectoras */}
            {MAIN_ROUNDS.slice(1).map((round, idx) => {
              const child = MAIN_ROUNDS[idx];
              const cp = pos[child], pp = pos[round];
              const xChildRight = idx * COL_W + CARD_W;
              const xParentLeft = (idx + 1) * COL_W;
              const xMid = xChildRight + CONN / 2;
              return (pp || []).map((py, j) => {
                const y1 = cp[2 * j], y2 = cp[2 * j + 1] ?? y1;
                return (
                  <View key={round + j}>
                    <View style={[styles.lineH, { left: xChildRight, top: y1, width: CONN / 2 }]} />
                    <View style={[styles.lineH, { left: xChildRight, top: y2, width: CONN / 2 }]} />
                    <View style={[styles.lineV, { left: xMid, top: Math.min(y1, y2), height: Math.abs(y2 - y1) }]} />
                    <View style={[styles.lineH, { left: xMid, top: py, width: xParentLeft - xMid }]} />
                  </View>
                );
              });
            })}
            {/* Tarjetas */}
            {MAIN_ROUNDS.map((round, idx) =>
              (treeOrder[round] || []).map((m, j) => (
                <Card key={m.id} m={m} x={idx * COL_W} y={pos[round][j]} />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* 3er lugar aparte */}
      {(byRound['third_place'] || []).map((m) => {
        const played = m.status !== 'upcoming' && m.home_score != null;
        return (
          <View key={m.id} style={styles.thirdBox}>
            <Text style={styles.thirdTitle}>🥉 Tercer Lugar</Text>
            <Text style={styles.thirdTeams}>
              {ph(m.home_team)} {played ? m.home_score : ''} – {played ? m.away_score : ''} {ph(m.away_team)}
            </Text>
          </View>
        );
      })}
      <Text style={styles.hint}>👉 Desliza horizontalmente para ver todas las rondas.</Text>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: Colors.background },
  empty: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  headerRow: { flexDirection: 'row', paddingVertical: 8, backgroundColor: Colors.primary },
  colHeader: { fontSize: 11, fontWeight: '800', color: Colors.white, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  card: {
    position: 'absolute', width: CARD_W, height: CARD_H, backgroundColor: Colors.card,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 7, justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  liveDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 18 },
  cardDiv: { height: 1, backgroundColor: '#eee', marginVertical: 1 },
  cTeam: { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.text },
  cPh: { fontWeight: '500', color: Colors.textSecondary, fontStyle: 'italic' },
  cWin: { color: Colors.green, fontWeight: '800' },
  cScore: { fontSize: 12, fontWeight: '800', color: Colors.text, marginLeft: 4 },
  lineH: { position: 'absolute', height: 1.5, backgroundColor: '#c5cad3' },
  lineV: { position: 'absolute', width: 1.5, backgroundColor: '#c5cad3' },
  thirdBox: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, margin: 14, marginBottom: 4 },
  thirdTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  thirdTeams: { fontSize: 14, fontWeight: '700', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 10 },
});
