import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Detectar si ya está instalado como PWA
    if ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Android / Chrome: escuchar el evento de instalación
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (Platform.OS !== 'web' || installed) return null;

  async function handleAndroidInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowAndroidModal(true);
    }
  }

  function detectOS() {
    if (typeof navigator === 'undefined') return 'other';
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  }

  const os = detectOS();

  return (
    <>
      {/* Botón principal */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          if (os === 'ios') setShowIOSModal(true);
          else handleAndroidInstall();
        }}
      >
        <Text style={styles.btnIcon}>📲</Text>
        <View style={styles.btnTextWrap}>
          <Text style={styles.btnTitle}>Agregar a inicio</Text>
          <Text style={styles.btnSub}>Abre la app sin el navegador</Text>
        </View>
        <Text style={styles.btnArrow}>›</Text>
      </TouchableOpacity>

      {/* Modal iOS */}
      <Modal visible={showIOSModal} animationType="slide" transparent onRequestClose={() => setShowIOSModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📲 Agregar a pantalla de inicio</Text>
            <Text style={styles.modalSub}>Sigue estos pasos en Safari:</Text>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Toca el botón de compartir</Text>
                <Text style={styles.stepIcon}>⬆️</Text>
                <Text style={styles.stepHint}>(barra inferior del navegador)</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Desplázate y toca</Text>
                <Text style={styles.stepHighlight}>"Agregar a pantalla de inicio"</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Toca <Text style={styles.bold}>Agregar</Text> (arriba a la derecha)</Text>
              </View>
            </View>

            <View style={styles.resultPreview}>
              <Text style={styles.resultIcon}>🏆</Text>
              <Text style={styles.resultLabel}>Quiniela 2026</Text>
              <Text style={styles.resultSub}>aparecerá en tu pantalla de inicio</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowIOSModal(false)}>
              <Text style={styles.closeBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Android (si no hay prompt automático) */}
      <Modal visible={showAndroidModal} animationType="slide" transparent onRequestClose={() => setShowAndroidModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📲 Agregar a pantalla de inicio</Text>
            <Text style={styles.modalSub}>Sigue estos pasos en Chrome:</Text>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Toca el menú ⋮ (tres puntos arriba a la derecha)</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Toca</Text>
                <Text style={styles.stepHighlight}>"Agregar a pantalla de inicio"</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepText}>Toca <Text style={styles.bold}>Agregar</Text></Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAndroidModal(false)}>
              <Text style={styles.closeBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  btnIcon: { fontSize: 28 },
  btnTextWrap: { flex: 1 },
  btnTitle: { fontSize: 15, fontWeight: '700', color: Colors.white },
  btnSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  btnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)', fontWeight: '300' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  modalSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center' },

  step: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  stepBody: { flex: 1 },
  stepText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  stepIcon: { fontSize: 24, marginTop: 4 },
  stepHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  stepHighlight: {
    fontSize: 14, fontWeight: '700', color: Colors.primary,
    backgroundColor: Colors.primary + '15', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start',
  },
  bold: { fontWeight: '700' },

  resultPreview: {
    alignItems: 'center', backgroundColor: Colors.background,
    borderRadius: 16, padding: 16, marginVertical: 16,
  },
  resultIcon: { fontSize: 48, marginBottom: 8 },
  resultLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  resultSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  closeBtn: {
    height: 52, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
