import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLeague } from '@/lib/league';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { PARTICIPATION_DEADLINE_STR, LOCK_DATE_STR, ADMIN_FEE_PERCENT } from '@/lib/constants';

interface PredStats {
  matchPreds: number;
  totalMatches: number;
  hasGroups: boolean;
  hasPodio: boolean;
}

export default function BienvenidaScreen() {
  const { memberId, leagueName } = useLocalSearchParams<{ memberId: string; leagueName: string }>();
  const { activeLeague } = useLeague();
  const [stats, setStats] = useState<PredStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberId) loadStats();
  }, [memberId]);

  async function loadStats() {
    try {
      const [{ count: totalMatches }, { data: matchPreds }, { data: groupPreds }, { data: podioPreds }] =
        await Promise.all([
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('league_predictions').select('id').eq('league_member_id', memberId),
          supabase.from('member_group_predictions').select('id').eq('league_member_id', memberId).limit(1),
          supabase.from('member_podium_predictions').select('id').eq('league_member_id', memberId).limit(1),
        ]);
      setStats({
        matchPreds: matchPreds?.length ?? 0,
        totalMatches: totalMatches ?? 0,
        hasGroups: (groupPreds?.length ?? 0) > 0,
        hasPodio: (podioPreds?.length ?? 0) > 0,
      });
    } catch {
      setStats({ matchPreds: 0, totalMatches: 0, hasGroups: false, hasPodio: false });
    } finally {
      setLoading(false);
    }
  }

  function getProgressColor(done: boolean) {
    return done ? '#2e7d32' : '#e65100';
  }

  function getMatchProgress() {
    if (!stats) return { pct: 0, color: '#e65100', label: '0%' };
    const pct = stats.totalMatches > 0 ? Math.round((stats.matchPreds / stats.totalMatches) * 100) : 0;
    const color = pct === 100 ? '#2e7d32' : pct > 0 ? '#f57c00' : '#e65100';
    return { pct, color, label: `${stats.matchPreds}/${stats.totalMatches} partidos` };
  }

  function handleEnter() {
    router.replace('/(tabs)');
  }

  const league = leagueName ? decodeURIComponent(leagueName) : activeLeague?.name ?? 'tu liga';
  const matchProgress = getMatchProgress();
  const allDone = stats && stats.matchPreds === stats.totalMatches && stats.hasGroups && stats.hasPodio;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>¡Bienvenido!</Text>
        <Text style={styles.leagueName}>{league}</Text>
      </View>

      {/* Mensaje principal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tu quiniela está lista 🎉</Text>
        <Text style={styles.cardText}>
          Ya eres parte de la liga. Ahora necesitas llenar tus predicciones antes del cierre.
          Mientras más completes, más puntos puedes ganar.
        </Text>
      </View>

      {/* Progreso */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Tu progreso</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
        ) : (
          <>
            {/* Partidos */}
            <View style={styles.progressRow}>
              <View style={styles.progressLeft}>
                <Text style={styles.progressIcon}>⚽</Text>
                <View>
                  <Text style={styles.progressLabel}>Predicciones de partidos</Text>
                  <Text style={[styles.progressSub, { color: matchProgress.color }]}>
                    {matchProgress.label}
                  </Text>
                </View>
              </View>
              <View style={[styles.progressBadge, { backgroundColor: matchProgress.color + '20', borderColor: matchProgress.color }]}>
                <Text style={[styles.progressBadgeText, { color: matchProgress.color }]}>
                  {matchProgress.pct}%
                </Text>
              </View>
            </View>

            {/* Grupos */}
            <View style={styles.progressRow}>
              <View style={styles.progressLeft}>
                <Text style={styles.progressIcon}>🗂</Text>
                <View>
                  <Text style={styles.progressLabel}>Avance de grupos</Text>
                  <Text style={[styles.progressSub, { color: getProgressColor(stats?.hasGroups ?? false) }]}>
                    {stats?.hasGroups ? '✓ Completado' : '✗ Pendiente'}
                  </Text>
                </View>
              </View>
              <View style={[styles.progressBadge, {
                backgroundColor: getProgressColor(stats?.hasGroups ?? false) + '20',
                borderColor: getProgressColor(stats?.hasGroups ?? false),
              }]}>
                <Text style={[styles.progressBadgeText, { color: getProgressColor(stats?.hasGroups ?? false) }]}>
                  {stats?.hasGroups ? '✓' : '✗'}
                </Text>
              </View>
            </View>

            {/* Pódio */}
            <View style={styles.progressRow}>
              <View style={styles.progressLeft}>
                <Text style={styles.progressIcon}>🏅</Text>
                <View>
                  <Text style={styles.progressLabel}>Pódio (Campeón, Goleador)</Text>
                  <Text style={[styles.progressSub, { color: getProgressColor(stats?.hasPodio ?? false) }]}>
                    {stats?.hasPodio ? '✓ Completado' : '✗ Pendiente'}
                  </Text>
                </View>
              </View>
              <View style={[styles.progressBadge, {
                backgroundColor: getProgressColor(stats?.hasPodio ?? false) + '20',
                borderColor: getProgressColor(stats?.hasPodio ?? false),
              }]}>
                <Text style={[styles.progressBadgeText, { color: getProgressColor(stats?.hasPodio ?? false) }]}>
                  {stats?.hasPodio ? '✓' : '✗'}
                </Text>
              </View>
            </View>

            {allDone && (
              <View style={styles.allDoneBanner}>
                <Text style={styles.allDoneText}>🎊 ¡Tu quiniela está 100% completada!</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Avisos importantes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚠️ Avisos importantes</Text>

        <View style={styles.noticeRow}>
          <Text style={styles.noticeIcon}>🔒</Text>
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>Cierre de predicciones</Text>
            <Text style={styles.noticeText}>
              Todas las predicciones se bloquean{' '}
              <Text style={{ fontWeight: '700' }}>1 hora antes del primer partido</Text>
              {'\n'}{LOCK_DATE_STR}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.noticeRow}>
          <Text style={styles.noticeIcon}>📅</Text>
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>Confirmación de participación</Text>
            <Text style={styles.noticeText}>
              Debes confirmar tu participación y pago con el administrador a más tardar el{' '}
              <Text style={{ fontWeight: '700' }}>{PARTICIPATION_DEADLINE_STR}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.noticeRow}>
          <Text style={styles.noticeIcon}>💰</Text>
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>Descuento por gestión</Text>
            <Text style={styles.noticeText}>
              Se descontará un{' '}
              <Text style={{ fontWeight: '700' }}>{ADMIN_FEE_PERCENT}% del pozo total</Text>
              {' '}para cubrir los gastos de administración y cobros de la quiniela.
            </Text>
          </View>
        </View>
      </View>

      {/* Cómo se puntúa */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 ¿Cómo ganar puntos?</Text>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>3 pts</Text><Text style={styles.scoreDesc}>Resultado exacto del partido</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>1 pt</Text><Text style={styles.scoreDesc}>Resultado correcto (G/E/P)</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>2 pts</Text><Text style={styles.scoreDesc}>Avance correcto de grupo</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>18 pts</Text><Text style={styles.scoreDesc}>Campeón correcto 🏆</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>15 pts</Text><Text style={styles.scoreDesc}>Subcampeón correcto 🥈</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>8 pts</Text><Text style={styles.scoreDesc}>Tercer lugar correcto 🥉</Text></View>
        <View style={styles.scoreRow}><Text style={styles.scorePoints}>10 pts</Text><Text style={styles.scoreDesc}>Goleador correcto ⚽</Text></View>
      </View>

      {/* Botón de acción */}
      <TouchableOpacity style={styles.ctaBtn} onPress={handleEnter}>
        <Text style={styles.ctaBtnText}>
          {allDone ? '✅ Ver mi quiniela' : '✏️ Llenar mi quiniela'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  header: { alignItems: 'center', paddingVertical: 24 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.primary },
  leagueName: { fontSize: 16, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 18,
    marginBottom: 14, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  cardText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  progressLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  progressIcon: { fontSize: 22 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  progressSub: { fontSize: 12, marginTop: 2 },
  progressBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5,
  },
  progressBadgeText: { fontSize: 12, fontWeight: '700' },
  allDoneBanner: {
    backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginTop: 12, alignItems: 'center',
  },
  allDoneText: { fontSize: 14, fontWeight: '700', color: '#2e7d32' },

  noticeRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  noticeIcon: { fontSize: 22 },
  noticeBody: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  noticeText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  divider: { height: 1, backgroundColor: Colors.border },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  scorePoints: {
    width: 50, textAlign: 'center', fontSize: 13, fontWeight: '800',
    color: Colors.primary, backgroundColor: Colors.primary + '15',
    borderRadius: 8, paddingVertical: 2,
  },
  scoreDesc: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  ctaBtn: {
    height: 56, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  ctaBtnText: { fontSize: 18, fontWeight: '800', color: Colors.white },
});
