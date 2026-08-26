import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, BookingStatus } from '@/src/api';
import { colors, spacing, type, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { AdminMenu } from '@/src/components/AdminMenu';

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_confirmation: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
};

type Booking = {
  id: string;
  service_name: string;
  service_price: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  note?: string;
  status: BookingStatus;
  latitude?: number | null;
  longitude?: number | null;
};

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('52')) return digits;
  return digits.length === 10 ? `52${digits}` : digits;
}

async function openCustomerWhatsApp(booking: Booking) {
  const message = [
    `Hola, ${booking.name}. Soy Miguel Suárez.`,
    `Recibí tu solicitud para ${booking.service_name} el ${booking.date} a las ${booking.time}.`,
    `Dirección: ${booking.address}, ${booking.neighborhood}.`,
    '¿Me confirmas que los datos son correctos para dejar la cita confirmada?',
  ].join(' ');
  const url = `https://wa.me/${whatsappNumber(booking.phone)}?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}

export default function ReservationsAdmin() {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      await api.me();
      const data = await api.adminBookings();
      setBookings(data);
    } catch (err: any) {
      if ((err?.message || '').toLowerCase().includes('autoriz')) {
        router.replace('/admin/login');
        return;
      }
      setError(err?.message || 'No se pudieron cargar las reservas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => {
    return [...bookings].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [bookings]);

  const changeStatus = async (booking: Booking, status: BookingStatus) => {
    setBusyId(booking.id);
    setError(null);
    try {
      await api.adminUpdateBookingStatus(booking.id, status);
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar la reserva.');
    } finally {
      setBusyId(null);
    }
  };

  const contactCustomer = async (booking: Booking) => {
    setError(null);
    try {
      await openCustomerWhatsApp(booking);
    } catch {
      setError('No se pudo abrir WhatsApp para este número.');
    }
  };

  const startReschedule = (booking: Booking) => {
    setRescheduling(booking.id);
    setNewDate(booking.date);
    setNewTime(booking.time);
    setError(null);
  };

  const submitReschedule = async (booking: Booking) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{2}:\d{2}$/.test(newTime)) {
      setError('Usa fecha AAAA-MM-DD y hora HH:MM.');
      return;
    }
    setBusyId(booking.id);
    try {
      await api.adminRescheduleBooking(booking.id, newDate, newTime);
      setRescheduling(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo reprogramar la reserva.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <AdminMenu current="reservas" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reservas</Text>
          <Text style={styles.subtitle}>WhatsApp, confirmación y seguimiento</Text>
        </View>
        <Pressable onPress={() => { setRefreshing(true); load(); }} style={styles.iconButton} accessibilityLabel="Actualizar reservas">
          <Feather name="refresh-cw" size={18} color={colors.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /><Text style={type.body}>Cargando reservas…</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={styles.infoBox}>
            <Text style={type.bodyStrong}>Cómo confirmar una reserva</Text>
            <Text style={[type.small, { marginTop: 4, color: colors.inkSoft }]}>
              Una solicitud pendiente ya aparta el horario. Abre WhatsApp, confirma los datos con el cliente y después pulsa Confirmar. Cancelar libera el horario inmediatamente.
            </Text>
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {ordered.length === 0 ? (
            <View style={styles.empty}><Text style={type.body}>No hay reservas registradas.</Text></View>
          ) : ordered.map(booking => {
            const busy = busyId === booking.id;
            const active = booking.status === 'pending_confirmation' || booking.status === 'confirmed';
            return (
              <View key={booking.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.bodyStrong}>{booking.service_name}</Text>
                    <Text style={[type.small, { marginTop: 3 }]}>{booking.date} · {booking.time} · ${booking.service_price} MXN</Text>
                  </View>
                  <View style={[styles.status, booking.status === 'confirmed' && styles.statusConfirmed]}>
                    <Text style={styles.statusText}>{STATUS_LABELS[booking.status] || booking.status}</Text>
                  </View>
                </View>

                <View style={styles.divider} />
                <Text style={type.bodyStrong}>{booking.name}</Text>
                <Text style={[type.small, { marginTop: 4 }]}>{booking.phone}</Text>
                <Text style={[type.small, { marginTop: 4 }]}>{booking.address}, {booking.neighborhood}</Text>
                {booking.note ? <Text style={[type.small, styles.note]}>“{booking.note}”</Text> : null}

                {booking.status === 'pending_confirmation' ? (
                  <Text style={[type.micro, { marginTop: spacing.md, color: colors.bronze }]}>HORARIO APARTADO MIENTRAS ESPERA CONFIRMACIÓN</Text>
                ) : null}

                {rescheduling === booking.id ? (
                  <View style={styles.rescheduleBox}>
                    <Text style={type.bodyStrong}>Nueva fecha y hora</Text>
                    <TextInput value={newDate} onChangeText={setNewDate} placeholder="AAAA-MM-DD" style={styles.input} autoCapitalize="none" />
                    <TextInput value={newTime} onChangeText={setNewTime} placeholder="HH:MM" style={styles.input} autoCapitalize="none" />
                    <View style={styles.actions}>
                      <PillButton label="Cancelar" variant="secondary" onPress={() => setRescheduling(null)} />
                      <PillButton label={busy ? 'Guardando…' : 'Reprogramar'} disabled={busy} onPress={() => submitReschedule(booking)} />
                    </View>
                  </View>
                ) : null}

                {booking.status === 'pending_confirmation' ? (
                  <View style={styles.actions}>
                    <PillButton label="Abrir WhatsApp" variant="whatsapp" disabled={busy} onPress={() => contactCustomer(booking)} />
                    <PillButton label={busy ? 'Actualizando…' : 'Confirmar'} disabled={busy} onPress={() => changeStatus(booking, 'confirmed')} />
                    <PillButton label="Reprogramar" variant="secondary" disabled={busy} onPress={() => startReschedule(booking)} />
                    <Pressable disabled={busy} onPress={() => changeStatus(booking, 'cancelled')} style={styles.textAction}>
                      <Text style={styles.cancelText}>CANCELAR</Text>
                    </Pressable>
                  </View>
                ) : null}

                {booking.status === 'confirmed' ? (
                  <View style={styles.actions}>
                    <PillButton label="WhatsApp" variant="whatsapp" disabled={busy} onPress={() => contactCustomer(booking)} />
                    <PillButton label={busy ? 'Actualizando…' : 'Completar'} disabled={busy} onPress={() => changeStatus(booking, 'completed')} />
                    <PillButton label="Reprogramar" variant="secondary" disabled={busy} onPress={() => startReschedule(booking)} />
                    <Pressable disabled={busy} onPress={() => changeStatus(booking, 'no_show')} style={styles.textAction}>
                      <Text style={styles.cancelText}>NO SE PRESENTÓ</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => changeStatus(booking, 'cancelled')} style={styles.textAction}>
                      <Text style={styles.cancelText}>CANCELAR</Text>
                    </Pressable>
                  </View>
                ) : null}

                {!active ? <Text style={[type.micro, { marginTop: spacing.md, color: colors.inkSoft }]}>RESERVA CERRADA</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 86, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { ...type.h3, color: colors.ink },
  subtitle: { ...type.micro, color: colors.inkSoft, marginTop: 2 },
  iconButton: { width: 42, height: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  infoBox: { padding: spacing.lg, borderWidth: 1, borderColor: colors.bronze, borderRadius: radius.lg, marginBottom: spacing.md },
  empty: { padding: spacing.xl, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  errorBox: { padding: spacing.md, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, marginBottom: spacing.md },
  errorText: { ...type.small, color: colors.danger },
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, marginBottom: spacing.md, backgroundColor: colors.paper },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  status: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusConfirmed: { borderColor: colors.bronze },
  statusText: { ...type.micro, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  note: { marginTop: spacing.sm, fontStyle: 'italic', color: colors.inkSoft },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  textAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  cancelText: { ...type.button, color: colors.danger },
  rescheduleBox: { marginTop: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: spacing.sm, color: colors.ink },
});
