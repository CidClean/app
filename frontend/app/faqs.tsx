import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type, fonts } from '@/src/theme';
import { SectionHead } from '@/src/components/SectionHead';
import { Accordion } from '@/src/components/Accordion';
import { api, Faq } from '@/src/api';

export default function FaqsScreen() {
  const insets = useSafeAreaInsets();
  const [faqs, setFaqs] = useState<Faq[]>([]);

  useEffect(() => { api.faqs().then(setFaqs).catch(() => {}); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="faqs-back-btn"><Feather name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text style={styles.brand}>Preguntas frecuentes</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        <SectionHead eyebrow="Antes de reservar" title="Todo lo que necesitas saber." />
        {faqs.map(f => (
          <Accordion key={f.id} q={f.question} a={f.answer} pending={f.pending_confirmation} testID={`faq-${f.id}`} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
});
