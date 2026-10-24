/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  BookingOrder,
  TimeSlot,
  Language,
  AppNotification,
  PaymentMethodType,
  RefundRequestInfo,
  PointReward,
} from './types/index.ts';
import {
  INITIAL_USERS,
  INITIAL_BOOKINGS,
  INITIAL_TIME_SLOTS,
  INITIAL_NOTIFICATIONS,
  POINT_REWARDS,
} from './data/mockData.ts';
import {
  applyPointsCompletion,
  formatRupiah,
  getTodayIso,
  getPaymentMethodDetails,
  buildAdminWaConfirmationMessage,
  buildCustomerToAdminRefundWaMessage,
  buildAdminApproveRefundWaMessage,
  buildAdminRejectRefundWaMessage,
  STORAGE_KEYS,
  safeLoadJson,
  safeSaveJson,
  normalizePhoneDigits,
  loadCustomersPersistently,
  saveCustomersPersistently,
  loadBookingsPersistently,
  saveBookingsPersistently,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  GRIYA_AYU_ADDRESS,
  GRIYA_AYU_MAPS_URL,
} from './utils/spaLogic.ts';
import {
  subscribeToGlobalCloudState,
  syncCustomerToCloud,
  syncBookingToCloud,
  syncNotificationToCloud,
  syncSpaSettingsToCloud,
} from './utils/cloudSync.ts';
import { CelebrationLayer } from './components/CelebrationLayer.tsx';
import { ToastModal } from './components/ToastModal.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.tsx';

export default function App() {
  // Language State ('id' | 'en')
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    return saved === 'en' ? 'en' : 'id';
  });

  // Daftar pelanggan terdaftar disimpan secara persisten di localStorage
  const [customers, setCustomers] = useState<User[]>(() =>
    loadCustomersPersistently(INITIAL_USERS)
  );

  // Pulihkan sesi login terakhir (Pelanggan maupun Admin) agar saat di-refresh tidak keluar
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = loadActiveSession();
    if (!session) return null;
    if (session.isAdmin) {
      const savedAdmin = safeLoadJson<User | null>(STORAGE_KEYS.ADMIN_PROFILE, null);
      const baseAdmin = savedAdmin || session.user;
      return baseAdmin.phone === '085183110392'
        ? { ...baseAdmin, phone: '087765573476' }
        : baseAdmin;
    }
    const storedList = loadCustomersPersistently(INITIAL_USERS);
    const matched = storedList.find(
      (u) => normalizePhoneDigits(u.phone) === normalizePhoneDigits(session.user.phone)
    );
    return matched || session.user;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const session = loadActiveSession();
    return Boolean(session?.isAdmin);
  });

  const [activeScreen, setActiveScreen] = useState<'auth' | 'app'>(() => {
    const session = loadActiveSession();
    return session ? 'app' : 'auth';
  });

  // Riwayat Booking & Data Omzet Harian/Bulanan dipulihkan dari localStorage + Buku Besar Omzet
  const [bookings, setBookings] = useState<BookingOrder[]>(() =>
    loadBookingsPersistently(INITIAL_BOOKINGS)
  );

  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    safeLoadJson<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)
  );

  const [masterTimeSlots, setMasterTimeSlots] = useState<TimeSlot[]>(() =>
    safeLoadJson<TimeSlot[]>(STORAGE_KEYS.SLOTS, INITIAL_TIME_SLOTS)
  );

  const [pointRewards, setPointRewards] = useState<PointReward[]>(() =>
    safeLoadJson<PointReward[]>(STORAGE_KEYS.POINT_REWARDS, POINT_REWARDS)
  );

  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(() =>
    safeLoadJson<number[]>(STORAGE_KEYS.CLOSED_WEEKDAYS, [0])
  );
  const [closedSpecificDates, setClosedSpecificDates] = useState<string[]>(() =>
    safeLoadJson<string[]>(STORAGE_KEYS.CLOSED_DATES, [])
  );

  const [adminProfile, setAdminProfile] = useState<User | null>(() => {
    const loaded = safeLoadJson<User | null>(STORAGE_KEYS.ADMIN_PROFILE, null);
    if (loaded && loaded.phone === '085183110392') {
      return { ...loaded, phone: '087765573476' };
    }
    return loaded;
  });

  // Modals & Popups
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<number | null>(null);

  // Modal Struk Booking Resmi (bisa dilihat saat masih Pending maupun setelah Berhasil)
  const [receiptOrderId, setReceiptOrderId] = useState<number | null>(null);

  // Toast State
  const [toast, setToast] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    waUrl?: string | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    waUrl: null,
  });

  // Celebration state
  const [celebration, setCelebration] = useState<{
    pointsText: string | null;
    confettiActive: boolean;
  }>({
    pointsText: null,
    confettiActive: false,
  });

  // =========================================================================
  // REAL-TIME GLOBAL CLOUD SYNC (FIRESTORE LINTAS PERANGKAT / VERCEL)
  // =========================================================================
  useEffect(() => {
    const unsubscribe = subscribeToGlobalCloudState({
      onCustomersSnapshot: (cloudCustomers) => {
        setCustomers((prevLocal) => {
          const mapByPhone = new Map<string, User>();
          const missingInCloud: User[] = [];

          // Utamakan data dari Cloud
          cloudCustomers.forEach((cu) => {
            const key = normalizePhoneDigits(cu.phone);
            if (key) mapByPhone.set(key, cu);
          });

          // Jika ada data di perangkat lokal yang belum pernah terunggah ke Cloud, migrasikan otomatis
          prevLocal.forEach((lu) => {
            const key = normalizePhoneDigits(lu.phone);
            if (key && !mapByPhone.has(key)) {
              mapByPhone.set(key, lu);
              missingInCloud.push(lu);
            }
          });

          if (missingInCloud.length > 0) {
            missingInCloud.forEach((u) => {
              void syncCustomerToCloud(u);
            });
          }

          const merged = Array.from(mapByPhone.values());
          saveCustomersPersistently(merged);

          // Perbarui currentUser jika pelanggan sedang login (misal poin bertambah / sandi berubah)
          setCurrentUser((curr) => {
            if (!curr || curr.role === 'admin') return curr;
            const updatedSelf = mapByPhone.get(normalizePhoneDigits(curr.phone));
            if (
              updatedSelf &&
              (updatedSelf.points !== curr.points ||
                updatedSelf.name !== curr.name ||
                updatedSelf.pass !== curr.pass ||
                updatedSelf.avatar !== curr.avatar)
            ) {
              saveActiveSession(updatedSelf, false);
              return updatedSelf;
            }
            return curr;
          });

          return merged;
        });
      },

      onBookingsSnapshot: (cloudBookings) => {
        setBookings((prevLocal) => {
          const mapById = new Map<number, BookingOrder>();
          const missingInCloud: BookingOrder[] = [];

          cloudBookings.forEach((cb) => {
            if (cb && typeof cb.id === 'number') {
              mapById.set(cb.id, cb);
            }
          });

          prevLocal.forEach((lb) => {
            if (lb && typeof lb.id === 'number' && !mapById.has(lb.id)) {
              mapById.set(lb.id, lb);
              missingInCloud.push(lb);
            }
          });

          if (missingInCloud.length > 0) {
            missingInCloud.forEach((b) => {
              void syncBookingToCloud(b);
            });
          }

          const merged = Array.from(mapById.values()).sort((a, b) => b.id - a.id);
          saveBookingsPersistently(merged);
          return merged;
        });
      },

      onNotificationsSnapshot: (cloudNotifs) => {
        setNotifications((prevLocal) => {
          const mapById = new Map<number, AppNotification>();
          const missingInCloud: AppNotification[] = [];

          cloudNotifs.forEach((cn) => {
            if (cn && typeof cn.id === 'number') {
              mapById.set(cn.id, cn);
            }
          });

          prevLocal.forEach((ln) => {
            if (ln && typeof ln.id === 'number' && !mapById.has(ln.id)) {
              mapById.set(ln.id, ln);
              missingInCloud.push(ln);
            }
          });

          if (missingInCloud.length > 0) {
            missingInCloud.slice(0, 30).forEach((n) => {
              void syncNotificationToCloud(n);
            });
          }

          const merged = Array.from(mapById.values())
            .sort((a, b) => b.id - a.id)
            .slice(0, 150);
          safeSaveJson(STORAGE_KEYS.NOTIFICATIONS, merged);
          return merged;
        });
      },

      onSettingsSnapshot: (settings) => {
        if (Array.isArray(settings.timeSlots) && settings.timeSlots.length > 0) {
          setMasterTimeSlots(settings.timeSlots);
          safeSaveJson(STORAGE_KEYS.SLOTS, settings.timeSlots);
        }
        if (Array.isArray(settings.closedWeekdays)) {
          setClosedWeekdays(settings.closedWeekdays);
          safeSaveJson(STORAGE_KEYS.CLOSED_WEEKDAYS, settings.closedWeekdays);
        }
        if (Array.isArray(settings.closedSpecificDates)) {
          setClosedSpecificDates(settings.closedSpecificDates);
          safeSaveJson(STORAGE_KEYS.CLOSED_DATES, settings.closedSpecificDates);
        }
        if (Array.isArray(settings.pointRewards)) {
          setPointRewards(settings.pointRewards);
          safeSaveJson(STORAGE_KEYS.POINT_REWARDS, settings.pointRewards);
        }
        if (settings.adminProfile) {
          const normalizedAdmin: User =
            settings.adminProfile.phone === '085183110392'
              ? { ...settings.adminProfile, phone: '087765573476' }
              : settings.adminProfile;
          setAdminProfile(normalizedAdmin);
          safeSaveJson(STORAGE_KEYS.ADMIN_PROFILE, normalizedAdmin);
          setCurrentUser((curr) => {
            if (!curr || curr.role !== 'admin') return curr;
            saveActiveSession(normalizedAdmin, true);
            return normalizedAdmin;
          });
          if (settings.adminProfile.phone === '085183110392') {
            void syncSpaSettingsToCloud({ adminProfile: normalizedAdmin });
          }
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, language);
    } catch {
      // ignore
    }
  }, [language]);

  useEffect(() => {
    saveCustomersPersistently(customers);
  }, [customers]);

  useEffect(() => {
    saveBookingsPersistently(bookings);
  }, [bookings]);

  useEffect(() => {
    safeSaveJson(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  useEffect(() => {
    safeSaveJson(STORAGE_KEYS.SLOTS, masterTimeSlots);
  }, [masterTimeSlots]);

  useEffect(() => {
    safeSaveJson(STORAGE_KEYS.POINT_REWARDS, pointRewards);
  }, [pointRewards]);

  useEffect(() => {
    safeSaveJson(STORAGE_KEYS.CLOSED_WEEKDAYS, closedWeekdays);
  }, [closedWeekdays]);

  useEffect(() => {
    safeSaveJson(STORAGE_KEYS.CLOSED_DATES, closedSpecificDates);
  }, [closedSpecificDates]);

  useEffect(() => {
    if (currentUser && activeScreen === 'app') {
      saveActiveSession(currentUser, isAdmin);
    }
  }, [currentUser, isAdmin, activeScreen]);

  // Helper update bookings & langsung amankan ke Cloud Global + localStorage
  const updateBookingsAndPersist = (
    updater: (prev: BookingOrder[]) => BookingOrder[]
  ) => {
    setBookings((prev) => {
      const next = updater(prev);
      saveBookingsPersistently(next);
      // Sinkronkan setiap pesanan yang baru/berubah ke Firestore
      next.forEach((order) => {
        const oldOrder = prev.find((p) => p.id === order.id);
        if (!oldOrder || JSON.stringify(oldOrder) !== JSON.stringify(order)) {
          void syncBookingToCloud(order);
        }
      });
      return next;
    });
  };

  // Helper tambah notifikasi & langsung amankan ke Cloud Global + localStorage
  const addNotificationsAndSync = (newNotifs: AppNotification[]) => {
    newNotifs.forEach((n) => {
      void syncNotificationToCloud(n);
    });
    setNotifications((prev) => {
      const next = [...newNotifs, ...prev];
      safeSaveJson(STORAGE_KEYS.NOTIFICATIONS, next);
      return next;
    });
  };

  // Helper trigger celebration
  const triggerCelebration = (text: string) => {
    setCelebration({ pointsText: text, confettiActive: true });
    setTimeout(() => {
      setCelebration((prev) => ({ ...prev, pointsText: null }));
    }, 2400);
    setTimeout(() => {
      setCelebration({ pointsText: null, confettiActive: false });
    }, 2900);
  };

  const showToast = (title: string, message: string, waUrl?: string | null) => {
    setToast({
      isOpen: true,
      title,
      message,
      waUrl: waUrl || null,
    });
  };

  const closeToast = () => {
    setToast((prev) => ({ ...prev, isOpen: false }));
  };

  // Auth Handlers
  const handleLoginSuccess = (user: User, adminStatus: boolean) => {
    if (!adminStatus) {
      const latestStored = loadCustomersPersistently(customers);
      const found = latestStored.find(
        (u) => normalizePhoneDigits(u.phone) === normalizePhoneDigits(user.phone)
      );
      const resolvedUser = found || user;
      setCurrentUser(resolvedUser);
      setIsAdmin(false);
      setActiveScreen('app');
      saveActiveSession(resolvedUser, false);
      void syncCustomerToCloud(resolvedUser);
      triggerCelebration(`${resolvedUser.points} Poin Member`);
      return;
    }

    setCurrentUser(user);
    setAdminProfile(user);
    setIsAdmin(true);
    setActiveScreen('app');
    saveActiveSession(user, true);
    triggerCelebration('Mode Admin Aktif');
  };

  const handleRegisterSuccess = (user: User) => {
    void syncCustomerToCloud(user);
    setCustomers((prev) => {
      const exists = prev.some(
        (u) => normalizePhoneDigits(u.phone) === normalizePhoneDigits(user.phone)
      );
      const next = exists
        ? prev.map((u) =>
            normalizePhoneDigits(u.phone) === normalizePhoneDigits(user.phone) ? user : u
          )
        : [...prev, user];
      saveCustomersPersistently(next);
      return next;
    });
    setCurrentUser(user);
    setIsAdmin(false);
    setActiveScreen('app');
    saveActiveSession(user, false);
    triggerCelebration('Bonus +20 Poin!');
    showToast(
      'Pendaftaran Berhasil! 🎉',
      `Halo ${user.name}, akun member Anda sudah aktif dengan Bonus +20 Poin perdana. Silakan pilih layanan dan jadwal terapi Anda.`
    );
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    saveActiveSession(updatedUser, isAdmin);

    if (isAdmin) {
      setAdminProfile(updatedUser);
      safeSaveJson(STORAGE_KEYS.ADMIN_PROFILE, updatedUser);
      void syncSpaSettingsToCloud({ adminProfile: updatedUser });
    } else {
      void syncCustomerToCloud(updatedUser);
      setCustomers((prev) => {
        const idx = prev.findIndex(
          (u) => normalizePhoneDigits(u.phone) === normalizePhoneDigits(updatedUser.phone)
        );
        const next =
          idx !== -1
            ? prev.map((u, i) => (i === idx ? updatedUser : u))
            : [...prev, updatedUser];
        saveCustomersPersistently(next);
        return next;
      });
    }
  };

  const handleUpdateCustomerAccount = (updatedCustomer: User) => {
    void syncCustomerToCloud(updatedCustomer);
    setCustomers((prev) => {
      const idx = prev.findIndex(
        (u) => normalizePhoneDigits(u.phone) === normalizePhoneDigits(updatedCustomer.phone)
      );
      const next =
        idx !== -1
          ? prev.map((u, i) => (i === idx ? updatedCustomer : u))
          : [...prev, updatedCustomer];
      saveCustomersPersistently(next);
      return next;
    });
  };

  const handleLogout = () => {
    clearActiveSession();
    setCurrentUser(null);
    setIsAdmin(false);
    setActiveScreen('auth');
  };

  const nowFormatted = () =>
    new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Saat klik "Booking & Bayar Sekarang": buat order dengan status Pending (20 Menit)
  const handleOpenPaymentModal = (draft: {
    total: number;
    scheduleDatePretty: string;
    scheduleDateIso: string;
    selectedTimeSlot: string;
    itemsSummary: string;
    pointsEarned: number;
    pointsRedeemedCost: number;
  }) => {
    if (!currentUser) return;

    const methodInfo = getPaymentMethodDetails('qris', currentUser.phone);
    const newOrderId = Date.now();
    const newPendingBooking: BookingOrder = {
      id: newOrderId,
      customer: currentUser.name,
      wa: currentUser.phone,
      items: draft.itemsSummary,
      date: draft.scheduleDateIso,
      datePretty: draft.scheduleDatePretty,
      time: draft.selectedTimeSlot,
      total: draft.total,
      ptsEarned: draft.pointsEarned,
      ptsRedeemedCost: draft.pointsRedeemedCost,
      payMethod: methodInfo.label,
      payMethodType: 'qris',
      vaNumber: methodInfo.vaNumber,
      paymentStatus: 'Pending',
      expiresAt: Date.now() + 20 * 60 * 1000, // 20 Menit
      status: 'Pending_Payment',
      createdAt: nowFormatted(),
    };

    updateBookingsAndPersist((prev) => [newPendingBooking, ...prev]);
    setActivePaymentOrderId(newOrderId);
    setPaymentModalOpen(true);
  };

  // Otomatis ubah status booking Pending menjadi Gagal apabila batas waktu 20 menit telah berakhir
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setBookings((prev) => {
        const hasExpiredPending = prev.some(
          (b) => b.paymentStatus === 'Pending' && b.expiresAt <= now
        );
        if (!hasExpiredPending) return prev;

        const next = prev.map((b) => {
          if (b.paymentStatus === 'Pending' && b.expiresAt <= now) {
            const failedOrder: BookingOrder = {
              ...b,
              paymentStatus: 'Gagal',
              status: 'Cancelled',
            };
            void syncBookingToCloud(failedOrder);
            return failedOrder;
          }
          return b;
        });
        saveBookingsPersistently(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Konfirmasi dari Wizard Langkah 3 (simpan sebagai Pending di Riwayat saat masuk Langkah 3, atau kunci permanen saat Selesai Bayar)
  const handleConfirmWizardBooking = (draft: {
    total: number;
    scheduleDatePretty: string;
    scheduleDateIso: string;
    selectedTimeSlot: string;
    itemsSummary: string;
    pointsEarned: number;
    pointsRedeemedCost: number;
    payMethodType: PaymentMethodType;
    markAsPaid: boolean;
    paymentProofImage?: string;
    existingOrderId?: number | null;
    silentReceipt?: boolean;
  }): BookingOrder | null => {
    if (!currentUser) return null;

    const now = Date.now();
    const existingOrder = draft.existingOrderId
      ? bookings.find((b) => b.id === draft.existingOrderId)
      : undefined;

    // Jika sedang mencoba membayar pesanan Pending yang waktunya (20 menit) sudah habis -> otomatis GAGAL
    if (
      draft.markAsPaid &&
      existingOrder &&
      (existingOrder.paymentStatus === 'Gagal' || now >= existingOrder.expiresAt)
    ) {
      updateBookingsAndPersist((prev) =>
        prev.map((b) =>
          b.id === existingOrder.id
            ? { ...b, paymentStatus: 'Gagal', status: 'Cancelled' }
            : b
        )
      );
      showToast(
        'Waktu Pembayaran Habis (Gagal) ⏳',
        'Batas waktu pembayaran 20 menit untuk booking ini telah berakhir sehingga pembayaran tidak dapat diproses lagi. Silakan buat booking baru.'
      );
      return null;
    }

    const methodInfo = getPaymentMethodDetails(draft.payMethodType, currentUser.phone);
    const isUpdatingExistingPending =
      Boolean(existingOrder) &&
      existingOrder!.paymentStatus === 'Pending' &&
      now < existingOrder!.expiresAt;

    const targetOrderId = isUpdatingExistingPending ? existingOrder!.id : now;
    const targetExpiresAt = isUpdatingExistingPending
      ? existingOrder!.expiresAt
      : now + 20 * 60 * 1000;
    const isCash = draft.payMethodType === 'cash';

    if (draft.markAsPaid && draft.pointsRedeemedCost > 0) {
      const updatedUser: User = {
        ...currentUser,
        points: Math.max(0, currentUser.points - draft.pointsRedeemedCost),
      };
      setCurrentUser(updatedUser);
      saveActiveSession(updatedUser, isAdmin);
      void syncCustomerToCloud(updatedUser);

      setCustomers((prev) => {
        const next = prev.map((u) =>
          normalizePhoneDigits(u.phone) === normalizePhoneDigits(currentUser.phone)
            ? { ...u, points: updatedUser.points }
            : u
        );
        saveCustomersPersistently(next);
        return next;
      });
    }

    const resolvedPaymentStatus: BookingOrder['paymentStatus'] = !draft.markAsPaid
      ? 'Pending'
      : isCash
      ? 'Booking Cash (Bayar di Lokasi)'
      : 'Lunas';

    const newBooking: BookingOrder = {
      id: targetOrderId,
      customer: currentUser.name,
      wa: currentUser.phone,
      items: draft.itemsSummary,
      date: draft.scheduleDateIso,
      datePretty: draft.scheduleDatePretty,
      time: draft.selectedTimeSlot,
      total: draft.total,
      ptsEarned: draft.pointsEarned,
      ptsRedeemedCost: draft.pointsRedeemedCost,
      payMethod: methodInfo.label,
      payMethodType: draft.payMethodType,
      vaNumber: methodInfo.vaNumber,
      paymentStatus: resolvedPaymentStatus,
      expiresAt: targetExpiresAt,
      status: draft.markAsPaid ? 'Paid' : 'Pending_Payment',
      createdAt: isUpdatingExistingPending ? existingOrder!.createdAt : nowFormatted(),
      verifiedDateIso: !draft.markAsPaid
        ? undefined
        : isCash
        ? existingOrder?.verifiedDateIso
        : getTodayIso(),
      paymentProofImage: draft.paymentProofImage || existingOrder?.paymentProofImage,
    };

    updateBookingsAndPersist((prev) => {
      const exists = prev.some((b) => b.id === targetOrderId);
      if (exists) {
        return prev.map((b) => (b.id === targetOrderId ? newBooking : b));
      }
      return [newBooking, ...prev];
    });

    if (draft.markAsPaid) {
      const waConfirm = buildAdminWaConfirmationMessage(newBooking);
      const adminNotif: AppNotification = {
        id: Date.now() + 1,
        target: 'admin',
        type: 'payment_success',
        title: isCash
          ? `💵 Booking Baru (Cash) — ${newBooking.customer} (${newBooking.time} WIB)`
          : `✅ Booking Baru (LUNAS) — ${newBooking.customer} (${newBooking.time} WIB)`,
        message: isCash
          ? `Pelanggan ${newBooking.customer} (${newBooking.wa}) melakukan Booking Cash (Bayar di Lokasi) sebesar ${formatRupiah(
              newBooking.total
            )}. Slot jam ${newBooking.time} WIB otomatis terkunci.`
          : `Pelanggan ${newBooking.customer} (${newBooking.wa}) telah menyelesaikan pembayaran ${formatRupiah(
              newBooking.total
            )} via ${newBooking.payMethod} (Status: LUNAS). Slot jam ${newBooking.time} WIB otomatis terkunci.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: newBooking.id,
        customerName: newBooking.customer,
        customerWa: newBooking.wa,
        waConfirmationText: waConfirm.text,
        waConfirmationUrl: waConfirm.url,
      };

      const customerNotif: AppNotification = {
        id: Date.now() + 2,
        target: 'customer',
        targetPhone: newBooking.wa,
        type: 'payment_success',
        title: `🔒 Jadwal Jam ${newBooking.time} WIB Terkunci (${resolvedPaymentStatus})`,
        message: isCash
          ? `Booking Anda sebesar ${formatRupiah(
              newBooking.total
            )} dengan metode Cash / Bayar di Tempat telah berhasil mengunci jadwal ${
              newBooking.datePretty
            } • Jam ${newBooking.time} WIB. Pembayaran dilakukan di kasir saat kedatangan.\n📍 Alamat Studio: ${GRIYA_AYU_ADDRESS}`
          : `Pembayaran Anda sebesar ${formatRupiah(newBooking.total)} melalui ${
              newBooking.payMethod
            } telah diterima (Status: LUNAS). Jadwal ${
              newBooking.datePretty
            } • Jam ${newBooking.time} WIB kini resmi terkunci untuk Anda.\n📍 Alamat Studio: ${GRIYA_AYU_ADDRESS}`,
        createdAt: nowFormatted(),
        read: false,
        orderId: newBooking.id,
      };

      addNotificationsAndSync([adminNotif, customerNotif]);
      triggerCelebration(`Jam ${newBooking.time} Terkunci!`);
    } else if (!isUpdatingExistingPending) {
      const pendingNotif: AppNotification = {
        id: Date.now() + 1,
        target: 'customer',
        targetPhone: newBooking.wa,
        type: 'payment_pending',
        title: `⏳ Menunggu Pembayaran (20 Menit) — Jam ${newBooking.time} WIB`,
        message: `Tagihan ${formatRupiah(newBooking.total)} (${newBooking.payMethod}) tersimpan di menu Riwayat dengan waktu tunggu 20 menit. Segera selesaikan pembayaran sebelum waktu habis.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: newBooking.id,
      };
      addNotificationsAndSync([pendingNotif]);
    }

    if (!draft.silentReceipt) {
      setReceiptOrderId(newBooking.id);
    }
    return newBooking;
  };

  // Ubah metode pembayaran (QRIS vs Transfer Bank vs Cash)
  const handleChangeMethodType = (orderId: number, methodType: PaymentMethodType) => {
    updateBookingsAndPersist((prev) =>
      prev.map((b) => {
        if (b.id !== orderId) return b;
        const details = getPaymentMethodDetails(methodType, b.wa);
        return {
          ...b,
          payMethodType: methodType,
          payMethod: details.label,
          vaNumber: details.vaNumber,
        };
      })
    );
  };

  // Jika modal pembayaran di-close sebelum bayar -> tetap tersimpan Pending 20 menit di Riwayat
  const handleClosePaymentWithoutPaying = () => {
    setPaymentModalOpen(false);
    const targetOrder = bookings.find((b) => b.id === activePaymentOrderId);
    if (targetOrder && targetOrder.paymentStatus === 'Pending') {
      const pendingNotif: AppNotification = {
        id: Date.now(),
        target: 'customer',
        targetPhone: targetOrder.wa,
        type: 'payment_pending',
        title: `⏳ Menunggu Pembayaran (20 Menit) — Jam ${targetOrder.time} WIB`,
        message: `Tagihan ${formatRupiah(targetOrder.total)} (${targetOrder.payMethod}) masih PENDING selama 20 menit. Buka menu Riwayat / Jadwal dan klik "Lihat Struk Pending & Bayar" untuk menyelesaikan pembayaran sebelum diambil pelanggan lain.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: targetOrder.id,
      };
      addNotificationsAndSync([pendingNotif]);
    }
  };

  // Jika Pembayaran Gagal
  const handlePaymentFailed = (orderId: number, methodType: PaymentMethodType) => {
    updateBookingsAndPersist((prev) =>
      prev.map((b) => {
        if (b.id !== orderId) return b;
        const details = getPaymentMethodDetails(methodType, b.wa);
        return {
          ...b,
          payMethodType: methodType,
          payMethod: details.label,
          vaNumber: details.vaNumber,
          paymentStatus: 'Gagal',
          status: 'Cancelled',
        };
      })
    );
  };

  // Jika Pembayaran / Konfirmasi Booking Selesai (via Modal Pembayaran atau di dalam Struk Pending dari Bar Riwayat)
  const handlePaymentSuccess = (
    orderId: number,
    methodType: PaymentMethodType,
    paymentProofImage?: string
  ) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;

    // Cek apakah batas waktu 20 menit sudah berakhir
    if (
      targetOrder.paymentStatus === 'Gagal' ||
      targetOrder.status === 'Cancelled' ||
      Date.now() >= targetOrder.expiresAt
    ) {
      handlePaymentFailed(orderId, methodType);
      setPaymentModalOpen(false);
      showToast(
        'Waktu Pembayaran 20 Menit Berakhir (Gagal) ⏳',
        'Maaf, batas waktu pembayaran 20 menit telah habis sehingga pesanan ini otomatis GAGAL dan tidak dapat dibayar lagi. Silakan buat booking baru.'
      );
      return;
    }

    const details = getPaymentMethodDetails(methodType, targetOrder.wa);
    const isCash = methodType === 'cash';

    // Kurangi poin jika member menukarkan poin
    if (currentUser && targetOrder.ptsRedeemedCost && targetOrder.ptsRedeemedCost > 0) {
      const updatedUser: User = {
        ...currentUser,
        points: Math.max(0, currentUser.points - targetOrder.ptsRedeemedCost),
      };
      setCurrentUser(updatedUser);
      saveActiveSession(updatedUser, isAdmin);
      void syncCustomerToCloud(updatedUser);

      setCustomers((prev) => {
        const next = prev.map((u) =>
          normalizePhoneDigits(u.phone) === normalizePhoneDigits(currentUser.phone)
            ? { ...u, points: updatedUser.points }
            : u
        );
        saveCustomersPersistently(next);
        return next;
      });
    }

    const resolvedStatus: BookingOrder['paymentStatus'] = isCash
      ? 'Booking Cash (Bayar di Lokasi)'
      : 'Lunas';

    const updatedOrder: BookingOrder = {
      ...targetOrder,
      payMethodType: methodType,
      payMethod: details.label,
      vaNumber: details.vaNumber,
      paymentStatus: resolvedStatus,
      status: 'Paid',
      verifiedDateIso: isCash ? targetOrder.verifiedDateIso : getTodayIso(),
      paymentProofImage: paymentProofImage || targetOrder.paymentProofImage,
    };

    updateBookingsAndPersist((prev) => prev.map((b) => (b.id === orderId ? updatedOrder : b)));

    // Buat Notifikasi Otomatis untuk Admin beserta Kata-Kata Konfirmasi WA Pelanggan
    const waConfirm = buildAdminWaConfirmationMessage(updatedOrder);
    const adminNotif: AppNotification = {
      id: Date.now() + 1,
      target: 'admin',
      type: 'payment_success',
      title: isCash
        ? `💵 Booking Baru (Cash) — ${updatedOrder.customer} (${updatedOrder.time} WIB)`
        : `✅ Booking Baru (LUNAS) — ${updatedOrder.customer} (${updatedOrder.time} WIB)`,
      message: isCash
        ? `Pelanggan ${updatedOrder.customer} (${updatedOrder.wa}) melakukan Booking Cash sebesar ${formatRupiah(
            updatedOrder.total
          )}. Slot jam ${updatedOrder.time} WIB otomatis terkunci (abu-abu).`
        : `Pelanggan ${updatedOrder.customer} (${updatedOrder.wa}) telah membayar ${formatRupiah(
            updatedOrder.total
          )} via ${updatedOrder.payMethod} (Status: LUNAS). Slot jam ${updatedOrder.time} WIB otomatis terkunci (abu-abu).`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
      customerName: updatedOrder.customer,
      customerWa: updatedOrder.wa,
      waConfirmationText: waConfirm.text,
      waConfirmationUrl: waConfirm.url,
    };

    // Buat Notifikasi Otomatis untuk Pelanggan
    const customerNotif: AppNotification = {
      id: Date.now() + 2,
      target: 'customer',
      targetPhone: updatedOrder.wa,
      type: 'payment_success',
      title: `🔒 Jam ${updatedOrder.time} WIB Terkunci (${resolvedStatus})`,
      message: isCash
        ? `Jadwal ${updatedOrder.datePretty} • Jam ${updatedOrder.time} WIB telah dikunci (Booking Cash - Bayar di Lokasi).\n📍 Alamat Griya Ayu: ${GRIYA_AYU_ADDRESS}`
        : `Pembayaran Anda sebesar ${formatRupiah(
            updatedOrder.total
          )} telah diterima (Status: LUNAS). Jadwal ${
            updatedOrder.datePretty
          } • Jam ${updatedOrder.time} WIB resmi terkunci.\n📍 Alamat Griya Ayu: ${GRIYA_AYU_ADDRESS}`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
    };

    addNotificationsAndSync([adminNotif, customerNotif]);
    setPaymentModalOpen(false);
    triggerCelebration(`Jam ${updatedOrder.time} Lock`);
    setReceiptOrderId(updatedOrder.id);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast('Berhasil Disalin', `${label} telah disalin ke papan klip.`);
  };

  // Admin Actions: ACC / Verifikasi Pesanan -> Ubah status menjadi Lunas & Terkonfirmasi
  const handleVerifyPayment = (orderId: number) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    const todayIso = getTodayIso();
    updateBookingsAndPersist((prev) =>
      prev.map((b) =>
        b.id === orderId
          ? {
              ...b,
              status: 'Verified',
              paymentStatus: 'Lunas',
              verifiedDateIso: b.verifiedDateIso || todayIso,
            }
          : b
      )
    );

    if (targetOrder) {
      const confirmNotif: AppNotification = {
        id: Date.now(),
        target: 'customer',
        targetPhone: targetOrder.wa,
        type: 'admin_confirmed',
        title: `✅ Pesanan Terkonfirmasi & Lunas — Jam ${targetOrder.time} WIB`,
        message: `Halo Kak ${targetOrder.customer}, pesanan Anda di GRIYA AYU SPORT MASSAGE & SPA untuk tanggal ${targetOrder.datePretty} jam ${targetOrder.time} WIB sudah kami KONFIRMASI (Status: LUNAS). Jadwal Anda sudah terkunci. Kami tunggu kedatangannya di Griya Ayu (${GRIYA_AYU_ADDRESS}) maksimal 10 menit sebelum jadwal ya. Terima kasih!`,
        createdAt: nowFormatted(),
        read: false,
        orderId: targetOrder.id,
      };
      addNotificationsAndSync([confirmNotif]);
    }

    triggerCelebration('Pesanan Lunas & ACC ✓');
  };

  const handleCompleteTreatment = (orderId: number) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;
    const todayIso = getTodayIso();

    updateBookingsAndPersist((prev) =>
      prev.map((b) =>
        b.id === orderId
          ? {
              ...b,
              status: 'Completed',
              paymentStatus: 'Lunas',
              verifiedDateIso: b.verifiedDateIso || todayIso,
            }
          : b
      )
    );

    if (
      currentUser &&
      normalizePhoneDigits(currentUser.phone) === normalizePhoneDigits(targetOrder.wa)
    ) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const updated = applyPointsCompletion(prev, targetOrder.ptsEarned);
        saveActiveSession(updated, isAdmin);
        void syncCustomerToCloud(updated);
        return updated;
      });
    }

    setCustomers((prev) => {
      const next = prev.map((u) => {
        if (normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)) {
          const updatedCustomer = { ...u, points: u.points + targetOrder.ptsEarned };
          void syncCustomerToCloud(updatedCustomer);
          return updatedCustomer;
        }
        return u;
      });
      saveCustomersPersistently(next);
      return next;
    });

    const rewardNotif: AppNotification = {
      id: Date.now(),
      target: 'customer',
      targetPhone: targetOrder.wa,
      type: 'points_reward',
      title: `🎁 +${targetOrder.ptsEarned} Poin Member Masuk ke Akun Anda!`,
      message: `Terima kasih telah melakukan sesi ${targetOrder.items} di Griya Ayu. Saldo +${targetOrder.ptsEarned} Poin telah ditambahkan dan siap ditukarkan pada sesi berikutnya.`,
      createdAt: nowFormatted(),
      read: false,
      orderId: targetOrder.id,
    };
    addNotificationsAndSync([rewardNotif]);

    triggerCelebration(`+${targetOrder.ptsEarned} Poin Terkirim!`);
    showToast(
      'Treatment Selesai & Poin Dikirim! 🎉',
      `Sesi terapi ${targetOrder.customer} selesai. +${targetOrder.ptsEarned} Poin telah ditambahkan ke akun pelanggan.`
    );
  };

  // Pelanggan Membatalkan Booking / Mengajukan Refund (Minimal 1 Jam Sebelum Jadwal -> Jadwal Langsung Kembali Tidak Terkunci)
  const handleRequestRefund = (orderId: number, refundInfo: RefundRequestInfo) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;

    const isCash =
      targetOrder.payMethodType === 'cash' ||
      refundInfo.isCashCancellation ||
      targetOrder.paymentStatus === 'Pending';

    // Jika pesanan Cash / Bayar di Tempat atau masih Pending belum bayar: langsung batalkan & kembalikan poin yang sempat ditukar
    if (isCash) {
      const ptsToRestore = targetOrder.ptsRedeemedCost || 0;
      if (ptsToRestore > 0) {
        if (
          currentUser &&
          normalizePhoneDigits(currentUser.phone) === normalizePhoneDigits(targetOrder.wa)
        ) {
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, points: prev.points + ptsToRestore };
            saveActiveSession(updated, isAdmin);
            void syncCustomerToCloud(updated);
            return updated;
          });
        }
        setCustomers((prev) => {
          const next = prev.map((u) => {
            if (normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)) {
              const updatedCustomer = { ...u, points: u.points + ptsToRestore };
              void syncCustomerToCloud(updatedCustomer);
              return updatedCustomer;
            }
            return u;
          });
          saveCustomersPersistently(next);
          return next;
        });
      }

      const cancelledCashOrder: BookingOrder = {
        ...targetOrder,
        paymentStatus: 'Refund Selesai / Dibatalkan',
        status: 'Cancelled',
        ptsEarned: 0,
        refundRequest: {
          ...refundInfo,
          isCashCancellation: true,
          processedAt: nowFormatted(),
        },
        refundRejectedReason: undefined,
      };

      updateBookingsAndPersist((prev) =>
        prev.map((b) => (b.id === orderId ? cancelledCashOrder : b))
      );

      const adminNotif: AppNotification = {
        id: Date.now() + 1,
        target: 'admin',
        type: 'refund_requested',
        title: `🔓 Booking Cash Dibatalkan — ${cancelledCashOrder.customer} (Jam ${cancelledCashOrder.time} WIB Terbuka)`,
        message: `Pelanggan ${cancelledCashOrder.customer} (${cancelledCashOrder.wa}) membatalkan jadwal Cash ${cancelledCashOrder.datePretty} • Jam ${cancelledCashOrder.time} WIB. Alasan: "${refundInfo.reason}". Slot jam ${cancelledCashOrder.time} WIB kini kembali tidak terkunci.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: cancelledCashOrder.id,
        customerName: cancelledCashOrder.customer,
        customerWa: cancelledCashOrder.wa,
      };

      const customerNotif: AppNotification = {
        id: Date.now() + 2,
        target: 'customer',
        targetPhone: cancelledCashOrder.wa,
        type: 'refund_approved',
        title: `✅ Booking Dibatalkan — Jam ${cancelledCashOrder.time} WIB Kembali Terbuka`,
        message: `Pesanan Anda untuk jadwal ${cancelledCashOrder.datePretty} • Jam ${cancelledCashOrder.time} WIB telah berhasil dibatalkan dan slot jadwal kembali tidak terkunci.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: cancelledCashOrder.id,
      };

      addNotificationsAndSync([adminNotif, customerNotif]);
      triggerCelebration(`Jam ${cancelledCashOrder.time} Terbuka!`);
      showToast(
        'Booking Berhasil Dibatalkan! 🔓',
        `Jadwal ${cancelledCashOrder.datePretty} • Jam ${cancelledCashOrder.time} WIB telah dibatalkan dan slot jam kembali tidak terkunci.`
      );
      return;
    }

    // Jika Non-Cash (QRIS / Transfer Bank / E-Wallet):
    // Batalkan jadwal (slot jam langsung kembali tidak terkunci) & kirim pengajuan refund ke Admin
    const updatedOrder: BookingOrder = {
      ...targetOrder,
      paymentStatus: 'Menunggu Cek Refund Admin',
      status: 'Refund_Requested',
      refundRequest: refundInfo,
      refundRejectedReason: undefined,
    };

    updateBookingsAndPersist((prev) => prev.map((b) => (b.id === orderId ? updatedOrder : b)));

    const waToAdminUrl = buildCustomerToAdminRefundWaMessage(updatedOrder);

    const adminNotif: AppNotification = {
      id: Date.now() + 1,
      target: 'admin',
      type: 'refund_requested',
      title: `⚠️ Pengajuan Refund Masuk — ${updatedOrder.customer} (${updatedOrder.time} WIB • Slot Terbuka)`,
      message: `Pelanggan ${updatedOrder.customer} (${updatedOrder.wa}) membatalkan booking #GA-${String(
        updatedOrder.id
      ).slice(-6)} & mengajukan refund sebesar ${formatRupiah(updatedOrder.total)} ke rekening ${
        refundInfo.bankName
      } ${refundInfo.accountNumber} (a.n. ${refundInfo.accountHolder}). Slot jam ${
        updatedOrder.time
      } WIB telah kembali tidak terkunci. Silakan transfer manual & klik ACC Refund di Tab Kelola Pesanan.`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
      customerName: updatedOrder.customer,
      customerWa: updatedOrder.wa,
    };

    const customerNotif: AppNotification = {
      id: Date.now() + 2,
      target: 'customer',
      targetPhone: updatedOrder.wa,
      type: 'refund_requested',
      title: `⏳ Booking Dibatalkan & Menunggu Refund Admin — Jam ${updatedOrder.time} WIB`,
      message: `Pembatalan booking & pengajuan refund sebesar ${formatRupiah(
        updatedOrder.total
      )} ke ${refundInfo.bankName} (${refundInfo.accountNumber}) telah dikirim ke Admin. Jadwal jam ${
        updatedOrder.time
      } WIB kini kembali tidak terkunci.`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
    };

    addNotificationsAndSync([adminNotif, customerNotif]);
    triggerCelebration(`Slot ${updatedOrder.time} Terbuka!`);
    showToast(
      'Booking Dibatalkan & Pengajuan Refund Terkirim! ⏳',
      `Jadwal jam ${updatedOrder.time} WIB kini kembali tidak terkunci dan pengajuan refund ke rekening ${refundInfo.bankName} (${refundInfo.accountNumber}) telah masuk ke Dashboard Admin. Klik tombol WhatsApp di bawah untuk mengirim pesan refund ke Admin.`,
      waToAdminUrl
    );
  };

  // Admin Menyetujui (ACC) Refund Setelah Transfer Manual -> Ubah Status Menjadi "Refund Selesai / Dibatalkan"
  const handleApproveRefund = (orderId: number) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;

    // Jika poin dari transaksi sudah pernah masuk atau ada penyesuaian poin transaksi, kurangi/batalkan poin tersebut
    const wasCompleted = targetOrder.status === 'Completed';
    const ptsToDeduct = wasCompleted ? targetOrder.ptsEarned : 0;
    const ptsToRestore = targetOrder.ptsRedeemedCost || 0;
    const netPointDelta = ptsToRestore - ptsToDeduct;

    if (netPointDelta !== 0) {
      if (
        currentUser &&
        normalizePhoneDigits(currentUser.phone) === normalizePhoneDigits(targetOrder.wa)
      ) {
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, points: Math.max(0, prev.points + netPointDelta) };
          saveActiveSession(updated, isAdmin);
          void syncCustomerToCloud(updated);
          return updated;
        });
      }

      setCustomers((prev) => {
        const next = prev.map((u) => {
          if (normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)) {
            const updatedCustomer = { ...u, points: Math.max(0, u.points + netPointDelta) };
            void syncCustomerToCloud(updatedCustomer);
            return updatedCustomer;
          }
          return u;
        });
        saveCustomersPersistently(next);
        return next;
      });
    }

    const updatedOrder: BookingOrder = {
      ...targetOrder,
      paymentStatus: 'Refund Selesai / Dibatalkan',
      status: 'Refund_Completed',
      ptsEarned: 0,
      refundRequest: targetOrder.refundRequest
        ? { ...targetOrder.refundRequest, processedAt: nowFormatted() }
        : undefined,
    };

    updateBookingsAndPersist((prev) => prev.map((b) => (b.id === orderId ? updatedOrder : b)));

    const waMsg = buildAdminApproveRefundWaMessage(updatedOrder);
    const customerNotif: AppNotification = {
      id: Date.now(),
      target: 'customer',
      targetPhone: updatedOrder.wa,
      type: 'refund_approved',
      title: `✅ Refund Selesai Ditransfer — #GA-${String(updatedOrder.id).slice(-6)}`,
      message: `Permintaan refund Anda sebesar ${formatRupiah(
        updatedOrder.total
      )} untuk pembatalan jadwal ${updatedOrder.datePretty} • Jam ${
        updatedOrder.time
      } WIB telah DI-ACC oleh Admin dan statusnya kini "Refund Selesai".`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
    };

    addNotificationsAndSync([customerNotif]);
    triggerCelebration('Refund Selesai ✓');
    showToast(
      'Refund Selesai (ACC Admin)! ✅',
      `Status pesanan ${updatedOrder.customer} telah diubah menjadi "Refund Selesai" dan jadwal jam ${updatedOrder.time} WIB tetap terbuka untuk pelanggan lain.`,
      waMsg.url
    );
  };

  // Admin Menolak Refund (Mengembalikan Status Pesanan / Membatalkan Klaim)
  const handleRejectRefund = (orderId: number, rejectReason?: string) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;

    const reasonText =
      rejectReason?.trim() ||
      'Bukti pembayaran awal tidak ditemukan pada mutasi rekening atau tidak valid.';

    const updatedOrder: BookingOrder = {
      ...targetOrder,
      paymentStatus: 'Berhasil',
      status: 'Paid',
      refundRejectedReason: reasonText,
    };

    updateBookingsAndPersist((prev) => prev.map((b) => (b.id === orderId ? updatedOrder : b)));

    const waMsg = buildAdminRejectRefundWaMessage(updatedOrder, reasonText);
    const customerNotif: AppNotification = {
      id: Date.now(),
      target: 'customer',
      targetPhone: updatedOrder.wa,
      type: 'refund_rejected',
      title: `❌ Pengajuan Refund Ditolak — Jam ${updatedOrder.time} WIB`,
      message: `Pengajuan refund untuk jadwal ${updatedOrder.datePretty} • Jam ${updatedOrder.time} WIB ditolak oleh Admin. Catatan: "${reasonText}". Status pesanan Anda dikembalikan menjadi aktif.`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
    };

    addNotificationsAndSync([customerNotif]);
    showToast(
      'Pengajuan Refund Ditolak',
      `Klaim refund dari ${updatedOrder.customer} telah dibatalkan dan status pesanan dikembalikan menjadi aktif.`,
      waMsg.url
    );
  };

  // Admin Bot Broadcast Promo ke Semua WA Pelanggan & Bar Notifikasi Pelanggan
  const handleBroadcastPromo = (promo: {
    title: string;
    message: string;
    imageUrl: string;
    promoCode: string;
  }) => {
    const promoNotif: AppNotification = {
      id: Date.now(),
      target: 'all_customers',
      type: 'promo_broadcast',
      title: promo.title,
      message: promo.message,
      promoImage: promo.imageUrl,
      promoCode: promo.promoCode,
      createdAt: nowFormatted(),
      read: false,
    };

    addNotificationsAndSync([promoNotif]);
    triggerCelebration('Bot Promo Terkirim!');
    showToast(
      'Bot Promo Berhasil Dikirim ke Semua Pelanggan! 🤖✨',
      `Promo "${promo.title}" (beserta gambar poster & kode ${promo.promoCode}) telah dikirim otomatis ke daftar WhatsApp seluruh pelanggan dan tampil di Bar Notifikasi Pelanggan.`
    );
  };

  const handleMarkCustomerNotificationsRead = () => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) => {
        const shouldMark =
          n.target === 'all_customers' ||
          (n.target === 'customer' &&
            (!n.targetPhone ||
              n.targetPhone.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')));
        if (shouldMark && !n.read) {
          const updated = { ...n, read: true };
          void syncNotificationToCloud(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const handleMarkAdminNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.target === 'admin' && !n.read) {
          const updated = { ...n, read: true };
          void syncNotificationToCloud(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const handleToggleWeekdayHoliday = (dayIdx: number) => {
    setClosedWeekdays((prev) => {
      const next = prev.includes(dayIdx)
        ? prev.filter((d) => d !== dayIdx)
        : [...prev, dayIdx];
      void syncSpaSettingsToCloud({ closedWeekdays: next });
      return next;
    });
  };

  const handleToggleCustomHolidayDate = (dateIso: string) => {
    setClosedSpecificDates((prev) => {
      const next = prev.includes(dateIso)
        ? prev.filter((d) => d !== dateIso)
        : [...prev, dateIso];
      void syncSpaSettingsToCloud({ closedSpecificDates: next });
      return next;
    });
  };

  const handleRemoveSpecificHoliday = (dateIso: string) => {
    setClosedSpecificDates((prev) => {
      const next = prev.filter((d) => d !== dateIso);
      void syncSpaSettingsToCloud({ closedSpecificDates: next });
      return next;
    });
  };

  const handleToggleMasterSlot = (slotTime: string) => {
    setMasterTimeSlots((prev) => {
      const next = prev.map((s) => (s.time === slotTime ? { ...s, active: !s.active } : s));
      void syncSpaSettingsToCloud({ timeSlots: next });
      return next;
    });
  };

  const handleAddNewTimeSlot = (slotTime: string) => {
    if (masterTimeSlots.some((s) => s.time === slotTime)) {
      showToast('Jam Sudah Ada', `Slot jam ${slotTime} sudah terdaftar.`);
      return;
    }
    const updated = [...masterTimeSlots, { time: slotTime, active: true }].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
    setMasterTimeSlots(updated);
    void syncSpaSettingsToCloud({ timeSlots: updated });
    showToast('Jam Ditambahkan', `Slot jam ${slotTime} berhasil ditambahkan.`);
  };

  // Kelola Katalog Penukaran Poin oleh Admin (Tambah / Edit / Hapus / Status)
  const handleUpdatePointRewards = (nextRewards: PointReward[]) => {
    setPointRewards(nextRewards);
    safeSaveJson(STORAGE_KEYS.POINT_REWARDS, nextRewards);
    void syncSpaSettingsToCloud({ pointRewards: nextRewards });
  };

  // Penukaran Poin Langsung oleh Pelanggan di Halaman Poin
  const handleRedeemPointReward = (reward: PointReward) => {
    if (!currentUser) return;
    const rewardTitle = reward.title || reward.label;
    if (reward.available === false) {
      showToast(
        'Reward Tidak Tersedia',
        `Mohon maaf, reward "${rewardTitle}" saat ini sedang tidak tersedia.`
      );
      return;
    }
    if (currentUser.points < reward.cost) {
      showToast(
        'Poin Belum Mencukupi',
        `Poin Anda saat ini ${currentUser.points} Poin. Dibutuhkan ${reward.cost} Poin untuk menukarkan "${rewardTitle}".`
      );
      return;
    }

    const nextPoints = Math.max(0, currentUser.points - reward.cost);
    const updatedUser: User = {
      ...currentUser,
      points: nextPoints,
    };

    setCurrentUser(updatedUser);
    saveActiveSession(updatedUser, isAdmin);
    void syncCustomerToCloud(updatedUser);

    setCustomers((prev) => {
      const next = prev.map((u) =>
        normalizePhoneDigits(u.phone) === normalizePhoneDigits(currentUser.phone)
          ? { ...u, points: nextPoints }
          : u
      );
      saveCustomersPersistently(next);
      return next;
    });

    const timestampStr = nowFormatted();
    const waRedeemText =
      `Halo Admin Griya Ayu, saya *${currentUser.name}* (${currentUser.phone}) telah menukarkan *${reward.cost} Poin Loyalitas* di aplikasi:\n\n` +
      `🎁 *Reward Ditukar:* ${rewardTitle}\n` +
      `📝 *Keterangan:* ${reward.description || '-'}\n` +
      `👑 *Sisa Poin Saya:* ${nextPoints} Poin\n` +
      `🕒 *Waktu Penukaran:* ${timestampStr}\n\n` +
      `Mohon dicatat untuk klaim reward saya ya Admin. Terima kasih!`;
    const waRedeemUrl = `https://wa.me/6287765573476?text=${encodeURIComponent(waRedeemText)}`;

    const adminNotif: AppNotification = {
      id: Date.now(),
      target: 'admin',
      type: 'points_reward',
      title: `🎁 Penukaran ${reward.cost} Poin — ${currentUser.name}`,
      message: `Pelanggan ${currentUser.name} (${currentUser.phone}) berhasil menukarkan ${reward.cost} Poin dengan reward "${rewardTitle}". Sisa poin pelanggan kini: ${nextPoints} Poin.`,
      createdAt: timestampStr,
      read: false,
      customerName: currentUser.name,
      customerWa: currentUser.phone,
    };

    const customerNotif: AppNotification = {
      id: Date.now() + 1,
      target: 'customer',
      targetPhone: currentUser.phone,
      type: 'points_reward',
      title: `🎉 Berhasil Tukar ${reward.cost} Poin: ${rewardTitle}`,
      message: `Selamat! Anda telah menukarkan ${reward.cost} Poin untuk "${rewardTitle}". Catatan: ${
        reward.description || 'Tunjukkan bukti notifikasi ini kepada Admin Griya Ayu saat kunjungan.'
      } Sisa saldo poin Anda: ${nextPoints} Poin.`,
      createdAt: timestampStr,
      read: false,
    };

    addNotificationsAndSync([adminNotif, customerNotif]);
    triggerCelebration(`🎁 Tukar ${reward.cost} Poin!`);
    showToast(
      'Penukaran Poin Berhasil! 🎁',
      `Anda berhasil menukarkan ${reward.cost} Poin untuk "${rewardTitle}". Sisa saldo poin Anda sekarang: ${nextPoints} Poin. Bukti penukaran juga tercatat di Bar Notifikasi.`,
      waRedeemUrl
    );
  };

  const activePaymentOrder = bookings.find((b) => b.id === activePaymentOrderId) || null;
  const activeReceiptOrder = bookings.find((b) => b.id === receiptOrderId) || null;

  const directWaUrl = `https://wa.me/6287765573476?text=${encodeURIComponent(
    currentUser
      ? `Halo Admin Griya Ayu (Rismawati), saya ${currentUser.name} (${currentUser.phone}) ingin berkonsultasi mengenai jadwal & layanan terapi.`
      : `Halo Admin Griya Ayu Sport Massage & Spa (Rismawati), saya ingin bertanya mengenai informasi layanan dan jadwal terapi.`
  )}`;

  return (
    <div className="min-h-screen bg-[#050e0a] text-stone-800 flex justify-center selection:bg-[#D4AF37] selection:text-[#0B261C]">
      {/* CONTAINER MOBILE UTAMA (max-w-md mx-auto) */}
      <div className="w-full max-w-md min-h-screen bg-[#F9F6F0] shadow-2xl relative flex flex-col border-x border-stone-800/80 overflow-x-clip">
        {/* Layer Perayaan Confetti & Floating +Poin */}
        <CelebrationLayer
          pointsText={celebration.pointsText}
          confettiActive={celebration.confettiActive}
        />

        {/* BANNER INSTALASI PWA KE LAYAR UTAMA HP */}
        <PWAInstallBanner />

        {/* =============================================================== */}
        {/* TAMPILAN AWAL: LOGIN & DAFTAR AKUN                              */}
        {/* =============================================================== */}
        {activeScreen === 'auth' && (
          <AuthScreen
            customers={customers}
            adminProfile={adminProfile}
            onLoginSuccess={handleLoginSuccess}
            onRegisterSuccess={handleRegisterSuccess}
            onShowToast={showToast}
          />
        )}

        {/* =============================================================== */}
        {/* HALAMAN KHUSUS CUSTOMER (100% TERPISAH DARI ADMIN)              */}
        {/* =============================================================== */}
        {activeScreen === 'app' && !isAdmin && currentUser && (
          <CustomerDashboard
            currentUser={currentUser}
            bookings={bookings}
            notifications={notifications}
            masterTimeSlots={masterTimeSlots}
            pointRewards={pointRewards}
            closedWeekdays={closedWeekdays}
            closedSpecificDates={closedSpecificDates}
            language={language}
            onChangeLanguage={setLanguage}
            onUpdateUser={handleUpdateUser}
            onOpenPaymentModal={handleOpenPaymentModal}
            onConfirmWizardBooking={handleConfirmWizardBooking}
            onRequestRefund={handleRequestRefund}
            onRedeemPointReward={handleRedeemPointReward}
            onCopyText={handleCopyText}
            onViewReceipt={(order) => setReceiptOrderId(order.id)}
            onMarkNotificationsRead={handleMarkCustomerNotificationsRead}
            onLogout={handleLogout}
            onShowToast={showToast}
          />
        )}

        {/* =============================================================== */}
        {/* HALAMAN KHUSUS ADMIN (087765573476 // RISMAWATI)                */}
        {/* =============================================================== */}
        {activeScreen === 'app' && isAdmin && currentUser && (
          <AdminDashboard
            currentUser={currentUser}
            customers={customers}
            bookings={bookings}
            notifications={notifications}
            masterTimeSlots={masterTimeSlots}
            pointRewards={pointRewards}
            closedWeekdays={closedWeekdays}
            closedSpecificDates={closedSpecificDates}
            language={language}
            onChangeLanguage={setLanguage}
            onUpdateUser={handleUpdateUser}
            onUpdateCustomerAccount={handleUpdateCustomerAccount}
            onUpdatePointRewards={handleUpdatePointRewards}
            onVerifyPayment={handleVerifyPayment}
            onCompleteTreatment={handleCompleteTreatment}
            onApproveRefund={handleApproveRefund}
            onRejectRefund={handleRejectRefund}
            onToggleWeekdayHoliday={handleToggleWeekdayHoliday}
            onToggleCustomHolidayDate={handleToggleCustomHolidayDate}
            onRemoveSpecificHoliday={handleRemoveSpecificHoliday}
            onToggleMasterSlot={handleToggleMasterSlot}
            onAddNewTimeSlot={handleAddNewTimeSlot}
            onBroadcastPromo={handleBroadcastPromo}
            onMarkAdminNotificationsRead={handleMarkAdminNotificationsRead}
            onViewReceipt={(order) => setReceiptOrderId(order.id)}
            onCopyText={handleCopyText}
            onLogout={handleLogout}
            onShowToast={showToast}
          />
        )}

        {/* =============================================================== */}
        {/* FLOATING LOGO WHATSAPP DI LAYAR LOGIN                           */}
        {/* =============================================================== */}
        {!isAdmin && activeScreen === 'auth' && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none z-40 px-4 flex justify-end">
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat Langsung ke WhatsApp Admin"
              className="tactile-btn pointer-events-auto w-12 h-12 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg border-2 border-[#D4AF37] flex items-center justify-center ring-2 ring-white/80"
            >
              <i className="fa-brands fa-whatsapp text-2xl"></i>
            </a>
          </div>
        )}

        {/* MODAL PEMBAYARAN OTOMATIS QRIS & VIRTUAL ACCOUNT + PIN (20 MENIT) */}
        <PaymentModal
          isOpen={paymentModalOpen}
          order={activePaymentOrder}
          onCloseWithoutPaying={handleClosePaymentWithoutPaying}
          onChangeMethodType={handleChangeMethodType}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailed={handlePaymentFailed}
          onCopyText={handleCopyText}
        />

        {/* MODAL STRUK PEMBAYARAN (BISA DILIHAT & DIBAYAR SAAT MASIH PENDING 20M) */}
        <ReceiptModal
          order={activeReceiptOrder}
          isAdmin={isAdmin}
          onClose={() => setReceiptOrderId(null)}
          onChangeMethodType={handleChangeMethodType}
          onPayFromReceipt={handlePaymentSuccess}
          onFailFromReceipt={handlePaymentFailed}
          onCopyText={handleCopyText}
        />

        {/* MODAL TOAST NOTIFIKASI */}
        <ToastModal
          isOpen={toast.isOpen}
          title={toast.title}
          message={toast.message}
          waUrl={toast.waUrl}
          onClose={closeToast}
        />
      </div>
    </div>
  );
}
