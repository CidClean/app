import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme';

export function SectionHead({ eyebrow, title, meta, style }: { eyebrow?: string; title: string; meta?: string; style?: any }) {
  return (
    <View style={[styles.wrap, style]}>
      {eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={styles.dash} />
          <Text style={[type.eyebrow, { color: colors.bronze }]}>{eyebrow}</Text>
        </View>
      ) : null}
      <Text style={[type.h2, styles.title]}>{title}</Text>
      {meta ? <Text style={[type.body, { marginTop: spacing.sm }]}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dash: { width: 22, height: 1, backgroundColor: colors.bronze },
  title: {},
});
