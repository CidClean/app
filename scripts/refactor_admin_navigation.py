from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
dashboard_path = root / "frontend/app/admin/dashboard.tsx"
reservations_path = root / "frontend/app/admin/reservas.tsx"
schedule_path = root / "frontend/app/admin/horarios.tsx"
login_path = root / "frontend/app/admin/login.tsx"

dashboard = dashboard_path.read_text(encoding="utf-8")
reservations = reservations_path.read_text(encoding="utf-8")
schedule = schedule_path.read_text(encoding="utf-8")
login = login_path.read_text(encoding="utf-8")

dashboard = dashboard.replace(
    "import { router } from 'expo-router';",
    "import { router, useLocalSearchParams } from 'expo-router';",
    1,
)
dashboard = dashboard.replace(
    "import { SectionHead } from '@/src/components/SectionHead';",
    "import { SectionHead } from '@/src/components/SectionHead';\nimport { AdminMenu, DashboardSection } from '@/src/components/AdminMenu';",
    1,
)
dashboard = dashboard.replace(
    "type Tab = 'inicio' | 'servicios' | 'zonas' | 'faqs' | 'resenas' | 'clientes' | 'contenido' | 'fotos' | 'ajustes' | 'cuenta';",
    "type Tab = DashboardSection;",
    1,
)
dashboard = dashboard.replace(
    "  const insets = useSafeAreaInsets();\n  const [tab, setTab] = useState<Tab>('inicio');",
    "  const insets = useSafeAreaInsets();\n  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();\n  const [tab, setTab] = useState<Tab>('inicio');",
    1,
)

auth_effect = """  useEffect(() => {
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
"""
auth_replacement = """  useEffect(() => {
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
"""
if auth_effect not in dashboard:
    raise SystemExit("Dashboard auth block was not found")
dashboard = dashboard.replace(auth_effect, auth_replacement, 1)

old_navigation = """      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Panel</Text>
          <Text style={styles.brandSub}>{email}</Text>
        </View>
        <Pressable onPress={logout} testID="admin-logout-btn" style={styles.logoutBtn}>
          <Feather name="log-out" size={16} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {(['inicio','servicios','zonas','faqs','resenas','clientes','contenido','fotos','ajustes','cuenta'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabChip, tab === t && styles.tabChipActive]} testID={`tab-${t}`}>
            <Text style={[styles.tabText, tab === t && { color: colors.paper }]}>{labelFor(t)}</Text>
          </Pressable>
        ))}
      </ScrollView>
"""
new_navigation = """      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AdminMenu current={tab} onSelectSection={setTab} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>{labelFor(tab)}</Text>
          <Text style={styles.brandSub}>{email}</Text>
        </View>
      </View>
"""
if old_navigation not in dashboard:
    raise SystemExit("Dashboard horizontal navigation block was not found")
dashboard = dashboard.replace(old_navigation, new_navigation, 1)

settings_replacement = """function SettingsTab() {
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

function FormField"""
dashboard, count = re.subn(
    r"function SettingsTab\(\) \{.*?\n\}\n\nfunction FormField",
    settings_replacement,
    dashboard,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"Expected one SettingsTab replacement, got {count}")

reservations = reservations.replace(
    "import { PillButton } from '@/src/components/PillButton';",
    "import { PillButton } from '@/src/components/PillButton';\nimport { AdminMenu } from '@/src/components/AdminMenu';",
    1,
)
reservations_old_header = """        <Pressable onPress={() => router.replace('/admin/dashboard')} style={styles.iconButton} accessibilityLabel="Volver al panel">
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reservas</Text>
          <Text style={styles.subtitle}>WhatsApp, confirmación y seguimiento</Text>
        </View>
        <Pressable onPress={() => router.push('/admin/horarios')} style={styles.iconButton} accessibilityLabel="Configurar horarios">
          <Feather name="calendar" size={18} color={colors.ink} />
        </Pressable>
"""
reservations_new_header = """        <AdminMenu current="reservas" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reservas</Text>
          <Text style={styles.subtitle}>WhatsApp, confirmación y seguimiento</Text>
        </View>
"""
if reservations_old_header not in reservations:
    raise SystemExit("Reservations header block was not found")
reservations = reservations.replace(reservations_old_header, reservations_new_header, 1)

schedule = schedule.replace(
    "import { PillButton } from '@/src/components/PillButton';",
    "import { PillButton } from '@/src/components/PillButton';\nimport { AdminMenu } from '@/src/components/AdminMenu';",
    1,
)
schedule_old_header = """        <Pressable onPress={() => router.replace('/admin/reservas')} style={styles.iconButton} accessibilityLabel="Volver a reservas">
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Horarios</Text>
          <Text style={styles.subtitle}>Agenda independiente por día</Text>
        </View>
"""
schedule_new_header = """        <AdminMenu current="horarios" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Horarios</Text>
          <Text style={styles.subtitle}>Agenda independiente por día</Text>
        </View>
"""
if schedule_old_header not in schedule:
    raise SystemExit("Schedule header block was not found")
schedule = schedule.replace(schedule_old_header, schedule_new_header, 1)

login = login.replace("router.replace('/admin/reservas');", "router.replace('/admin/dashboard');", 1)

dashboard_path.write_text(dashboard, encoding="utf-8")
reservations_path.write_text(reservations, encoding="utf-8")
schedule_path.write_text(schedule, encoding="utf-8")
login_path.write_text(login, encoding="utf-8")

(root / ".github/workflows/refactor-admin-navigation-once.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
