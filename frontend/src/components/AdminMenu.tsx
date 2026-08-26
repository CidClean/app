import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { api } from '@/src/api';
import { colors, fonts, radius, spacing, type } from '@/src/theme';

export type DashboardSection =
  | 'inicio'
  | 'servicios'
  | 'zonas'
  | 'faqs'
  | 'resenas'
  | 'clientes'
  | 'contenido'
  | 'fotos'
  | 'ajustes'
  | 'cuenta';

export type AdminLocation = DashboardSection | 'reservas' | 'horarios';

type MenuItem = {
  key: AdminLocation;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  section?: DashboardSection;
  route?: '/admin/reservas' | '/admin/horarios';
};

const ITEMS: MenuItem[] = [
  { key: 'inicio', label: 'Inicio', icon: 'home', section: 'inicio' },
  { key: 'reservas', label: 'Reservas', icon: 'calendar', route: '/admin/reservas' },
  { key: 'horarios', label: 'Horarios', icon: 'clock', route: '/admin/horarios' },
  { key: 'servicios', label: 'Servicios', icon: 'scissors', section: 'servicios' },
  { key: 'clientes', label: 'Clientes', icon: 'users', section: 'clientes' },
  { key: 'zonas', label: 'Zonas y recargos', icon: 'map-pin', section: 'zonas' },
  { key: 'faqs', label: 'Preguntas frecuentes', icon: 'help-circle', section: 'faqs' },
  { key: 'resenas', label: 'Reseñas', icon: 'message-square', section: 'resenas' },
  { key: 'contenido', label: 'Contenido', icon: 'edit-3', section: 'contenido' },
  { key: 'fotos', label: 'Fotografías', icon: 'image', section: 'fotos' },
  { key: 'ajustes', label: 'Información del negocio', icon: 'settings', section: 'ajustes' },
  { key: 'cuenta', label: 'Cuenta y contraseña', icon: 'lock', section: 'cuenta' },
];

type Props = {
  current: AdminLocation;
  onSelectSection?: (section: DashboardSection) => void;
};

export function AdminMenu({ current, onSelectSection }: Props) {
  const [open, setOpen] = useState(false);

  const select = (item: MenuItem) => {
    setOpen(false);
    if (item.route) {
      router.replace(item.route);
      return;
    }
    if (!item.section) return;
    if (onSelectSection) {
      onSelectSection(item.section);
      return;
    }
    router.replace({ pathname: '/admin/dashboard', params: { tab: item.section } });
  };

  const logout = async () => {
    setOpen(false);
    await api.logout();
    router.replace('/admin/login');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Abrir menú administrativo"
        testID="admin-menu-button"
      >
        <Feather name="menu" size={21} color={colors.ink} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar menú" />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>ADMINISTRACIÓN</Text>
                <Text style={styles.title}>Miguel Suárez</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeButton} accessibilityLabel="Cerrar menú">
                <Feather name="x" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
              {ITEMS.map(item => {
                const active = item.key === current;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => select(item)}
                    style={[styles.item, active && styles.itemActive]}
                    testID={`admin-menu-${item.key}`}
                  >
                    <Feather name={item.icon} size={18} color={active ? colors.paper : colors.inkSoft} />
                    <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
                    <Feather name="chevron-right" size={16} color={active ? colors.paper : colors.inkSoft} />
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable onPress={logout} style={styles.logout} testID="admin-logout-btn">
                <Feather name="log-out" size={18} color={colors.danger} />
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.md,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  modalRoot: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 18, 16, 0.48)' },
  drawer: {
    width: '86%',
    maxWidth: 390,
    height: '100%',
    backgroundColor: colors.paper,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  eyebrow: { ...type.micro, color: colors.bronze },
  title: { fontFamily: fonts.serif, fontSize: 25, color: colors.ink, marginTop: 4 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: { padding: spacing.md, paddingBottom: spacing.xl },
  item: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  itemActive: { backgroundColor: colors.ink },
  itemText: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  itemTextActive: { color: colors.paper },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  logout: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.danger },
});
