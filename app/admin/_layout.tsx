import { Stack, router } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.gold },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerTitle: '⚙️ Panel Admin',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/perfil');
            }}
            style={{ marginLeft: 4, paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700' }}>‹ Volver</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );
}
