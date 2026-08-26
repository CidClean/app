import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, type, fonts, radius } from '../theme';

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  testID?: string;
};

export function LocationPicker({ latitude, longitude, onChange, testID }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = async () => {
    setError(null);
    setBusy(true);
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Tu navegador no soporta geolocalización.');
        return;
      }
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { onChange(pos.coords.latitude, pos.coords.longitude); resolve(); },
          (err) => { setError('No se pudo obtener la ubicación en el navegador.'); reject(err); },
          { enableHighAccuracy: false, timeout: 8000 }
        );
      });
    } catch { /* handled above */ } finally { setBusy(false); }
  };

  const hasPin = latitude !== null && longitude !== null;
  const mapUrl = hasPin
    ? `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : null;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>UBICACIÓN EXACTA (OPCIONAL)</Text>
      <Text style={[type.small, { marginBottom: spacing.md }]}>
        En la app móvil puedes tocar el mapa para colocar un pin. Aquí en el navegador usa el botón de "usar mi ubicación".
      </Text>

      <View style={styles.mapBox}>
        {mapUrl ? (
          // @ts-ignore RN-Web renders iframe as HTMLIFrameElement
          <iframe src={mapUrl} style={{ width: '100%', height: '100%', border: 0 }} title="mapa" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Feather name="map-pin" size={24} color={colors.inkSoft} />
            <Text style={[type.small, { textAlign: 'center', paddingHorizontal: spacing.xl }]}>Aún no hay un pin marcado.</Text>
          </View>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={useMyLocation} style={styles.actionBtn} disabled={busy} testID="use-my-location-btn">
          {busy ? <ActivityIndicator size="small" color={colors.ink} /> : <Feather name="navigation" size={14} color={colors.ink} />}
          <Text style={styles.actionText}>USAR MI UBICACIÓN</Text>
        </Pressable>
        {hasPin && (
          <Pressable onPress={() => onChange(NaN, NaN)} style={styles.actionBtn}>
            <Feather name="x" size={14} color={colors.ink} />
            <Text style={styles.actionText}>QUITAR PIN</Text>
          </Pressable>
        )}
      </View>

      {hasPin && <Text style={[type.micro, { marginTop: spacing.sm, color: colors.bronze }]}>PIN: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}</Text>}
      {error ? <Text style={[type.small, { color: colors.danger, marginTop: spacing.xs }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  label: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.6, color: colors.inkSoft, marginBottom: 6 },
  mapBox: { height: 200, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperDeep },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center' },
  actionText: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 0.8, color: colors.ink },
});
