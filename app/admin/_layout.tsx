import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.gold },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerTitle: '⚙️ Panel Admin',
      }}
    />
  );
}
