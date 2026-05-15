import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function RegisterScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleRegister() {
    setError('');
    if (!name.trim() || !email || !password) { setError('Completa todos los campos'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (signUpError) { setLoading(false); setError(signUpError.message); return; }
    if (data?.user) {
      await supabase.from('profiles').insert({ id: data.user.id, name: name.trim() });
    }
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneIcon}>📧</Text>
        <Text style={styles.doneTitle}>¡Revisa tu correo!</Text>
        <Text style={styles.doneText}>
          Enviamos un link de confirmación a:{'\n'}
          <Text style={{ fontWeight: '700' }}>{email}</Text>
          {'\n\n'}Confirma tu correo y luego inicia sesión.
          {codigo ? `\n\nUna vez adentro, te unirás automáticamente a la liga con código ${codigo.toUpperCase()}.` : ''}
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace(codigo ? `/(auth)/login?codigo=${codigo}` : '/(auth)/login')}
        >
          <Text style={styles.btnText}>Ir a Iniciar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
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
          <Text style={styles.formTitle}>Crear cuenta</Text>

          {codigo ? (
            <View style={styles.codeHintBox}>
              <Text style={styles.codeHintText}>🎯 Te unirás a la liga <Text style={{ fontWeight: '800' }}>{codigo.toUpperCase()}</Text> al registrarte</Text>
            </View>
          ) : null}

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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Registrarme</Text>
            }
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push(codigo ? `/(auth)/login?codigo=${codigo}` : '/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Ya tengo cuenta · Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  form: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  codeHintBox: {
    backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10,
    marginBottom: 14, alignItems: 'center',
  },
  codeHintText: { fontSize: 13, color: '#2e7d32', fontWeight: '600', textAlign: 'center' },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, fontSize: 16, color: Colors.text,
    backgroundColor: '#fafafa', marginBottom: 12,
  },
  btn: {
    height: 52, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnText: { fontSize: 17, fontWeight: '700', color: Colors.white },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textSecondary },
  loginBtn: {
    height: 50, borderRadius: 12, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  loginBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  errorText: { fontSize: 13, color: '#d32f2f', marginBottom: 8, textAlign: 'center' },
  // Done screen
  doneContainer: {
    flex: 1, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  doneIcon: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: Colors.white, marginBottom: 12 },
  doneText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
