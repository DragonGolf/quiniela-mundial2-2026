import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function LoginScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLogin() {
    if (!email || !password) { setErrorMsg('Ingresa tu correo y contraseña'); return; }
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    if (codigo) router.replace(`/unirse?codigo=${codigo}`);
    else router.replace('/ligas');
  }

  function goRegister() {
    router.push(codigo ? `/(auth)/register?codigo=${codigo}` : '/(auth)/register');
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

        {codigo ? (
          <View style={styles.codeHintBox}>
            <Text style={styles.codeHintText}>🎯 Liga con código <Text style={{ fontWeight: '800' }}>{codigo.toUpperCase()}</Text></Text>
          </View>
        ) : null}

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

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Entrar</Text>
          }
        </TouchableOpacity>

        {/* Recuperar contraseña */}
        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => router.push('/(auth)/forgot')}
        >
          <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        {/* Ir a registro */}
        <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>o</Text><View style={styles.dividerLine} /></View>

        <TouchableOpacity style={styles.registerBtn} onPress={goRegister}>
          <Text style={styles.registerBtnText}>Crear cuenta gratis</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 36 },
  trophy: { fontSize: 60, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
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
  codeHintText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
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
  forgotRow: { alignItems: 'center', marginTop: 12, marginBottom: 4 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textSecondary },
  registerBtn: {
    height: 50, borderRadius: 12, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  errorText: { fontSize: 13, color: '#d32f2f', marginBottom: 8, textAlign: 'center' },
});
