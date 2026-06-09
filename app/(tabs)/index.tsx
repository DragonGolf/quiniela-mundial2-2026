import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, Text, StyleSheet, RefreshControl,
  ActivityIndicator, SectionList,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { getMatches, getLeagueMatchesForMember } from '@/lib/api';
import { MatchWithPrediction, Prediction } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import PredictionModal from '@/components/PredictionModal';
import LivePredictionsModal from '@/components/LivePredictionsModal';
import EmptyState from '@/components/EmptyState';
import { Colors } from '@/constants/Colors';
import { isPredictionsLocked, LOCK_DATE_STR } from '@/lib/constants';

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
  const { activeLeague } = useLeague();
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MatchWithPrediction | null>(null);
  const [liveSelected, setLiveSelected] = useState<MatchWithPrediction | null>(null);

  async function load() {
    if (!profile) return;
    try {
      let data: MatchWithPrediction[];
      if (activeLeague?.member_id) {
        data = await getLeagueMatchesForMember(activeLeague.member_id);
      } else {
        data = await getMatches(profile.id);
      }
      setMatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [profile, activeLeague?.member_id]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [profile, activeLeague?.member_id]);

  function handlePredictionSaved(pred: Prediction) {
    setMatches(prev =>
      prev.map(m => m.id === pred.match_id ? { ...m, my_prediction: pred } : m)
    );
  }

  function isMatchLocked(match: MatchWithPrediction): boolean {
    if (isPredictionsLocked()) return true; // lock global: 1h antes del Mundial
    if (match.status !== 'upcoming') return true;
    const minsUntil = (new Date(match.match_date).getTime() - Date.now()) / 60000;
    return minsUntil < 60;
  }

  function handlePress(match: MatchWithPrediction) {
    if (!isMatchLocked(match)) setSelected(match);
    else setLiveSelected(match);
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

  const locked = isPredictionsLocked();

  return (
    <View style={styles.container}>
      {locked && (
        <View style={styles.lockBanner}>
          <Text style={styles.lockBannerText}>🔒 Predicciones cerradas — el Mundial ya comenzó</Text>
        </View>
      )}
      {!locked && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>
            ⏰ Cierre: {LOCK_DATE_STR}
          </Text>
        </View>
      )}
      {activeLeague?.is_paid ? (
        <View style={styles.paidBanner}>
          <Text style={styles.paidBannerText}>✅ Pago confirmado</Text>
        </View>
      ) : (
        <View style={styles.unpaidBanner}>
          <Text style={styles.unpaidBannerText}>⚠️ Pago pendiente — confirma con el administrador</Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() => handlePress(item)}
            onViewPredictions={() => setLiveSelected(item)}
          />
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
          memberId={activeLeague?.member_id}
        />
      )}

      <LivePredictionsModal
        match={liveSelected}
        visible={!!liveSelected}
        onClose={() => setLiveSelected(null)}
      />
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
  lockBanner: {
    backgroundColor: '#b71c1c', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center',
  },
  lockBannerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  warningBanner: {
    backgroundColor: '#fff3e0', paddingVertical: 7, paddingHorizontal: 16,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ffe0b2',
  },
  warningBannerText: { color: '#e65100', fontSize: 12, fontWeight: '600' },
  paidBanner: {
    backgroundColor: '#e8f5e9', paddingVertical: 7, paddingHorizontal: 16,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#c8e6c9',
  },
  paidBannerText: { color: '#2e7d32', fontSize: 12, fontWeight: '700' },
  unpaidBanner: {
    backgroundColor: '#fff8e1', paddingVertical: 7, paddingHorizontal: 16,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ffecb3',
  },
  unpaidBannerText: { color: '#f57f17', fontSize: 12, fontWeight: '600' },
});
