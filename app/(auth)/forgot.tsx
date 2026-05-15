import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!email.trim()) { setError('Ingresa tu correo electrónico'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://quiniela-dragon-2026.vercel.app/',
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.form}>
          <Text style={styles.doneIcon}>📧</Text>
          <Text style={styles.doneTitle}>¡Revisa tu correo!</Text>
          <Text style={styles.doneText}>
            Te enviamos un link para restablecer tu contraseña a:{'\n'}
            <Text style={{ fontWeight: '700' }}>{email}</Text>
            {'\n\n'}Sigue el link en el correo y luego inicia sesión con tu nueva contraseña.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.btnText}>Ir a Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🔑</Text>
        <Text style={styles.title}>Quiniela</Text>
        <Text style={styles.subtitle}>Mundial 2026</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Recuperar contraseña</Text>
        <Text style={styles.formHint}>
          Ingresa tu correo y te enviaremos un link para crear una nueva contraseña.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Enviar link de recuperación</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  form: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  formHint: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, fontSize: 16, color: Colors.text,
    backgroundColor: '#fafafa', marginBottom: 12,
  },
  btn: {
    height: 52, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  backRow: { alignItems: 'center', marginTop: 16 },
  backText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  errorText: { fontSize: 13, color: '#d32f2f', marginBottom: 8, textAlign: 'center' },
  doneIcon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  doneText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
