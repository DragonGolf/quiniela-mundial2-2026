import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { getPodiumPrediction, savePodiumPrediction, getMemberPodiumPrediction, saveMemberPodiumPrediction, getTournamentResults, getAllTeams } from '@/lib/api';
import { PodiumPrediction, TournamentResult } from '@/lib/types';
import { Colors } from '@/constants/Colors';
import { isPredictionsLocked } from '@/lib/constants';

function isLocked() { return isPredictionsLocked(); }

interface TeamPickerProps {
  visible: boolean;
  title: string;
  teams: string[];
  selected: string;
  onSelect: (team: string) => void;
  onClose: () => void;
}

function TeamPicker({ visible, title, teams, selected, onSelect, onClose }: TeamPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = teams.filter(t => t.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <TextInput
            style={styles.search}
            placeholder="Buscar equipo..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={t => t}
            style={styles.teamList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.teamRow, item === selected && styles.teamRowSelected]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[styles.teamName, item === selected && styles.teamNameSelected]}>
                  {item}
                </Text>
                {item === selected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { onClose(); setSearch(''); }}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PodioScreen() {
  const { profile } = useAuth();
  const { activeLeague } = useLeague();
  const [podium, setPodium] = useState<PodiumPrediction | null>(null);
  const [results, setResults] = useState<TournamentResult | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [champion, setChampion] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [thirdPlace, setThirdPlace] = useState('');
  const [topScorer, setTopScorer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [picker, setPicker] = useState<'champion' | 'runner_up' | 'third_place' | null>(null);
  const locked = isLocked();

  const load = useCallback(async () => {
    if (!profile) return;
    const [p, r, t] = await Promise.all([
      activeLeague?.member_id
        ? getMemberPodiumPrediction(activeLeague.member_id)
        : getPodiumPrediction(profile.id),
      getTournamentResults(),
      getAllTeams(),
    ]);
    setPodium(p);
    setResults(r);
    setTeams(t);
    if (p) {
      setChampion(p.champion);
      setRunnerUp(p.runner_up);
      setThirdPlace(p.third_place);
      setTopScorer(p.top_scorer || '');
    }
    setLoading(false);
  }, [profile, activeLeague?.member_id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!champion || !runnerUp || !thirdPlace) {
      setSaveMsg('⚠️ Selecciona los 3 equipos del podio');
      return;
    }
    if (champion === runnerUp || champion === thirdPlace || runnerUp === thirdPlace) {
      setSaveMsg('❌ No puedes repetir el mismo equipo en el podio');
      return;
    }
    if (!profile) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const saved = await (activeLeague?.member_id
        ? saveMemberPodiumPrediction(activeLeague.member_id, champion, runnerUp, thirdPlace, topScorer || undefined)
        : savePodiumPrediction(profile.id, champion, runnerUp, thirdPlace, topScorer || undefined));
      setPodium(saved);
      setSaveMsg('✅ Podio guardado correctamente');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e.message || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  function getPodiumPoints() {
    if (!podium || !results) return null;
    let pts = 0;
    if (results.champion && podium.champion === results.champion) pts += 18;
    if (results.runner_up && podium.runner_up === results.runner_up) pts += 15;
    if (results.third_place && podium.third_place === results.third_place) pts += 8;
    return pts;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const podiumPoints = getPodiumPoints();
  const hasResults = results && (results.champion || results.runner_up || results.third_place);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Rules & prizes card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Premios</Text>
        <View style={styles.prizeRow}>
          <Text style={styles.prizePlace}>🥇 1er lugar</Text>
          <Text style={styles.prizePercent}>70%</Text>
        </View>
        <View style={styles.prizeRow}>
          <Text style={styles.prizePlace}>🥈 2do lugar</Text>
          <Text style={styles.prizePercent}>25%</Text>
        </View>
        <View style={styles.prizeRow}>
          <Text style={styles.prizePlace}>🥉 3er lugar</Text>
          <Text style={styles.prizePercent}>5%</Text>
        </View>
        <Text style={styles.prizeNote}>
          En caso de empate en puntos, los premios se combinan y se dividen entre los empatados.
        </Text>
        <Text style={styles.prizeNote}>💵 Solo se acepta efectivo · Fecha límite de pago: 10 de Junio</Text>
      </View>

      {/* Scoring card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Sistema de Puntos</Text>
        <View style={styles.scoreTable}>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>✓ Resultado correcto (ganador/empate)</Text><Text style={styles.scoreVal}>3 pts</Text></View>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>🎯 Marcador exacto (adicional)</Text><Text style={styles.scoreVal}>+2 pts</Text></View>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>⚽ Goles atinados de un equipo</Text><Text style={styles.scoreVal}>+1 pt</Text></View>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>↔ Diferencia de goles correcta</Text><Text style={styles.scoreVal}>+1 pt</Text></View>
          <View style={[styles.scoreRow, styles.scoreRowMax]}><Text style={[styles.scoreLabel, { fontWeight: '700' }]}>Máximo por partido</Text><Text style={[styles.scoreVal, { fontWeight: '700', color: Colors.gold }]}>7 pts</Text></View>
        </View>
        <View style={styles.divider} />
        <View style={styles.scoreTable}>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>🏆 Equipo Campeón</Text><Text style={styles.scoreVal}>18 pts</Text></View>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>🥈 Equipo Subcampeón</Text><Text style={styles.scoreVal}>15 pts</Text></View>
          <View style={styles.scoreRow}><Text style={styles.scoreLabel}>🥉 3er Lugar</Text><Text style={styles.scoreVal}>8 pts</Text></View>
        </View>
        <Text style={styles.prizeNote}>
          ⚠️ El podio debe llenarse antes del 10 de Junio, de lo contrario no se otorgan estos puntos.
        </Text>
        <Text style={styles.prizeNote}>
          Las predicciones de partidos se bloquean 20 minutos antes de cada partido.
        </Text>
      </View>

      {/* Podium prediction */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏅 Mi Predicción del Podio</Text>

        {locked ? (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedText}>🔒 Predicciones cerradas (10 Junio)</Text>
          </View>
        ) : (
          <Text style={styles.deadline}>Fecha límite: 10 de Junio</Text>
        )}

        {hasResults && podium && podiumPoints !== null && (
          <View style={[styles.resultBanner, podiumPoints > 0 ? styles.resultGood : styles.resultNone]}>
            <Text style={styles.resultText}>
              Puntos del podio: {podiumPoints} pts
              {results.champion === podium.champion ? ' · 🏆 Campeón ✓' : ''}
              {results.runner_up === podium.runner_up ? ' · 🥈 Sub ✓' : ''}
              {results.third_place === podium.third_place ? ' · 🥉 3ro ✓' : ''}
            </Text>
          </View>
        )}

        {[
          { label: '🏆 Campeón', pts: '18 pts', value: champion, key: 'champion' as const, set: setChampion },
          { label: '🥈 Subcampeón', pts: '15 pts', value: runnerUp, key: 'runner_up' as const, set: setRunnerUp },
          { label: '🥉 3er Lugar', pts: '8 pts', value: thirdPlace, key: 'third_place' as const, set: setThirdPlace },
        ].map(({ label, pts, value, key }) => {
          const actual = key === 'champion' ? results?.champion : key === 'runner_up' ? results?.runner_up : results?.third_place;
          const isCorrect = actual && value === actual;
          const isWrong = actual && value && value !== actual;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.podiumSlot, isCorrect && styles.podiumCorrect, isWrong && styles.podiumWrong]}
              onPress={() => !locked && setPicker(key)}
              disabled={locked}
            >
              <View style={styles.podiumSlotLeft}>
                <Text style={styles.podiumLabel}>{label}</Text>
                <Text style={styles.podiumPts}>{pts}</Text>
              </View>
              <Text style={styles.podiumTeam}>{value || 'Seleccionar equipo →'}</Text>
              {isCorrect && <Text style={styles.podiumCheck}>✓</Text>}
              {isWrong && <Text style={styles.podiumX}>✗</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Top scorer */}
        <View style={styles.divider} />
        <Text style={styles.scorerLabel}>⚽ Goleador del Torneo — 10 pts</Text>
        {(() => {
          const scorerCorrect = results?.top_scorer && topScorer &&
            topScorer.trim().toLowerCase() === results.top_scorer.trim().toLowerCase();
          const scorerWrong = results?.top_scorer && topScorer &&
            topScorer.trim().toLowerCase() !== results.top_scorer.trim().toLowerCase();
          return (
            <>
              <TextInput
                style={[
                  styles.scorerInput,
                  locked && styles.scorerInputLocked,
                  scorerCorrect && styles.scorerCorrect,
                  scorerWrong && styles.scorerWrong,
                ]}
                value={topScorer}
                onChangeText={setTopScorer}
                placeholder="Nombre del jugador (ej: Messi, Mbappé...)"
                placeholderTextColor={Colors.textSecondary}
                editable={!locked}
                autoCapitalize="words"
              />
              {scorerCorrect && <Text style={styles.scorerResult}>✓ ¡Correcto! +10 pts</Text>}
              {scorerWrong && <Text style={styles.scorerWrongText}>✗ Incorrecto · Real: {results?.top_scorer}</Text>}
            </>
          );
        })()}

        {saveMsg ? <Text style={styles.saveMsg}>{saveMsg}</Text> : null}
        {!locked && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{podium ? 'Actualizar Podio' : 'Guardar Podio'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <TeamPicker
        visible={picker !== null}
        title={picker === 'champion' ? '🏆 Selecciona el Campeón' : picker === 'runner_up' ? '🥈 Selecciona el Subcampeón' : '🥉 Selecciona el 3er Lugar'}
        teams={teams}
        selected={picker === 'champion' ? champion : picker === 'runner_up' ? runnerUp : thirdPlace}
        onSelect={(t) => {
          if (picker === 'champion') setChampion(t);
          else if (picker === 'runner_up') setRunnerUp(t);
          else if (picker === 'third_place') setThirdPlace(t);
        }}
        onClose={() => setPicker(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1,
    shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prizePlace: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  prizePercent: { fontSize: 15, fontWeight: '700', color: Colors.gold },
  prizeNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 10, lineHeight: 18 },
  scoreTable: { gap: 8 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  scoreRowMax: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  scoreLabel: { fontSize: 13, color: Colors.text, flex: 1 },
  scoreVal: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginLeft: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  deadline: { fontSize: 12, color: Colors.gold, fontWeight: '600', marginBottom: 12 },
  lockedBanner: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 12 },
  lockedText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  resultBanner: { borderRadius: 8, padding: 10, marginBottom: 12 },
  resultGood: { backgroundColor: '#e8f8ee' },
  resultNone: { backgroundColor: '#f5f5f5' },
  resultText: { fontSize: 12, color: Colors.text, fontWeight: '600', textAlign: 'center' },
  podiumSlot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  podiumCorrect: { borderColor: Colors.green, backgroundColor: '#f0fbf4' },
  podiumWrong: { borderColor: Colors.accent, backgroundColor: '#fff5f5' },
  podiumSlotLeft: { gap: 2 },
  podiumLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  podiumPts: { fontSize: 11, color: Colors.gold, fontWeight: '600' },
  podiumTeam: { fontSize: 14, color: Colors.primary, fontWeight: '600', flex: 1, textAlign: 'right', marginHorizontal: 8 },
  podiumCheck: { fontSize: 18, color: Colors.green, fontWeight: '700' },
  podiumX: { fontSize: 18, color: Colors.accent, fontWeight: '700' },
  saveBtn: {
    height: 52, borderRadius: 12, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  scorerLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  scorerInput: {
    height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
    marginBottom: 10,
  },
  scorerInputLocked: { backgroundColor: '#f5f5f5', color: Colors.textSecondary },
  scorerCorrect: { borderColor: Colors.green, backgroundColor: '#f0fbf4' },
  scorerWrong: { borderColor: Colors.accent, backgroundColor: '#fff5f5' },
  saveMsg: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10, color: Colors.text },
  scorerResult: { fontSize: 13, color: Colors.green, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  scorerWrongText: { fontSize: 13, color: Colors.accent, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  // Team picker
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  picker: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, maxHeight: '80%',
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 },
  search: {
    marginHorizontal: 16, marginBottom: 8, height: 42, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.background,
  },
  teamList: { flexGrow: 0 },
  teamRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  teamRowSelected: { backgroundColor: '#e8f0fe' },
  teamName: { fontSize: 15, color: Colors.text },
  teamNameSelected: { color: Colors.primary, fontWeight: '700' },
  checkmark: { fontSize: 16, color: Colors.primary, fontWeight: '700' },
  cancelBtn: {
    margin: 16, height: 50, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
});
