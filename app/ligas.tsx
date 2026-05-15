import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import {
  getMyLeagues, joinLeague, addLeagueEntry,
  getLeagueMembers, setLeagueMemberPaidById, renameLeagueEntry, deleteLeagueEntry,
} from '@/lib/api';
import { exportLeagueToExcel } from '@/lib/export';
import { Colors } from '@/constants/Colors';
import { LeagueEntry, LeagueMember } from '@/lib/types';

const APP_URL = 'https://quiniela-dragon-2026.vercel.app';

export default function LigasScreen() {
  const { profile } = useAuth();
  const { activeLeague, setActiveLeague } = useLeague();
  const [entries, setEntries] = useState<LeagueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Join with code
  const [joinCode, setJoinCode] = useState('');
  const [joinAlias, setJoinAlias] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');

  // Add extra entry
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [addingEntry, setAddingEntry] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  // Invite link
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Rename entry
  const [renamingId, setRenamingId] = useState<string | null>(null); // member_id
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState('');

  // Delete entry
  const [deletingId, setDeletingId] = useState<string | null>(null); // member_id confirming delete
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  // Admin panel
  const [adminLeagueId, setAdminLeagueId] = useState<string | null>(null);
  const [adminMembers, setAdminMembers] = useState<(LeagueMember & { profile: { name: string } })[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null); // league id being exported

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  async function load() {
    setLoading(true);
    const data = await getMyLeagues(profile!.id);
    setEntries(data);
    setLoading(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    if (!joinAlias.trim()) { setJoinMsg('⚠️ Ponle un nombre a tu quiniela'); return; }
    setJoining(true);
    setJoinMsg('');
    try {
      await joinLeague(joinCode.trim(), joinAlias.trim());
      setJoinCode('');
      setJoinAlias('');
      setJoinMsg('✅ Quiniela creada');
      await load();
    } catch (e: any) {
      setJoinMsg('❌ ' + (e?.message || 'Código inválido'));
    } finally {
      setJoining(false);
    }
  }

  async function handleAddEntry(leagueId: string) {
    if (!newAlias.trim()) { setAddMsg('⚠️ Escribe un nombre'); return; }
    setAddingEntry(true);
    setAddMsg('');
    try {
      await addLeagueEntry(leagueId, newAlias.trim());
      setNewAlias('');
      setAddingFor(null);
      await load();
    } catch (e: any) {
      setAddMsg('❌ ' + (e?.message || 'Error al agregar'));
    } finally {
      setAddingEntry(false);
    }
  }

  function handleSelect(entry: LeagueEntry) {
    setActiveLeague(entry);
    router.replace('/(tabs)');
  }

  async function copyLink(entry: LeagueEntry) {
    const url = `${APP_URL}/unirse?codigo=${entry.code}`;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* ignore */ }
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleRename(memberId: string) {
    if (!renameValue.trim()) { setRenameMsg('⚠️ El nombre no puede estar vacío'); return; }
    setRenaming(true);
    setRenameMsg('');
    try {
      await renameLeagueEntry(memberId, renameValue.trim());
      // Update activeLeague alias if it's the same entry
      if (activeLeague?.member_id === memberId) {
        setActiveLeague({ ...activeLeague, alias: renameValue.trim() });
      }
      setRenamingId(null);
      setRenameValue('');
      await load();
    } catch (e: any) {
      setRenameMsg('❌ ' + (e?.message || 'Error al renombrar'));
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete(memberId: string, alias: string) {
    setDeleting(true);
    setDeleteMsg('');
    try {
      await deleteLeagueEntry(memberId);
      // Si era la activa, limpiar
      if (activeLeague?.member_id === memberId) {
        setActiveLeague(null as any);
      }
      setDeletingId(null);
      await load();
    } catch (e: any) {
      setDeleteMsg('❌ ' + (e?.message || 'No se pudo eliminar'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(leagueId: string, leagueName: string, leagueCode: string) {
    setExporting(leagueId);
    try {
      await exportLeagueToExcel(leagueId, leagueName, leagueCode);
    } catch (e: any) {
      console.error('Export error:', e);
    } finally {
      setExporting(null);
    }
  }

  async function openAdminPanel(leagueId: string) {
    if (adminLeagueId === leagueId) {
      setAdminLeagueId(null);
      return;
    }
    setAdminLeagueId(leagueId);
    setAdminLoading(true);
    try {
      const members = await getLeagueMembers(leagueId);
      setAdminMembers(members);
    } finally {
      setAdminLoading(false);
    }
  }

  async function togglePaid(member: LeagueMember & { profile: { name: string } }) {
    setTogglingId(member.id);
    try {
      await setLeagueMemberPaidById(member.id, !member.is_paid);
      setAdminMembers(prev =>
        prev.map(m => m.id === member.id ? { ...m, is_paid: !m.is_paid } : m)
      );
      // Refresh entries so the badge updates for the current user's entries
      await load();
    } catch (e: any) {
      console.error('Error toggling paid:', e);
    } finally {
      setTogglingId(null);
    }
  }

  // Group entries by league id
  const leagueMap: Record<string, { league: LeagueEntry; entries: LeagueEntry[] }> = {};
  for (const e of entries) {
    if (!leagueMap[e.id]) leagueMap[e.id] = { league: e, entries: [] };
    leagueMap[e.id].entries.push(e);
  }
  const leagueGroups = Object.values(leagueMap);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>Quiniela Mundial 2026</Text>
        <Text style={styles.subtitle}>Selecciona tu quiniela</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.white} size="large" style={{ marginTop: 40 }} />
      ) : (
        <>
          {leagueGroups.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No estás en ninguna liga todavía.</Text>
              <Text style={styles.emptyText}>Ingresa un código para unirte.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Mis ligas</Text>
              {leagueGroups.map(({ league, entries: groupEntries }) => {
                const isAdmin = groupEntries.some(e => e.is_admin);
                return (
                  <View key={league.id} style={styles.leagueGroup}>
                    {/* League header */}
                    <View style={styles.leagueHeader}>
                      <Text style={styles.leagueName}>{league.name}</Text>
                      {league.description ? <Text style={styles.leagueDesc}>{league.description}</Text> : null}
                    </View>

                    {/* My quiniela entries */}
                    <Text style={styles.entriesLabel}>Mis quinielas en esta liga</Text>
                    {groupEntries.map(entry => {
                      const isActive = activeLeague?.member_id === entry.member_id;
                      const isRenaming = renamingId === entry.member_id;
                      const isConfirmingDelete = deletingId === entry.member_id;
                      return (
                        <View key={entry.member_id}>
                          <TouchableOpacity
                            style={[styles.entryRow, isActive && styles.entryRowActive]}
                            onPress={() => !isConfirmingDelete && handleSelect(entry)}
                          >
                            <View style={styles.entryInfo}>
                              <View style={styles.entryAliasRow}>
                                {isActive && <Text style={styles.activeIndicator}>▶ </Text>}
                                <Text style={[styles.entryAlias, isActive && styles.entryAliasActive]}>
                                  🎯 {entry.alias}
                                </Text>
                              </View>
                              <View style={styles.entryTags}>
                                {entry.is_admin && <View style={styles.tagAdmin}><Text style={styles.tagText}>Admin</Text></View>}
                                {entry.is_paid
                                  ? <View style={styles.tagPaid}><Text style={styles.tagText}>✓ Pagado</Text></View>
                                  : <View style={styles.tagUnpaid}><Text style={styles.tagText}>Sin pago</Text></View>
                                }
                              </View>
                            </View>
                            {/* ✏️ Rename */}
                            <TouchableOpacity
                              style={styles.entryActionBtn}
                              onPress={() => {
                                setDeletingId(null);
                                if (isRenaming) { setRenamingId(null); setRenameMsg(''); }
                                else { setRenamingId(entry.member_id); setRenameValue(entry.alias); setRenameMsg(''); }
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.renameBtnText}>{isRenaming ? '✕' : '✏️'}</Text>
                            </TouchableOpacity>
                            {/* 🗑️ Delete */}
                            <TouchableOpacity
                              style={styles.entryActionBtn}
                              onPress={() => {
                                setRenamingId(null);
                                setDeleteMsg('');
                                setDeletingId(isConfirmingDelete ? null : entry.member_id);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.renameBtnText}>{isConfirmingDelete ? '✕' : '🗑️'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.arrow}>{isActive ? '●' : '›'}</Text>
                          </TouchableOpacity>

                          {/* Rename box */}
                          {isRenaming && (
                            <View style={styles.renameBox}>
                              <TextInput
                                style={styles.renameInput}
                                value={renameValue}
                                onChangeText={setRenameValue}
                                placeholder="Nuevo nombre de la quiniela"
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                autoFocus
                                maxLength={40}
                                onSubmitEditing={() => handleRename(entry.member_id)}
                              />
                              {renameMsg ? <Text style={styles.renameMsg}>{renameMsg}</Text> : null}
                              <View style={styles.renameBtns}>
                                <TouchableOpacity
                                  style={styles.renameCancelBtn}
                                  onPress={() => { setRenamingId(null); setRenameMsg(''); }}
                                >
                                  <Text style={styles.renameCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.renameConfirmBtn}
                                  onPress={() => handleRename(entry.member_id)}
                                  disabled={renaming}
                                >
                                  {renaming
                                    ? <ActivityIndicator color={Colors.white} size="small" />
                                    : <Text style={styles.renameConfirmText}>Guardar</Text>
                                  }
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}

                          {/* Delete confirmation box */}
                          {isConfirmingDelete && (
                            <View style={styles.deleteBox}>
                              <Text style={styles.deleteWarning}>
                                ⚠️ ¿Eliminar <Text style={{ fontWeight: '800' }}>"{entry.alias}"</Text>?{'\n'}
                                Se borrarán todas sus predicciones y no se puede deshacer.
                              </Text>
                              {deleteMsg ? <Text style={styles.deleteMsg}>{deleteMsg}</Text> : null}
                              <View style={styles.deleteBtns}>
                                <TouchableOpacity
                                  style={styles.deleteCancelBtn}
                                  onPress={() => { setDeletingId(null); setDeleteMsg(''); }}
                                >
                                  <Text style={styles.deleteCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.deleteConfirmBtn}
                                  onPress={() => handleDelete(entry.member_id, entry.alias)}
                                  disabled={deleting}
                                >
                                  {deleting
                                    ? <ActivityIndicator color={Colors.white} size="small" />
                                    : <Text style={styles.deleteConfirmText}>Sí, eliminar</Text>
                                  }
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Add extra entry */}
                    {addingFor === league.id ? (
                      <View style={styles.addEntryBox}>
                        <Text style={styles.addEntryLabel}>Nombre de tu nueva quiniela:</Text>
                        <TextInput
                          style={styles.addEntryInput}
                          value={newAlias}
                          onChangeText={setNewAlias}
                          placeholder="Ej: Mi quiniela arriesgada"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          autoFocus
                          maxLength={40}
                        />
                        {addMsg ? <Text style={styles.addMsg}>{addMsg}</Text> : null}
                        <View style={styles.addEntryBtns}>
                          <TouchableOpacity style={styles.addCancelBtn} onPress={() => { setAddingFor(null); setNewAlias(''); setAddMsg(''); }}>
                            <Text style={styles.addCancelText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.addConfirmBtn} onPress={() => handleAddEntry(league.id)} disabled={addingEntry}>
                            {addingEntry ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.addConfirmText}>Crear</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addEntryBtn} onPress={() => { setAddingFor(league.id); setNewAlias(''); setAddMsg(''); }}>
                        <Text style={styles.addEntryBtnText}>➕ Agregar otra quiniela en esta liga</Text>
                      </TouchableOpacity>
                    )}

                    {/* Admin section */}
                    {isAdmin && (
                      <View style={styles.adminSection}>
                        {/* Invite link */}
                        <TouchableOpacity
                          style={styles.inviteToggle}
                          onPress={() => setExpandedId(expandedId === league.id ? null : league.id)}
                        >
                          <Text style={styles.inviteToggleText}>
                            🔗 Link de invitación {expandedId === league.id ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>
                        {expandedId === league.id && (
                          <View style={styles.inviteExpanded}>
                            <Text style={styles.inviteUrl} selectable>
                              {APP_URL}/unirse?codigo={league.code}
                            </Text>
                            <TouchableOpacity
                              style={[styles.copyBtn, copiedId === league.id && styles.copyBtnDone]}
                              onPress={() => copyLink(league)}
                            >
                              <Text style={styles.copyBtnText}>
                                {copiedId === league.id ? '✅ Copiado' : '📋 Copiar link'}
                              </Text>
                            </TouchableOpacity>
                            <Text style={styles.inviteHint}>Código: <Text style={{ fontWeight: '800' }}>{league.code}</Text></Text>
                          </View>
                        )}

                        {/* Payment management */}
                        <TouchableOpacity
                          style={styles.adminToggle}
                          onPress={() => openAdminPanel(league.id)}
                        >
                          <Text style={styles.adminToggleText}>
                            👑 Gestionar pagos {adminLeagueId === league.id ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>

                        {/* Export button */}
                        <TouchableOpacity
                          style={[styles.exportBtn, exporting === league.id && styles.exportBtnBusy]}
                          onPress={() => handleExport(league.id, league.name, league.code)}
                          disabled={exporting === league.id}
                        >
                          {exporting === league.id ? (
                            <ActivityIndicator color={Colors.white} size="small" />
                          ) : (
                            <Text style={styles.exportBtnText}>📊 Exportar Excel con todas las predicciones</Text>
                          )}
                        </TouchableOpacity>

                        {adminLeagueId === league.id && (
                          <View style={styles.adminPanel}>
                            {adminLoading ? (
                              <ActivityIndicator color={Colors.white} style={{ marginVertical: 12 }} />
                            ) : adminMembers.length === 0 ? (
                              <Text style={styles.adminEmpty}>No hay participantes aún</Text>
                            ) : (
                              <>
                                <Text style={styles.adminHint}>Toca ✓/✗ para aprobar o quitar el pago</Text>
                                {adminMembers.map(member => (
                                  <View key={member.id} style={styles.adminRow}>
                                    <View style={styles.adminMemberInfo}>
                                      <Text style={styles.adminAlias}>{member.alias || member.profile?.name || 'Jugador'}</Text>
                                      <Text style={styles.adminProfileName}>{member.profile?.name}</Text>
                                    </View>
                                    <TouchableOpacity
                                      style={[styles.paidToggle, member.is_paid ? styles.paidToggleOn : styles.paidToggleOff]}
                                      onPress={() => togglePaid(member)}
                                      disabled={togglingId === member.id}
                                    >
                                      {togglingId === member.id
                                        ? <ActivityIndicator size="small" color={Colors.white} />
                                        : <Text style={styles.paidToggleText}>
                                            {member.is_paid ? '✓ Pagado' : '✗ Sin pago'}
                                          </Text>
                                      }
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Join with code */}
          <View style={styles.joinBox}>
            <Text style={styles.joinTitle}>Unirme a una liga</Text>
            <Text style={styles.joinHint}>Ingresa el código y el nombre que verán los demás</Text>
            <TextInput
              style={styles.joinInput}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())}
              placeholder="Código (ej: FAMILIA2026)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.joinInput, { marginTop: 8 }]}
              value={joinAlias}
              onChangeText={setJoinAlias}
              placeholder="Nombre de tu quiniela (ej: Isaac Optimista)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              maxLength={40}
            />
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={joining}>
              {joining ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.joinBtnText}>Unirme</Text>}
            </TouchableOpacity>
            {joinMsg ? <Text style={styles.joinMsg}>{joinMsg}</Text> : null}
          </View>

          {profile?.is_admin && (
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/crear-liga')}>
              <Text style={styles.createBtnText}>+ Crear nueva liga</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  content: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32, paddingTop: 20 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  leagueGroup: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  leagueHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  leagueName: { fontSize: 18, fontWeight: '800', color: Colors.white },
  leagueDesc: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  entriesLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 10, marginBottom: 6, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  entryRowActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: Colors.gold,
  },
  entryInfo: { flex: 1 },
  entryAliasRow: { flexDirection: 'row', alignItems: 'center' },
  activeIndicator: { fontSize: 12, color: Colors.gold, fontWeight: '800' },
  entryAlias: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  entryAliasActive: { color: Colors.gold },
  entryTags: { flexDirection: 'row', gap: 6 },
  tagAdmin: { backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagUnpaid: { backgroundColor: 'rgba(255,100,100,0.6)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagPaid: { backgroundColor: 'rgba(100,220,100,0.5)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  arrow: { fontSize: 22, color: Colors.gold, marginLeft: 8, fontWeight: '800' },
  entryActionBtn: { padding: 4, marginLeft: 2 },
  renameBtn: { padding: 4, marginRight: 4 },
  renameBtnText: { fontSize: 16 },
  renameBox: { marginHorizontal: 10, marginBottom: 6, padding: 12, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12 },
  renameInput: {
    height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, fontSize: 14, color: Colors.white,
    borderWidth: 1, borderColor: Colors.gold,
  },
  renameMsg: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  renameBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  renameCancelBtn: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  renameCancelText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  renameConfirmBtn: { flex: 1, height: 38, borderRadius: 8, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  renameConfirmText: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  // Delete confirmation
  deleteBox: { marginHorizontal: 10, marginBottom: 6, padding: 14, backgroundColor: 'rgba(180,0,0,0.25)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,100,100,0.4)' },
  deleteWarning: { fontSize: 13, color: Colors.white, lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  deleteMsg: { fontSize: 12, color: 'rgba(255,200,200,0.9)', textAlign: 'center', marginBottom: 8 },
  deleteBtns: { flexDirection: 'row', gap: 8 },
  deleteCancelBtn: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  deleteCancelText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  deleteConfirmBtn: { flex: 1, height: 38, borderRadius: 8, backgroundColor: '#d32f2f', alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  addEntryBtn: {
    marginHorizontal: 10, marginBottom: 10, paddingVertical: 10,
    alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed',
  },
  addEntryBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  addEntryBox: { margin: 10, padding: 12, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12 },
  addEntryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: '600' },
  addEntryInput: {
    height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, fontSize: 14, color: Colors.white,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  addMsg: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  addEntryBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addCancelBtn: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  addCancelText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  addConfirmBtn: { flex: 1, height: 38, borderRadius: 8, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  addConfirmText: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  // Admin section
  adminSection: { backgroundColor: 'rgba(0,0,0,0.15)', marginHorizontal: 10, marginBottom: 10, borderRadius: 10 },
  inviteToggle: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  inviteToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  inviteExpanded: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  inviteUrl: {
    fontSize: 11, color: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8, padding: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: { height: 36, borderRadius: 8, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  copyBtnDone: { backgroundColor: '#4caf50' },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  inviteHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  exportBtn: {
    marginHorizontal: 14, marginTop: 2, marginBottom: 2, height: 40, borderRadius: 8,
    backgroundColor: 'rgba(76,175,80,0.75)', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  exportBtnBusy: { backgroundColor: 'rgba(76,175,80,0.4)' },
  exportBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  adminToggle: { paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  adminToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,215,0,0.9)' },
  adminPanel: { paddingHorizontal: 12, paddingBottom: 12 },
  adminHint: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textAlign: 'center' },
  adminEmpty: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: 12 },
  adminRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  adminMemberInfo: { flex: 1 },
  adminAlias: { fontSize: 14, fontWeight: '700', color: Colors.white },
  adminProfileName: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  paidToggle: { height: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  paidToggleOn: { backgroundColor: 'rgba(76,175,80,0.8)' },
  paidToggleOff: { backgroundColor: 'rgba(244,67,54,0.7)' },
  paidToggleText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  // Join section
  emptyBox: { alignItems: 'center', marginVertical: 32 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 4 },
  joinBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 20, marginTop: 8 },
  joinTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  joinHint: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 12 },
  joinInput: {
    height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, fontSize: 15, color: Colors.white,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  joinBtn: {
    height: 48, borderRadius: 12, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginTop: 10,
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  joinMsg: { marginTop: 10, fontSize: 13, fontWeight: '600', color: Colors.white },
  createBtn: {
    marginTop: 16, height: 52, borderRadius: 14, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
