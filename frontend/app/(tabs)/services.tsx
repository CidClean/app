import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { api, Media, Service, Zone, absoluteMediaUrl } from '@/src/api';
import { openWhatsApp, waMessages } from '@/src/contact';
import { Image } from 'expo-image';

export default function Services() {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<Service[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [gallery, setGallery] = useState<Media[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, z, g] = await Promise.all([api.services(), api.zones(), api.listMedia('gallery')]);
        setServices(s); setZones(z); setGallery(g);
      } catch { /* silent */ }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>Servicios</Text>
        <Text style={styles.brandSub}>Miguel Suárez · Torreón</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.xl }}>
          <SectionHead eyebrow="Precios y duración" title="Cada servicio, cuidadosamente definido." />
          {services.map((s, i) => (
            <View key={s.id} style={[styles.card, i < services.length - 1 && { marginBottom: spacing.lg }]}>
              <View style={styles.cardTop}>
                <Text style={styles.svcIndex}>{`0${i + 1}`}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{s.name}</Text>
                  <Text style={[type.body, { marginTop: 6 }]}>{s.short_description}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <View>
                  <Text style={styles.metaLabel}>DURACIÓN</Text>
                  <Text style={styles.metaValue}>{s.duration_minutes} min</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>DESDE</Text>
                  <Text style={styles.price}>${s.price} <Text style={styles.currency}>MXN</Text></Text>
                </View>
              </View>
              <View style={styles.cardBtns}>
                <PillButton
                  label="Reservar"
                  onPress={() => router.push({ pathname: '/(tabs)/book', params: { serviceId: s.id } })}
                  testID={`reserve-${s.slug}-btn`}
                />
                <Pressable onPress={() => openWhatsApp(waMessages.service(s.name))} testID={`wa-${s.slug}-btn`}>
                  <Text style={[type.button, { color: colors.ink }]}>WHATSAPP</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.notice}>
            <Feather name="info" size={16} color={colors.bronze} />
            <Text style={[type.small, { flex: 1 }]}>
              Los precios corresponden al servicio. Dependiendo de la colonia o ubicación, puede aplicar un recargo de traslado que será confirmado antes de la cita.
            </Text>
          </View>
        </View>

        {/* Zones */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <SectionHead eyebrow="Zonas de atención" title="Torreón, Coahuila." />
          <Text style={type.body}>
            Enfoque especial en las siguientes colonias. También se pueden atender otras colonias de Torreón, con posible recargo de traslado a confirmar por WhatsApp.
          </Text>
          <View style={styles.zonesGrid}>
            {zones.map(z => (
              <View key={z.id} style={[styles.zoneChip, z.featured && { backgroundColor: colors.ink }]}>
                <Text style={[styles.zoneChipText, z.featured && { color: colors.paper }]}>{z.neighborhood}</Text>
              </View>
            ))}
          </View>
          <PillButton
            label="Consultar mi colonia por WhatsApp"
            variant="secondary"
            onPress={() => openWhatsApp(waMessages.zoneCheck(''))}
            testID="services-zone-check-btn"
            style={{ marginTop: spacing.xl, alignSelf: 'flex-start' }}
          />
        </View>

        {/* Gallery */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.huge }}>
          <SectionHead eyebrow="Galería" title="Cortes, barbas y proceso." />
          <View style={styles.gallery}>
            {gallery.length === 0 ? (
              [0, 1, 2, 3].map(i => (
                <View key={i} style={styles.galleryItem}>
                  <Feather name="image" size={22} color={colors.inkSoft} />
                  <Text style={[type.micro, { marginTop: spacing.md }]}>FOTOGRAFÍA PENDIENTE</Text>
                </View>
              ))
            ) : (
              gallery.map(m => (
                <View key={m.id} style={styles.galleryItem}>
                  <Image
                    source={{ uri: absoluteMediaUrl(m.file_url) as string }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  brandSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkSoft, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  svcIndex: { fontFamily: fonts.serif, fontSize: 22, color: colors.bronze, width: 36, marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  metaLabel: { ...type.micro, letterSpacing: 1.6, color: colors.inkSoft, fontSize: 10 },
  metaValue: { ...type.bodyStrong, marginTop: 4 },
  price: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink, marginTop: 4 },
  currency: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft, letterSpacing: 1 },
  cardBtns: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  notice: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.paperDeep, padding: spacing.lg, borderRadius: radius.md, alignItems: 'flex-start' },
  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  zoneChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white },
  zoneChipText: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  galleryItem: { width: '48%', aspectRatio: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, overflow: 'hidden' },
});
