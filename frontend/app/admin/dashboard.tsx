import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, Switch, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { api, Service, Zone, Faq, Testimonial, Media, absoluteMediaUrl } from '@/src/api';

type Tab = 'inicio' | 'servicios' | 'zonas' | 'faqs' | 'resenas' | 'fotos' | 'ajustes' | 'cuenta';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('inicio');
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await api.me();
        const em = await api.getStoredEmail();
        setEmail(em);
        setReady(true);
      } catch {
        router.replace('/admin/login');
      }
    })();
  }, []);

  const logout = async () => {
    await api.logout();
    router.replace('/admin/login');
  };

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Panel</Text>
          <Text style={styles.brandSub}>{email}</Text>
        </View>
        <Pressable onPress={logout} testID="admin-logout-btn" style={styles.logoutBtn}>
          <Feather name="log-out" size={16} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {(['inicio','servicios','zonas','faqs','resenas','fotos','ajustes','cuenta'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabChip, tab === t && styles.tabChipActive]} testID={`tab-${t}`}>
            <Text style={[styles.tabText, tab === t && { color: colors.paper }]}>{labelFor(t)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flex: 1 }}>
        {tab === 'inicio' && <HomeTab />}
        {tab === 'servicios' && <ServicesTab />}
        {tab === 'zonas' && <ZonesTab />}
        {tab === 'faqs' && <FaqsTab />}
        {tab === 'resenas' && <TestimonialsTab />}
        {tab === 'fotos' && <MediaTab />}
        {tab === 'ajustes' && <SettingsTab />}
        {tab === 'cuenta' && <AccountTab />}
      </View>
    </View>
  );
}

function labelFor(t: Tab) {
  const m: any = { inicio: 'Inicio', servicios: 'Servicios', zonas: 'Zonas', faqs: 'Preguntas', resenas: 'Reseñas', fotos: 'Fotos', ajustes: 'Ajustes', cuenta: 'Cuenta' };
  return m[t];
}

function HomeTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setBookings(await api.adminBookings()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <SectionHead eyebrow="Resumen" title="Próximas reservas" />
      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.body]}>Aún no hay reservas registradas.</Text>
        </View>
      ) : bookings.map(b => (
        <View key={b.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.bodyStrong}>{b.service_name}</Text>
            <Text style={[type.micro, { color: colors.bronze }]}>{b.status.toUpperCase()}</Text>
          </View>
          <Text style={[type.small, { marginTop: 4 }]}>{b.date} · {b.time} · ${b.service_price} MXN</Text>
          <Text style={[type.small, { marginTop: 4 }]}>{b.name} · {b.phone}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>{b.address}, {b.neighborhood}</Text>
          {b.note ? <Text style={[type.small, { marginTop: 6, fontStyle: 'italic' }]}>&ldquo;{b.note}&rdquo;</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function ServicesTab() {
  const [items, setItems] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const load = async () => { try { const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/services?all=true`); setItems(await r.json()); } catch {} };
  useEffect(() => { load(); }, []);

  const save = async (data: any, id?: string) => {
    try {
      if (id) await api.adminUpdateService(id, data); else await api.adminCreateService(data);
      setEditing(null); setCreating(false);
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const remove = async (id: string) => {
    try { await api.adminDeleteService(id); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Catálogo" title="Servicios y precios" />
      {items.map(s => (
        <View key={s.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.bodyStrong}>{s.name}</Text>
            <Text style={[type.micro, { color: s.active ? colors.bronze : colors.inkSoft }]}>{s.active ? 'ACTIVO' : 'OCULTO'}</Text>
          </View>
          <Text style={[type.small, { marginTop: 4 }]}>${s.price} MXN · {s.duration_minutes} min · buffer {s.buffer_minutes} min</Text>
          <View style={styles.rowBtns}>
            <PillButton label="Editar" variant="secondary" onPress={() => setEditing(s)} testID={`edit-svc-${s.slug}`} />
            <Pressable onPress={() => remove(s.id)}><Text style={[type.button, { color: colors.danger }]}>ELIMINAR</Text></Pressable>
          </View>
        </View>
      ))}
      <PillButton label="Añadir servicio" onPress={() => setCreating(true)} style={{ marginTop: spacing.lg }} testID="add-svc-btn" />

      {(editing || creating) && (
        <ServiceForm
          initial={editing || undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSave={(data) => save(data, editing?.id)}
        />
      )}
    </ScrollView>
  );
}

function ServiceForm({ initial, onCancel, onSave }: any) {
  const [f, setF] = useState({
    name: initial?.name || '',
    short_description: initial?.short_description || '',
    full_description: initial?.full_description || '',
    price: String(initial?.price || 0),
    duration_minutes: String(initial?.duration_minutes || 40),
    buffer_minutes: String(initial?.buffer_minutes || 20),
    active: initial?.active ?? true,
    display_order: String(initial?.display_order || 0),
  });
  return (
    <View style={styles.form}>
      <Text style={[type.eyebrow, { marginBottom: spacing.md }]}>{initial ? 'EDITAR SERVICIO' : 'NUEVO SERVICIO'}</Text>
      <FormField label="Nombre" value={f.name} onChange={v => setF({ ...f, name: v })} />
      <FormField label="Descripción corta" value={f.short_description} onChange={v => setF({ ...f, short_description: v })} />
      <FormField label="Descripción completa" value={f.full_description} onChange={v => setF({ ...f, full_description: v })} multiline />
      <FormField label="Precio (MXN)" value={f.price} onChange={v => setF({ ...f, price: v })} keyboardType="number-pad" />
      <FormField label="Duración (min)" value={f.duration_minutes} onChange={v => setF({ ...f, duration_minutes: v })} keyboardType="number-pad" />
      <FormField label="Buffer (min)" value={f.buffer_minutes} onChange={v => setF({ ...f, buffer_minutes: v })} keyboardType="number-pad" />
      <FormField label="Orden" value={f.display_order} onChange={v => setF({ ...f, display_order: v })} keyboardType="number-pad" />
      <View style={styles.switchRow}>
        <Text style={type.bodyStrong}>Activo</Text>
        <Switch value={f.active} onValueChange={v => setF({ ...f, active: v })} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <PillButton label="Cancelar" variant="secondary" onPress={onCancel} />
        <PillButton label="Guardar" onPress={() => onSave({
          name: f.name,
          short_description: f.short_description,
          full_description: f.full_description,
          price: parseInt(f.price) || 0,
          duration_minutes: parseInt(f.duration_minutes) || 40,
          buffer_minutes: parseInt(f.buffer_minutes) || 20,
          active: f.active,
          display_order: parseInt(f.display_order) || 0,
        })} style={{ flex: 1 }} testID="save-svc-btn" />
      </View>
    </View>
  );
}

function ZonesTab() {
  const [items, setItems] = useState<Zone[]>([]);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [creating, setCreating] = useState(false);
  const load = async () => { try { const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/zones?all=true`); setItems(await r.json()); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async (d: any, id?: string) => { try { if (id) await api.adminUpdateZone(id, d); else await api.adminCreateZone(d); setEditing(null); setCreating(false); await load(); } catch (e: any) { alert(e.message); } };
  const remove = async (id: string) => { try { await api.adminDeleteZone(id); await load(); } catch (e: any) { alert(e.message); } };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Zonas" title="Colonias y recargos" />
      {items.map(z => (
        <View key={z.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.bodyStrong}>{z.neighborhood}</Text>
            <Text style={[type.micro, { color: z.featured ? colors.bronze : colors.inkSoft }]}>{z.featured ? 'DESTACADA' : 'REGULAR'}</Text>
          </View>
          <Text style={[type.small, { marginTop: 4 }]}>Recargo: {z.surcharge_amount ? `$${z.surcharge_amount} MXN` : 'Confirmar por WhatsApp'}</Text>
          <View style={styles.rowBtns}>
            <PillButton label="Editar" variant="secondary" onPress={() => setEditing(z)} />
            <Pressable onPress={() => remove(z.id)}><Text style={[type.button, { color: colors.danger }]}>ELIMINAR</Text></Pressable>
          </View>
        </View>
      ))}
      <PillButton label="Añadir zona" onPress={() => setCreating(true)} style={{ marginTop: spacing.lg }} />
      {(editing || creating) && (
        <ZoneForm initial={editing || undefined} onCancel={() => { setEditing(null); setCreating(false); }} onSave={(d) => save(d, editing?.id)} />
      )}
    </ScrollView>
  );
}

function ZoneForm({ initial, onCancel, onSave }: any) {
  const [f, setF] = useState({
    neighborhood: initial?.neighborhood || '',
    featured: initial?.featured ?? false,
    surcharge_amount: initial?.surcharge_amount ? String(initial.surcharge_amount) : '',
    message: initial?.message || '',
    active: initial?.active ?? true,
    display_order: String(initial?.display_order || 0),
  });
  return (
    <View style={styles.form}>
      <Text style={[type.eyebrow, { marginBottom: spacing.md }]}>{initial ? 'EDITAR ZONA' : 'NUEVA ZONA'}</Text>
      <FormField label="Colonia" value={f.neighborhood} onChange={v => setF({ ...f, neighborhood: v })} />
      <FormField label="Recargo (MXN, opcional)" value={f.surcharge_amount} onChange={v => setF({ ...f, surcharge_amount: v })} keyboardType="number-pad" />
      <FormField label="Mensaje" value={f.message} onChange={v => setF({ ...f, message: v })} multiline />
      <FormField label="Orden" value={f.display_order} onChange={v => setF({ ...f, display_order: v })} keyboardType="number-pad" />
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Destacada</Text><Switch value={f.featured} onValueChange={v => setF({ ...f, featured: v })} /></View>
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Activa</Text><Switch value={f.active} onValueChange={v => setF({ ...f, active: v })} /></View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <PillButton label="Cancelar" variant="secondary" onPress={onCancel} />
        <PillButton label="Guardar" onPress={() => onSave({
          neighborhood: f.neighborhood,
          featured: f.featured,
          surcharge_amount: f.surcharge_amount ? parseInt(f.surcharge_amount) : null,
          surcharge_status: f.surcharge_amount ? 'fixed' : 'confirm_by_whatsapp',
          message: f.message,
          active: f.active,
          display_order: parseInt(f.display_order) || 0,
        })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function FaqsTab() {
  const [items, setItems] = useState<Faq[]>([]);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [creating, setCreating] = useState(false);
  const load = async () => { try { const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/faqs?all=true`); setItems(await r.json()); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async (d: any, id?: string) => { try { if (id) await api.adminUpdateFaq(id, d); else await api.adminCreateFaq(d); setEditing(null); setCreating(false); await load(); } catch (e: any) { alert(e.message); } };
  const remove = async (id: string) => { try { await api.adminDeleteFaq(id); await load(); } catch (e: any) { alert(e.message); } };
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="FAQ" title="Preguntas frecuentes" />
      {items.map(f => (
        <View key={f.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[type.bodyStrong, { flex: 1 }]}>{f.question}</Text>
            {f.pending_confirmation ? <Text style={[type.micro, { color: colors.bronze }]}>PENDIENTE</Text> : null}
          </View>
          <Text style={[type.small, { marginTop: 6 }]} numberOfLines={2}>{f.answer}</Text>
          <View style={styles.rowBtns}>
            <PillButton label="Editar" variant="secondary" onPress={() => setEditing(f)} />
            <Pressable onPress={() => remove(f.id)}><Text style={[type.button, { color: colors.danger }]}>ELIMINAR</Text></Pressable>
          </View>
        </View>
      ))}
      <PillButton label="Añadir pregunta" onPress={() => setCreating(true)} style={{ marginTop: spacing.lg }} />
      {(editing || creating) && (
        <FaqForm initial={editing || undefined} onCancel={() => { setEditing(null); setCreating(false); }} onSave={(d) => save(d, editing?.id)} />
      )}
    </ScrollView>
  );
}

function FaqForm({ initial, onCancel, onSave }: any) {
  const [f, setF] = useState({
    question: initial?.question || '',
    answer: initial?.answer || '',
    category: initial?.category || 'general',
    pending_confirmation: initial?.pending_confirmation ?? false,
    active: initial?.active ?? true,
    display_order: String(initial?.display_order || 0),
  });
  return (
    <View style={styles.form}>
      <Text style={[type.eyebrow, { marginBottom: spacing.md }]}>{initial ? 'EDITAR PREGUNTA' : 'NUEVA PREGUNTA'}</Text>
      <FormField label="Pregunta" value={f.question} onChange={v => setF({ ...f, question: v })} />
      <FormField label="Respuesta" value={f.answer} onChange={v => setF({ ...f, answer: v })} multiline />
      <FormField label="Categoría" value={f.category} onChange={v => setF({ ...f, category: v })} />
      <FormField label="Orden" value={f.display_order} onChange={v => setF({ ...f, display_order: v })} keyboardType="number-pad" />
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Pendiente de confirmación</Text><Switch value={f.pending_confirmation} onValueChange={v => setF({ ...f, pending_confirmation: v })} /></View>
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Activa</Text><Switch value={f.active} onValueChange={v => setF({ ...f, active: v })} /></View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <PillButton label="Cancelar" variant="secondary" onPress={onCancel} />
        <PillButton label="Guardar" onPress={() => onSave({
          question: f.question, answer: f.answer, category: f.category,
          pending_confirmation: f.pending_confirmation, active: f.active,
          display_order: parseInt(f.display_order) || 0,
        })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function TestimonialsTab() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const load = async () => { try { setItems(await api.adminListTestimonials()); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async (d: any, id?: string) => { try { if (id) await api.adminUpdateTestimonial(id, d); else await api.adminCreateTestimonial(d); setEditing(null); setCreating(false); await load(); } catch (e: any) { alert(e.message); } };
  const remove = async (id: string) => { try { await api.adminDeleteTestimonial(id); await load(); } catch (e: any) { alert(e.message); } };
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Reseñas" title="Testimonios autorizados" />
      {items.length === 0 ? (
        <View style={styles.empty}><Text style={type.body}>Aún no hay reseñas.</Text></View>
      ) : items.map(t => (
        <View key={t.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.bodyStrong}>{t.display_name}</Text>
            <Text style={[type.micro, { color: t.permission_confirmed && t.active ? colors.bronze : colors.inkSoft }]}>
              {!t.permission_confirmed ? 'SIN PERMISO' : t.active ? 'VISIBLE' : 'OCULTA'}
            </Text>
          </View>
          {t.service_name ? <Text style={[type.micro, { color: colors.inkSoft, marginTop: 4 }]}>{t.service_name.toUpperCase()}</Text> : null}
          <Text style={[type.small, { marginTop: 6 }]} numberOfLines={3}>{t.content}</Text>
          <View style={styles.rowBtns}>
            <PillButton label="Editar" variant="secondary" onPress={() => setEditing(t)} />
            <Pressable onPress={() => remove(t.id)}><Text style={[type.button, { color: colors.danger }]}>ELIMINAR</Text></Pressable>
          </View>
        </View>
      ))}
      <PillButton label="Añadir reseña" onPress={() => setCreating(true)} style={{ marginTop: spacing.lg }} />
      {(editing || creating) && (
        <TestimonialForm initial={editing || undefined} onCancel={() => { setEditing(null); setCreating(false); }} onSave={(d) => save(d, editing?.id)} />
      )}
    </ScrollView>
  );
}

function TestimonialForm({ initial, onCancel, onSave }: any) {
  const [f, setF] = useState({
    display_name: initial?.display_name || '',
    service_name: initial?.service_name || '',
    content: initial?.content || '',
    permission_confirmed: initial?.permission_confirmed ?? false,
    active: initial?.active ?? true,
    display_order: String(initial?.display_order || 0),
  });
  return (
    <View style={styles.form}>
      <Text style={[type.eyebrow, { marginBottom: spacing.md }]}>{initial ? 'EDITAR RESEÑA' : 'NUEVA RESEÑA'}</Text>
      <FormField label="Nombre visible o iniciales" value={f.display_name} onChange={v => setF({ ...f, display_name: v })} />
      <FormField label="Servicio (opcional)" value={f.service_name} onChange={v => setF({ ...f, service_name: v })} />
      <FormField label="Texto" value={f.content} onChange={v => setF({ ...f, content: v })} multiline />
      <FormField label="Orden" value={f.display_order} onChange={v => setF({ ...f, display_order: v })} keyboardType="number-pad" />
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Permiso confirmado</Text><Switch value={f.permission_confirmed} onValueChange={v => setF({ ...f, permission_confirmed: v })} /></View>
      <View style={styles.switchRow}><Text style={type.bodyStrong}>Visible</Text><Switch value={f.active} onValueChange={v => setF({ ...f, active: v })} /></View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <PillButton label="Cancelar" variant="secondary" onPress={onCancel} />
        <PillButton label="Guardar" onPress={() => onSave({
          display_name: f.display_name, service_name: f.service_name, content: f.content,
          permission_confirmed: f.permission_confirmed, active: f.active,
          display_order: parseInt(f.display_order) || 0,
        })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function SettingsTab() {
  const [bs, setBs] = useState<any>(null);
  const [ss, setSs] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setBs(await api.bookingSettings());
        setSs(await api.siteSettings());
      } catch {}
    })();
  }, []);
  const toggleDay = (d: number) => {
    if (!bs) return;
    const set = new Set<number>(bs.open_days || []);
    if (set.has(d)) set.delete(d); else set.add(d);
    setBs({ ...bs, open_days: Array.from(set).sort() });
  };
  const saveBs = async () => {
    try {
      await api.adminUpdateBookingSettings({
        open_days: bs.open_days,
        open_hour: parseInt(String(bs.open_hour)) || 11,
        close_hour: parseInt(String(bs.close_hour)) || 18,
        min_notice_minutes: parseInt(String(bs.min_notice_minutes)) || 60,
        slot_step_minutes: parseInt(String(bs.slot_step_minutes)) || 15,
      });
      setSavedMsg('Agenda actualizada');
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e: any) { alert(e.message); }
  };
  const saveSs = async () => {
    try {
      await api.adminUpdateSiteSettings(ss);
      setSavedMsg('Sitio actualizado');
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e: any) { alert(e.message); }
  };
  if (!bs || !ss) return null;
  const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Agenda" title="Días y horarios" />
      <Text style={[type.small, { marginBottom: spacing.md }]}>Selecciona los días de la semana en los que aceptas reservas automáticas.</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {dayNames.map((n, i) => {
          const on = (bs.open_days || []).includes(i);
          return (
            <Pressable key={i} onPress={() => toggleDay(i)} style={[styles.dayToggle, on && { backgroundColor: colors.ink, borderColor: colors.ink }]} testID={`day-${i}`}>
              <Text style={[styles.dayToggleText, on && { color: colors.paper }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <FormField label="Hora de apertura (0-23)" value={String(bs.open_hour)} onChange={v => setBs({ ...bs, open_hour: v })} keyboardType="number-pad" />
      <FormField label="Hora de cierre (0-23, último fin)" value={String(bs.close_hour)} onChange={v => setBs({ ...bs, close_hour: v })} keyboardType="number-pad" />
      <FormField label="Aviso mínimo (min)" value={String(bs.min_notice_minutes)} onChange={v => setBs({ ...bs, min_notice_minutes: v })} keyboardType="number-pad" />
      <FormField label="Intervalo entre inicios (min)" value={String(bs.slot_step_minutes)} onChange={v => setBs({ ...bs, slot_step_minutes: v })} keyboardType="number-pad" />
      <PillButton label="Guardar agenda" onPress={saveBs} style={{ marginTop: spacing.lg }} testID="save-schedule-btn" />

      <View style={{ height: spacing.huge }} />

      <SectionHead eyebrow="Sitio" title="Información del negocio" />
      <FormField label="Nombre comercial" value={ss.business_name} onChange={v => setSs({ ...ss, business_name: v })} />
      <FormField label="Descriptor" value={ss.descriptor} onChange={v => setSs({ ...ss, descriptor: v })} />
      <FormField label="Eslogan" value={ss.slogan} onChange={v => setSs({ ...ss, slogan: v })} multiline />
      <FormField label="Teléfono" value={ss.phone} onChange={v => setSs({ ...ss, phone: v })} />
      <FormField label="WhatsApp (sin +, ej. 528714633372)" value={ss.whatsapp} onChange={v => setSs({ ...ss, whatsapp: v })} />
      <FormField label="Correo" value={ss.email} onChange={v => setSs({ ...ss, email: v })} />
      <FormField label="Instagram URL" value={ss.instagram} onChange={v => setSs({ ...ss, instagram: v })} />
      <FormField label="Facebook URL" value={ss.facebook} onChange={v => setSs({ ...ss, facebook: v })} />
      <FormField label="Enlace Cal.com (opcional)" value={ss.booking_url} onChange={v => setSs({ ...ss, booking_url: v })} />
      <PillButton label="Guardar sitio" onPress={saveSs} style={{ marginTop: spacing.lg }} />

      {savedMsg ? <Text style={[type.micro, { color: colors.bronze, marginTop: spacing.md }]}>{savedMsg.toUpperCase()}</Text> : null}
    </ScrollView>
  );
}

function FormField({ label, value, onChange, keyboardType, multiline, secure }: any) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.formLabel}>{label.toUpperCase()}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secure} style={[styles.formInput, multiline && { minHeight: 60, textAlignVertical: 'top' }]} placeholderTextColor={colors.inkSoft} />
    </View>
  );
}

function MediaTab() {
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<'gallery' | 'hero' | 'about'>('gallery');

  const load = async () => {
    try { setItems(await api.adminListMedia()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const pickAndUpload = async () => {
    try {
      const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        if (perm.canAskAgain) {
          const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (r.status !== 'granted') { alert('Permiso denegado'); return; }
        } else { alert('Habilita el acceso a fotos en Ajustes'); return; }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const name = a.fileName || `photo-${Date.now()}.jpg`;
      const mime = a.mimeType || 'image/jpeg';
      setBusy(true);
      await api.uploadMedia(a.uri, name, mime, category);
      await load();
    } catch (e: any) {
      alert(e.message || 'Error al subir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const setAsHero = async (m: Media) => {
    try { await api.adminUpdateSiteSettings({ hero_image_url: m.file_url }); alert('Actualizado como imagen principal'); }
    catch (e: any) { alert(e.message); }
  };
  const setAsAbout = async (m: Media) => {
    try { await api.adminUpdateSiteSettings({ about_image_url: m.file_url }); alert('Actualizada como retrato de Miguel'); }
    catch (e: any) { alert(e.message); }
  };
  const toggleActive = async (m: Media) => {
    try { await api.adminUpdateMedia(m.id, { active: !m.active }); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async (m: Media) => {
    try { await api.adminDeleteMedia(m.id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
      <SectionHead eyebrow="Fotos" title="Galería y hero" />
      <Text style={[type.small, { marginBottom: spacing.md }]}>Elige una categoría antes de subir. Después puedes marcar una foto como principal (hero) o como retrato de Miguel.</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
        {(['gallery','hero','about'] as const).map(c => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.tabChip, category === c && styles.tabChipActive]}>
            <Text style={[styles.tabText, category === c && { color: colors.paper }]}>{c === 'gallery' ? 'GALERÍA' : c === 'hero' ? 'HERO' : 'MIGUEL'}</Text>
          </Pressable>
        ))}
      </View>
      <PillButton label={busy ? 'Subiendo…' : 'Subir foto'} onPress={pickAndUpload} loading={busy} testID="admin-upload-photo-btn" />
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {items.length === 0 ? (
          <View style={styles.empty}><Text style={type.body}>Aún no has subido fotos.</Text></View>
        ) : items.map(m => (
          <View key={m.id} style={styles.mediaCard}>
            <View style={styles.mediaThumb}>
              <Image source={{ uri: absoluteMediaUrl(m.file_url) as string }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.micro, { color: colors.bronze }]}>{m.category.toUpperCase()} · {m.active ? 'VISIBLE' : 'OCULTA'}</Text>
              <Text style={[type.small, { marginTop: 4 }]} numberOfLines={1}>{m.storage_path.split('/').pop()}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <Pressable onPress={() => setAsHero(m)}><Text style={styles.mediaAction}>USAR EN HERO</Text></Pressable>
                <Pressable onPress={() => setAsAbout(m)}><Text style={styles.mediaAction}>USAR EN MIGUEL</Text></Pressable>
                <Pressable onPress={() => toggleActive(m)}><Text style={styles.mediaAction}>{m.active ? 'OCULTAR' : 'MOSTRAR'}</Text></Pressable>
                <Pressable onPress={() => remove(m)}><Text style={[styles.mediaAction, { color: colors.danger }]}>ELIMINAR</Text></Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function AccountTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null); setErr(null);
    if (!current || !next) { setErr('Completa ambos campos.'); return; }
    if (next.length < 8) { setErr('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (next !== confirm) { setErr('La confirmación no coincide.'); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setMsg('Contraseña actualizada. Se recomienda cerrar sesión y volver a entrar.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      setErr(e.message || 'Error al actualizar');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <SectionHead eyebrow="Cuenta" title="Cambiar contraseña" />
      <Text style={[type.small, { marginBottom: spacing.md }]}>
        Elige una nueva contraseña. Miguel es el único con acceso al panel; te recomendamos usar al menos 8 caracteres con letras y números.
      </Text>
      <FormField label="Contraseña actual" value={current} onChange={setCurrent} secure />
      <FormField label="Nueva contraseña" value={next} onChange={setNext} secure />
      <FormField label="Confirmar nueva contraseña" value={confirm} onChange={setConfirm} secure />
      {err ? <Text style={[type.small, { color: colors.danger, marginTop: spacing.md }]}>{err}</Text> : null}
      {msg ? <Text style={[type.micro, { color: colors.bronze, marginTop: spacing.md }]}>{msg.toUpperCase()}</Text> : null}
      <PillButton label="Actualizar contraseña" onPress={submit} loading={busy} style={{ marginTop: spacing.xl }} testID="save-password-btn" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  brandSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkSoft, letterSpacing: 1.2, marginTop: 2 },
  logoutBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexGrow: 0, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexShrink: 0, height: 36, justifyContent: 'center' },
  tabChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.8, color: colors.ink },
  empty: { padding: spacing.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.md },
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.md },
  rowBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  form: { marginTop: spacing.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperDeep, borderRadius: radius.md },
  formLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: colors.inkSoft, marginBottom: 4 },
  formInput: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  dayToggle: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  dayToggleText: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.8, color: colors.ink },
  mediaCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.md },
  mediaThumb: { width: 76, height: 76, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.paperDeep },
  mediaAction: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 0.8, color: colors.ink, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
});
