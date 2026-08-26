import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { api } from '@/src/api';

export default function AdminLogin() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Ingresa correo y contraseña.'); return; }
    setLoading(true);
    try {
      await api.login(email.trim(), password);
      router.replace('/admin/dashboard');
    } catch (e: any) {
      setError('Credenciales inválidas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="admin-back-btn"><Feather name="arrow-left" size={22} color={colors.ink} /></Pressable>
        <Text style={styles.brand}>Panel</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: spacing.huge }}>
          <Text style={type.eyebrow}>ADMINISTRACIÓN</Text>
          <Text style={[type.h2, { marginTop: spacing.md }]}>Panel privado{'\n'}de Miguel Suárez.</Text>
          <Text style={[type.body, { marginTop: spacing.md }]}>
            Ingresa con el correo autorizado para editar servicios, zonas, preguntas y reseñas.
          </Text>
        </View>
        <View style={{ marginTop: spacing.xxl }}>
          <Text style={styles.label}>CORREO</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholderTextColor={colors.inkSoft}
            testID="admin-email-input"
          />
          <Text style={[styles.label, { marginTop: spacing.lg }]}>CONTRASEÑA</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              style={[styles.input, { paddingRight: 34 }]}
              placeholderTextColor={colors.inkSoft}
              testID="admin-password-input"
            />
            <Pressable onPress={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 0, top: 6, padding: 8 }} hitSlop={6}>
              <Feather name={showPwd ? 'eye-off' : 'eye'} size={16} color={colors.inkSoft} />
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PillButton
            label="Iniciar sesión"
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.xl }}
            fullWidth
            testID="admin-login-btn"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  label: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.6, color: colors.inkSoft, marginBottom: 6 },
  input: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, marginTop: spacing.md },
});
