import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { createLeague, updateLeagueRules } from '@/lib/api';
import { Colors } from '@/constants/Colors';

const DEFAULT_RULES = {
  pts_correct_result: 3,
  pts_exact_score: 2,
  pts_one_team_goals: 1,
  pts_goal_diff: 1,
  pts_group_advance: 4,
  pts_champion: 18,
  pts_runner_up: 15,
  pts_third_place: 8,
  pts_top_scorer: 10,
};

export default function CrearLigaScreen() {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [prizeDescription, setPrizeDescription] = useState('');
  const [commission, setCommission] = useState('0');
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function setRule(key: keyof typeof DEFAULT_RULES, val: string) {
    setRules(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
  }

  async function handleCreate() {
    if (!name.trim() || !code.trim()) { setMsg('❌ El nombre y código son obligatorios'); return; }
    setSaving(true);
    setMsg('');
    try {
      const league = await createLeague(name.trim(), code.trim(), description.trim(), parseFloat(entryPrice) || 0, prizeDescription.trim());
      await updateLeagueRules(league.id, { ...rules, organizer_commission: parseFloat(commission) || 0 } as any);
      // Update rules
      setMsg('✅ Liga creada');
      setTimeout(() => router.replace('/ligas'), 1000);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || 'Error al crear liga'));
    } finally {
      setSaving(false);
    }
  }

  const ruleFields: { key: keyof typeof DEFAULT_RULES; label: string }[] = [
    { key: 'pts_correct_result', label: 'Resultado correcto (ganador/empate)' },
    { key: 'pts_exact_score', label: 'Marcador exacto (adicional)' },
    { key: 'pts_one_team_goals', label: 'Goles de un equipo correctos' },
    { key: 'pts_goal_diff', label: 'Diferencia de goles correcta' },
    { key: 'pts_group_advance', label: 'Equipo que clasifica de grupo' },
    { key: 'pts_champion', label: 'Campeón del torneo' },
    { key: 'pts_runner_up', label: 'Subcampeón' },
    { key: 'pts_third_place', label: '3er lugar' },
    { key: 'pts_top_scorer', label: 'Goleador del torneo' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Crear Nueva Liga</Text>

      {/* Info básica */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información General</Text>

        <Text style={styles.label}>Nombre de la liga *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Liga Familia" placeholderTextColor={Colors.textSecondary} />

        <Text style={styles.label}>Código de invitación *</Text>
        <TextInput style={styles.input} value={code} onChangeText={t => setCode(t.toUpperCase().replace(/\s/g, ''))}
          placeholder="Ej: FAMILIA2026" placeholderTextColor={Colors.textSecondary} autoCapitalize="characters" autoCorrect={false} />
        <Text style={styles.hint}>El código que les das a los jugadores para unirse. Sin espacios.</Text>

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription}
          placeholder="Ej: Liga de la familia Askenazi" placeholderTextColor={Colors.textSecondary} />

        <Text style={styles.label}>Precio de entrada ($)</Text>
        <TextInput style={styles.input} value={entryPrice} onChangeText={setEntryPrice}
          placeholder="0" placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" />

        <Text style={styles.label}>Comisión del organizador (%)</Text>
        <TextInput style={styles.input} value={commission} onChangeText={setCommission}
          placeholder="0" placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" />
        {entryPrice && commission ? (
          <Text style={styles.commissionHint}>
            Con {commission}% de comisión: de cada ${entryPrice} entrada,
            ${(parseFloat(entryPrice) * parseFloat(commission) / 100).toFixed(2)} van al organizador
            y ${(parseFloat(entryPrice) * (1 - parseFloat(commission) / 100)).toFixed(2)} al pozo de premios.
          </Text>
        ) : null}

        <Text style={styles.label}>Descripción de premios</Text>
        <TextInput style={[styles.input, styles.inputMulti]} value={prizeDescription} onChangeText={setPrizeDescription}
          placeholder="Ej: 70% 1er lugar, 25% 2do, 5% 3ro" placeholderTextColor={Colors.textSecondary} multiline numberOfLines={3} />
      </View>

      {/* Reglas de puntos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistema de Puntos</Text>
        <Text style={styles.hint}>Modifica los puntos de cada categoría. Los valores iniciales son los estándar.</Text>

        {ruleFields.map(({ key, label }) => (
          <View key={key} style={styles.ruleRow}>
            <Text style={styles.ruleLabel}>{label}</Text>
            <TextInput
              style={styles.ruleInput}
              value={String(rules[key])}
              onChangeText={v => setRule(key, v)}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.rulePts}>pts</Text>
          </View>
        ))}
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={saving}>
        {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.createBtnText}>Crear Liga</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  commissionHint: { fontSize: 12, color: Colors.primary, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  input: {
    height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
  },
  inputMulti: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  ruleLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  ruleInput: {
    width: 56, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.primary,
    textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.text, backgroundColor: Colors.background,
  },
  rulePts: { fontSize: 12, color: Colors.textSecondary, width: 24 },
  msg: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12, color: Colors.text },
  createBtn: {
    height: 54, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  createBtnText: { fontSize: 17, fontWeight: '700', color: Colors.white },
});
