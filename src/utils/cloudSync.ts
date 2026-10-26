import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  AppNotification,
  BookingOrder,
  HomeServiceScheduleConfig,
  PointReward,
  ServiceItem,
  TimeSlot,
  User,
} from '../types/index.ts';
import { normalizePhoneDigits } from './spaLogic.ts';

export const CLOUD_COLLECTIONS = {
  CUSTOMERS: 'griya_customers',
  BOOKINGS: 'griya_bookings',
  NOTIFICATIONS: 'griya_notifications',
  CONFIG: 'griya_config',
} as const;

export const SETTINGS_DOC_ID = 'settings';
export const HOME_SERVICE_DOC_ID = 'home_service_schedule';

export interface GlobalSpaSettingsDoc {
  timeSlots?: TimeSlot[];
  closedWeekdays?: number[];
  closedSpecificDates?: string[];
  homeServiceSchedule?: HomeServiceScheduleConfig;
  adminProfile?: User;
  pointRewards?: PointReward[];
  singleServices?: ServiceItem[];
  packageServices?: ServiceItem[];
  updatedAt?: number;
}

const MAX_IMAGE_CHARS = 700_000;

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeCustomerPayload(user: User): User & { updatedAt: number } {
  const cleanPhone = normalizePhoneDigits(user.phone || '').slice(0, 30);
  const avatar =
    user.avatar && user.avatar.length <= MAX_IMAGE_CHARS ? user.avatar : undefined;

  return stripUndefined({
    id: user.id || cleanPhone || '0800000000',
    name: (user.name || 'Member Griya Ayu').trim().slice(0, 120) || 'Member Griya Ayu',
    phone: cleanPhone || '0800000000',
    pass: (user.pass || '123456').slice(0, 120),
    points: Math.max(0, Math.min(1_000_000, Number(user.points) || 0)),
    role: user.role === 'admin' ? 'admin' : user.role || 'customer',
    status: user.status || 'active',
    avatar,
    updatedAt: Date.now(),
  });
}

function sanitizeBookingPayload(order: BookingOrder): BookingOrder & { updatedAt: number } {
  const safeProof =
    order.paymentProofImage && order.paymentProofImage.length <= MAX_IMAGE_CHARS
      ? order.paymentProofImage
      : undefined;

  const safeRefund = order.refundRequest
    ? {
        ...order.refundRequest,
        proofImage:
          order.refundRequest.proofImage &&
          order.refundRequest.proofImage.length <= MAX_IMAGE_CHARS
            ? order.refundRequest.proofImage
            : undefined,
      }
    : undefined;

  return stripUndefined({
    ...order,
    id: Number(order.id) || Date.now(),
    customer: (order.customer || 'Pelanggan').slice(0, 120),
    wa: normalizePhoneDigits(order.wa || '0800000000').slice(0, 30),
    items: (order.items || 'Treatment Griya Ayu').slice(0, 500),
    date: (order.date || '2026-01-01').slice(0, 20),
    time: (order.time || '09:00').slice(0, 10),
    total: Math.max(0, Math.min(100_000_000, Number(order.total) || 0)),
    paymentStatus: (order.paymentStatus || 'Pending').slice(0, 60) as BookingOrder['paymentStatus'],
    status: (order.status || 'Pending_Payment').slice(0, 40) as BookingOrder['status'],
    healthNote: order.healthNote ? String(order.healthNote).trim().slice(0, 1000) : undefined,
    rescheduledAt: order.rescheduledAt ? String(order.rescheduledAt).slice(0, 80) : undefined,
    previousSchedule: order.previousSchedule
      ? String(order.previousSchedule).slice(0, 120)
      : undefined,
    paymentProofImage: safeProof,
    refundRequest: safeRefund,
    updatedAt: Date.now(),
  });
}

function sanitizeNotificationPayload(notif: AppNotification): AppNotification {
  const safePromoImg =
    notif.promoImage && notif.promoImage.length <= MAX_IMAGE_CHARS
      ? notif.promoImage
      : undefined;

  return stripUndefined({
    ...notif,
    id: Number(notif.id) || Date.now(),
    target: notif.target || 'customer',
    type: notif.type || 'payment_success',
    title: (notif.title || 'Info Griya Ayu').slice(0, 300),
    message: (notif.message || '-').slice(0, 3000),
    read: Boolean(notif.read),
    promoImage: safePromoImg,
  });
}

/**
 * Simpan / perbarui 1 akun pelanggan ke Firestore global.
 */
export async function syncCustomerToCloud(user: User): Promise<void> {
  const docId = normalizePhoneDigits(user.phone);
  if (!docId || docId.length < 5) return;
  const path = `${CLOUD_COLLECTIONS.CUSTOMERS}/${docId}`;
  try {
    const payload = sanitizeCustomerPayload(user);
    await setDoc(doc(db, CLOUD_COLLECTIONS.CUSTOMERS, docId), payload, { merge: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal: tetap berjalan dengan cache lokal bila koneksi sedang terputus
    }
  }
}

/**
 * Update HANYA field kata sandi (pass) milik pelanggan tertentu di Firestore
 * tanpa membuat dokumen baru dan tanpa mengubah ID, nomor WA, poin, maupun status member.
 */
export async function updateCustomerPasswordInCloud(
  existingCustomer: User,
  newPassword: string
): Promise<User> {
  const cleanPhone = normalizePhoneDigits(existingCustomer.phone);
  const updatedCustomer: User = {
    ...existingCustomer,
    id: existingCustomer.id || cleanPhone,
    phone: cleanPhone || existingCustomer.phone,
    pass: newPassword.trim(),
    role: existingCustomer.role === 'admin' ? 'admin' : existingCustomer.role || 'customer',
    status: existingCustomer.status || 'active',
  };
  if (!cleanPhone || cleanPhone.length < 5) return updatedCustomer;
  const path = `${CLOUD_COLLECTIONS.CUSTOMERS}/${cleanPhone}`;
  try {
    const payload = sanitizeCustomerPayload(updatedCustomer);
    await setDoc(doc(db, CLOUD_COLLECTIONS.CUSTOMERS, cleanPhone), payload, { merge: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal: tetap tersimpan di localStorage bila offline
    }
  }
  return updatedCustomer;
}

/**
 * Simpan / perbarui daftar pelanggan ke Firestore global.
 */
export async function syncAllCustomersToCloud(users: User[]): Promise<void> {
  await Promise.all(users.map((u) => syncCustomerToCloud(u)));
}

/**
 * Ambil 1 akun pelanggan langsung dari Firestore (dipakai saat login di perangkat baru).
 */
export async function fetchCustomerFromCloud(phone: string): Promise<User | null> {
  const docId = normalizePhoneDigits(phone);
  if (!docId || docId.length < 5) return null;
  const path = `${CLOUD_COLLECTIONS.CUSTOMERS}/${docId}`;
  try {
    const snap = await getDoc(doc(db, CLOUD_COLLECTIONS.CUSTOMERS, docId));
    if (snap.exists()) {
      return snap.data() as User;
    }
    return null;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      return null;
    }
  }
}

/**
 * Ambil seluruh daftar akun pelanggan langsung dari Firestore.
 */
export async function fetchAllCustomersFromCloud(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, CLOUD_COLLECTIONS.CUSTOMERS));
    const list: User[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      if (data && data.phone) {
        list.push(data);
      }
    });
    return list;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, CLOUD_COLLECTIONS.CUSTOMERS);
    } catch {
      return [];
    }
  }
}

/**
 * Simpan / perbarui 1 pesanan booking (termasuk status pembayaran, refund, dan omzet) ke Firestore global.
 */
export async function syncBookingToCloud(order: BookingOrder): Promise<void> {
  if (!order || !order.id) return;
  const docId = String(order.id);
  const path = `${CLOUD_COLLECTIONS.BOOKINGS}/${docId}`;
  try {
    const payload = sanitizeBookingPayload(order);
    await setDoc(doc(db, CLOUD_COLLECTIONS.BOOKINGS, docId), payload);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal fallback
    }
  }
}

/**
 * Hapus 1 pesanan booking dari Firestore global secara permanen (dipakai oleh Admin untuk menghapus pesanan iseng/main-main).
 */
export async function deleteBookingFromCloud(orderId: number): Promise<void> {
  if (!orderId) return;
  const docId = String(orderId);
  const path = `${CLOUD_COLLECTIONS.BOOKINGS}/${docId}`;
  try {
    await deleteDoc(doc(db, CLOUD_COLLECTIONS.BOOKINGS, docId));
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {
      // Non-fatal fallback
    }
  }
}

/**
 * Simpan / perbarui banyak pesanan booking ke Firestore global.
 */
export async function syncAllBookingsToCloud(orders: BookingOrder[]): Promise<void> {
  await Promise.all(orders.map((o) => syncBookingToCloud(o)));
}

/**
 * Simpan / perbarui 1 notifikasi ke Firestore global.
 */
export async function syncNotificationToCloud(notif: AppNotification): Promise<void> {
  if (!notif || !notif.id) return;
  const docId = String(notif.id);
  const path = `${CLOUD_COLLECTIONS.NOTIFICATIONS}/${docId}`;
  try {
    const payload = sanitizeNotificationPayload(notif);
    await setDoc(doc(db, CLOUD_COLLECTIONS.NOTIFICATIONS, docId), payload);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal fallback
    }
  }
}

/**
 * Hapus 1 notifikasi dari Firestore global secara permanen.
 */
export async function deleteNotificationFromCloud(notifId: number): Promise<void> {
  if (!notifId) return;
  const docId = String(notifId);
  const path = `${CLOUD_COLLECTIONS.NOTIFICATIONS}/${docId}`;
  try {
    await deleteDoc(doc(db, CLOUD_COLLECTIONS.NOTIFICATIONS, docId));
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {
      // Non-fatal fallback
    }
  }
}

/**
 * Simpan pengaturan operasional SPA & profil Admin ke Firestore global.
 */
export async function syncSpaSettingsToCloud(
  partialSettings: Partial<GlobalSpaSettingsDoc>
): Promise<void> {
  const path = `${CLOUD_COLLECTIONS.CONFIG}/${SETTINGS_DOC_ID}`;
  try {
    const cleaned = stripUndefined({
      ...partialSettings,
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, CLOUD_COLLECTIONS.CONFIG, SETTINGS_DOC_ID), cleaned, {
      merge: true,
    });
    if (partialSettings.homeServiceSchedule) {
      const hsPayload = stripUndefined({
        ...partialSettings.homeServiceSchedule,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, CLOUD_COLLECTIONS.CONFIG, HOME_SERVICE_DOC_ID), hsPayload, {
        merge: true,
      });
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal fallback
    }
  }
}

/**
 * Ambil pengaturan SPA & profil Admin langsung dari Firestore.
 */
export async function fetchSpaSettingsFromCloud(): Promise<GlobalSpaSettingsDoc | null> {
  const path = `${CLOUD_COLLECTIONS.CONFIG}/${SETTINGS_DOC_ID}`;
  try {
    const snap = await getDoc(doc(db, CLOUD_COLLECTIONS.CONFIG, SETTINGS_DOC_ID));
    if (snap.exists()) {
      return snap.data() as GlobalSpaSettingsDoc;
    }
    return null;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      return null;
    }
  }
}

/**
 * Berlangganan (real-time listener) seluruh koleksi global di Firestore
 * agar setiap perubahan dari HP pelanggan atau HP Admin langsung tersinkronisasi otomatis.
 */
export function subscribeToGlobalCloudState(callbacks: {
  onCustomersSnapshot: (customers: User[]) => void;
  onBookingsSnapshot: (bookings: BookingOrder[]) => void;
  onNotificationsSnapshot: (notifications: AppNotification[]) => void;
  onSettingsSnapshot: (settings: GlobalSpaSettingsDoc) => void;
}): Unsubscribe {
  const unsubCustomers = onSnapshot(
    collection(db, CLOUD_COLLECTIONS.CUSTOMERS),
    (snapshot) => {
      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as User;
        if (data && data.phone) {
          list.push(data);
        }
      });
      callbacks.onCustomersSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CLOUD_COLLECTIONS.CUSTOMERS);
      } catch {
        // Ignore listener error in offline state
      }
    }
  );

  const unsubBookings = onSnapshot(
    collection(db, CLOUD_COLLECTIONS.BOOKINGS),
    (snapshot) => {
      const list: BookingOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BookingOrder;
        if (data && typeof data.id === 'number') {
          list.push(data);
        }
      });
      list.sort((a, b) => b.id - a.id);
      callbacks.onBookingsSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CLOUD_COLLECTIONS.BOOKINGS);
      } catch {
        // Ignore listener error in offline state
      }
    }
  );

  const unsubNotifications = onSnapshot(
    collection(db, CLOUD_COLLECTIONS.NOTIFICATIONS),
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AppNotification;
        if (data && typeof data.id === 'number') {
          list.push(data);
        }
      });
      list.sort((a, b) => b.id - a.id);
      callbacks.onNotificationsSnapshot(list.slice(0, 150));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CLOUD_COLLECTIONS.NOTIFICATIONS);
      } catch {
        // Ignore listener error in offline state
      }
    }
  );

  const unsubSettings = onSnapshot(
    doc(db, CLOUD_COLLECTIONS.CONFIG, SETTINGS_DOC_ID),
    (docSnap) => {
      if (docSnap.exists()) {
        callbacks.onSettingsSnapshot(docSnap.data() as GlobalSpaSettingsDoc);
      }
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.GET,
          `${CLOUD_COLLECTIONS.CONFIG}/${SETTINGS_DOC_ID}`
        );
      } catch {
        // Ignore listener error in offline state
      }
    }
  );

  return () => {
    unsubCustomers();
    unsubBookings();
    unsubNotifications();
    unsubSettings();
  };
}
