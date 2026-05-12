import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, Text, StyleSheet, RefreshControl,
  ActivityIndicator, SectionList,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { getMatches } from '@/lib/api';
import { MatchWithPrediction, Prediction } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import PredictionModal from '@/components/PredictionModal';
import EmptyState from '@/components/EmptyState';
import { Colors } from '@/constants/Colors';

function groupByDate(matches: MatchWithPrediction[]) {
  const groups: Record<string, MatchWithPrediction[]> = {};
  for (const m of matches) {
    const date = new Date(m.match_date).toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function MatchesScreen() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MatchWithPrediction | null>(null);

  async function load() {
    if (!profile) return;
    try {
      const data = await getMatches(profile.id);
      setMatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [profile]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [profile]);

  function handlePredictionSaved(pred: Prediction) {
    setMatches(prev =>
      prev.map(m => m.id === pred.match_id ? { ...m, my_prediction: pred } : m)
    );
  }

  function handlePress(match: MatchWithPrediction) {
    if (match.status === 'upcoming') setSelected(match);
  }

  const sections = groupByDate(matches);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando partidos...</Text>
      </View>
    );
  }

  if (!matches.length) {
    return (
      <EmptyState
        icon="🏟️"
        title="No hay partidos aún"
        subtitle="Los partidos del Mundial 2026 aparecerán aquí cuando estén disponibles"
      />
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <MatchCard match={item} onPress={() => handlePress(item)} />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        stickySectionHeadersEnabled={false}
      />

      {selected && (
        <PredictionModal
          match={selected}
          existing={selected.my_prediction}
          visible={!!selected}
          onClose={() => setSelected(null)}
          onSaved={handlePredictionSaved}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  list: { padding: 16, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingVertical: 8, paddingHorizontal: 4,
  },
});
