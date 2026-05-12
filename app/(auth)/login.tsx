import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Error al iniciar sesión', error.message);
    else router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>Quiniela</Text>
        <Text style={styles.subtitle}>Mundial 2026</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Iniciar Sesión</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={Colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>¿No tienes cuenta? </Text>
          <Link href="/(auth)/register" style={styles.registerLink}>Regístrate</Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  trophy: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  form: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, fontSize: 16, color: Colors.text,
    backgroundColor: '#fafafa', marginBottom: 12,
  },
  btn: {
    height: 52, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  btnText: { fontSize: 17, fontWeight: '700', color: Colors.white },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
});
