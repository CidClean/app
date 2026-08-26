import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, Switch, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { AdminMenu, DashboardSection } from '@/src/components/AdminMenu';
import { api, Service, Zone, Faq, Testimonial, Media, Client, ContentBlock, absoluteMediaUrl } from '@/src/api';

type Tab = DashboardSection;

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
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

  useEffect(() => {
    const allowed: Tab[] = ['inicio', 'servicios', 'zonas', 'faqs', 'resenas', 'clientes', 'contenido', 'fotos', 'ajustes', 'cuenta'];
    if (requestedTab && allowed.includes(requestedTab as Tab)) {
      setTab(requestedTab as Tab);
    }
  }, [requestedTab]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AdminMenu current={tab} onSelectSection={setTab} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>{labelFor(tab)}</Text>
          <Text style={styles.brandSub}>{email}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'inicio' && <HomeTab />}
        {tab === 'servicios' && <ServicesTab />}
        {tab === 'zonas' && <ZonesTab />}
        {tab === 'faqs' && <FaqsTab />}
        {tab === 'resenas' && <TestimonialsTab />}
        {tab === 'clientes' && <ClientsTab />}
        {tab === 'contenido' && <ContentTab />}
        {tab === 'fotos' && <MediaTab />}
        {tab === 'ajustes' && <SettingsTab />}
        {tab === 'cuenta' && <AccountTab />}
      </View>
    </View>
  );
}

function labelFor(t: Tab) {
  const m: any = { inicio: 'Inicio', servicios: 'Servicios', zonas: 'Zonas', faqs: 'Preguntas', resenas: 'Reseñas', clientes: 'Clientes', contenido: 'Contenido', fotos: 'Fotos', ajustes: 'Ajustes', cuenta: 'Cuenta' };
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
  const [ss, setSs] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setSs(await api.siteSettings()); } catch {}
    })();
  }, []);

  const saveSs = async () => {
    try {
      await api.adminUpdateSiteSettings(ss);
      setSavedMsg('Información del negocio actualizada');
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e: any) { alert(e.message); }
  };

  if (!ss) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Sitio" title="Información del negocio" />
      <Text style={[type.small, { marginBottom: spacing.md }]}>
        Los días, horas, aviso mínimo e intervalos se administran únicamente desde Horarios en el menú principal.
      </Text>
      <PillButton
        label="Abrir horarios"
        variant="secondary"
        onPress={() => router.push('/admin/horarios')}
        style={{ marginBottom: spacing.lg, alignSelf: 'flex-start' }}
      />
      <FormField label="Nombre comercial" value={ss.business_name} onChange={v => setSs({ ...ss, business_name: v })} />
      <FormField label="Descriptor" value={ss.descriptor} onChange={v => setSs({ ...ss, descriptor: v })} />
      <FormField label="Eslogan" value={ss.slogan} onChange={v => setSs({ ...ss, slogan: v })} multiline />
      <FormField label="Teléfono" value={ss.phone} onChange={v => setSs({ ...ss, phone: v })} />
      <FormField label="WhatsApp (sin +, ej. 528714633372)" value={ss.whatsapp} onChange={v => setSs({ ...ss, whatsapp: v })} />
      <FormField label="Correo" value={ss.email} onChange={v => setSs({ ...ss, email: v })} />
      <FormField label="Instagram URL" value={ss.instagram} onChange={v => setSs({ ...ss, instagram: v })} />
      <FormField label="Facebook URL" value={ss.facebook} onChange={v => setSs({ ...ss, facebook: v })} />
      <FormField label="Enlace Cal.com (opcional)" value={ss.booking_url} onChange={v => setSs({ ...ss, booking_url: v })} />
      <PillButton label="Guardar información" onPress={saveSs} style={{ marginTop: spacing.lg }} />
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

function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [q, setQ] = useState('');
  const load = async () => { try { setClients(await api.adminListClients()); } catch {} };
  useEffect(() => { load(); }, []);

  const openClient = async (c: Client) => {
    setSelected(c);
    try { setDetail(await api.adminGetClient(c.id)); } catch { setDetail(null); }
  };

  const saveNotes = async (notes: string) => {
    if (!selected) return;
    try { await api.adminUpdateClient(selected.id, { notes }); await load(); setSelected({ ...selected, notes }); }
    catch (e: any) { alert(e.message); }
  };

  const remove = async (id: string) => {
    try { await api.adminDeleteClient(id); setSelected(null); setDetail(null); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const filtered = clients.filter(c =>
    !q.trim() ||
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
    (c.last_neighborhood || '').toLowerCase().includes(q.toLowerCase())
  );

  if (selected) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
        <Pressable onPress={() => { setSelected(null); setDetail(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
          <Feather name="arrow-left" size={16} color={colors.ink} />
          <Text style={[type.button, { color: colors.ink }]}>VOLVER</Text>
        </Pressable>
        <SectionHead eyebrow="Cliente" title={selected.name} />
        <View style={styles.card}>
          <Text style={[type.micro]}>TELÉFONO</Text>
          <Text style={[type.bodyStrong, { marginTop: 4 }]}>{selected.phone}</Text>
          <Text style={[type.micro, { marginTop: spacing.md }]}>ÚLTIMA COLONIA</Text>
          <Text style={[type.body, { marginTop: 4 }]}>{selected.last_neighborhood || '—'}</Text>
          <Text style={[type.micro, { marginTop: spacing.md }]}>ÚLTIMA DIRECCIÓN</Text>
          <Text style={[type.body, { marginTop: 4 }]}>{selected.last_address || '—'}</Text>
          <Text style={[type.micro, { marginTop: spacing.md }]}>RESERVAS TOTALES</Text>
          <Text style={[type.bodyStrong, { marginTop: 4 }]}>{selected.bookings_count}</Text>
          <Text style={[type.micro, { marginTop: spacing.md }]}>PRIMERA · ÚLTIMA</Text>
          <Text style={[type.small, { marginTop: 4 }]}>{new Date(selected.first_seen_at).toLocaleDateString('es-MX')} · {new Date(selected.last_seen_at).toLocaleDateString('es-MX')}</Text>
        </View>
        <Text style={[styles.formLabel, { marginTop: spacing.xl }]}>NOTAS PRIVADAS</Text>
        <TextInput
          value={selected.notes}
          onChangeText={(v) => setSelected({ ...selected, notes: v })}
          onBlur={() => saveNotes(selected.notes)}
          multiline
          placeholder="Preferencias, estilo habitual, alergias, etc."
          placeholderTextColor={colors.inkSoft}
          style={[styles.formInput, { minHeight: 90, textAlignVertical: 'top' }]}
        />
        <Text style={[type.small, { marginTop: 4, color: colors.inkSoft }]}>Se guarda automáticamente al salir del campo.</Text>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHead eyebrow="Historial" title="Reservas de este cliente" />
          {detail?.bookings?.length ? detail.bookings.map((b: any) => (
            <View key={b.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={type.bodyStrong}>{b.service_name}</Text>
                <Text style={[type.micro, { color: colors.bronze }]}>{b.status.toUpperCase()}</Text>
              </View>
              <Text style={[type.small, { marginTop: 4 }]}>{b.date} · {b.time} · ${b.service_price} MXN</Text>
              <Text style={[type.small, { marginTop: 4 }]}>{b.address}, {b.neighborhood}</Text>
              {b.note ? <Text style={[type.small, { marginTop: 6, fontStyle: 'italic' }]}>&ldquo;{b.note}&rdquo;</Text> : null}
            </View>
          )) : <View style={styles.empty}><Text style={type.body}>Sin reservas registradas.</Text></View>}
        </View>

        <Pressable onPress={() => remove(selected.id)} style={{ marginTop: spacing.xl }}>
          <Text style={[type.button, { color: colors.danger }]}>ELIMINAR CLIENTE</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
      <SectionHead eyebrow="Clientes" title="Registro automático" />
      <Text style={[type.small, { marginBottom: spacing.md }]}>
        Cada reserva alimenta este registro. Toca un cliente para ver su historial completo y agregar notas privadas.
      </Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar por nombre, teléfono o colonia"
        placeholderTextColor={colors.inkSoft}
        style={[styles.formInput, { marginBottom: spacing.md }]}
      />
      {filtered.length === 0 ? (
        <View style={styles.empty}><Text style={type.body}>{clients.length === 0 ? 'Aún no hay clientes registrados. Se agregan automáticamente al recibir la primera reserva.' : 'Ningún cliente coincide con tu búsqueda.'}</Text></View>
      ) : filtered.map(c => (
        <Pressable key={c.id} onPress={() => openClient(c)} style={styles.card} testID={`client-${c.id}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>{c.name}</Text>
              <Text style={[type.small, { marginTop: 4 }]}>{c.phone}</Text>
              <Text style={[type.small, { marginTop: 2, color: colors.inkSoft }]}>{c.last_neighborhood || '—'} · {c.bookings_count} {c.bookings_count === 1 ? 'reserva' : 'reservas'}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkSoft} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ContentTab() {
  const [blocks, setBlocks] = useState<Record<string, ContentBlock>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const load = async () => {
    try {
      const items = await api.contentBlocks();
      const map: Record<string, ContentBlock> = {};
      (items as ContentBlock[]).forEach(b => { map[b.section_key] = b; });
      setBlocks(map);
    } catch {}
  };
  useEffect(() => { load(); }, []);
  const saveBlock = async (key: string) => {
    const b = blocks[key];
    if (!b) return;
    try {
      await api.adminUpdateContentBlock(key, { eyebrow: b.eyebrow, title: b.title, content: b.content });
      setSavedMsg(`Guardado: ${key}`);
      setTimeout(() => setSavedMsg(null), 2000);
      await load();
    } catch (e: any) { alert(e.message); }
  };
  const setField = (key: string, field: keyof ContentBlock, value: string) => {
    setBlocks({ ...blocks, [key]: { ...(blocks[key] || { section_key: key, eyebrow: '', title: '', content: '', active: true }), [field]: value } });
  };
  const KEYS: { key: string; label: string; help: string }[] = [
    { key: 'hero', label: 'Hero (portada)', help: 'Etiqueta superior, título grande y párrafo principal que ven los clientes al entrar.' },
    { key: 'about', label: 'Sobre Miguel / historia', help: 'Narrativa de Miguel. Separa párrafos con una línea en blanco.' },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <SectionHead eyebrow="Contenido" title="Textos del sitio" />
      {savedMsg ? <Text style={[type.micro, { color: colors.bronze, marginBottom: spacing.sm }]}>{savedMsg.toUpperCase()}</Text> : null}
      {KEYS.map(({ key, label, help }) => (
        <View key={key} style={[styles.form, { marginTop: spacing.md }]}>
          <Text style={[type.eyebrow, { marginBottom: 4 }]}>{label.toUpperCase()}</Text>
          <Text style={[type.small, { marginBottom: spacing.md }]}>{help}</Text>
          <FormField label="Etiqueta superior" value={blocks[key]?.eyebrow || ''} onChange={(v: string) => setField(key, 'eyebrow', v)} />
          <FormField label="Título" value={blocks[key]?.title || ''} onChange={(v: string) => setField(key, 'title', v)} multiline />
          <FormField label="Contenido" value={blocks[key]?.content || ''} onChange={(v: string) => setField(key, 'content', v)} multiline />
          <PillButton label={`Guardar ${label}`} onPress={() => saveBlock(key)} style={{ marginTop: spacing.md }} />
        </View>
      ))}
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
