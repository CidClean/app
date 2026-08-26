import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type, fonts } from '@/src/theme';
import { SectionHead } from '@/src/components/SectionHead';
import { api } from '@/src/api';

export default function PoliciesScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { api.policies().then(setItems).catch(() => {}); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Feather name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text style={styles.brand}>Políticas</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        <SectionHead eyebrow="Reserva y servicio" title="Reglas para una buena experiencia." />
        {items.map((p, i) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[type.body, { flex: 1 }]}>{p.content}</Text>
          </View>
        ))}
        <Text style={[type.small, { marginTop: spacing.xl, color: colors.inkSoft }]}>
          Datos pendientes de definición: margen de tolerancia para retrasos, plazo recomendado para cancelar, definición de retraso relevante, condiciones especiales para menores/hoteles/eventos. Miguel podrá editar estos textos desde el panel administrativo.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  num: { fontFamily: fonts.serif, fontSize: 22, color: colors.bronze, width: 34 },
});
