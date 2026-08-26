import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type, fonts, radius } from '@/src/theme';
import { PillButton } from '@/src/components/PillButton';
import { SectionHead } from '@/src/components/SectionHead';
import { openWhatsApp, openPhone, openEmail, openSms, waMessages } from '@/src/contact';

export default function Contact() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>Contacto</Text>
        <Text style={styles.brandSub}>Miguel Suárez</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <SectionHead eyebrow="Directo a Miguel" title="Escribe, llama o reserva." />

        <Pressable
          onPress={() => openWhatsApp(waMessages.general)}
          style={[styles.primaryContact, { backgroundColor: colors.whatsapp }]}
          testID="contact-wa-btn"
        >
          <Feather name="message-circle" size={22} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={[type.micro, { color: 'rgba(255,255,255,0.75)' }]}>WHATSAPP</Text>
            <Text style={[type.bodyStrong, { color: colors.white, marginTop: 2 }]}>+52 871 463 3372</Text>
          </View>
          <Feather name="arrow-right" size={18} color={colors.white} />
        </Pressable>

        <ContactRow icon="calendar" label="RESERVAR" value="Elige servicio y horario" onPress={() => router.push('/(tabs)/book')} testID="contact-book-btn" />
        <ContactRow icon="phone" label="LLAMAR" value="+52 871 463 3372" onPress={() => openPhone()} testID="contact-call-btn" />
        <ContactRow icon="message-square" label="MENSAJE DE TEXTO" value="+52 871 463 3372" onPress={() => openSms()} testID="contact-sms-btn" />
        <ContactRow icon="mail" label="CORREO" value="Suarezmaiky25@gmail.com" onPress={() => openEmail()} testID="contact-email-btn" />

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHead eyebrow="Redes sociales" title="Miguel en redes." />
          <View style={styles.socialBox}>
            <Feather name="instagram" size={18} color={colors.inkSoft} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>Instagram</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Enlace pendiente de configuración.</Text>
            </View>
          </View>
          <View style={styles.socialBox}>
            <Feather name="facebook" size={18} color={colors.inkSoft} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>Facebook</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Enlace pendiente de configuración.</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHead eyebrow="Otros temas" title="Bodas, grupos y consultas." />
          <PillButton
            label="Cotizar boda o evento"
            variant="secondary"
            onPress={() => openWhatsApp(waMessages.group)}
            testID="contact-group-btn"
            style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
          />
          <PillButton
            label="Consultar mi colonia"
            variant="secondary"
            onPress={() => openWhatsApp(waMessages.zoneCheck(''))}
            testID="contact-zone-btn"
            style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
          />
          <PillButton
            label="Horario entre semana"
            variant="secondary"
            onPress={() => openWhatsApp(waMessages.weekday)}
            testID="contact-weekday-btn"
            style={{ alignSelf: 'flex-start' }}
          />
        </View>

        <View style={{ marginTop: spacing.xxxl }}>
          <SectionHead eyebrow="Legal" title="Reglas de la reserva." />
          <Pressable onPress={() => router.push('/policies')} style={styles.linkRow}>
            <Feather name="file-text" size={18} color={colors.ink} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>Políticas de reserva</Text>
            <Feather name="arrow-up-right" size={16} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => router.push('/faqs')} style={styles.linkRow}>
            <Feather name="help-circle" size={18} color={colors.ink} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>Preguntas frecuentes</Text>
            <Feather name="arrow-up-right" size={16} color={colors.ink} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ContactRow({ icon, label, value, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} style={styles.contactRow} testID={testID}>
      <Feather name={icon} size={18} color={colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={type.micro}>{label}</Text>
        <Text style={[type.bodyStrong, { marginTop: 2 }]}>{value}</Text>
      </View>
      <Feather name="arrow-right" size={16} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  brandSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkSoft, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 },
  primaryContact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.md, marginBottom: spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginTop: spacing.sm },
  socialBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
});
