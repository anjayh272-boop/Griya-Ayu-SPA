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
} from './types/index.ts';
import {
  INITIAL_USERS,
  INITIAL_BOOKINGS,
  INITIAL_TIME_SLOTS,
  INITIAL_NOTIFICATIONS,
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
import { CelebrationLayer } from './components/CelebrationLayer.tsx';
import { ToastModal } from './components/ToastModal.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';

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
      return savedAdmin || session.user;
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

  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(() =>
    safeLoadJson<number[]>(STORAGE_KEYS.CLOSED_WEEKDAYS, [0])
  );
  const [closedSpecificDates, setClosedSpecificDates] = useState<string[]>(() =>
    safeLoadJson<string[]>(STORAGE_KEYS.CLOSED_DATES, [])
  );

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

  // Helper update bookings & langsung amankan ke localStorage secara sinkron
  const updateBookingsAndPersist = (
    updater: (prev: BookingOrder[]) => BookingOrder[]
  ) => {
    setBookings((prev) => {
      const next = updater(prev);
      saveBookingsPersistently(next);
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
      triggerCelebration(`${resolvedUser.points} Poin Member`);
      return;
    }

    setCurrentUser(user);
    setIsAdmin(true);
    setActiveScreen('app');
    saveActiveSession(user, true);
    triggerCelebration('Mode Admin Aktif');
  };

  const handleRegisterSuccess = (user: User) => {
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
      safeSaveJson(STORAGE_KEYS.ADMIN_PROFILE, updatedUser);
    } else {
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

  // Konfirmasi langsung dari Wizard Langkah 3 (Pembayaran & Konfirmasi) -> Munculkan Struk Digital & Kunci Jam
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
  }): BookingOrder | null => {
    if (!currentUser) return null;

    const methodInfo = getPaymentMethodDetails(draft.payMethodType, currentUser.phone);
    const newOrderId = Date.now();
    const isCash = draft.payMethodType === 'cash';

    if (draft.markAsPaid && draft.pointsRedeemedCost > 0) {
      const updatedUser: User = {
        ...currentUser,
        points: Math.max(0, currentUser.points - draft.pointsRedeemedCost),
      };
      setCurrentUser(updatedUser);
      saveActiveSession(updatedUser, isAdmin);

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
      : 'Menunggu Verifikasi Admin';

    const newBooking: BookingOrder = {
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
      payMethodType: draft.payMethodType,
      vaNumber: methodInfo.vaNumber,
      paymentStatus: resolvedPaymentStatus,
      expiresAt: Date.now() + 20 * 60 * 1000,
      status: draft.markAsPaid ? 'Paid' : 'Pending_Payment',
      createdAt: nowFormatted(),
      paymentProofImage: draft.paymentProofImage,
    };

    updateBookingsAndPersist((prev) => [newBooking, ...prev]);

    if (draft.markAsPaid) {
      const waConfirm = buildAdminWaConfirmationMessage(newBooking);
      const adminNotif: AppNotification = {
        id: Date.now() + 1,
        target: 'admin',
        type: 'payment_success',
        title: isCash
          ? `💵 Booking Cash Masuk! — ${newBooking.customer} (${newBooking.time} WIB)`
          : `💰 Bukti Bayar Masuk (Menunggu Verifikasi)! — ${newBooking.customer} (${newBooking.time} WIB)`,
        message: isCash
          ? `Pelanggan ${newBooking.customer} (${newBooking.wa}) melakukan Booking Cash (Bayar di Lokasi) sebesar ${formatRupiah(
              newBooking.total
            )}. Slot jam ${newBooking.time} WIB otomatis terkunci. Silakan klik ACC / Verifikasi Pesanan.`
          : `Pelanggan ${newBooking.customer} (${newBooking.wa}) telah mengirim bukti pembayaran ${formatRupiah(
              newBooking.total
            )} via ${newBooking.payMethod}. Slot jam ${newBooking.time} WIB otomatis terkunci (abu-abu). Silakan cek bukti & klik ACC / Verifikasi Pesanan.`,
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
          : `Bukti pembayaran Anda sebesar ${formatRupiah(newBooking.total)} melalui ${
              newBooking.payMethod
            } telah terkirim (Status: Menunggu Verifikasi Admin). Jadwal ${
              newBooking.datePretty
            } • Jam ${newBooking.time} WIB kini resmi terkunci untuk Anda.\n📍 Alamat Studio: ${GRIYA_AYU_ADDRESS}`,
        createdAt: nowFormatted(),
        read: false,
        orderId: newBooking.id,
      };

      setNotifications((prev) => [adminNotif, customerNotif, ...prev]);
      triggerCelebration(`Jam ${newBooking.time} Terkunci!`);
    } else {
      const pendingNotif: AppNotification = {
        id: Date.now() + 1,
        target: 'customer',
        targetPhone: newBooking.wa,
        type: 'payment_pending',
        title: `⏳ Menunggu Pembayaran (20 Menit) — Jam ${newBooking.time} WIB`,
        message: `Tagihan ${formatRupiah(newBooking.total)} (${newBooking.payMethod}) masih PENDING selama 20 menit. Buka menu Riwayat untuk menyelesaikan pembayaran.`,
        createdAt: nowFormatted(),
        read: false,
        orderId: newBooking.id,
      };
      setNotifications((prev) => [pendingNotif, ...prev]);
    }

    setReceiptOrderId(newBooking.id);
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
      setNotifications((prev) => [pendingNotif, ...prev]);
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
        };
      })
    );
  };

  // Jika Pembayaran / Konfirmasi Booking Selesai (via Modal Pembayaran atau di dalam Struk Pending)
  const handlePaymentSuccess = (
    orderId: number,
    methodType: PaymentMethodType,
    paymentProofImage?: string
  ) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    if (!targetOrder) return;

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
      : 'Menunggu Verifikasi Admin';

    const updatedOrder: BookingOrder = {
      ...targetOrder,
      payMethodType: methodType,
      payMethod: details.label,
      vaNumber: details.vaNumber,
      paymentStatus: resolvedStatus,
      status: 'Paid',
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
        ? `💵 Booking Cash Masuk! — ${updatedOrder.customer} (${updatedOrder.time} WIB)`
        : `💰 Bukti Bayar Masuk (Menunggu Verifikasi)! — ${updatedOrder.customer} (${updatedOrder.time} WIB)`,
      message: isCash
        ? `Pelanggan ${updatedOrder.customer} (${updatedOrder.wa}) melakukan Booking Cash sebesar ${formatRupiah(
            updatedOrder.total
          )}. Slot jam ${updatedOrder.time} WIB otomatis terkunci (abu-abu).`
        : `Pelanggan ${updatedOrder.customer} (${updatedOrder.wa}) telah mengunggah bukti bayar ${formatRupiah(
            updatedOrder.total
          )} via ${updatedOrder.payMethod}. Slot jam ${updatedOrder.time} WIB otomatis terkunci (abu-abu).`,
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
        : `Bukti pembayaran Anda sebesar ${formatRupiah(
            updatedOrder.total
          )} telah diterima (Status: Menunggu Verifikasi Admin). Jadwal ${
            updatedOrder.datePretty
          } • Jam ${updatedOrder.time} WIB resmi terkunci.\n📍 Alamat Griya Ayu: ${GRIYA_AYU_ADDRESS}`,
      createdAt: nowFormatted(),
      read: false,
      orderId: updatedOrder.id,
    };

    setNotifications((prev) => [adminNotif, customerNotif, ...prev]);
    setPaymentModalOpen(false);
    triggerCelebration(`Jam ${updatedOrder.time} Lock`);
    setReceiptOrderId(updatedOrder.id);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast('Berhasil Disalin', `${label} telah disalin ke papan klip.`);
  };

  // Admin Actions: ACC / Verifikasi Pesanan -> Ubah status menjadi "Terkonfirmasi (ACC Admin)" & Amankan ke Buku Besar Omzet
  const handleVerifyPayment = (orderId: number) => {
    const targetOrder = bookings.find((b) => b.id === orderId);
    const todayIso = getTodayIso();
    updateBookingsAndPersist((prev) =>
      prev.map((b) =>
        b.id === orderId
          ? {
              ...b,
              status: 'Verified',
              paymentStatus: 'Terkonfirmasi (ACC Admin)',
              verifiedDateIso: todayIso,
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
        title: `✅ Terkonfirmasi (ACC Admin) — Jam ${targetOrder.time} WIB`,
        message: `Halo Kak ${targetOrder.customer}, pesanan Anda di GRIYA AYU SPORT MASSAGE & SPA untuk tanggal ${targetOrder.datePretty} jam ${targetOrder.time} WIB sudah kami VERIFIKASI / ACC. Jadwal Anda sudah terkunci. Kami tunggu kedatangannya di Griya Ayu (${GRIYA_AYU_ADDRESS}) maksimal 10 menit sebelum jadwal ya. Terima kasih!`,
        createdAt: nowFormatted(),
        read: false,
        orderId: targetOrder.id,
      };
      setNotifications((prev) => [confirmNotif, ...prev]);
    }

    triggerCelebration('Terkonfirmasi (ACC) ✓');
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
              paymentStatus: 'Terkonfirmasi (ACC Admin)',
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
        return updated;
      });
    }

    setCustomers((prev) => {
      const next = prev.map((u) =>
        normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)
          ? { ...u, points: u.points + targetOrder.ptsEarned }
          : u
      );
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
    setNotifications((prev) => [rewardNotif, ...prev]);

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
            return updated;
          });
        }
        setCustomers((prev) => {
          const next = prev.map((u) =>
            normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)
              ? { ...u, points: u.points + ptsToRestore }
              : u
          );
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

      setNotifications((prev) => [adminNotif, customerNotif, ...prev]);
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

    setNotifications((prev) => [adminNotif, customerNotif, ...prev]);
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
          return updated;
        });
      }

      setCustomers((prev) => {
        const next = prev.map((u) =>
          normalizePhoneDigits(u.phone) === normalizePhoneDigits(targetOrder.wa)
            ? { ...u, points: Math.max(0, u.points + netPointDelta) }
            : u
        );
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

    setNotifications((prev) => [customerNotif, ...prev]);
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

    setNotifications((prev) => [customerNotif, ...prev]);
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

    setNotifications((prev) => [promoNotif, ...prev]);
    triggerCelebration('Bot Promo Terkirim!');
    showToast(
      'Bot Promo Berhasil Dikirim ke Semua Pelanggan! 🤖✨',
      `Promo "${promo.title}" (beserta gambar poster & kode ${promo.promoCode}) telah dikirim otomatis ke daftar WhatsApp seluruh pelanggan dan tampil di Bar Notifikasi Pelanggan.`
    );
  };

  const handleMarkCustomerNotificationsRead = () => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.target === 'all_customers' ||
        (n.target === 'customer' &&
          (!n.targetPhone ||
            n.targetPhone.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')))
          ? { ...n, read: true }
          : n
      )
    );
  };

  const handleMarkAdminNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (n.target === 'admin' ? { ...n, read: true } : n))
    );
  };

  const handleToggleWeekdayHoliday = (dayIdx: number) => {
    setClosedWeekdays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleToggleCustomHolidayDate = (dateIso: string) => {
    setClosedSpecificDates((prev) =>
      prev.includes(dateIso) ? prev.filter((d) => d !== dateIso) : [...prev, dateIso]
    );
  };

  const handleRemoveSpecificHoliday = (dateIso: string) => {
    setClosedSpecificDates((prev) => prev.filter((d) => d !== dateIso));
  };

  const handleToggleMasterSlot = (slotTime: string) => {
    setMasterTimeSlots((prev) =>
      prev.map((s) => (s.time === slotTime ? { ...s, active: !s.active } : s))
    );
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
    showToast('Jam Ditambahkan', `Slot jam ${slotTime} berhasil ditambahkan.`);
  };

  const activePaymentOrder = bookings.find((b) => b.id === activePaymentOrderId) || null;
  const activeReceiptOrder = bookings.find((b) => b.id === receiptOrderId) || null;

  const directWaUrl = `https://wa.me/6285183110392?text=${encodeURIComponent(
    currentUser
      ? `Halo Admin Griya Ayu (Rismawati), saya ${currentUser.name} (${currentUser.phone}) ingin berkonsultasi mengenai jadwal & layanan terapi.`
      : `Halo Admin Griya Ayu Sport Massage & Spa (Rismawati), saya ingin bertanya mengenai informasi layanan dan jadwal terapi.`
  )}`;

  return (
    <div className="min-h-screen bg-[#050e0a] text-stone-800 flex justify-center selection:bg-[#D4AF37] selection:text-[#0B261C]">
      {/* CONTAINER MOBILE UTAMA (max-w-md mx-auto) */}
      <div className="w-full max-w-md min-h-screen bg-[#F9F6F0] shadow-2xl relative flex flex-col border-x border-stone-800/80 overflow-x-hidden">
        {/* Layer Perayaan Confetti & Floating +Poin */}
        <CelebrationLayer
          pointsText={celebration.pointsText}
          confettiActive={celebration.confettiActive}
        />

        {/* =============================================================== */}
        {/* TAMPILAN AWAL: LOGIN & DAFTAR AKUN                              */}
        {/* =============================================================== */}
        {activeScreen === 'auth' && (
          <AuthScreen
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
            closedWeekdays={closedWeekdays}
            closedSpecificDates={closedSpecificDates}
            language={language}
            onChangeLanguage={setLanguage}
            onUpdateUser={handleUpdateUser}
            onOpenPaymentModal={handleOpenPaymentModal}
            onConfirmWizardBooking={handleConfirmWizardBooking}
            onRequestRefund={handleRequestRefund}
            onCopyText={handleCopyText}
            onViewReceipt={(order) => setReceiptOrderId(order.id)}
            onMarkNotificationsRead={handleMarkCustomerNotificationsRead}
            onLogout={handleLogout}
            onShowToast={showToast}
          />
        )}

        {/* =============================================================== */}
        {/* HALAMAN KHUSUS ADMIN (085183110392 // RISMAWATI)                */}
        {/* =============================================================== */}
        {activeScreen === 'app' && isAdmin && currentUser && (
          <AdminDashboard
            currentUser={currentUser}
            bookings={bookings}
            notifications={notifications}
            masterTimeSlots={masterTimeSlots}
            closedWeekdays={closedWeekdays}
            closedSpecificDates={closedSpecificDates}
            language={language}
            onChangeLanguage={setLanguage}
            onUpdateUser={handleUpdateUser}
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
        {/* FLOATING LOGO WHATSAPP DI KANAN BAWAH DEKAT NAVBAR              */}
        {/* =============================================================== */}
        {!isAdmin && (
          <div
            className={`fixed ${
              activeScreen === 'app' ? 'bottom-[74px]' : 'bottom-5'
            } left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none z-40 px-4 flex justify-end`}
          >
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
