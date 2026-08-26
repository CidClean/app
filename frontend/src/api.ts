import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API = `${BASE}/api`;

const TOKEN_KEY = 'admin_token';

async function req<T = any>(path: string, opts: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (auth) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).detail || text; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text() as any;
}

export const api = {
  siteSettings: () => req('/site-settings'),
  services: () => req('/services'),
  zones: () => req('/zones'),
  faqs: () => req('/faqs'),
  testimonials: () => req('/testimonials'),
  policies: () => req('/policies'),
  bookingSettings: () => req('/booking-settings'),
  availableSlots: (serviceId: string, date: string) =>
    req(`/available-slots?service_id=${encodeURIComponent(serviceId)}&date_str=${date}`),
  createBooking: (body: any) => req('/bookings', { method: 'POST', body: JSON.stringify(body) }),

  // admin
  login: async (email: string, password: string) => {
    const r = await req<{ token: string; email: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, r.token);
    await AsyncStorage.setItem('admin_email', r.email);
    return r;
  },
  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem('admin_email');
  },
  getStoredEmail: () => AsyncStorage.getItem('admin_email'),
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  me: () => req('/admin/me', {}, true),

  adminCreateService: (body: any) => req('/admin/services', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateService: (id: string, body: any) => req(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteService: (id: string) => req(`/admin/services/${id}`, { method: 'DELETE' }, true),

  adminCreateZone: (body: any) => req('/admin/zones', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateZone: (id: string, body: any) => req(`/admin/zones/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteZone: (id: string) => req(`/admin/zones/${id}`, { method: 'DELETE' }, true),

  adminCreateFaq: (body: any) => req('/admin/faqs', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateFaq: (id: string, body: any) => req(`/admin/faqs/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteFaq: (id: string) => req(`/admin/faqs/${id}`, { method: 'DELETE' }, true),

  adminCreateTestimonial: (body: any) => req('/admin/testimonials', { method: 'POST', body: JSON.stringify(body) }, true),
  adminListTestimonials: () => req('/admin/testimonials', {}, true),
  adminUpdateTestimonial: (id: string, body: any) => req(`/admin/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteTestimonial: (id: string) => req(`/admin/testimonials/${id}`, { method: 'DELETE' }, true),

  adminBookings: () => req('/admin/bookings', {}, true),
  adminUpdateSiteSettings: (body: any) => req('/admin/site-settings', { method: 'PUT', body: JSON.stringify(body) }, true),
  adminUpdateBookingSettings: (body: any) => req('/admin/booking-settings', { method: 'PUT', body: JSON.stringify(body) }, true),
};

export type Service = {
  id: string; name: string; slug: string; short_description: string; full_description: string;
  price: number; currency: string; duration_minutes: number; buffer_minutes: number;
  active: boolean; display_order: number;
};
export type Zone = { id: string; neighborhood: string; featured: boolean; surcharge_amount?: number | null; surcharge_status: string; message: string; active: boolean; display_order: number; };
export type Faq = { id: string; question: string; answer: string; category: string; pending_confirmation: boolean; active: boolean; display_order: number; };
export type Testimonial = { id: string; display_name: string; service_name: string; content: string; permission_confirmed: boolean; active: boolean; display_order: number; };
export type SiteSettings = { business_name: string; full_name: string; descriptor: string; slogan: string; phone: string; whatsapp: string; email: string; city: string; instagram: string; facebook: string; booking_url: string; };
