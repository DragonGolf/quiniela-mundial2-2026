import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LeagueProvider, useLeague } from '@/lib/league';
import { Colors } from '@/constants/Colors';

function AuthGuard() {
  const { session, loading } = useAuth();
  const { activeLeague } = useLeague();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inLigas = segments[0] === 'ligas';
    const inCrearLiga = segments[0] === 'crear-liga';
    const inUnirse = segments[0] === 'unirse';
    const inBienvenida = segments[0] === 'bienvenida';

    if (!session && !inAuth) {
      router.replace('/(auth)/');
    } else if (session && inAuth) {
      router.replace('/ligas');
    } else if (session && !inAuth && !inLigas && !inCrearLiga && !inUnirse && !inBienvenida && !activeLeague) {
      router.replace('/ligas');
    }
  }, [session, loading, segments, activeLeague]);

  if (loading) {
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
