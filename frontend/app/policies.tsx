import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { SectionHead } from '@/src/components/SectionHead';
import { api } from '@/src/api';

type PrivacyNotice = {
  version: string;
  controller: string;
  purpose: string;
  data: string[];
  retention: string;
  rights: string;
};

export default function PoliciesScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyNotice | null>(null);

  useEffect(() => {
    Promise.all([api.policies(), api.privacyNotice()])
      .then(([policies, notice]) => {
        setItems(policies);
        setPrivacy(notice);
      })
      .catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.brand}>Políticas y privacidad</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
        <SectionHead eyebrow="Reserva y servicio" title="Reglas para una buena experiencia." />
        {items.map((policy, index) => (
          <View key={policy.id} style={styles.row}>
            <Text style={styles.num}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={[type.body, { flex: 1 }]}>{policy.content}</Text>
          </View>
        ))}

        <View style={styles.privacyCard}>
          <Text style={type.eyebrow}>AVISO DE PRIVACIDAD</Text>
          <Text style={[type.h3, { marginTop: spacing.md }]}>Cómo se utilizan tus datos.</Text>
          {privacy ? (
            <>
              <PrivacyRow label="Responsable" value={privacy.controller} />
              <PrivacyRow label="Finalidad" value={privacy.purpose} />
              <PrivacyRow label="Datos solicitados" value={privacy.data.join(', ')} />
              <PrivacyRow label="Conservación" value={privacy.retention} />
              <PrivacyRow label="Tus derechos" value={privacy.rights} />
              <Text style={[type.micro, { marginTop: spacing.lg, color: colors.inkSoft }]}>VERSIÓN {privacy.version}</Text>
            </>
          ) : (
            <Text style={[type.body, { marginTop: spacing.md }]}>No fue posible cargar el aviso en este momento. No envíes una reserva hasta poder revisarlo.</Text>
          )}
        </View>

        <Text style={[type.small, { marginTop: spacing.xl, color: colors.inkSoft }]}>
          Algunos detalles operativos, como tolerancia de retrasos y condiciones especiales para eventos, podrán confirmarse directamente antes de la cita.
        </Text>
      </ScrollView>
    </View>
  );
}

function PrivacyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.privacyLabel}>{label.toUpperCase()}</Text>
      <Text style={[type.body, { marginTop: spacing.xs }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  num: { fontFamily: fonts.serif, fontSize: 22, color: colors.bronze, width: 34 },
  privacyCard: { marginTop: spacing.xxl, padding: spacing.xl, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.lg, backgroundColor: colors.paperDeep },
  privacyLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: colors.bronze },
});
