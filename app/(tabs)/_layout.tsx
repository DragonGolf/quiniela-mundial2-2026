import { Tabs, router } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useLeague } from '@/lib/league';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 24 : 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { activeLeague } = useLeague();

  return (
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
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push('/ligas')}
            style={{ marginRight: 14, alignItems: 'flex-end' }}
          >
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.3 }}>
              {activeLeague?.name ?? 'Sin liga'} ▾
            </Text>
            <Text style={{ fontSize: 13, color: Colors.white, fontWeight: '700', maxWidth: 130 }} numberOfLines={1}>
              🎯 {activeLeague?.alias ?? 'Elegir quiniela'}
            </Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Partidos',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚽" focused={focused} />,
          headerTitle: '🏆 Quiniela Mundial 2026',
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
          headerTitle: '🗂 Predicción de Grupos',
        }}
      />
      <Tabs.Screen
        name="podio"
        options={{
          title: 'Podio',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
          headerTitle: '🏆 Podio & Reglas',
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
  );
}
