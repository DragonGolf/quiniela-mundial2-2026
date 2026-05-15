import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { getLeagueRanking } from '@/lib/api';
import { LeagueRankingEntry } from '@/lib/types';
import RankingRow from '@/components/RankingRow';
import EmptyState from '@/components/EmptyState';
import { Colors } from '@/constants/Colors';

export default function RankingScreen() {
  const { profile } = useAuth();
  const { activeLeague } = useLeague();
  const [ranking, setRanking] = useState<LeagueRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!activeLeague) return;
    try {
      const data = await getLeagueRanking(activeLeague.id);
      setRanking(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [activeLeague]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [activeLeague]);

  const myRank = ranking.findIndex((e: LeagueRankingEntry) => e.user_id === profile?.id) + 1;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!ranking.length) {
    return (
      <EmptyState
        icon="🏅"
        title="Ranking vacío"
        subtitle="El ranking aparecerá cuando haya predicciones y resultados"
      />
    );
  }

  return (
    <View style={styles.container}>
      {myRank > 0 && (
        <View style={styles.myRankBanner}>
          <Text style={styles.myRankText}>Tu posición: #{myRank} de {ranking.length}</Text>
        </View>
      )}
      <View style={styles.columnHeaders}>
        <Text style={[styles.colHeader, { width: 36 }]}>#</Text>
        <Text style={[styles.colHeader, { flex: 1, marginLeft: 8 }]}>Jugador</Text>
        <Text style={[styles.colHeader, { marginRight: 10 }]}>Partidos</Text>
        <Text style={[styles.colHeader, { minWidth: 54, textAlign: 'right' }]}>Total</Text>
      </View>
      <FlatList
        data={ranking}
        keyExtractor={item => item.user_id}
        renderItem={({ item, index }) => (
          <RankingRow
            entry={item}
            rank={index + 1}
            isMe={item.user_id === profile?.id}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  myRankBanner: {
    backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 16,
  },
  myRankText: { color: Colors.white, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  columnHeaders: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  colHeader: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  list: { paddingHorizontal: 8, paddingBottom: 32 },
});
