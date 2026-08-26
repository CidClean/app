import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, type } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Accordion({ q, a, pending, testID }: { q: string; a: string; pending?: boolean; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen(v => !v);
        }}
        style={styles.head}
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <Text style={styles.q}>{q}</Text>
        <Feather name={open ? 'minus' : 'plus'} size={18} color={colors.ink} />
      </Pressable>
      {open && (
        <View style={styles.body}>
          {pending && (
            <Text style={styles.pending}>PENDIENTE DE CONFIRMACIÓN</Text>
          )}
          <Text style={type.body}>{a}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: colors.line },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  q: { ...type.bodyStrong, flex: 1 },
  body: { paddingBottom: spacing.lg, gap: spacing.sm },
  pending: {
    ...type.micro,
    color: colors.bronze,
    letterSpacing: 1.4,
  },
});
