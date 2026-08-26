import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API = `${BASE}/api`;
const TOKEN_KEY = 'admin_token';
const EMAIL_KEY = 'admin_email';

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  }
  try { return await SecureStore.getItemAsync(key); } catch { return AsyncStorage.getItem(key); }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
    return;
  }
  try { await SecureStore.setItemAsync(key, value); } catch { await AsyncStorage.setItem(key, value); }
}

async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch { await AsyncStorage.removeItem(key); }
}

async function req<T = any>(path: string, opts: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (auth) {
    const token = await storageGet(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
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
  privacyNotice: () => req('/privacy-notice'),
  bookingSettings: () => req('/booking-settings'),
  availableSlots: (serviceId: string, date: string) =>
    req(`/available-slots?service_id=${encodeURIComponent(serviceId)}&date_str=${encodeURIComponent(date)}`),
  createBooking: (body: any) => req('/bookings', { method: 'POST', body: JSON.stringify(body) }),

  login: async (email: string, password: string) => {
    const result = await req<{ token: string; email: string; expires_at?: string }>('/admin/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await storageSet(TOKEN_KEY, result.token);
    await storageSet(EMAIL_KEY, result.email);
    return result;
  },
  logout: async () => {
    try { await req('/admin/logout', { method: 'POST' }, true); } catch {}
    await storageRemove(TOKEN_KEY);
    await storageRemove(EMAIL_KEY);
  },
  getStoredEmail: () => storageGet(EMAIL_KEY),
  getToken: () => storageGet(TOKEN_KEY),
  me: () => req('/admin/me', {}, true),

  adminListServices: () => req('/admin/services', {}, true),
  adminCreateService: (body: any) => req('/admin/services', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateService: (id: string, body: any) => req(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteService: (id: string) => req(`/admin/services/${id}`, { method: 'DELETE' }, true),

  adminListZones: () => req('/admin/zones', {}, true),
  adminCreateZone: (body: any) => req('/admin/zones', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateZone: (id: string, body: any) => req(`/admin/zones/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteZone: (id: string) => req(`/admin/zones/${id}`, { method: 'DELETE' }, true),

  adminListFaqs: () => req('/admin/faqs', {}, true),
  adminCreateFaq: (body: any) => req('/admin/faqs', { method: 'POST', body: JSON.stringify(body) }, true),
  adminUpdateFaq: (id: string, body: any) => req(`/admin/faqs/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteFaq: (id: string) => req(`/admin/faqs/${id}`, { method: 'DELETE' }, true),

  adminCreateTestimonial: (body: any) => req('/admin/testimonials', { method: 'POST', body: JSON.stringify(body) }, true),
  adminListTestimonials: () => req('/admin/testimonials', {}, true),
  adminUpdateTestimonial: (id: string, body: any) => req(`/admin/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteTestimonial: (id: string) => req(`/admin/testimonials/${id}`, { method: 'DELETE' }, true),

  adminBookings: () => req('/admin/bookings', {}, true),
  adminUpdateBookingStatus: (id: string, status: BookingStatus, note = '') =>
    req(`/admin/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }, true),
  adminRescheduleBooking: (id: string, date: string, time: string) =>
    req(`/admin/bookings/${id}/reschedule`, { method: 'PUT', body: JSON.stringify({ date, time }) }, true),
  adminUpdateSiteSettings: (body: any) => req('/admin/site-settings', { method: 'PUT', body: JSON.stringify(body) }, true),
  adminUpdateBookingSettings: (body: any) => req('/admin/booking-settings', { method: 'PUT', body: JSON.stringify(body) }, true),
  changePassword: (current_password: string, new_password: string) =>
    req('/admin/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }, true),

  listMedia: (category?: string) => req(`/media${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  adminListMedia: () => req('/admin/media', {}, true),
  adminUpdateMedia: (id: string, body: any) => req(`/admin/media/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteMedia: (id: string) => req(`/admin/media/${id}`, { method: 'DELETE' }, true),

  contentBlocks: () => req('/content-blocks'),
  contentBlock: (key: string) => req(`/content-blocks/${encodeURIComponent(key)}`),
  adminUpdateContentBlock: (key: string, body: any) =>
    req(`/admin/content-blocks/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) }, true),

  adminListClients: () => req('/admin/clients', {}, true),
  adminGetClient: (id: string) => req(`/admin/clients/${id}`, {}, true),
  adminUpdateClient: (id: string, body: any) => req(`/admin/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  adminDeleteClient: (id: string) => req(`/admin/clients/${id}`, { method: 'DELETE' }, true),

  uploadMedia: async (uri: string, filename: string, mimeType: string, category: string) => {
    const token = await storageGet(TOKEN_KEY);
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('file', blob, filename);
    } else {
      form.append('file', { uri, name: filename, type: mimeType } as any);
    }
    const res = await fetch(`${API}/admin/upload?category=${encodeURIComponent(category)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form as any,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text; try { msg = JSON.parse(text).detail || text; } catch {}
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

export function absoluteMediaUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export type BookingStatus = 'pending_confirmation' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type Service = { id: string; name: string; slug: string; short_description: string; full_description: string; price: number; currency: string; duration_minutes: number; buffer_minutes: number; active: boolean; display_order: number; };
export type Zone = { id: string; neighborhood: string; featured: boolean; surcharge_amount?: number | null; surcharge_status: string; message: string; active: boolean; display_order: number; };
export type Faq = { id: string; question: string; answer: string; category: string; pending_confirmation: boolean; active: boolean; display_order: number; };
export type Testimonial = { id: string; display_name: string; service_name: string; content: string; permission_confirmed: boolean; active: boolean; display_order: number; };
export type SiteSettings = { business_name: string; full_name: string; descriptor: string; slogan: string; phone: string; whatsapp: string; email: string; city: string; instagram: string; facebook: string; booking_url: string; hero_image_url: string; about_image_url: string; };
export type Media = { id: string; storage_path: string; file_url: string; content_type: string; size: number; category: string; alt_text: string; active: boolean; display_order: number; created_at: string; };
export type ContentBlock = { section_key: string; eyebrow: string; title: string; content: string; cta_label?: string; cta_url?: string; active: boolean; };
export type Client = { id: string; phone: string; phone_key: string; name: string; first_seen_at: string; last_seen_at: string; bookings_count: number; last_address: string; last_neighborhood: string; last_latitude?: number | null; last_longitude?: number | null; notes: string; tags: string[]; };
