import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme';

export function Eyebrow({ children, color, testID }: { children: React.ReactNode; color?: string; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={[styles.dash, { backgroundColor: color || colors.bronze }]} />
      <Text style={[type.eyebrow, { color: color || colors.inkSoft }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dash: { width: 22, height: 1 },
});
