import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/src/api';
import { colors, spacing, type, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type DayConfig = {
  enabled: boolean;
  open_time: string;
  close_time: string;
};

type WeeklySchedule = Record<string, DayConfig>;

function defaultSchedule(): WeeklySchedule {
  return Object.fromEntries(
    DAY_NAMES.map((_, day) => [
      String(day),
      { enabled: day === 0, open_time: '11:00', close_time: '18:00' },
    ])
  );
}

function normalizeSettings(data: any) {
  if (data?.weekly_schedule) {
    return {
      weekly_schedule: data.weekly_schedule as WeeklySchedule,
      min_notice_minutes: Number(data.min_notice_minutes ?? 60),
      slot_step_minutes: Number(data.slot_step_minutes ?? 15),
    };
  }

  const schedule = defaultSchedule();
  const enabled = new Set<number>(data?.open_days || [0]);
  for (let day = 0; day < 7; day++) {
    schedule[String(day)] = {
      enabled: enabled.has(day),
      open_time: `${String(data?.open_hour ?? 11).padStart(2, '0')}:00`,
      close_time: `${String(data?.close_hour ?? 18).padStart(2, '0')}:00`,
    };
  }
  return {
    weekly_schedule: schedule,
    min_notice_minutes: Number(data?.min_notice_minutes ?? 60),
    slot_step_minutes: Number(data?.slot_step_minutes ?? 15),
  };
}

export default function ScheduleAdmin() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await api.me();
        const data = await api.bookingSettings();
        setSettings(normalizeSettings(data));
      } catch (err: any) {
        if ((err?.message || '').toLowerCase().includes('autoriz')) {
          router.replace('/admin/login');
          return;
        }
        setError(err?.message || 'No se pudo cargar la agenda.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enabledCount = useMemo(() => {
    if (!settings) return 0;
    return Object.values(settings.weekly_schedule as WeeklySchedule).filter(day => day.enabled).length;
  }, [settings]);

  const updateDay = (day: number, patch: Partial<DayConfig>) => {
    if (!settings) return;
    const key = String(day);
    setSettings({
      ...settings,
      weekly_schedule: {
        ...settings.weekly_schedule,
        [key]: { ...settings.weekly_schedule[key], ...patch },
      },
    });
    setMessage(null);
    setError(null);
  };

  const save = async () => {
    if (!settings) return;
    setMessage(null);
    setError(null);

    if (enabledCount === 0) {
      setError('Activa al menos un día para recibir reservas.');
      return;
    }

    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (let day = 0; day < 7; day++) {
      const config: DayConfig = settings.weekly_schedule[String(day)];
      if (!timePattern.test(config.open_time) || !timePattern.test(config.close_time)) {
        setError(`Revisa el horario de ${DAY_NAMES[day]}. Usa formato HH:MM.`);
        return;
      }
      if (config.enabled && config.open_time >= config.close_time) {
        setError(`En ${DAY_NAMES[day]}, el cierre debe ser posterior a la apertura.`);
        return;
      }
    }

    setSaving(true);
    try {
      const result = await api.adminUpdateBookingSettings({
        weekly_schedule: settings.weekly_schedule,
        min_notice_minutes: Number(settings.min_notice_minutes) || 0,
        slot_step_minutes: Number(settings.slot_step_minutes) || 15,
      });
      setSettings(normalizeSettings(result));
      setMessage('Agenda semanal actualizada.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la agenda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.replace('/admin/reservas')} style={styles.iconButton} accessibilityLabel="Volver a reservas">
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Horarios</Text>
          <Text style={styles.subtitle}>Agenda independiente por día</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={type.body}>Cargando agenda…</Text>
        </View>
      ) : settings ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.h3}>Disponibilidad semanal</Text>
          <Text style={[type.body, styles.help]}>
            Activa los días que Miguel quiera ofrecer automáticamente y define una apertura y cierre diferentes para cada uno.
          </Text>

          {DAY_NAMES.map((name, day) => {
            const config: DayConfig = settings.weekly_schedule[String(day)];
            return (
              <View key={name} style={[styles.dayCard, config.enabled && styles.dayCardActive]}>
                <View style={styles.dayHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.bodyStrong}>{name}</Text>
                    <Text style={[type.small, { marginTop: 3, color: colors.inkSoft }]}>
                      {config.enabled ? `${config.open_time} – ${config.close_time}` : 'No disponible para reservas'}
                    </Text>
                  </View>
                  <Switch value={config.enabled} onValueChange={enabled => updateDay(day, { enabled })} />
                </View>

                {config.enabled ? (
                  <View style={styles.timeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>APERTURA</Text>
                      <TextInput
                        value={config.open_time}
                        onChangeText={open_time => updateDay(day, { open_time })}
                        placeholder="09:00"
                        autoCapitalize="none"
                        inputMode="text"
                        style={styles.input}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>CIERRE</Text>
                      <TextInput
                        value={config.close_time}
                        onChangeText={close_time => updateDay(day, { close_time })}
                        placeholder="17:00"
                        autoCapitalize="none"
                        inputMode="text"
                        style={styles.input}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.optionsCard}>
            <Text style={type.bodyStrong}>Reglas generales</Text>
            <Text style={[type.small, styles.optionHelp]}>Estas reglas se aplican a todos los días activos.</Text>
            <Text style={styles.label}>AVISO MÍNIMO EN MINUTOS</Text>
            <TextInput
              value={String(settings.min_notice_minutes)}
              onChangeText={value => setSettings({ ...settings, min_notice_minutes: value })}
              keyboardType="number-pad"
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: spacing.md }]}>INTERVALO ENTRE INICIOS EN MINUTOS</Text>
            <TextInput
              value={String(settings.slot_step_minutes)}
              onChangeText={value => setSettings({ ...settings, slot_step_minutes: value })}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {message ? <View style={styles.successBox}><Text style={styles.successText}>{message}</Text></View> : null}

          <PillButton
            label={saving ? 'Guardando…' : 'Guardar agenda semanal'}
            disabled={saving}
            onPress={save}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      ) : (
        <View style={styles.center}><Text style={type.body}>{error || 'No se pudo cargar la agenda.'}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 86,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { ...type.h3, color: colors.ink },
  subtitle: { ...type.micro, color: colors.inkSoft, marginTop: 2 },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.lg, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  help: { marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.inkSoft },
  dayCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.paper,
  },
  dayCardActive: { borderColor: colors.bronze },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  label: { ...type.micro, color: colors.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  optionsCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  optionHelp: { marginTop: 4, marginBottom: spacing.lg, color: colors.inkSoft },
  errorBox: { marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md },
  errorText: { ...type.small, color: colors.danger },
  successBox: { marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.bronze, borderRadius: radius.md },
  successText: { ...type.small, color: colors.ink },
});
