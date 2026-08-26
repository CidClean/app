import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

import { colors, spacing, type, fonts, radius } from '../theme';

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  testID?: string;
};

// Default center: Torreón, Coahuila
const TORREON = { latitude: 25.5428, longitude: -103.4068 };

export function LocationPicker({ latitude, longitude, onChange, testID }: Props) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'canAskAgain'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status: s, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (s === 'granted') setStatus('granted');
      else if (canAskAgain) setStatus('canAskAgain');
      else setStatus('denied');
    })();
  }, []);

  const useMyLocation = async () => {
    setError(null);
    setBusy(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (perm.canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') {
            if (!req.canAskAgain) setStatus('denied');
            else setStatus('canAskAgain');
            setError('Necesitamos tu permiso de ubicación para colocar el pin automáticamente.');
            return;
          }
        } else {
          setStatus('denied');
          setError('Ve a Ajustes para habilitar la ubicación.');
          return;
        }
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange(loc.coords.latitude, loc.coords.longitude);
      setStatus('granted');
    } catch (e: any) {
      setError('No se pudo obtener tu ubicación. Puedes tocar el mapa para colocar el pin manualmente.');
    } finally {
      setBusy(false);
    }
  };

  const hasPin = latitude !== null && longitude !== null;
  const region = {
    latitude: latitude ?? TORREON.latitude,
    longitude: longitude ?? TORREON.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>UBICACIÓN EXACTA (OPCIONAL)</Text>
      <Text style={[type.small, { marginBottom: spacing.md }]}>
        Usa tu ubicación actual o toca el mapa para colocar un pin. Ayuda a Miguel a llegar sin confusiones.
      </Text>

      {MapView ? (
        <View style={styles.mapBox}>
          <MapView
            style={{ flex: 1 }}
            region={region}
            onPress={(e: any) => {
              const { latitude: la, longitude: lo } = e.nativeEvent.coordinate;
              onChange(la, lo);
            }}
            showsUserLocation={status === 'granted'}
            testID="booking-map"
          >
            {hasPin && <Marker coordinate={{ latitude: latitude!, longitude: longitude! }} pinColor={colors.bronze} />}
          </MapView>
        </View>
      ) : (
        <View style={[styles.mapBox, { alignItems: 'center', justifyContent: 'center', gap: spacing.sm }]}>
          <Feather name="map-pin" size={24} color={colors.inkSoft} />
          <Text style={[type.small, { textAlign: 'center', paddingHorizontal: spacing.xl }]}>
            Mapa no disponible.
          </Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable onPress={useMyLocation} style={styles.actionBtn} disabled={busy} testID="use-my-location-btn">
          {busy ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Feather name="navigation" size={14} color={colors.ink} />
          )}
          <Text style={styles.actionText}>USAR MI UBICACIÓN</Text>
        </Pressable>
        {hasPin && (
          <Pressable onPress={() => onChange(NaN, NaN)} style={styles.actionBtn}>
            <Feather name="x" size={14} color={colors.ink} />
            <Text style={styles.actionText}>QUITAR PIN</Text>
          </Pressable>
        )}
      </View>

      {hasPin && (
        <Text style={[type.micro, { marginTop: spacing.sm, color: colors.bronze }]}>
          PIN: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </Text>
      )}
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
