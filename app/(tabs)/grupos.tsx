import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { getGroupTeams, getGroupPredictions, saveGroupPrediction, getGroupResults, getMemberGroupPredictions, saveMemberGroupPrediction } from '@/lib/api';
import { GroupPrediction, GroupResult } from '@/lib/types';
import { Colors } from '@/constants/Colors';
import FlagImage from '@/components/FlagImage';
import { isPredictionsLocked } from '@/lib/constants';

function isLocked() { return isPredictionsLocked(); }

interface GroupEntry { team: string; flag: string; }
type GroupState = { first: string; second: string };

interface GroupCardProps {
  groupName: string;
  teams: GroupEntry[];
  selection: GroupState;
  savedSelection: GroupState | null;
  result: GroupResult | null;
  locked: boolean;
  onChange: (groupName: string, first: string, second: string) => void;
}

function GroupCard({ groupName, teams, selection, savedSelection, result, locked, onChange }: GroupCardProps) {
  const isSaved = savedSelection !== null &&
    savedSelection.first === selection.first &&
    savedSelection.second === selection.second;

  function tap(team: string) {
    if (locked) return;
    let { first, second } = selection;
    if (team === first) {
      first = second;
      second = '';
    } else if (team === second) {
      second = '';
    } else if (!first) {
      first = team;
    } else if (!second) {
      second = team;
    } else {
      second = team;
    }
    onChange(groupName, first, second);
  }

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>Grupo {groupName}</Text>
        <View style={styles.groupStatus}>
          {result?.first_place ? (
            <Text style={styles.resultReady}>✓ Resultado oficial</Text>
          ) : isSaved ? (
            <Text style={styles.savedLabel}>✓ Guardado</Text>
          ) : selection.first && selection.second ? (
            <Text style={styles.pendingLabel}>Sin guardar</Text>
          ) : null}
        </View>
      </View>

      {teams.map(({ team, flag }) => {
        const isFirst = selection.first === team;
        const isSecond = selection.second === team;
        const badge = isFirst ? '🥇' : isSecond ? '🥈' : null;

        // Result comparison
        const realTop2 = [result?.first_place, result?.second_place];
        const isCorrect = result?.first_place && realTop2.includes(team) && (isFirst || isSecond);
        const isWrong = result?.first_place && (isFirst || isSecond) && !realTop2.includes(team);

        return (
          <TouchableOpacity
            key={team}
            style={[
              styles.teamRow,
              isFirst && styles.teamFirst,
              isSecond && styles.teamSecond,
              isCorrect && styles.teamCorrect,
              isWrong && styles.teamWrong,
            ]}
            onPress={() => tap(team)}
            activeOpacity={locked ? 1 : 0.7}
          >
            <FlagImage flag={flag} size={24} />
            <Text style={styles.teamName} numberOfLines={1}>{team}</Text>
            <View style={styles.teamRight}>
              {badge && <Text style={styles.badge}>{badge}</Text>}
              {isCorrect && <Text style={styles.correctMark}>✓ 4pts</Text>}
              {isWrong && <Text style={styles.wrongMark}>✗</Text>}
            </View>
          </TouchableOpacity>
        );
      })}

      {result?.first_place && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Resultado real: 🥇 {result.first_place}  🥈 {result.second_place}</Text>
        </View>
      )}
    </View>
  );
}

export default function GruposScreen() {
  const { profile } = useAuth();
  const { activeLeague } = useLeague();
  const [groupTeams, setGroupTeams] = useState<Record<string, GroupEntry[]>>({});
  const [selections, setSelections] = useState<Record<string, GroupState>>({});
  const [savedSelections, setSavedSelections] = useState<Record<string, GroupState>>({});
  const [results, setResults] = useState<Record<string, GroupResult>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const locked = isLocked();

  const load = useCallback(async () => {
    if (!profile) return;
    const [teams, preds, groupRes] = await Promise.all([
      getGroupTeams(),
      activeLeague?.member_id
        ? getMemberGroupPredictions(activeLeague.member_id)
        : getGroupPredictions(profile.id),
      getGroupResults(),
    ]);
    setGroupTeams(teams);

    const selMap: Record<string, GroupState> = {};
    for (const p of preds) {
      selMap[p.group_name] = { first: p.first_place, second: p.second_place };
    }
    setSelections(selMap);
    setSavedSelections({ ...selMap });

    const resMap: Record<string, GroupResult> = {};
    for (const r of groupRes) resMap[r.group_name] = r;
    setResults(resMap);

    setLoading(false);
  }, [profile, activeLeague?.member_id]);

  useEffect(() => { load(); }, [load]);

  function handleChange(groupName: string, first: string, second: string) {
    setSelections(prev => ({ ...prev, [groupName]: { first, second } }));
  }

  async function handleSaveAll() {
    if (!profile) return;
    const toSave = Object.entries(selections).filter(([, { first, second }]) => first && second);
    if (toSave.length === 0) {
      setSaveMsg('⚠️ Selecciona 1ro y 2do de al menos un grupo');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await Promise.all(
        toSave.map(([groupName, { first, second }]) =>
          activeLeague?.member_id
            ? saveMemberGroupPrediction(activeLeague.member_id, groupName, first, second)
            : saveGroupPrediction(profile.id, groupName, first, second)
        )
      );
      const newSaved: Record<string, GroupState> = { ...savedSelections };
      for (const [g, sel] of toSave) newSaved[g] = sel;
      setSavedSelections(newSaved);
      setSaveMsg(`✅ ${toSave.length} grupo${toSave.length > 1 ? 's' : ''} guardado${toSave.length > 1 ? 's' : ''}`);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e.message || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  const groupNames = Object.keys(groupTeams).sort();
  const completedCount = Object.values(selections).filter(s => s.first && s.second).length;
  const savedCount = Object.values(savedSelections).filter(s => s.first && s.second).length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>
          {savedCount}/{groupNames.length} grupos guardados · 4 pts c/equipo clasificado
        </Text>
        {locked && <Text style={styles.lockedText}>🔒 Cerrado — el Mundial comenzó</Text>}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {groupNames.map(groupName => (
          <GroupCard
            key={groupName}
            groupName={groupName}
            teams={groupTeams[groupName] || []}
            selection={selections[groupName] || { first: '', second: '' }}
            savedSelection={savedSelections[groupName] || null}
            result={results[groupName] || null}
            locked={locked}
            onChange={handleChange}
          />
        ))}
        <View style={styles.bottomSpace} />
      </ScrollView>

      {!locked && (
        <View style={styles.saveBar}>
          <View style={{ flex: 1 }}>
            {saveMsg ? (
              <Text style={styles.saveMsg}>{saveMsg}</Text>
            ) : (
              <Text style={styles.saveBarInfo}>
                {completedCount > 0 ? `${completedCount} grupo${completedCount > 1 ? 's' : ''} listos` : 'Selecciona 1ro y 2do de cada grupo'}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, completedCount === 0 && styles.saveBtnDisabled]}
            onPress={handleSaveAll}
            disabled={saving || completedCount === 0}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar ({completedCount})</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  lockedText: { color: '#ffcc80', fontSize: 12, fontWeight: '600' },
  content: { padding: 12, paddingBottom: 100 },
  groupCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f8f9ff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  groupTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  groupStatus: {},
  savedLabel: { fontSize: 12, color: Colors.green, fontWeight: '600' },
  pendingLabel: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  resultReady: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  teamFirst: { backgroundColor: '#fffde7' },
  teamSecond: { backgroundColor: '#f3f3f3' },
  teamCorrect: { backgroundColor: '#f0fbf4' },
  teamWrong: { backgroundColor: '#fff5f5' },
  teamFlag: { fontSize: 24 },
  teamName: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
  teamRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontSize: 20 },
  correctMark: { fontSize: 12, color: Colors.green, fontWeight: '700' },
  wrongMark: { fontSize: 16, color: Colors.accent, fontWeight: '700' },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f0f2f5',
  },
  resultLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  bottomSpace: { height: 20 },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  saveBarInfo: { fontSize: 13, color: Colors.textSecondary },
  saveMsg: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saveBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
