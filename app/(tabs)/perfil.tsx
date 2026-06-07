import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { supabase } from '@/lib/supabase';
import { getLeagueMatchesForMember, getMatches } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { Prediction, MatchWithPrediction } from '@/lib/types';
import { isPredictionsLocked } from '@/lib/constants';
import InstallAppButton from '@/components/InstallAppButton';

interface Stats {
  total: number;
  exact: number;
  correct: number;
  points: number;
}

interface PredProgress {
  total: number;
  done: number;
  openMissing: MatchWithPrediction[];   // upcoming, not locked, no prediction
  lockedMissing: number;               // locked/live/finished with no prediction
}

function isLocked(m: MatchWithPrediction) {
  if (isPredictionsLocked()) return true;
  if (m.status !== 'upcoming') return true;
  return (new Date(m.match_date).getTime() - Date.now()) / 60000 < 60;
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { activeLeague, setActiveLeague } = useLeague();
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<PredProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadAll();
  }, [profile, activeLeague?.member_id]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadStats(), loadProgress()]);
    setLoading(false);
  }

  async function loadStats() {
    const { data } = await supabase
      .from('predictions')
      .select('*, match:matches(status)')
      .eq('user_id', profile!.id);

    if (data) {
      const finished = data.filter((p: any) => p.match?.status === 'finished');
      setStats({
        total: data.length,
        exact: finished.filter((p: Prediction) => p.points === 7).length,
        correct: finished.filter((p: Prediction) => (p.points ?? 0) >= 3 && p.points < 7).length,
        points: finished.reduce((sum: number, p: Prediction) => sum + (p.points || 0), 0),
      });
    }
  }

  async function loadProgress() {
    let matches: MatchWithPrediction[] = [];
    if (activeLeague?.member_id) {
      matches = await getLeagueMatchesForMember(activeLeague.member_id);
    } else {
      matches = await getMatches(profile!.id);
    }

    const done = matches.filter(m => m.my_prediction != null);
    const missing = matches.filter(m => m.my_prediction == null);
    const openMissing = missing.filter(m => !isLocked(m));
    const lockedMissing = missing.filter(m => isLocked(m)).length;

    openMissing.sort((a, b) =>
      new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    );

    setProgress({
      total: matches.length,
      done: done.length,
      openMissing,
      lockedMissing,
    });
  }

  async function handleSaveName() {
    if (!newName.trim()) { setNameMsg('El apodo no puede estar vacío'); return; }
    setSavingName(true);
    setNameMsg('');
    const { error } = await supabase.from('profiles').update({ name: newName.trim() }).eq('id', profile!.id);
    setSavingName(false);
    if (error) { setNameMsg('❌ Error al guardar'); return; }
    setNameMsg('✅ Apodo actualizado');
    setEditingName(false);
    await refreshProfile();
  }

  async function handleSignOut() {
    if (!confirmSignOut) { setConfirmSignOut(true); return; }
    await signOut();
    router.replace('/(auth)/login');
  }

  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const visibleMissing = showAllMissing
    ? progress?.openMissing ?? []
    : (progress?.openMissing ?? []).slice(0, 4);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        {profile?.is_admin && (
          <View style={styles.adminBadge}><Text style={styles.adminText}>⚙️ Administrador</Text></View>
        )}
        {editingName ? (
          <View style={styles.nameEditBox}>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Tu apodo"
              autoFocus
              maxLength={30}
            />
            {nameMsg ? <Text style={styles.nameMsg}>{nameMsg}</Text> : null}
            <View style={styles.nameEditBtns}>
              <TouchableOpacity style={styles.nameCancelBtn} onPress={() => { setEditingName(false); setNameMsg(''); }}>
                <Text style={styles.nameCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nameSaveBtn} onPress={handleSaveName} disabled={savingName}>
                {savingName ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.nameSaveText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setNewName(profile?.name ?? ''); setEditingName(true); setNameMsg(''); }}>
            <Text style={styles.editNameLink}>✏️ Cambiar apodo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Unpaid warning */}
      {profile && !profile.is_paid && !profile.is_admin && (
        <View style={styles.unpaidBanner}>
          <Text style={styles.unpaidTitle}>⚠️ Participación no confirmada</Text>
          <Text style={styles.unpaidText}>
            Tu entrada aún no ha sido registrada como pagada. Puedes llenar tus predicciones, pero no aparecerás en el ranking hasta que el organizador confirme tu pago.
          </Text>
        </View>
      )}

      {/* Stats */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {stats && (
            <View style={styles.statsGrid}>
              <StatCard label="Predicciones" value={stats.total} emoji="📝" />
              <StatCard label="Exactos" value={stats.exact} emoji="🎯" highlight />
              <StatCard label="Aciertos" value={stats.correct} emoji="✓" />
              <StatCard label="Puntos Total" value={stats.points} emoji="⭐" highlight />
            </View>
          )}

          {/* Prediction Progress */}
          {progress && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>📋 Progreso de predicciones</Text>
                {activeLeague && (
                  <Text style={styles.progressLeague}>🎯 {activeLeague.alias}</Text>
                )}
              </View>

              {/* Bar */}
              <View style={styles.barRow}>
                <View style={styles.barBg}>
                  <View style={[
                    styles.barFill,
                    { width: `${pct}%` as any },
                    pct === 100 && styles.barFillComplete,
                  ]} />
                </View>
                <Text style={styles.barPct}>{pct}%</Text>
              </View>

              {/* Count */}
              <View style={styles.progressCounts}>
                <View style={styles.countBox}>
                  <Text style={styles.countNum}>{progress.done}</Text>
                  <Text style={styles.countLabel}>Realizadas</Text>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countBox}>
                  <Text style={[styles.countNum, progress.openMissing.length > 0 && styles.countNumWarn]}>
                    {progress.openMissing.length}
                  </Text>
                  <Text style={styles.countLabel}>Pendientes</Text>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countBox}>
                  <Text style={[styles.countNum, progress.lockedMissing > 0 && styles.countNumMiss]}>
                    {progress.lockedMissing}
                  </Text>
                  <Text style={styles.countLabel}>Perdidas</Text>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countBox}>
                  <Text style={styles.countNum}>{progress.total}</Text>
                  <Text style={styles.countLabel}>Total</Text>
                </View>
              </View>

              {pct === 100 ? (
                <View style={styles.allDoneBox}>
                  <Text style={styles.allDoneText}>🎉 ¡Tienes todas las predicciones!</Text>
                </View>
              ) : progress.openMissing.length === 0 && progress.lockedMissing > 0 ? (
                <View style={styles.missedBox}>
                  <Text style={styles.missedText}>
                    ⚠️ {progress.lockedMissing} partido{progress.lockedMissing > 1 ? 's' : ''} sin predicción ya comenzaron o están bloqueados.
                  </Text>
                </View>
              ) : progress.openMissing.length > 0 ? (
                <>
                  <Text style={styles.missingLabel}>⏳ Partidos abiertos sin predicción:</Text>
                  {visibleMissing.map(m => {
                    const date = new Date(m.match_date);
                    const dateStr = date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
                    const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                    const minsLeft = Math.round((date.getTime() - Date.now()) / 60000);
                    const hoursLeft = Math.floor(minsLeft / 60);
                    const timeLeft = hoursLeft > 24
                      ? `${Math.floor(hoursLeft / 24)}d`
                      : hoursLeft > 0 ? `${hoursLeft}h` : `${minsLeft}m`;

                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.missingRow}
                        onPress={() => router.replace('/(tabs)')}
                      >
                        <View style={styles.missingTeams}>
                          <Text style={styles.missingFlags}>{m.home_flag} {m.away_flag}</Text>
                          <Text style={styles.missingMatch} numberOfLines={1}>
                            {m.home_team} vs {m.away_team}
                          </Text>
                          <Text style={styles.missingDate}>{dateStr} · {timeStr}</Text>
                        </View>
                        <View style={styles.missingTimeBox}>
                          <Text style={styles.missingTimeLeft}>{timeLeft}</Text>
                          <Text style={styles.missingGo}>› Predecir</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {progress.openMissing.length > 4 && (
                    <TouchableOpacity
                      style={styles.showMoreBtn}
                      onPress={() => setShowAllMissing(!showAllMissing)}
                    >
                      <Text style={styles.showMoreText}>
                        {showAllMissing
                          ? '▲ Ver menos'
                          : `▼ Ver ${progress.openMissing.length - 4} más`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : null}
            </View>
          )}
        </>
      )}

      {/* Scoring rules */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>📊 Sistema de Puntos</Text>
        <Text style={styles.rulesSubtitle}>Por partido (máx 7 pts)</Text>
        {[
          ['✓', 'Resultado correcto (ganador/empate)', '3 pts'],
          ['🎯', 'Marcador exacto (adicional)', '+2 pts'],
          ['⚽', 'Goles de un equipo correctos', '+1 pt'],
          ['↔', 'Diferencia de goles correcta', '+1 pt'],
        ].map(([emoji, label, pts]) => (
          <View key={label} style={styles.rule}>
            <Text style={styles.ruleEmoji}>{emoji}</Text>
            <Text style={styles.ruleText}>{label}</Text>
            <Text style={styles.rulePts}>{pts}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.rulesSubtitle}>Fase de grupos (máx 96 pts)</Text>
        <View style={styles.rule}>
          <Text style={styles.ruleEmoji}>🗂</Text>
          <Text style={styles.ruleText}>Equipo que clasifica correctamente</Text>
          <Text style={styles.rulePts}>4 pts</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.rulesSubtitle}>Predicciones finales</Text>
        {[
          ['🏆', 'Campeón del Mundial', '18 pts'],
          ['🥈', 'Subcampeón', '15 pts'],
          ['🥉', '3er Lugar', '8 pts'],
          ['⚽', 'Goleador del torneo', '10 pts'],
        ].map(([emoji, label, pts]) => (
          <View key={label} style={styles.rule}>
            <Text style={styles.ruleEmoji}>{emoji}</Text>
            <Text style={styles.ruleText}>{label}</Text>
            <Text style={styles.rulePts}>{pts}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.rulesSubtitle}>🏆 Premios</Text>
        {[
          ['🥇', '1er Lugar', '70%'],
          ['🥈', '2do Lugar', '25%'],
          ['🥉', '3er Lugar', '5%'],
        ].map(([emoji, label, pct]) => (
          <View key={label} style={styles.rule}>
            <Text style={styles.ruleEmoji}>{emoji}</Text>
            <Text style={styles.ruleText}>{label}</Text>
            <Text style={styles.rulePts}>{pct}</Text>
          </View>
        ))}
        <Text style={styles.rulesNote}>
          💵 Solo efectivo · Confirmación de pago: 10 de junio{'\n'}
          🔒 Todas las predicciones se cierran 1 hora antes del primer partido (11 jun){'\n'}
          💰 Se descuenta 10% del pozo por gestión y cobros{'\n'}
          En caso de empate en puntos los premios se dividen entre los empatados.
        </Text>
      </View>

      {/* Liga activa */}
      {activeLeague && (
        <View style={styles.leagueBox}>
          <Text style={styles.leagueBoxLabel}>Liga activa · quiniela</Text>
          <Text style={styles.leagueBoxName}>{activeLeague.name}</Text>
          <Text style={styles.leagueBoxAlias}>🎯 {activeLeague.alias}</Text>
          <TouchableOpacity style={styles.changeLeagueBtn} onPress={() => router.push('/ligas')}>
            <Text style={styles.changeLeagueBtnText}>🔄 Cambiar de quiniela</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instalar app */}
      <InstallAppButton />

      {/* Admin button */}
      {(profile?.is_admin || activeLeague?.is_admin) && (
        <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.adminBtnText}>⚙️ Panel de Administrador</Text>
        </TouchableOpacity>
      )}

      {confirmSignOut ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>¿Seguro que quieres salir?</Text>
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmSignOut(false)}>
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmExit} onPress={handleSignOut}>
              <Text style={styles.confirmExitText}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Colors.white },
  name: { fontSize: 24, fontWeight: '700', color: Colors.text },
  adminBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#fff3cd', borderRadius: 20 },
  adminText: { fontSize: 13, fontWeight: '600', color: '#856404' },
  editNameLink: { marginTop: 10, fontSize: 13, color: Colors.primary, fontWeight: '600' },
  nameEditBox: { marginTop: 12, width: '100%', paddingHorizontal: 16 },
  nameInput: {
    height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
    paddingHorizontal: 14, fontSize: 15, color: Colors.text,
    backgroundColor: Colors.background, marginBottom: 6, textAlign: 'center',
  },
  nameMsg: { fontSize: 12, textAlign: 'center', marginBottom: 6, color: Colors.textSecondary },
  nameEditBtns: { flexDirection: 'row', gap: 8 },
  nameCancelBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  nameCancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  nameSaveBtn: { flex: 1, height: 40, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  nameSaveText: { fontSize: 14, color: Colors.white, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statCardHighlight: { backgroundColor: Colors.primary },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.text },
  statValueHighlight: { color: Colors.white },
  statLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  unpaidBanner: {
    backgroundColor: '#fff8e1', borderRadius: 12, padding: 14, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.gold,
  },
  unpaidTitle: { fontSize: 14, fontWeight: '700', color: '#856404', marginBottom: 4 },
  unpaidText: { fontSize: 13, color: '#856404', lineHeight: 18 },
  // Progress card
  progressCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 20,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  progressLeague: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  barBg: { flex: 1, height: 12, backgroundColor: '#e8eaed', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 6 },
  barFillComplete: { backgroundColor: '#4caf50' },
  barPct: { fontSize: 14, fontWeight: '800', color: Colors.primary, minWidth: 38, textAlign: 'right' },
  progressCounts: { flexDirection: 'row', backgroundColor: '#f5f7fa', borderRadius: 10, padding: 12, marginBottom: 14 },
  countBox: { flex: 1, alignItems: 'center' },
  countNum: { fontSize: 22, fontWeight: '800', color: Colors.text },
  countNumWarn: { color: '#f57c00' },
  countNumMiss: { color: Colors.accent },
  countLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
  countDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  allDoneBox: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, alignItems: 'center' },
  allDoneText: { fontSize: 14, fontWeight: '700', color: '#2e7d32' },
  missedBox: { backgroundColor: '#fff8e1', borderRadius: 10, padding: 12 },
  missedText: { fontSize: 13, color: '#856404', fontWeight: '600' },
  missingLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  missingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff8e1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: '#f57c00',
  },
  missingTeams: { flex: 1 },
  missingFlags: { fontSize: 18, marginBottom: 2 },
  missingMatch: { fontSize: 13, fontWeight: '700', color: Colors.text },
  missingDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  missingTimeBox: { alignItems: 'flex-end' },
  missingTimeLeft: { fontSize: 16, fontWeight: '800', color: '#f57c00' },
  missingGo: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  showMoreBtn: { alignItems: 'center', paddingVertical: 8 },
  showMoreText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  // Rules
  rulesCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 20 },
  rulesTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  rulesSubtitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 8, marginTop: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  ruleEmoji: { fontSize: 15, width: 22 },
  ruleText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  rulePts: { fontSize: 13, fontWeight: '700', color: Colors.primary, minWidth: 44, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  rulesNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 10, lineHeight: 19 },
  // League box
  leagueBox: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  leagueBoxLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  leagueBoxName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  leagueBoxAlias: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginBottom: 10 },
  changeLeagueBtn: { height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  changeLeagueBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  adminBtn: { height: 52, borderRadius: 12, backgroundColor: '#f5a623', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  adminBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  signOutBtn: { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 16, fontWeight: '600', color: Colors.accent },
  confirmRow: { borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent, padding: 16 },
  confirmText: { fontSize: 15, color: Colors.text, textAlign: 'center', marginBottom: 12 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  confirmExit: { flex: 1, height: 44, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  confirmExitText: { fontSize: 15, color: Colors.white, fontWeight: '700' },
});
