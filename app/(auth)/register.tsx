import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email || !password) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert('Error al registrarse', error.message);
      return;
    }
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, name: name.trim() });
    }
    setLoading(false);
    Alert.alert('¡Listo!', 'Cuenta creada exitosamente', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>Quiniela</Text>
          <Text style={styles.subtitle}>Mundial 2026</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Crear Cuenta</Text>

          <TextInput
            style={styles.input}
            placeholder="Tu nombre (visible en el ranking)"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
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
            placeholder="Contraseña (mín. 6 caracteres)"
            placeholderTextColor={Colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            placeholderTextColor={Colors.textSecondary}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.btnText}>Registrarme</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login" style={styles.loginLink}>Inicia sesión</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
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
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  loginText: { fontSize: 14, color: Colors.textSecondary },
  loginLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
});
