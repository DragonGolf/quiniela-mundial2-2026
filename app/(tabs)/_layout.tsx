import { Tabs, router } from 'expo-router';
import { Text, TouchableOpacity, View, Modal, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { useLeague } from '@/lib/league';
import { useAuth } from '@/lib/auth';
import { PARTICIPATION_DEADLINE_STR, LOCK_DATE_STR, ADMIN_FEE_PERCENT } from '@/lib/constants';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 24 : 20 }}>{emoji}</Text>;
}

function ReglasModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.modal}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>📋 Reglas de la Quiniela</Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <Text style={st.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Avisos */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>⚠️ Avisos importantes</Text>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>📅</Text>
                <Text style={st.noticeText}>
                  Confirma tu participación con el admin antes del{' '}
                  <Text style={st.bold}>{PARTICIPATION_DEADLINE_STR}</Text>
                </Text>
              </View>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>🔒</Text>
                <Text style={st.noticeText}>
                  Cierre de predicciones:{' '}
                  <Text style={st.bold}>{LOCK_DATE_STR}</Text>
                </Text>
              </View>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>💰</Text>
                <Text style={st.noticeText}>
                  Se descuenta{' '}
                  <Text style={st.bold}>{ADMIN_FEE_PERCENT}% del pozo</Text>
                  {' '}por gestión y cobros
                </Text>
              </View>
            </View>

            {/* Puntuación por partido */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>⚽ Puntos por partido (máx 7)</Text>
              {[
                ['✓', 'Resultado correcto (G/E/P)', '3 pts'],
                ['🎯', 'Marcador exacto (+bonus)', '+2 pts'],
                ['⚽', 'Goles de un equipo exactos', '+1 pt'],
                ['↔', 'Diferencia de goles exacta', '+1 pt'],
              ].map(([e, l, p]) => (
                <View key={l} style={st.ruleRow}>
                  <Text style={st.ruleEmoji}>{e}</Text>
                  <Text style={st.ruleLabel}>{l}</Text>
                  <Text style={st.rulePts}>{p}</Text>
                </View>
              ))}
            </View>

            {/* Grupos */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>🗂 Fase de Grupos (máx 96 pts)</Text>
              <View style={st.ruleRow}>
                <Text style={st.ruleEmoji}>✓</Text>
                <Text style={st.ruleLabel}>Equipo que clasifica en tu predicción</Text>
                <Text style={st.rulePts}>4 pts</Text>
              </View>
            </View>

            {/* Predicciones finales */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>🏆 Predicciones finales</Text>
              {[
                ['🏆', 'Campeón del Mundial', '18 pts'],
                ['🥈', 'Subcampeón', '15 pts'],
                ['🥉', '3er Lugar', '8 pts'],
                ['⚽', 'Goleador del torneo', '10 pts'],
              ].map(([e, l, p]) => (
                <View key={l} style={st.ruleRow}>
                  <Text style={st.ruleEmoji}>{e}</Text>
                  <Text style={st.ruleLabel}>{l}</Text>
                  <Text style={st.rulePts}>{p}</Text>
                </View>
              ))}
            </View>

            {/* Premios */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>🏅 Distribución de Premios</Text>
              {[
                ['🥇', '1er Lugar', '70% del pozo'],
                ['🥈', '2do Lugar', '25% del pozo'],
                ['🥉', '3er Lugar', '5% del pozo'],
              ].map(([e, l, p]) => (
                <View key={l} style={st.ruleRow}>
                  <Text style={st.ruleEmoji}>{e}</Text>
                  <Text style={st.ruleLabel}>{l}</Text>
                  <Text style={st.rulePts}>{p}</Text>
                </View>
              ))}
              <Text style={st.noteText}>
                💵 Solo efectivo · En empate de puntos los premios se dividen entre empatados.
              </Text>
            </View>

            {/* Fase Eliminatoria */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>🏆 Fase Eliminatoria (quiniela aparte)</Text>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>⏱</Text>
                <Text style={st.noticeText}>
                  Se predice <Text style={st.bold}>cada partido por separado</Text>, hasta 1 hora antes de que inicie (no se llena todo de golpe).
                </Text>
              </View>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>📈</Text>
                <Text style={st.noticeText}>
                  Los puntos <Text style={st.bold}>valen más en cada ronda</Text>: Octavos ×2, Cuartos ×3, Semis ×4, Final ×5 (sobre los 7 pts base por partido).
                </Text>
              </View>
              <View style={st.noticeRow}>
                <Text style={st.noticeIcon}>⚽</Text>
                <Text style={st.noticeText}>
                  Cuenta el marcador <Text style={st.bold}>con el que terminó el partido, incluyendo tiempos extra</Text>. Los penales NO suman goles: un empate que se define por penales cuenta como ese empate, sin importar quién avance.
                </Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function TabsLayout() {
  const { activeLeague } = useLeague();
  // En quinielas de eliminatoria no van Grupos ni Podio (solo pick-em por partido)
  const isKnockout = (activeLeague as any)?.is_knockout === true;
  const { signOut } = useAuth();
  const [showReglas, setShowReglas] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  function handleSignOut() {
    if (!confirmSignOut) { setConfirmSignOut(true); return; }
    signOut();
    setConfirmSignOut(false);
    router.replace('/(auth)/');
  }

  const logoutButton = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 6 }}>
      {confirmSignOut ? (
        <>
          <TouchableOpacity onPress={() => setConfirmSignOut(false)} style={st.headerBtn}>
            <Text style={st.headerBtnTextCancel}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={[st.headerBtn, st.headerBtnRed]}>
            <Text style={st.headerBtnTextRed}>Salir</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={handleSignOut} style={st.headerBtn}>
          <Text style={st.headerBtnText}>↩ Cuenta</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const reglasButton = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 }}>
      <TouchableOpacity onPress={() => setShowReglas(true)} style={st.reglasBtn}>
        <Text style={st.reglasBtnText}>📋</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.navigate('/ligas')}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={st.switchBtn}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', letterSpacing: 0.3 }}>
              {activeLeague?.name ?? 'Sin liga'}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.white, fontWeight: '700', maxWidth: 120 }} numberOfLines={1}>
              🎯 {activeLeague?.alias ?? 'Elegir'}
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: Colors.gold, fontWeight: '700', lineHeight: 20 }}>▾</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <ReglasModal visible={showReglas} onClose={() => setShowReglas(false)} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopColor: Colors.border,
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerLeft: () => logoutButton,
          headerRight: () => reglasButton,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Partidos',
            tabBarIcon: ({ focused }) => <TabIcon emoji="⚽" focused={focused} />,
            headerTitle: '🏆 Mundial 2026',
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            title: 'Ranking',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏅" focused={focused} />,
            headerTitle: '🏅 Ranking',
          }}
        />
        <Tabs.Screen
          name="grupos"
          options={{
            title: 'Grupos',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗂" focused={focused} />,
            headerTitle: '🗂 Grupos',
            href: isKnockout ? null : undefined, // ocultar en eliminatoria
          }}
        />
        <Tabs.Screen
          name="podio"
          options={{
            title: 'Podio',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
            headerTitle: '🏆 Pódio',
            href: isKnockout ? null : undefined, // ocultar en eliminatoria
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Mi Perfil',
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
            headerTitle: '👤 Mi Perfil',
          }}
        />
      </Tabs>
    </>
  );
}

const st = StyleSheet.create({
  // Header buttons
  headerBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerBtnRed: { backgroundColor: 'rgba(255,80,80,0.3)' },
  headerBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  headerBtnTextCancel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  headerBtnTextRed: { color: '#ffcdd2', fontSize: 11, fontWeight: '700' },
  reglasBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  reglasBtnText: { fontSize: 16 },
  switchBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '700' },
  // Sections
  section: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 10 },
  noticeRow: { flexDirection: 'row', gap: 8, paddingVertical: 5 },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  bold: { fontWeight: '700', color: Colors.text },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  ruleEmoji: { width: 24, textAlign: 'center', fontSize: 15 },
  ruleLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  rulePts: {
    fontSize: 13, fontWeight: '700', color: Colors.primary,
    backgroundColor: Colors.primary + '15', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 44, textAlign: 'center',
  },
  noteText: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
});
