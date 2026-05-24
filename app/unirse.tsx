import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useLeague } from '@/lib/league';
import { joinLeague, getMyLeagues } from '@/lib/api';
import { Colors } from '@/constants/Colors';

export default function UnirseScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { profile, session, loading } = useAuth();
  const { setActiveLeague } = useLeague();
  const [msg, setMsg] = useState('Procesando invitación...');

  useEffect(() => {
    if (loading) return; // Esperar a que auth cargue
    if (!codigo) {
      router.replace('/ligas');
      return;
    }
    if (!session) {
      // Lleva al landing con el código visible
      router.replace(`/(auth)/?codigo=${codigo}` as any);
      return;
    }
    if (profile) handleJoin();
  }, [profile, session, codigo, loading]);

  async function handleJoin() {
    try {
      setMsg(`Buscando liga con código ${codigo}...`);

      // Primero verificar si ya somos miembro para no crear duplicados
      const allLeagues = await getMyLeagues(profile!.id);
      const alreadyMember = allLeagues.find(l => l.code === codigo!.toUpperCase());
      if (alreadyMember) {
        setActiveLeague(alreadyMember);
        setMsg(`✅ Ya eres miembro de ${alreadyMember.name}`);
        const leagueName = encodeURIComponent(alreadyMember.name);
        setTimeout(() => router.replace(`/bienvenida?memberId=${alreadyMember.member_id}&leagueName=${leagueName}` as any), 1000);
        return;
      }

      // No somos miembro: unirse
      setMsg(`Uniéndote a la liga con código ${codigo}...`);
      const league = await joinLeague(codigo!, profile!.name);
      const leagues = await getMyLeagues(profile!.id);
      const myLeague = leagues.find(l => l.id === league.id);
      if (myLeague) setActiveLeague(myLeague);
      setMsg(`✅ Te uniste a ${league.name}`);
      const memberId = myLeague?.member_id ?? '';
      const leagueName = encodeURIComponent(league.name);
      setTimeout(() => router.replace(`/bienvenida?memberId=${memberId}&leagueName=${leagueName}` as any), 1200);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || 'Código inválido'));
      setTimeout(() => router.replace('/ligas'), 2000);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.title}>Quiniela Mundial 2026</Text>
      <ActivityIndicator color={Colors.white} size="large" style={{ marginTop: 32 }} />
      <Text style={styles.msg}>{msg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: 32 },
  trophy: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.white },
  msg: { marginTop: 24, fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontWeight: '600' },
});
