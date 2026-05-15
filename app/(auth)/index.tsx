import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function WelcomeScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const code = codigo?.toUpperCase();

  function goRegister() {
    router.push(code ? `/(auth)/register?codigo=${code}` : '/(auth)/register');
  }
  function goLogin() {
    router.push(code ? `/(auth)/login?codigo=${code}` : '/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>Quiniela</Text>
        <Text style={styles.subtitle}>Mundial 2026</Text>
      </View>

      {code ? (
        <View style={styles.inviteBanner}>
          <Text style={styles.inviteEmoji}>🎯</Text>
          <Text style={styles.inviteTitle}>¡Te invitaron a una liga!</Text>
          <Text style={styles.inviteCode}>{code}</Text>
          <Text style={styles.inviteHint}>Regístrate o inicia sesión para unirte automáticamente</Text>
        </View>
      ) : (
        <View style={styles.tagline}>
          <Text style={styles.taglineText}>Arma tu quiniela,{'\n'}compite con tus amigos</Text>
        </View>
      )}

      <View style={styles.actions}>
        {/* Registro — botón principal grande */}
        <TouchableOpacity style={styles.primaryBtn} onPress={goRegister} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Crear cuenta gratis</Text>
          <Text style={styles.primaryBtnSub}>Nuevo por aquí · ¡Empieza ya!</Text>
        </TouchableOpacity>

        {/* Login — botón secundario */}
        <TouchableOpacity style={styles.secondaryBtn} onPress={goLogin} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>Ya tengo cuenta — Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  trophy: { fontSize: 72, marginBottom: 8 },
  title: { fontSize: 40, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // Invite banner
  inviteBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inviteEmoji: { fontSize: 32, marginBottom: 6 },
  inviteTitle: { fontSize: 17, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  inviteCode: {
    fontSize: 28, fontWeight: '900', color: Colors.gold,
    letterSpacing: 4, marginBottom: 8,
  },
  inviteHint: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 18 },

  // Tagline (no invite)
  tagline: { marginBottom: 32, alignItems: 'center' },
  taglineText: { fontSize: 20, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 28, fontWeight: '500' },

  // Buttons
  actions: { width: '100%', gap: 14 },

  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { fontSize: 20, fontWeight: '800', color: Colors.white },
  primaryBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3, fontWeight: '500' },

  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
