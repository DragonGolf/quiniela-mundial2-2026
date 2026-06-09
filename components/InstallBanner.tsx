import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';

const DISMISS_KEY = 'installBannerDismissed_v1';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [hidden, setHidden] = useState(true);
  const [showIOS, setShowIOS] = useState(false);
  const [showAndroid, setShowAndroid] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Ya instalada como PWA → no mostrar
    if ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches) return;
    // Descartada antes
    try { if (window.localStorage.getItem(DISMISS_KEY)) return; } catch { /* ignore */ }

    setHidden(false);

    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setHidden(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (Platform.OS !== 'web' || hidden) return null;

  function detectOS(): 'ios' | 'android' | 'desktop' {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  }

  async function handleInstall() {
    const os = detectOS();
    if (os === 'ios') { setShowIOS(true); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setHidden(true);
      setDeferredPrompt(null);
    } else {
      setShowAndroid(true);
    }
  }

  function dismiss() {
    setHidden(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  return (
    <>
      <View style={styles.banner}>
        <Text style={styles.icon}>📲</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Instala la app en tu teléfono</Text>
          <Text style={styles.sub}>Ábrela como app desde tu pantalla de inicio</Text>
        </View>
        <TouchableOpacity style={styles.installBtn} onPress={handleInstall}>
          <Text style={styles.installBtnText}>Instalar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* iOS */}
      <Modal visible={showIOS} animationType="slide" transparent onRequestClose={() => setShowIOS(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.sheetTitle}>📲 Agregar a pantalla de inicio</Text>
              <Text style={styles.sheetSub}>En Safari, sigue estos pasos:</Text>
              <Step n="1" text="Toca el botón de compartir ⬆️ (barra inferior)" />
              <Step n="2" text="Desplázate y toca «Agregar a pantalla de inicio»" />
              <Step n="3" text="Toca «Agregar» (arriba a la derecha)" />
              <View style={styles.preview}>
                <Text style={{ fontSize: 40 }}>🏆</Text>
                <Text style={styles.previewLabel}>Quiniela 2026</Text>
                <Text style={styles.previewSub}>aparecerá en tu inicio</Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.okBtn} onPress={() => setShowIOS(false)}>
              <Text style={styles.okBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Android (sin prompt automático) */}
      <Modal visible={showAndroid} animationType="slide" transparent onRequestClose={() => setShowAndroid(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>📲 Agregar a pantalla de inicio</Text>
            <Text style={styles.sheetSub}>En Chrome, sigue estos pasos:</Text>
            <Step n="1" text="Toca el menú ⋮ (arriba a la derecha)" />
            <Step n="2" text="Toca «Agregar a pantalla de inicio» / «Instalar app»" />
            <Step n="3" text="Confirma con «Agregar»" />
            <TouchableOpacity style={styles.okBtn} onPress={() => setShowAndroid(false)}>
              <Text style={styles.okBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10,
  },
  icon: { fontSize: 26 },
  title: { fontSize: 13, fontWeight: '800', color: Colors.white },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  installBtn: { backgroundColor: Colors.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  installBtnText: { fontSize: 13, fontWeight: '800', color: Colors.white },
  closeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 32, maxHeight: '80%' },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 18 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  preview: { alignItems: 'center', backgroundColor: Colors.background, borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 6 },
  previewLabel: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 4 },
  previewSub: { fontSize: 12, color: Colors.textSecondary },
  okBtn: { height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  okBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
