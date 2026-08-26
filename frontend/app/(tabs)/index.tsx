import React, { useEffect, useState, useCallback } from 'react';import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { Accordion } from '@/src/components/Accordion';
import { api, ContentBlock, Faq, Media, SiteSettings, Testimonial, Zone, absoluteMediaUrl } from '@/src/api';
import { openWhatsApp, waMessages } from '@/src/contact';

const HERO_IMG_FALLBACK = 'https://images.unsplash.com/photo-1599834562135-b6fc90e642ca?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwzfHxtZW4lMjBwb3J0cmFpdCUyMHN0eWxlJTIwZ3Jvb21pbmclMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzg2NTU5NTk0fDA&ixlib=rb-4.1.0&q=85';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHw0fHxtZW4lMjBwb3J0cmFpdCUyMHN0eWxlJTIwZ3Jvb21pbmclMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzg2NTU5NTk0fDA&ixlib=rb-4.1.0&q=85';const STEPS = [
  { n: '01', t: 'Elige tu servicio', d: 'Revisa precios, duración y características.' },
  { n: '02', t: 'Reserva o contacta', d: 'Reserva automáticamente o escribe por WhatsApp para otro horario.' },
  { n: '03', t: 'Confirma la ubicación', d: 'Miguel revisará la dirección, colonia, acceso y posible recargo.' },
  { n: '04', t: 'Recibe el servicio', d: 'Miguel se desplaza hasta la ubicación acordada.' },
  { n: '05', t: 'Paga al terminar', d: 'El pago se realiza en efectivo o transferencia después del servicio.' },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [blocks, setBlocks] = useState<Record<string, ContentBlock>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, z, f, t, cb] = await Promise.all([
        api.siteSettings(), api.zones(), api.faqs(), api.testimonials(), api.contentBlocks(),
      ]);
      setSettings(s); setZones(z); setFaqs(f); setTestimonials(t);
      const map: Record<string, ContentBlock> = {};
      (cb as ContentBlock[]).forEach(b => { map[b.section_key] = b; });
      setBlocks(map);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <StickyHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: absoluteMediaUrl(settings?.hero_image_url) || HERO_IMG_FALLBACK }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient
            colors={['rgba(17,17,14,0.05)', 'rgba(17,17,14,0.55)', 'rgba(17,17,14,0.92)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.dash, { backgroundColor: colors.bronze }]} />
                <Text style={[type.eyebrow, { color: colors.paper }]}>{blocks.hero?.eyebrow || 'Barbería premium a domicilio · Torreón'}</Text>
              </View>
            </View>
            <View>
              <Text style={[type.h1, styles.heroTitle]}>{blocks.hero?.title || 'Precisión y estilo,\ndonde tú estés.'}</Text>
              <Text style={styles.heroLead}>
                {blocks.hero?.content || 'Cortes, barba y cuidado facial con atención personalizada, técnica detallada y la comodidad de recibir el servicio en tu residencia, hotel u oficina.'}
              </Text>
              <View style={styles.heroBtns}>
                <PillButton
                  label="Reservar"
                  onPress={() => router.push('/(tabs)/book')}
                  testID="hero-reservar-btn"
                  invert
                />
                <Pressable
                  onPress={() => openWhatsApp(waMessages.general)}
                  testID="hero-whatsapp-btn"
                  style={styles.heroLink}
                >
                  <Text style={[type.button, { color: colors.paper }]}>WHATSAPP</Text>
                  <Feather name="arrow-right" size={16} color={colors.paper} />
                </Pressable>
              </View>
              <Text style={styles.heroMeta}>Atención dentro de Torreón · Precios claros · Pago al finalizar</Text>
            </View>
          </View>
        </View>

        {/* Trust bar */}
        <View style={styles.trust}>
          {[
            { t: 'Servicio en tu espacio', d: 'Residencias, hoteles, oficinas y ubicaciones acordadas dentro de Torreón.' },
            { t: 'Precios claros', d: 'Servicios, duración y precio visibles antes de reservar.' },
            { t: 'Atención detallista', d: 'Cada servicio se adapta al estilo, facciones y necesidades del cliente.' },
          ].map((b, i) => (
            <View key={i} style={[styles.trustItem, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
              <Text style={styles.trustNum}>{`0${i + 1}`}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{b.t}</Text>
                <Text style={[type.body, { marginTop: 4 }]}>{b.d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* About / story card */}
        <View style={styles.section}>
          <SectionHead eyebrow={blocks.about?.eyebrow || '01 · Sobre Miguel'} title={blocks.about?.title || 'Detalle, técnica y\nvocación de servicio.'} />
          <View style={styles.storyCard}>
            <Text style={styles.monogram}>M</Text>
            <View style={{ gap: spacing.md }}>
              <Text style={[type.small, { color: 'rgba(244,241,233,0.7)' }]}>MIGUEL ÁNGEL SUÁREZ</Text>
              {(blocks.about?.content || 'Miguel Ángel Suárez es graduado de Medicina en Cuba y encontró en la barbería una actividad que combina precisión, creatividad y trato directo con las personas.\n\nComenzó en la barbería por el placer de realizar cada corte con el máximo nivel de detalle y por la satisfacción de ver a un cliente feliz con el resultado.\n\nCuenta con experiencia en cortes clásicos, cortes a tijera y cortes a máquina, y aplica un enfoque personalizado considerando el estilo, las características del cabello y las facciones del cliente.').split(/\n\n+/).map((para, i) => (
                <Text key={i} style={[i === 0 ? type.h3 : type.body, { color: i === 0 ? colors.paper : 'rgba(244,241,233,0.75)' }]}>
                  {para}
                </Text>
              ))}
            </View>
            <View style={styles.signature}>
              <View style={styles.signLine} />
              <Text style={[type.small, { color: 'rgba(244,241,233,0.7)', marginTop: spacing.sm }]}>M. Suárez · Torreón, Coah.</Text>
            </View>
          </View>
        </View>

        {/* Process */}
        <View style={styles.section}>
          <SectionHead eyebrow="02 · Cómo funciona" title="El proceso, paso a paso." />
          <View>
            {STEPS.map((s, i) => (
              <View key={s.n} style={[styles.step, i < STEPS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                <Text style={styles.stepNum}>{s.n}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{s.t}</Text>
                  <Text style={[type.body, { marginTop: 4 }]}>{s.d}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Zones */}
        <View style={styles.section}>
          <SectionHead eyebrow="03 · Zonas" title={'Servicio a domicilio\ndentro de Torreón.'} />
          <View style={styles.zonesGrid}>
            {zones.filter(z => z.featured).map(z => (
              <View key={z.id} style={styles.zoneChip}>
                <Text style={styles.zoneChipText}>{z.neighborhood}</Text>
              </View>
            ))}
          </View>
          <Text style={[type.body, { marginTop: spacing.lg }]}>
            También es posible solicitar atención en otras colonias de Torreón. La disponibilidad y cualquier recargo de traslado se confirman directamente por WhatsApp.
          </Text>
          <PillButton
            label="Consultar mi zona"
            variant="secondary"
            onPress={() => openWhatsApp(waMessages.zoneCheck(''))}
            testID="zone-check-btn"
            style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
          />
        </View>

        {/* Packages */}
        <View style={styles.section}>
          <View style={styles.packageCard}>
            <Text style={[type.eyebrow, { color: 'rgba(255,253,248,0.8)' }]}>Bodas · Eventos · Grupos</Text>
            <Text style={[type.h2, { color: colors.paper, marginTop: spacing.md }]}>
              Servicios para bodas, eventos y grupos.
            </Text>
            <Text style={[type.body, { color: 'rgba(255,253,248,0.85)', marginTop: spacing.md }]}>
              Miguel puede atender a varias personas en una misma ubicación. Cada paquete se cotiza de acuerdo con la fecha, número de personas, servicios requeridos, ubicación y tiempo disponible.
            </Text>
            <PillButton
              label="Solicitar cotización"
              onPress={() => openWhatsApp(waMessages.group)}
              testID="group-quote-btn"
              invert
              style={{ marginTop: spacing.xl, alignSelf: 'flex-start' }}
            />
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <SectionHead eyebrow="04 · Reseñas" title="Palabras de quienes ya han probado el servicio." />
          {testimonials.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[type.micro, { color: colors.bronze }]}>PRÓXIMAMENTE</Text>
              <Text style={[type.body, { marginTop: spacing.sm }]}>
                Las primeras reseñas autorizadas de clientes se publicarán aquí. Mientras tanto, puedes escribirle a Miguel para conocer más sobre el servicio.
              </Text>
            </View>
          ) : (
            testimonials.map(t => (
              <View key={t.id} style={styles.reviewCard}>
                <Text style={styles.reviewMonogram}>M</Text>
                <Text style={[type.body, { color: colors.paper }]}>&ldquo;{t.content}&rdquo;</Text>
                <Text style={[type.micro, { color: colors.bronze, marginTop: spacing.md }]}>{t.display_name}{t.service_name ? ` · ${t.service_name}` : ''}</Text>
              </View>
            ))
          )}
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <SectionHead eyebrow="05 · Preguntas frecuentes" title="Todo lo que necesitas saber." />
          {faqs.slice(0, 6).map(f => (
            <Accordion key={f.id} q={f.question} a={f.answer} pending={f.pending_confirmation} testID={`faq-${f.id}`} />
          ))}
          <PillButton
            label="Ver todas las preguntas"
            variant="secondary"
            onPress={() => router.push('/faqs')}
            style={{ marginTop: spacing.xl, alignSelf: 'flex-start' }}
          />
        </View>

        {/* Footer */}
        <Footer settings={settings} />
      </ScrollView>

      {/* Sticky WhatsApp FAB */}
      <Pressable
        onPress={() => openWhatsApp(waMessages.general)}
        style={[styles.fab, { bottom: 92 + insets.bottom * 0 }]}
        testID="floating-wa-btn"
      >
        <Feather name="message-circle" size={18} color={colors.white} />
        <Text style={[type.button, { color: colors.white }]}>WHATSAPP</Text>
      </Pressable>
    </View>
  );
}

function StickyHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View>
        <Text style={styles.brand}>Miguel Suárez</Text>
        <Text style={styles.brandSub}>Barbero profesional a domicilio</Text>
      </View>
    </View>
  );
}

function Footer({ settings }: { settings: SiteSettings | null }) {
  const [taps, setTaps] = useState(0);
  const onYearPress = () => {
    const n = taps + 1;
    if (n >= 5) { setTaps(0); router.push('/admin/login'); }
    else setTaps(n);
  };
  return (
    <View style={styles.footer}>
      <Text style={[type.h3, { color: colors.paper }]}>Miguel Suárez</Text>
      <Text style={[type.small, { color: 'rgba(244,241,233,0.65)', marginTop: 4 }]}>Barbero profesional a domicilio · Torreón, Coahuila</Text>
      <View style={styles.footerDivider} />
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.small, { color: 'rgba(244,241,233,0.75)' }]}>WhatsApp: +52 871 463 3372</Text>
        <Text style={[type.small, { color: 'rgba(244,241,233,0.75)' }]}>Correo: Suarezmaiky25@gmail.com</Text>
      </View>
      <View style={styles.footerDivider} />
      <Pressable onPress={() => router.push('/policies')}>
        <Text style={[type.micro, { color: colors.bronze }]}>POLÍTICAS DE RESERVA</Text>
      </Pressable>
      <Pressable onPress={onYearPress} hitSlop={12} testID="footer-year-btn">
        <Text style={[type.small, { color: 'rgba(244,241,233,0.5)', marginTop: spacing.xl }]}>
          © {new Date().getFullYear()} Miguel Suárez · Todos los derechos reservados
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
  },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, letterSpacing: 0.3 },
  brandSub: { fontFamily: fonts.sans, fontSize: 10, color: colors.inkSoft, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 },
  hero: { height: 620, justifyContent: 'flex-end' },
  heroContent: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xxl },
  heroTop: { marginTop: spacing.xxxl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dash: { width: 22, height: 1 },
  heroTitle: { color: colors.paper, fontSize: 44, lineHeight: 46, marginBottom: spacing.lg },
  heroLead: { ...type.body, color: 'rgba(244,241,233,0.9)' },
  heroBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, flexWrap: 'wrap', alignItems: 'center' },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  heroMeta: { ...type.small, color: 'rgba(244,241,233,0.6)', marginTop: spacing.lg },

  trust: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    backgroundColor: colors.white,
    padding: spacing.xl,
    borderRadius: radius.md,
  },
  trustItem: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.lg },
  trustNum: { fontFamily: fonts.serif, fontSize: 22, color: colors.bronze, width: 30 },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.huge },

  storyCard: {
    backgroundColor: colors.ink,
    padding: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radius.md,
    minHeight: 480,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  monogram: {
    position: 'absolute',
    right: -30, bottom: -60,
    fontFamily: fonts.serif,
    fontSize: 340,
    color: 'rgba(244,241,233,0.06)',
    lineHeight: 340,
  },
  signature: { marginTop: spacing.xl },
  signLine: { width: 60, height: 1, backgroundColor: colors.bronze },

  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, paddingVertical: spacing.xl },
  stepNum: { fontFamily: fonts.serif, fontSize: 40, color: colors.bronze, width: 60, lineHeight: 44 },

  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  zoneChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white },
  zoneChipText: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink },

  packageCard: {
    padding: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radius.md,
    backgroundColor: colors.bronze,
  },

  emptyBox: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  reviewCard: {
    backgroundColor: colors.ink,
    padding: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  reviewMonogram: {
    position: 'absolute', right: -20, bottom: -40,
    fontFamily: fonts.serif, fontSize: 200,
    color: 'rgba(244,241,233,0.06)', lineHeight: 200,
  },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 100,
    backgroundColor: colors.whatsapp,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },

  footer: {
    backgroundColor: colors.ink,
    padding: spacing.xl,
    paddingVertical: spacing.xxxl,
    marginTop: spacing.huge,
  },
  footerDivider: { height: 1, backgroundColor: 'rgba(244,241,233,0.15)', marginVertical: spacing.xl },
});
