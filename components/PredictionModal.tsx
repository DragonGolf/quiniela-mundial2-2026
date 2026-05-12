import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Match, Prediction } from '@/lib/types';
import { savePrediction } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Props {
  match: Match;
  existing?: Prediction;
  visible: boolean;
  onClose: () => void;
  onSaved: (prediction: Prediction) => void;
}

export default function PredictionModal({ match, existing, visible, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [home, setHome] = useState(existing ? String(existing.pred_home) : '');
  const [away, setAway] = useState(existing ? String(existing.pred_away) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const h = parseInt(home);
    const a = parseInt(away);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      Alert.alert('Error', 'Ingresa marcadores válidos (números ≥ 0)');
      return;
    }
    if (!profile) return;
    setSaving(true);
    try {
      const pred = await savePrediction(profile.id, match.id, h, a);
      onSaved(pred);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar la predicción');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Tu Predicción</Text>
          <Text style={styles.matchLabel}>
            {match.home_flag} {match.home_team} vs {match.away_team} {match.away_flag}
          </Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreInput}>
              <Text style={styles.teamName}>{match.home_team}</Text>
              <TextInput
                style={styles.input}
                value={home}
                onChangeText={setHome}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <Text style={styles.dash}>-</Text>
            <View style={styles.scoreInput}>
              <Text style={styles.teamName}>{match.away_team}</Text>
              <TextInput
                style={styles.input}
                value={away}
                onChangeText={setAway}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.pointsInfo}>
            <Text style={styles.pointsInfoText}>⚽ Marcador exacto = 3 pts</Text>
            <Text style={styles.pointsInfoText}>✓ Resultado correcto = 1 pt</Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.btnSaveText}>
                  {existing ? 'Actualizar' : 'Guardar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  matchLabel: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  scoreInput: { alignItems: 'center', flex: 1 },
  teamName: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, textAlign: 'center' },
  input: {
    width: 80, height: 64, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.primary,
    fontSize: 32, fontWeight: '700', color: Colors.text,
    textAlign: 'center', backgroundColor: '#f8f9ff',
  },
  dash: { fontSize: 32, fontWeight: '700', color: Colors.textSecondary },
  pointsInfo: { backgroundColor: '#f0f2f5', borderRadius: 10, padding: 12, marginBottom: 24, gap: 4 },
  pointsInfoText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1, height: 50, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  btnSave: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  btnSaveText: { fontSize: 16, color: Colors.white, fontWeight: '700' },
});
