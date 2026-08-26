import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'ghost';

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  style,
  testID,
  loading,
  disabled,
  fullWidth,
  invert,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  style?: ViewStyle;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  invert?: boolean;
}) {
  let bg =
    variant === 'primary' ? colors.ink :
    variant === 'whatsapp' ? colors.whatsapp :
    variant === 'ghost' ? 'transparent' :
    'transparent';
  let border =
    variant === 'secondary' ? colors.ink :
    variant === 'ghost' ? colors.line :
    bg;
  let fg =
    variant === 'primary' || variant === 'whatsapp' ? colors.white :
    colors.ink;
  if (invert) {
    // Inverted primary: paper background, ink text (for use on dark backgrounds)
    bg = colors.paper;
    border = colors.paper;
    fg = colors.ink;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: (disabled || loading) ? 0.55 : pressed ? 0.85 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[type.button, { color: fg }]} numberOfLines={1}>{label.toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
