import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LeagueProvider, useLeague } from '@/lib/league';
import { Colors } from '@/constants/Colors';
import { getMyLeagues } from '@/lib/api';

function AuthGuard() {
  const { session, loading, profile } = useAuth();
  const { activeLeague, leagueLoaded, setActiveLeague } = useLeague();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !leagueLoaded) return;
    const inAuth = segments[0] === '(auth)';
    const inLigas = segments[0] === 'ligas';
    const inCrearLiga = segments[0] === 'crear-liga';
    const inUnirse = segments[0] === 'unirse';
    const inBienvenida = segments[0] === 'bienvenida';
    const inTabs = segments[0] === '(tabs)';

    if (!session && !inAuth) {
      router.replace('/(auth)/');
      return;
    }

    if (session && inAuth) {
      // Si ya hay liga guardada, ir directo a partidos
      if (activeLeague) {
        router.replace('/(tabs)');
      } else {
        router.replace('/ligas');
      }
      return;
    }

    if (session && !inAuth && !inLigas && !inCrearLiga && !inUnirse && !inBienvenida) {
      if (activeLeague) {
        // Tiene liga activa — dejar pasar a tabs
        return;
      }
      // Sin liga: auto-seleccionar si solo tiene una
      if (profile && !inTabs) {
        getMyLeagues(profile.id).then(leagues => {
          if (leagues.length === 1) {
            setActiveLeague(leagues[0]);
            router.replace('/(tabs)');
          } else if (leagues.length > 1) {
            router.replace('/ligas');
          } else {
            router.replace('/ligas');
          }
        }).catch(() => router.replace('/ligas'));
      }
    }
  }, [session, loading, leagueLoaded, segments, activeLeague, profile]);

  if (loading || !leagueLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LeagueProvider>
        <StatusBar style="light" />
        <AuthGuard />
      </LeagueProvider>
    </AuthProvider>
  );
}
