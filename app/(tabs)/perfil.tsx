import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { Prediction, Match } from '@/lib/types';

interface Stats {
  total: number;
  exact: number;
  correct: number;
  points: number;
}

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadStats();
  }, [profile]);

  async function loadStats() {
    const { data } = await supabase
      .from('predictions')
      .select('*, match:matches(status)')
      .eq('user_id', profile!.id);

    if (data) {
      const finished = data.filter((p: any) => p.match?.status === 'finished');
      setStats({
        total: data.length,
        exact: finished.filter((p: Prediction) => p.points === 3).length,
        correct: finished.filter((p: Prediction) => p.points === 1).length,
        points: finished.reduce((sum: number, p: Prediction) => sum + (p.points || 0), 0),
      });
    }
    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login'); },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        {profile?.is_admin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminText}>⚙️ Administrador</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
      ) : stats ? (
        <View style={styles.statsGrid}>
          <StatCard label="Predicciones" value={stats.total} emoji="📝" />
          <StatCard label="Exactos" value={stats.exact} emoji="🎯" highlight />
          <StatCard label="Aciertos" value={stats.correct} emoji="✓" />
          <StatCard label="Puntos Total" value={stats.points} emoji="⭐" highlight />
        </View>
      ) : null}

      {/* Scoring rules */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>Sistema de puntos</Text>
        <View style={styles.rule}>
          <Text style={styles.ruleEmoji}>🎯</Text>
          <Text style={styles.ruleText}><Text style={styles.ruleBold}>Marcador exacto</Text> = 3 puntos</Text>
        </View>
        <View style={styles.rule}>
          <Text style={styles.ruleEmoji}>✓</Text>
          <Text style={styles.ruleText}><Text style={styles.ruleBold}>Resultado correcto</Text> (ganador/empate) = 1 punto</Text>
        </View>
        <View style={styles.rule}>
          <Text style={styles.ruleEmoji}>✗</Text>
          <Text style={styles.ruleText}><Text style={styles.ruleBold}>Resultado incorrecto</Text> = 0 puntos</Text>
        </View>
        <Text style={styles.rulesNote}>
          Las predicciones se bloquean al iniciar cada partido y se revelan a todos los jugadores.
        </Text>
      </View>

      {/* Admin button */}
      {profile?.is_admin && (
        <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.adminBtnText}>⚙️ Panel de Administrador</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value, emoji, highlight }: { label: string; value: number; emoji: string; highlight?: boolean }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Colors.white },
  name: { fontSize: 24, fontWeight: '700', color: Colors.text },
  adminBadge: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: '#fff3cd', borderRadius: 20,
  },
  adminText: { fontSize: 13, fontWeight: '600', color: '#856404' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20,
  },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, alignItems: 'center', gap: 4,
  },
  statCardHighlight: { backgroundColor: Colors.primary },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.text },
  statValueHighlight: { color: Colors.white },
  statLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  rulesCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 20,
  },
  rulesTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  ruleEmoji: { fontSize: 16, width: 20 },
  ruleText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  ruleBold: { fontWeight: '700', color: Colors.text },
  rulesNote: {
    fontSize: 12, color: Colors.textSecondary, marginTop: 8,
    fontStyle: 'italic', lineHeight: 18,
  },
  adminBtn: {
    height: 52, borderRadius: 12, backgroundColor: '#f5a623',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  adminBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  signOutBtn: {
    height: 52, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: Colors.accent },
});
