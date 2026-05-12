import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { triggerMatchSync, adminUpdateMatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Match } from '@/lib/types';
import { Colors, StatusLabels } from '@/constants/Colors';

export default function AdminScreen() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [newStatus, setNewStatus] = useState<'upcoming' | 'live' | 'finished'>('live');

  useEffect(() => {
    if (profile && !profile.is_admin) {
      Alert.alert('Sin acceso', 'Solo administradores pueden entrar aquí');
      router.back();
    }
  }, [profile]);

  async function load() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });
    setMatches(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerMatchSync();
      await load();
      Alert.alert('✅ Sincronizado', 'Los partidos se actualizaron correctamente');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  function openEdit(match: Match) {
    setEditing(match);
    setHomeScore(match.home_score != null ? String(match.home_score) : '');
    setAwayScore(match.away_score != null ? String(match.away_score) : '');
    setNewStatus(match.status as any);
  }

  async function handleUpdateMatch() {
    if (!editing) return;
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a)) {
      Alert.alert('Error', 'Ingresa marcadores válidos');
      return;
    }
    try {
      await adminUpdateMatch(editing.id, h, a, newStatus);
      setEditing(null);
      await load();
      Alert.alert('✅ Actualizado', 'Partido actualizado y puntos recalculados');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.gold} /></View>;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.syncBtnText}>🔄 Sincronizar con API (football-data.org)</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Partidos ({matches.length})</Text>
      <Text style={styles.hint}>Toca un partido para actualizar su marcador manualmente</Text>

      <FlatList
        data={matches}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.matchRow} onPress={() => openEdit(item)}>
            <View style={styles.matchInfo}>
              <Text style={styles.matchTeams}>
                {item.home_flag} {item.home_team} vs {item.away_team} {item.away_flag}
              </Text>
              <Text style={styles.matchDate}>
                {new Date(item.match_date).toLocaleDateString('es-MX')}
              </Text>
            </View>
            <View style={[styles.statusBadge,
              item.status === 'live' && styles.statusLive,
              item.status === 'finished' && styles.statusFinished,
            ]}>
              <Text style={styles.statusText}>{StatusLabels[item.status]}</Text>
            </View>
            {item.home_score != null && (
              <Text style={styles.matchScore}>{item.home_score}-{item.away_score}</Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Actualizar Partido</Text>
            {editing && (
              <Text style={styles.editMatch}>
                {editing.home_flag} {editing.home_team} vs {editing.away_team} {editing.away_flag}
              </Text>
            )}

            <View style={styles.scoreRow}>
              <TextInput
                style={styles.scoreInput}
                value={homeScore}
                onChangeText={setHomeScore}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
              />
              <Text style={styles.scoreDash}>-</Text>
              <TextInput
                style={styles.scoreInput}
                value={awayScore}
                onChangeText={setAwayScore}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
              />
            </View>

            <Text style={styles.statusLabel}>Estado del partido:</Text>
            <View style={styles.statusOptions}>
              {(['upcoming', 'live', 'finished'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, newStatus === s && styles.statusOptionActive]}
                  onPress={() => setNewStatus(s)}
                >
                  <Text style={[styles.statusOptionText, newStatus === s && styles.statusOptionTextActive]}>
                    {StatusLabels[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.editCancel} onPress={() => setEditing(null)}>
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSave} onPress={handleUpdateMatch}>
                <Text style={styles.editSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  syncBtn: {
    margin: 16, height: 52, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  syncBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, paddingHorizontal: 16, marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 8, paddingBottom: 32 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 10, padding: 12, marginBottom: 6,
  },
  matchInfo: { flex: 1 },
  matchTeams: { fontSize: 14, fontWeight: '600', color: Colors.text },
  matchDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#e8f0fe', marginLeft: 8,
  },
  statusLive: { backgroundColor: '#ffe5e5' },
  statusFinished: { backgroundColor: '#f0f0f0' },
  statusText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  matchScore: { fontSize: 16, fontWeight: '800', color: Colors.text, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  editTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  editMatch: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  scoreInput: {
    width: 72, height: 60, borderRadius: 12, borderWidth: 2, borderColor: Colors.gold,
    fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center', backgroundColor: '#fffdf0',
  },
  scoreDash: { fontSize: 28, fontWeight: '700', color: Colors.textSecondary },
  statusLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  statusOptions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusOption: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  statusOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusOptionText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  statusOptionTextActive: { color: Colors.white },
  editButtons: { flexDirection: 'row', gap: 12 },
  editCancel: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  editCancelText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  editSave: { flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { fontSize: 16, color: Colors.white, fontWeight: '700' },
});
