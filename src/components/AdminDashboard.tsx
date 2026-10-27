import React, { useState, useEffect } from 'react';
import {
  User,
  BookingOrder,
  TimeSlot,
  Language,
  AppNotification,
  PointReward,
  ServiceItem,
  ServiceGridCategory,
  HomeServiceScheduleConfig,
} from '../types/index.ts';
import {
  formatRupiah,
  formatDatePretty,
  getTodayIso,
  getCurrentMonthPrefix,
  formatMonthYearIndo,
  isOrderLockedStatus,
  isTodayRevenueOrder,
  isMonthRevenueOrder,
  downloadMonthlyRevenueCsv,
  loadCustomersPersistently,
  compressImageFileToDataUrl,
  buildAdminWaConfirmationMessage,
  buildAdminApproveRefundWaMessage,
  buildAdminRejectRefundWaMessage,
  normalizeHomeServiceSchedule,
  getValidMemberCustomers,
} from '../utils/spaLogic.ts';
import {
  PROMO_TEMPLATES,
  INITIAL_USERS,
  POINT_REWARDS,
  SINGLE_CATALOG,
  PACKAGE_CATALOG,
  DEFAULT_HOME_SERVICE_SCHEDULE,
} from '../data/mockData.ts';
import { AccountPanel } from './AccountPanel.tsx';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface AdminDashboardProps {
  currentUser: User;
  customers?: User[];
  bookings: BookingOrder[];
  notifications: AppNotification[];
  masterTimeSlots: TimeSlot[];
  pointRewards?: PointReward[];
  singleServices?: ServiceItem[];
  packageServices?: ServiceItem[];
  closedWeekdays: number[];
  closedSpecificDates: string[];
  homeServiceSchedule?: HomeServiceScheduleConfig;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onUpdateUser: (updated: User) => void;
  onUpdateCustomerAccount?: (updated: User) => void;
  onUpdatePointRewards?: (nextRewards: PointReward[]) => void;
  onUpdateServices?: (
    nextSingleServices: ServiceItem[],
    nextPackageServices: ServiceItem[]
  ) => void;
  onUpdateHomeServiceSchedule?: (nextSchedule: HomeServiceScheduleConfig) => void;
  onVerifyPayment: (orderId: number) => void;
  onCompleteTreatment: (orderId: number) => void;
  onApproveRefund: (orderId: number) => void;
  onRejectRefund: (orderId: number, rejectReason?: string) => void;
  onUpdateBookingProof?: (
    orderId: number,
    proofImage: string,
    paymentChannel?: string
  ) => void;
  onRejectFakePayment?: (orderId: number, reason: string) => void;
  onDeleteBooking?: (orderId: number) => void;
  onToggleWeekdayHoliday: (dayIdx: number) => void;
  onToggleCustomHolidayDate: (dateIso: string) => void;
  onRemoveSpecificHoliday: (dateIso: string) => void;
  onToggleMasterSlot: (slotTime: string) => void;
  onAddNewTimeSlot: (slotTime: string) => void;
  onBroadcastPromo: (promo: {
    title: string;
    message: string;
    imageUrl: string;
    promoCode: string;
  }) => void;
  onMarkAdminNotificationsRead: () => void;
  onViewReceipt: (order: BookingOrder) => void;
  onCopyText: (text: string, label: string) => void;
  onLogout: () => void;
  onShowToast: (title: string, message: string, waUrl?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  customers,
  bookings,
  notifications,
  masterTimeSlots,
  pointRewards,
  singleServices,
  packageServices,
  closedWeekdays,
  closedSpecificDates,
  homeServiceSchedule,
  language,
  onChangeLanguage,
  onUpdateUser,
  onUpdateCustomerAccount,
  onUpdatePointRewards,
  onUpdateServices,
  onUpdateHomeServiceSchedule,
  onVerifyPayment,
  onCompleteTreatment,
  onApproveRefund,
  onRejectRefund,
  onUpdateBookingProof,
  onRejectFakePayment,
  onDeleteBooking,
  onToggleWeekdayHoliday,
  onToggleCustomHolidayDate,
  onRemoveSpecificHoliday,
  onToggleMasterSlot,
  onAddNewTimeSlot,
  onBroadcastPromo,
  onMarkAdminNotificationsRead,
  onViewReceipt,
  onCopyText,
  onLogout,
  onShowToast,
}) => {
  const isEn = language === 'en';
  const [adminSubTab, setAdminSubTab] = useState<
    'orders' | 'services' | 'notifications' | 'rewards' | 'schedule' | 'account'
  >('orders');
  const [orderFilter, setOrderFilter] = useState<
    'new_incoming' | 'all' | 'refund_pending' | 'active' | 'refund_done'
  >('new_incoming');

  useEffect(() => {
    const handleOpenBookingFromNotif = () => {
      setAdminSubTab('orders');
      setOrderFilter('new_incoming');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('griya-open-booking-dashboard', handleOpenBookingFromNotif);
    return () => {
      window.removeEventListener('griya-open-booking-dashboard', handleOpenBookingFromNotif);
    };
  }, []);
  const [customDateInput, setCustomDateInput] = useState<string>(() => getTodayIso());
  const [newSlotTimeInput, setNewSlotTimeInput] = useState<string>('20:30');
  const [scheduleSectionTab, setScheduleSectionTab] = useState<'studio' | 'home_service'>(
    'home_service'
  );
  const [hsDraft, setHsDraft] = useState<HomeServiceScheduleConfig>(() =>
    normalizeHomeServiceSchedule(homeServiceSchedule || DEFAULT_HOME_SERVICE_SCHEDULE)
  );
  const [newHsSlotInput, setNewHsSlotInput] = useState<string>('10:00');
  const [hasUnsavedHsChanges, setHasUnsavedHsChanges] = useState<boolean>(false);

  useEffect(() => {
    if (homeServiceSchedule) {
      setHsDraft(normalizeHomeServiceSchedule(homeServiceSchedule));
      setHasUnsavedHsChanges(false);
    }
  }, [homeServiceSchedule]);

  const handleToggleHsGlobalStatus = () => {
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      enabled: !hsDraft.enabled,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(false);
    onUpdateHomeServiceSchedule?.(nextConfig);
    onShowToast(
      nextConfig.enabled
        ? 'Layanan Home Service Diaktifkan! 🚗✅'
        : 'Home Service Dinonaktifkan Sementara ⏸️',
      nextConfig.enabled
        ? 'Pelanggan kini dapat memilih lokasi Home Service sesuai jadwal hari & jam yang aktif.'
        : 'Layanan Home Service ditutup sementara (misal seluruh terapis sedang penuh). Pelanggan akan diarahkan ke sesi Studio.'
    );
  };

  const handleToggleHsDayOpen = (dayOfWeek: number) => {
    const nextDays = hsDraft.days.map((d) =>
      d.dayOfWeek === dayOfWeek ? { ...d, isOpen: !d.isOpen } : d
    );
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      days: nextDays,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
    onUpdateHomeServiceSchedule?.(nextConfig);
  };

  const handleChangeHsDayHours = (
    dayOfWeek: number,
    field: 'openTime' | 'closeTime',
    value: string
  ) => {
    if (!value) return;
    const nextDays = hsDraft.days.map((d) =>
      d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d
    );
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      days: nextDays,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
  };

  const handleApplyHoursToAllDays = (openTime: string, closeTime: string) => {
    const nextDays = hsDraft.days.map((d) => ({
      ...d,
      openTime,
      closeTime,
    }));
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      days: nextDays,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
    onUpdateHomeServiceSchedule?.(nextConfig);
    onShowToast(
      'Jam Operasional Diterapkan ke Semua Hari 🕒',
      `Jam operasional ${openTime} - ${closeTime} WIB telah diterapkan untuk Senin s/d Minggu.`
    );
  };

  const handleToggleHsSlotActive = (slotTime: string) => {
    const nextSlots = hsDraft.slots.map((s) =>
      s.time === slotTime ? { ...s, active: !s.active } : s
    );
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      slots: nextSlots,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
    onUpdateHomeServiceSchedule?.(nextConfig);
  };

  const handleAddHsSlot = () => {
    const cleanTime = (newHsSlotInput || '').trim();
    if (!/^\d{2}:\d{2}$/.test(cleanTime)) {
      onShowToast('Format Jam Tidak Valid', 'Silakan pilih jam dengan format HH:MM (contoh 10:00).');
      return;
    }
    if (hsDraft.slots.some((s) => s.time === cleanTime)) {
      onShowToast(
        'Slot Jam Sudah Ada',
        `Slot jam Home Service ${cleanTime} WIB sudah ada di dalam daftar.`
      );
      return;
    }
    const nextSlots = [...hsDraft.slots, { time: cleanTime, active: true }].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      slots: nextSlots,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
    onUpdateHomeServiceSchedule?.(nextConfig);
    onShowToast(
      'Slot Jam Home Service Ditambahkan! ➕',
      `Slot jam ${cleanTime} WIB berhasil ditambahkan ke daftar jadwal Home Service.`
    );
  };

  const handleRemoveHsSlot = (slotTime: string) => {
    if (hsDraft.slots.length <= 1) {
      onShowToast(
        'Minimal 1 Slot Jam',
        'Daftar slot jam Home Service harus menyisakan minimal 1 slot waktu.'
      );
      return;
    }
    const nextSlots = hsDraft.slots.filter((s) => s.time !== slotTime);
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      slots: nextSlots,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(true);
    onUpdateHomeServiceSchedule?.(nextConfig);
    onShowToast(
      'Slot Jam Dihapus 🗑️',
      `Slot jam Home Service ${slotTime} WIB telah dihapus dari daftar.`
    );
  };

  const handleSaveHomeServiceSchedule = () => {
    const nextConfig: HomeServiceScheduleConfig = {
      ...hsDraft,
      updatedAt: new Date().toISOString(),
    };
    setHsDraft(nextConfig);
    setHasUnsavedHsChanges(false);
    onUpdateHomeServiceSchedule?.(nextConfig);
    onShowToast(
      'Pengaturan Jadwal Home Service Disimpan! ✅',
      'Perubahan hari operasional, jam buka-tutup, dan slot waktu Home Service telah berhasil disimpan dan langsung tersinkronisasi ke halaman booking pelanggan.'
    );
  };

  const handleResetHomeServiceDefault = () => {
    const defaultCfg = normalizeHomeServiceSchedule(DEFAULT_HOME_SERVICE_SCHEDULE);
    setHsDraft(defaultCfg);
    setHasUnsavedHsChanges(false);
    onUpdateHomeServiceSchedule?.(defaultCfg);
    onShowToast(
      'Jadwal Home Service Direset ke Default 🔄',
      'Jadwal Home Service telah dikembalikan ke pengaturan awal (Senin - Minggu aktif, jam 09:00 - 20:00 WIB).'
    );
  };
  const [expandedConfirmOrderId, setExpandedConfirmOrderId] = useState<number | null>(null);
  const [previewProofOrder, setPreviewProofOrder] = useState<BookingOrder | null>(null);
  const [proofZoomLevel, setProofZoomLevel] = useState<number>(1);
  const [confirmRejectFakeId, setConfirmRejectFakeId] = useState<number | null>(null);
  const [fakePaymentReason, setFakePaymentReason] = useState<string>(
    'Struk screenshot tidak sesuai / dana belum masuk di mutasi rekening resmi Griya Ayu.'
  );
  const [rejectingOrderId, setRejectingOrderId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>(
    'Bukti pembayaran tidak ditemukan pada mutasi rekening atau tidak sesuai.'
  );
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<number | null>(null);

  const handleOpenProofInspector = (order: BookingOrder) => {
    setProofZoomLevel(1);
    setConfirmRejectFakeId(null);
    setPreviewProofOrder(order);
  };

  const handleAdminUploadProofForOrder = async (
    order: BookingOrder,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateBookingProof) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      onUpdateBookingProof(order.id, compressed, order.paymentChannel || order.payMethod);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateBookingProof(order.id, reader.result, order.paymentChannel || order.payMethod);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // State Laporan Keuangan Bulanan
  const [selectedMonthPrefix, setSelectedMonthPrefix] = useState<string>(() =>
    getCurrentMonthPrefix()
  );
  const [showMonthlyDetails, setShowMonthlyDetails] = useState<boolean>(false);

  // State Bot Broadcast Promo (Teks & Gambar)
  const [promoTitle, setPromoTitle] = useState<string>(PROMO_TEMPLATES[0].title);
  const [promoCode, setPromoCode] = useState<string>(PROMO_TEMPLATES[0].promoCode);
  const [promoImage, setPromoImage] = useState<string>(PROMO_TEMPLATES[0].imageUrl);
  const [promoMessage, setPromoMessage] = useState<string>(PROMO_TEMPLATES[0].message);
  const [botRunning, setBotRunning] = useState<boolean>(false);
  const [botSentList, setBotSentList] = useState<string[]>([]);

  // Perhitungan Omzet Hari Ini (Real-Time) & Omzet Bulanan
  const todayIso = getTodayIso();
  const todayPretty = formatDatePretty(new Date());
  const todayVerifiedOrders = bookings.filter((b) => isTodayRevenueOrder(b, todayIso));
  const todayOmzetTotal = todayVerifiedOrders.reduce((sum, b) => sum + b.total, 0);
  const todayWaitingVerifyCount = bookings.filter(
    (b) =>
      b.date === todayIso &&
      b.paymentStatus === 'Booking Cash (Bayar di Lokasi)' &&
      b.status !== 'Cancelled' &&
      b.status !== 'Refund_Requested' &&
      b.status !== 'Refund_Completed'
  ).length;

  const monthlyVerifiedOrders = bookings.filter((b) =>
    isMonthRevenueOrder(b, selectedMonthPrefix)
  );
  const monthlyOmzetTotal = monthlyVerifiedOrders.reduce((sum, b) => sum + b.total, 0);
  const monthLabelIndo = formatMonthYearIndo(selectedMonthPrefix);

  const handleDownloadMonthlyCsv = () => {
    const downloadedFileName = downloadMonthlyRevenueCsv(
      monthlyVerifiedOrders,
      selectedMonthPrefix
    );
    onShowToast(
      'Laporan Bulanan Diunduh (Excel .XLSX)! 📊',
      `File "${downloadedFileName}" (${monthlyVerifiedOrders.length} transaksi • Total ${formatRupiah(
        monthlyOmzetTotal
      )}) berhasil diunduh dengan format kolom rapi dan rumus otomatis Microsoft Excel.`
    );
  };

  const adminNotifications = notifications.filter((n) => n.target === 'admin');
  const unreadAdminNotifs = adminNotifications.filter((n) => !n.read).length;

  const isOrderNewIncoming = (b: BookingOrder) => {
    const isRefWait =
      b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested';
    const isRefDone =
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.status === 'Refund_Completed' ||
      b.status === 'Cancelled';
    return !isRefWait && !isRefDone && isOrderLockedStatus(b) && b.status !== 'Completed';
  };

  const newIncomingCount = bookings.filter(isOrderNewIncoming).length;
  const paidUnverifiedCount = newIncomingCount;
  const completedCount = bookings.filter((b) => {
    const isRefWait =
      b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested';
    const isRefDone =
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.status === 'Refund_Completed' ||
      b.status === 'Cancelled';
    return !isRefWait && !isRefDone && b.status === 'Completed';
  }).length;
  const refundPendingCount = bookings.filter(
    (b) => b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested'
  ).length;
  const refundDoneCount = bookings.filter(
    (b) =>
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.status === 'Refund_Completed' ||
      b.status === 'Cancelled'
  ).length;

  const filteredBookings = bookings.filter((b) => {
    const isRefWait =
      b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested';
    const isRefDone =
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.status === 'Refund_Completed' ||
      b.status === 'Cancelled';
    if (orderFilter === 'new_incoming') return isOrderNewIncoming(b);
    if (orderFilter === 'refund_pending') return isRefWait;
    if (orderFilter === 'refund_done') return isRefDone;
    if (orderFilter === 'active') return !isRefWait && !isRefDone && b.status === 'Completed';
    return true;
  });

  const storedCustomers: User[] = React.useMemo(() => {
    const rawList =
      customers && customers.length > 0
        ? customers
        : loadCustomersPersistently(INITIAL_USERS);
    return getValidMemberCustomers(rawList);
  }, [customers, adminSubTab, bookings.length]);

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const handleOpenNotifTab = () => {
    setAdminSubTab('notifications');
    onMarkAdminNotificationsRead();
  };

  const handleAddCustomDate = () => {
    if (customDateInput) {
      onToggleCustomHolidayDate(customDateInput);
    }
  };

  const handleAddNewSlot = () => {
    if (newSlotTimeInput) {
      onAddNewTimeSlot(newSlotTimeInput);
    }
  };

  const handlePromoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setPromoImage(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPromoImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPromoPreset = (preset: (typeof PROMO_TEMPLATES)[0]) => {
    setPromoTitle(preset.title);
    setPromoCode(preset.promoCode);
    setPromoImage(preset.imageUrl);
    setPromoMessage(preset.message);
  };

  const handleRunPromoBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim() || !promoMessage.trim()) {
      onShowToast('Lengkapi Promo', 'Mohon isi judul dan kata-kata teks promo terlebih dahulu.');
      return;
    }

    setBotRunning(true);
    setBotSentList([]);

    // Simulasi Bot Mengirim Otomatis ke Semua WA Pelanggan Satu per Satu
    storedCustomers.forEach((cust, idx) => {
      setTimeout(() => {
        setBotSentList((prev) => [...prev, cust.phone]);
      }, (idx + 1) * 350);
    });

    setTimeout(() => {
      setBotRunning(false);
      onBroadcastPromo({
        title: promoTitle.trim(),
        message: promoMessage.trim(),
        imageUrl:
          promoImage ||
          'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=700&auto=format&fit=crop&q=80',
        promoCode: promoCode.trim() || 'GRIYA-PROMO',
      });
    }, storedCustomers.length * 350 + 200);
  };

  // =========================================================================
  // STATE & HANDLER KELOLA PENUKARAN POIN (TAMBAH / EDIT / HAPUS REWARD)
  // =========================================================================
  const allRewardsSource =
    pointRewards && pointRewards.length > 0 ? pointRewards : POINT_REWARDS;
  const managedRewards = React.useMemo(
    () =>
      allRewardsSource
        .filter((r) => r.id !== 'none')
        .sort((a, b) => a.cost - b.cost),
    [allRewardsSource]
  );

  const [rewardModalOpen, setRewardModalOpen] = useState<boolean>(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardTitleInput, setRewardTitleInput] = useState<string>('');
  const [rewardCostInput, setRewardCostInput] = useState<string>('50');
  const [rewardDescInput, setRewardDescInput] = useState<string>('');
  const [rewardStockInput, setRewardStockInput] = useState<string>('Tersedia');
  const [rewardAvailableInput, setRewardAvailableInput] = useState<boolean>(true);
  const [rewardFormError, setRewardFormError] = useState<string>('');
  const [deletingRewardId, setDeletingRewardId] = useState<string | null>(null);

  const handleOpenAddRewardModal = () => {
    setEditingRewardId(null);
    setRewardTitleInput('');
    setRewardCostInput('50');
    setRewardDescInput('');
    setRewardStockInput('Tersedia');
    setRewardAvailableInput(true);
    setRewardFormError('');
    setRewardModalOpen(true);
  };

  const handleOpenEditRewardModal = (item: PointReward) => {
    setEditingRewardId(item.id);
    setRewardTitleInput(item.title || item.label);
    setRewardCostInput(String(item.cost));
    setRewardDescInput(item.description || '');
    setRewardStockInput(item.stockInfo || 'Tersedia');
    setRewardAvailableInput(item.available !== false);
    setRewardFormError('');
    setRewardModalOpen(true);
  };

  const handleSaveRewardForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = rewardTitleInput.trim();
    const parsedCost = Math.floor(Number(rewardCostInput));
    const cleanDesc = rewardDescInput.trim();
    const cleanStock = rewardStockInput.trim() || (rewardAvailableInput ? 'Tersedia' : 'Stok Habis');

    if (!cleanTitle) {
      setRewardFormError('Mohon isi Nama Reward / Hadiah terlebih dahulu.');
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost <= 0) {
      setRewardFormError('Jumlah Poin yang dibutuhkan harus berupa angka lebih dari 0.');
      return;
    }

    const noneOption: PointReward =
      allRewardsSource.find((r) => r.id === 'none') || {
        id: 'none',
        title: 'Simpan Poin (Tabung Poin Loyalitas)',
        label: 'Simpan Poin (Tabung Poin Loyalitas)',
        cost: 0,
        cut: 0,
        available: true,
        stockInfo: 'Tersedia',
      };

    if (editingRewardId) {
      const updatedItem: PointReward = {
        id: editingRewardId,
        title: cleanTitle,
        label: cleanTitle,
        cost: parsedCost,
        cut: 0,
        description: cleanDesc || 'Syarat & ketentuan sesuai kebijakan Griya Ayu.',
        available: rewardAvailableInput,
        stockInfo: cleanStock,
      };
      const nextList = [
        noneOption,
        ...managedRewards.map((r) => (r.id === editingRewardId ? updatedItem : r)),
      ];
      if (onUpdatePointRewards) {
        onUpdatePointRewards(nextList);
      }
      setRewardModalOpen(false);
      onShowToast(
        'Reward Berhasil Diperbarui! ✨',
        `Perubahan pada reward "${cleanTitle}" (${parsedCost} Poin) telah disimpan dan langsung terbarui di halaman Poin pelanggan.`
      );
    } else {
      const newItem: PointReward = {
        id: `reward_${Date.now()}`,
        title: cleanTitle,
        label: cleanTitle,
        cost: parsedCost,
        cut: 0,
        description: cleanDesc || 'Syarat & ketentuan sesuai kebijakan Griya Ayu.',
        available: rewardAvailableInput,
        stockInfo: cleanStock,
      };
      const nextList = [noneOption, ...managedRewards, newItem];
      if (onUpdatePointRewards) {
        onUpdatePointRewards(nextList);
      }
      setRewardModalOpen(false);
      onShowToast(
        'Reward Baru Ditambahkan! 🎁',
        `Reward "${cleanTitle}" (${parsedCost} Poin) berhasil ditambahkan ke katalog penukaran poin pelanggan.`
      );
    }
  };

  const handleToggleRewardAvailability = (item: PointReward) => {
    const nextAvailable = item.available === false ? true : false;
    const noneOption: PointReward =
      allRewardsSource.find((r) => r.id === 'none') || {
        id: 'none',
        title: 'Simpan Poin (Tabung Poin Loyalitas)',
        label: 'Simpan Poin (Tabung Poin Loyalitas)',
        cost: 0,
        cut: 0,
        available: true,
      };
    const nextList = [
      noneOption,
      ...managedRewards.map((r) =>
        r.id === item.id
          ? {
              ...r,
              available: nextAvailable,
              stockInfo: nextAvailable
                ? r.stockInfo === 'Nonaktif / Habis'
                  ? 'Tersedia'
                  : r.stockInfo || 'Tersedia'
                : 'Nonaktif / Habis',
            }
          : r
      ),
    ];
    if (onUpdatePointRewards) {
      onUpdatePointRewards(nextList);
    }
    onShowToast(
      nextAvailable ? 'Reward Diaktifkan Kembali ✓' : 'Reward Dinonaktifkan Sementara',
      nextAvailable
        ? `Reward "${item.title || item.label}" kini aktif dan tampil kembali di katalog poin pelanggan.`
        : `Reward "${item.title || item.label}" dinonaktifkan dan otomatis disembunyikan dari katalog poin pelanggan.`
    );
  };

  const handleConfirmDeleteReward = (item: PointReward) => {
    const noneOption: PointReward =
      allRewardsSource.find((r) => r.id === 'none') || {
        id: 'none',
        title: 'Simpan Poin (Tabung Poin Loyalitas)',
        label: 'Simpan Poin (Tabung Poin Loyalitas)',
        cost: 0,
        cut: 0,
        available: true,
      };
    const nextList = [
      noneOption,
      ...managedRewards.filter((r) => r.id !== item.id),
    ];
    if (onUpdatePointRewards) {
      onUpdatePointRewards(nextList);
    }
    setDeletingRewardId(null);
    onShowToast(
      'Reward Berhasil Dihapus 🗑️',
      `Item reward "${item.title || item.label}" (${item.cost} Poin) telah dihapus dari katalog penukaran poin.`
    );
  };

  // =========================================================================
  // STATE & HANDLER KELOLA LAYANAN SPORT MASSAGE & SPA (TAMBAH / EDIT / HAPUS)
  // =========================================================================
  const managedSingleServices = React.useMemo(
    () => (singleServices && singleServices.length > 0 ? singleServices : SINGLE_CATALOG),
    [singleServices]
  );
  const managedPackageServices = React.useMemo(
    () =>
      packageServices && Array.isArray(packageServices)
        ? packageServices
        : PACKAGE_CATALOG,
    [packageServices]
  );

  const [serviceTabMode, setServiceTabMode] = useState<'single' | 'package'>('single');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<
    'all' | 'sport' | 'wellness' | ServiceGridCategory
  >('all');
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [serviceModalOpen, setServiceModalOpen] = useState<boolean>(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceOrigType, setEditingServiceOrigType] = useState<'single' | 'package'>('single');

  const [serviceTypeInput, setServiceTypeInput] = useState<'single' | 'package'>('single');
  const [serviceCategoryInput, setServiceCategoryInput] = useState<'sport' | 'wellness'>('sport');
  const [serviceNameInput, setServiceNameInput] = useState<string>('');
  const [serviceDurationInput, setServiceDurationInput] = useState<string>('60 Menit');
  const [servicePriceInput, setServicePriceInput] = useState<string>('150000');
  const [serviceNormalPriceInput, setServiceNormalPriceInput] = useState<string>('');
  const [servicePointsInput, setServicePointsInput] = useState<string>('10');
  const [serviceTagInput, setServiceTagInput] = useState<string>('');
  const [serviceDescInput, setServiceDescInput] = useState<string>('');
  const [serviceGenderInput, setServiceGenderInput] = useState<'all' | 'female' | 'male'>('all');
  const [serviceGridCatsInput, setServiceGridCatsInput] = useState<ServiceGridCategory[]>([
    'kebugaran',
  ]);
  const [serviceHasInjurySpotsInput, setServiceHasInjurySpotsInput] = useState<boolean>(false);
  const [serviceAvailableInput, setServiceAvailableInput] = useState<boolean>(true);
  const [serviceFormError, setServiceFormError] = useState<string>('');
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [confirmResetServices, setConfirmResetServices] = useState<boolean>(false);

  const GRID_CATEGORY_OPTIONS: Array<{
    id: ServiceGridCategory;
    label: string;
    icon: string;
  }> = [
    { id: 'kebugaran', label: 'Pijat Kebugaran', icon: 'fa-hands-holding-circle' },
    { id: 'otot_cedera', label: 'Terapi Otot & Cedera', icon: 'fa-person-running' },
    { id: 'spa_tubuh', label: 'Spa Perawatan Tubuh', icon: 'fa-spa' },
    { id: 'bekam', label: 'Terapi Bekam', icon: 'fa-heart-pulse' },
    { id: 'khusus_wanita', label: 'Khusus Wanita', icon: 'fa-venus' },
  ];

  const handleOpenAddServiceModal = (defaultType: 'single' | 'package' = serviceTabMode) => {
    setEditingServiceId(null);
    setEditingServiceOrigType(defaultType);
    setServiceTypeInput(defaultType);
    setServiceCategoryInput('sport');
    setServiceNameInput('');
    setServiceDurationInput(defaultType === 'package' ? '120 Menit' : '60 Menit');
    setServicePriceInput(defaultType === 'package' ? '400000' : '150000');
    setServiceNormalPriceInput(defaultType === 'package' ? '450000' : '');
    setServicePointsInput(defaultType === 'package' ? '20' : '10');
    setServiceTagInput(defaultType === 'package' ? 'Paket Hemat Spesial' : 'Terapi Unggulan');
    setServiceDescInput('');
    setServiceGenderInput('all');
    setServiceGridCatsInput(['kebugaran']);
    setServiceHasInjurySpotsInput(false);
    setServiceAvailableInput(true);
    setServiceFormError('');
    setServiceModalOpen(true);
  };

  const handleOpenEditServiceModal = (item: ServiceItem, type: 'single' | 'package') => {
    setEditingServiceId(item.id);
    setEditingServiceOrigType(type);
    setServiceTypeInput(type);
    setServiceCategoryInput(
      item.category || (item.gender === 'female' ? 'wellness' : 'sport')
    );
    setServiceNameInput(item.name);
    setServiceDurationInput(item.duration || '60 Menit');
    setServicePriceInput(String(item.price));
    setServiceNormalPriceInput(item.normalPrice ? String(item.normalPrice) : '');
    setServicePointsInput(String(item.points));
    setServiceTagInput(item.tag || '');
    setServiceDescInput(item.desc || '');
    setServiceGenderInput(item.gender || 'all');
    setServiceGridCatsInput(
      item.gridCategories && item.gridCategories.length > 0
        ? item.gridCategories
        : item.gender === 'female'
        ? ['khusus_wanita']
        : ['kebugaran']
    );
    setServiceHasInjurySpotsInput(
      Boolean(item.hasInjurySpots || item.id === 's2' || item.id === 's4')
    );
    setServiceAvailableInput(item.available !== false);
    setServiceFormError('');
    setServiceModalOpen(true);
  };

  const toggleGridCatInput = (cat: ServiceGridCategory) => {
    setServiceGridCatsInput((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSaveServiceForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = serviceNameInput.trim();
    const cleanDuration = serviceDurationInput.trim() || '60 Menit';
    const parsedPrice = Math.floor(Number(servicePriceInput));
    const parsedNormalPrice = serviceNormalPriceInput.trim()
      ? Math.floor(Number(serviceNormalPriceInput))
      : undefined;
    const parsedPoints = Math.max(0, Math.floor(Number(servicePointsInput) || 0));
    const cleanTag =
      serviceTagInput.trim() ||
      (serviceCategoryInput === 'sport' ? 'Sport Massage' : 'SPA & Wellness');
    const cleanDesc =
      serviceDescInput.trim() ||
      `Layanan ${cleanName} (${cleanDuration}) oleh terapis profesional Griya Ayu.`;

    if (!cleanName) {
      setServiceFormError('Mohon isi Nama Layanan terlebih dahulu.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setServiceFormError('Harga layanan (Rp) harus berupa angka lebih dari 0.');
      return;
    }

    const genderBadge =
      serviceGenderInput === 'female'
        ? '👩 Khusus Wanita'
        : serviceGenderInput === 'male'
        ? '👨 Khusus Pria'
        : '👨👩 Semua Gender';

    const resolvedGridCats: ServiceGridCategory[] =
      serviceGridCatsInput.length > 0
        ? serviceGridCatsInput
        : serviceGenderInput === 'female'
        ? ['khusus_wanita']
        : ['kebugaran'];

    const servicePayload: ServiceItem = {
      id:
        editingServiceId ||
        `${serviceTypeInput === 'package' ? 'pkg' : serviceCategoryInput === 'sport' ? 's' : 'w'}_${Date.now()}`,
      name: cleanName,
      duration: cleanDuration,
      price: parsedPrice,
      normalPrice:
        parsedNormalPrice && parsedNormalPrice > parsedPrice ? parsedNormalPrice : undefined,
      points: parsedPoints,
      tag: cleanTag,
      desc: cleanDesc,
      category: serviceCategoryInput,
      gender: serviceGenderInput,
      genderBadge,
      gridCategories: resolvedGridCats,
      available: serviceAvailableInput,
      hasInjurySpots: serviceTypeInput === 'single' ? serviceHasInjurySpotsInput : false,
    };

    let nextSingle = [...managedSingleServices];
    let nextPackage = [...managedPackageServices];

    if (editingServiceId) {
      if (editingServiceOrigType === serviceTypeInput) {
        if (serviceTypeInput === 'single') {
          nextSingle = nextSingle.map((s) =>
            s.id === editingServiceId ? servicePayload : s
          );
        } else {
          nextPackage = nextPackage.map((p) =>
            p.id === editingServiceId ? servicePayload : p
          );
        }
      } else {
        // Pindah dari Satuan ke Paket atau sebaliknya
        if (editingServiceOrigType === 'single') {
          nextSingle = nextSingle.filter((s) => s.id !== editingServiceId);
          nextPackage = [...nextPackage, servicePayload];
        } else {
          nextPackage = nextPackage.filter((p) => p.id !== editingServiceId);
          nextSingle = [...nextSingle, servicePayload];
        }
      }
      if (onUpdateServices) {
        onUpdateServices(nextSingle, nextPackage);
      }
      setServiceTabMode(serviceTypeInput);
      setServiceModalOpen(false);
      onShowToast(
        'Layanan Berhasil Diperbarui! ✨',
        `Layanan "${cleanName}" (${formatRupiah(parsedPrice)} • ${cleanDuration}) telah disimpan dan langsung terbarui di halaman pelanggan.`
      );
    } else {
      if (serviceTypeInput === 'single') {
        nextSingle = [servicePayload, ...nextSingle];
      } else {
        nextPackage = [servicePayload, ...nextPackage];
      }
      if (onUpdateServices) {
        onUpdateServices(nextSingle, nextPackage);
      }
      setServiceTabMode(serviceTypeInput);
      setServiceModalOpen(false);
      onShowToast(
        'Layanan Baru Ditambahkan! 💆‍♀️✨',
        `Layanan "${cleanName}" (${formatRupiah(parsedPrice)} • ${cleanDuration} • +${parsedPoints} Poin) berhasil ditambahkan ke daftar layanan pelanggan.`
      );
    }
  };

  const handleToggleServiceAvailability = (
    item: ServiceItem,
    type: 'single' | 'package'
  ) => {
    const nextAvailable = item.available === false ? true : false;
    const nextSingle =
      type === 'single'
        ? managedSingleServices.map((s) =>
            s.id === item.id ? { ...s, available: nextAvailable } : s
          )
        : managedSingleServices;
    const nextPackage =
      type === 'package'
        ? managedPackageServices.map((p) =>
            p.id === item.id ? { ...p, available: nextAvailable } : p
          )
        : managedPackageServices;

    if (onUpdateServices) {
      onUpdateServices(nextSingle, nextPackage);
    }
    onShowToast(
      nextAvailable ? 'Layanan Diaktifkan Kembali ✓' : 'Layanan Dinonaktifkan Sementara',
      nextAvailable
        ? `Layanan "${item.name}" kini aktif dan tampil kembali di katalog booking pelanggan.`
        : `Layanan "${item.name}" dinonaktifkan dan otomatis disembunyikan dari halaman booking pelanggan.`
    );
  };

  const handleConfirmDeleteService = (item: ServiceItem, type: 'single' | 'package') => {
    const nextSingle =
      type === 'single'
        ? managedSingleServices.filter((s) => s.id !== item.id)
        : managedSingleServices;
    const nextPackage =
      type === 'package'
        ? managedPackageServices.filter((p) => p.id !== item.id)
        : managedPackageServices;

    if (onUpdateServices) {
      onUpdateServices(nextSingle, nextPackage);
    }
    setDeletingServiceId(null);
    onShowToast(
      'Layanan Berhasil Dihapus 🗑️',
      `Layanan "${item.name}" (${formatRupiah(item.price)}) telah dihapus dari daftar katalog layanan.`
    );
  };

  const handleResetServicesToDefault = () => {
    if (onUpdateServices) {
      onUpdateServices(SINGLE_CATALOG, PACKAGE_CATALOG);
    }
    setConfirmResetServices(false);
    onShowToast(
      'Katalog Layanan Direset ke Default ✓',
      'Seluruh daftar layanan Sport Massage, SPA & Paket Hemat telah dikembalikan ke daftar bawaan Griya Ayu.'
    );
  };

  const currentServiceList =
    serviceTabMode === 'single' ? managedSingleServices : managedPackageServices;

  const filteredManagedServices = currentServiceList.filter((item) => {
    if (serviceCategoryFilter === 'sport') {
      if (item.category && item.category !== 'sport') return false;
      if (!item.category && item.gender === 'female') return false;
    } else if (serviceCategoryFilter === 'wellness') {
      if (item.category && item.category !== 'wellness') return false;
      if (!item.category && item.gender !== 'female') return false;
    } else if (serviceCategoryFilter !== 'all') {
      if (!item.gridCategories?.includes(serviceCategoryFilter)) return false;
    }

    if (serviceSearchQuery.trim()) {
      const q = serviceSearchQuery.trim().toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q) ||
        (item.tag || '').toLowerCase().includes(q) ||
        (item.duration || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col pb-28">
      {/* HEADER DASHBOARD ADMIN RISMAWATI */}
      <header className="bg-gradient-to-r from-stone-900 via-[#0B261C] to-stone-900 text-white px-4 py-3.5 rounded-b-3xl shadow-lg border-b-2 border-[#D4AF37]">
        <div className="flex justify-between items-center gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex-shrink-0">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                />
              ) : (
                <GriyaAyuLogo size="sm" showBadge={false} floating={false} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded inline-block max-w-full truncate">
                {isEn ? 'OFFICIAL ADMIN PANEL' : 'DASHBOARD ADMIN RESMI'}
              </span>
              <h1 className="text-sm sm:text-base font-black text-white truncate mt-0.5 leading-tight">
                {currentUser.name}
              </h1>
              <p className="text-xs text-emerald-200 font-semibold truncate mt-0.5">
                WA Admin: 0877-6557-3476
              </p>
            </div>
          </div>

          {/* Kanan Atas: Lonceng Bar Notifikasi Admin + Akun Admin */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleOpenNotifTab}
              aria-label="Buka Bar Notifikasi & Bot Promo Admin"
              className="tactile-btn relative w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center flex-shrink-0"
            >
              <i className="fa-solid fa-bell text-xs"></i>
              {unreadAdminNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadAdminNotifs}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('account')}
              aria-label="Buka Pengaturan Akun Admin"
              className="tactile-btn bg-white/10 hover:bg-white/20 text-[11px] font-bold px-2.5 py-2 rounded-xl border border-[#D4AF37]/50 transition flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
            >
              <i className="fa-solid fa-user-gear text-amber-300"></i>
              <span>{isEn ? 'Account' : 'Akun'}</span>
            </button>
          </div>
        </div>

        {/* Shortcut Cepat ke Pengaturan Jadwal Home Service & Data Member */}
        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                hsDraft.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            ></span>
            <span className="text-[11px] font-bold text-stone-200 truncate">
              Home Service:{' '}
              <strong className={hsDraft.enabled ? 'text-emerald-300' : 'text-red-300'}>
                {hsDraft.enabled ? 'Aktif' : 'Nonaktif'}
              </strong>{' '}
              ({hsDraft.days.filter((d) => d.isOpen).length}/7 Hari)
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setAdminSubTab('account')}
              className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-200 border border-[#D4AF37]/50 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1"
            >
              <i className="fa-solid fa-users-gear text-[#D4AF37]"></i>
              <span>Data Member ({storedCustomers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminSubTab('schedule');
                setScheduleSectionTab('home_service');
              }}
              className="tactile-btn bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/60 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"
            >
              <i className="fa-solid fa-car-side"></i>
              <span>Jadwal Home Service</span>
            </button>
          </div>
        </div>
      </header>

      {/* Konten Utama Admin */}
      <div className="p-3.5 space-y-3.5 flex-1">
        {/* =============================================================== */}
        {/* SUB-TAB 1: DAFTAR PESANAN & VERIFIKASI REFUND ADMIN             */}
        {/* =============================================================== */}
        {adminSubTab === 'orders' && (
          <div className="space-y-3 animate-page-enter">
            {/* Penanda Khusus / Alert jika ada pesanan yang Menunggu Cek Refund Admin */}
            {refundPendingCount > 0 && (
              <div className="bg-amber-50 border-2 border-amber-400 p-3.5 rounded-2xl shadow-xs flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-sm font-black flex-shrink-0 animate-pulse">
                    <i className="fa-solid fa-rotate-left"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded inline-block">
                      Perlu Verifikasi Admin
                    </span>
                    <h3 className="text-xs sm:text-sm font-black text-[#0B261C] mt-0.5 leading-snug">
                      {refundPendingCount} Pesanan Menunggu Cek Refund Admin
                    </h3>
                    <p className="text-xs text-stone-600 leading-snug mt-0.5">
                      Cek alasan batal, rekening tujuan, dan foto bukti transfer/QRIS di bawah.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOrderFilter(orderFilter === 'refund_pending' ? 'all' : 'refund_pending')
                  }
                  className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black px-3 py-2 rounded-xl text-xs whitespace-nowrap shadow-xs flex-shrink-0"
                >
                  {orderFilter === 'refund_pending' ? 'Lihat Semua' : 'Filter Refund'}
                </button>
              </div>
            )}

            {/* Filter Tab Kelola Pesanan (Fokus Booking Baru Masuk Terpisah dari Semua) */}
            <div className="bg-white p-2 rounded-2xl border border-stone-200 space-y-1.5 shadow-2xs">
              <div className="grid grid-cols-2 gap-1.5 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setOrderFilter('new_incoming')}
                  className={`py-2.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 min-w-0 ${
                    orderFilter === 'new_incoming'
                      ? 'bg-[#0B261C] text-[#D4AF37] shadow-xs border border-[#D4AF37]/50'
                      : newIncomingCount > 0
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300'
                      : 'bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  <i className="fa-solid fa-bell text-[11px] flex-shrink-0"></i>
                  <span className="truncate">Booking Baru</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none flex-shrink-0 ${
                      orderFilter === 'new_incoming'
                        ? 'bg-[#D4AF37] text-[#0B261C]'
                        : newIncomingCount > 0
                        ? 'bg-emerald-700 text-white animate-pulse'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {newIncomingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('all')}
                  className={`py-2.5 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 min-w-0 ${
                    orderFilter === 'all'
                      ? 'bg-[#0B261C] text-[#D4AF37] shadow-xs border border-[#D4AF37]/50'
                      : 'bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  <i className="fa-solid fa-list-check text-[11px] flex-shrink-0"></i>
                  <span className="truncate">Semua Pesanan ({bookings.length})</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-black">
                <button
                  type="button"
                  onClick={() => setOrderFilter('active')}
                  className={`py-2 px-1.5 rounded-xl transition truncate ${
                    orderFilter === 'active'
                      ? 'bg-[#0B261C] text-[#D4AF37]'
                      : 'bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200/80'
                  }`}
                >
                  Selesai ({completedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('refund_pending')}
                  className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 min-w-0 ${
                    orderFilter === 'refund_pending'
                      ? 'bg-amber-500 text-stone-950'
                      : refundPendingCount > 0
                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
                      : 'bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200/80'
                  }`}
                >
                  <span className="truncate">Refund</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-black/15 text-[10px] leading-none flex-shrink-0">
                    {refundPendingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('refund_done')}
                  className={`py-2 px-1.5 rounded-xl transition truncate ${
                    orderFilter === 'refund_done'
                      ? 'bg-[#0B261C] text-[#D4AF37]'
                      : 'bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200/80'
                  }`}
                >
                  Batal ({refundDoneCount})
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 px-1 flex-wrap">
              <h2 className="text-xs font-black uppercase tracking-wider text-stone-800">
                {orderFilter === 'new_incoming'
                  ? `Daftar Booking Baru Masuk (${newIncomingCount})`
                  : orderFilter === 'active'
                  ? `Pesanan Selesai Treatment (${completedCount})`
                  : orderFilter === 'refund_pending'
                  ? `Menunggu Cek Refund (${refundPendingCount})`
                  : orderFilter === 'refund_done'
                  ? `Riwayat Batal / Refund (${refundDoneCount})`
                  : `Semua Riwayat Pesanan (${bookings.length})`}
              </h2>
              <span className="text-[11px] font-bold text-emerald-800">
                Non-Cash = Otomatis Lunas
              </span>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 text-center space-y-1.5">
                <p className="text-stone-700 text-sm font-extrabold">
                  {orderFilter === 'new_incoming'
                    ? 'Belum ada booking baru yang masuk saat ini.'
                    : 'Tidak ada pesanan pada filter ini.'}
                </p>
                {orderFilter === 'new_incoming' && bookings.length > 0 && (
                  <p className="text-xs text-stone-500">
                    Klik tab <b>Semua Pesanan ({bookings.length})</b> atau <b>Selesai ({completedCount})</b> untuk melihat riwayat pesanan lainnya.
                  </p>
                )}
              </div>
            ) : (
              filteredBookings.map((b) => {
                const isPaid = isOrderLockedStatus(b);
                const isCashOrder =
                  b.payMethodType === 'cash' ||
                  b.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ||
                  b.payMethod.toLowerCase().includes('cash') ||
                  b.payMethod.toLowerCase().includes('tempat');
                const isCashPaid =
                  isCashOrder &&
                  (b.paymentStatus === 'Lunas' ||
                    b.paymentStatus === 'Terkonfirmasi (ACC Admin)' ||
                    b.status === 'Verified' ||
                    b.status === 'Completed');
                const isLunasOrder = (!isCashOrder && isPaid) || isCashPaid;
                const isConfirmedAcc =
                  b.paymentStatus === 'Terkonfirmasi (ACC Admin)' ||
                  b.status === 'Verified' ||
                  b.status === 'Completed';
                const isFailed = b.paymentStatus === 'Gagal';
                const isRefundWaiting =
                  b.paymentStatus === 'Menunggu Cek Refund Admin' ||
                  b.status === 'Refund_Requested';
                const isRefundDone =
                  b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
                  b.status === 'Refund_Completed' ||
                  b.status === 'Cancelled';
                const isCompleted = b.status === 'Completed';
                const isNewOrderBadge =
                  !isRefundWaiting && !isRefundDone && isPaid && !isCompleted;
                const confirmMsg = buildAdminWaConfirmationMessage(b);
                const approveRefundWa = buildAdminApproveRefundWaMessage(b);
                const isConfirmOpen = expandedConfirmOrderId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`bg-white p-3.5 rounded-2xl border shadow-xs space-y-2.5 ${
                      isRefundWaiting
                        ? 'border-2 border-amber-400 bg-amber-50/35'
                        : isRefundDone
                        ? 'border-stone-200 bg-stone-50/80 opacity-90'
                        : isNewOrderBadge
                        ? 'border-2 border-emerald-600 bg-emerald-50/15'
                        : isPaid
                        ? 'border-stone-200'
                        : 'border-amber-300 bg-amber-50/30'
                    }`}
                  >
                    {/* Baris Atas: ID Pesanan & Status Pembayaran / Verifikasi / Refund Badge */}
                    <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-stone-200/80">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-stone-500">
                          #GA-{String(b.id).slice(-6)}
                        </span>
                        {isNewOrderBadge && (
                          <span className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2 py-0.5 rounded-full">
                            🆕 BARU
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isRefundWaiting ? (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full inline-flex items-center gap-1 animate-pulse">
                            <i className="fa-solid fa-clock-rotate-left text-amber-700"></i>
                            <span>MENUNGGU CEK REFUND ADMIN</span>
                          </span>
                        ) : isRefundDone ? (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <i className="fa-solid fa-circle-check text-emerald-700"></i>
                            <span>
                              {b.status === 'Refund_Completed' ? 'REFUND SELESAI' : 'DIBATALKAN'}
                            </span>
                          </span>
                        ) : isLunasOrder ? (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-500 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                            <i className="fa-solid fa-circle-check text-emerald-600"></i>
                            <span>
                              LUNAS ({isCashOrder ? 'CASH' : b.payMethodType === 'qris' ? 'QRIS' : 'TRANSFER'})
                            </span>
                          </span>
                        ) : isCashOrder && isPaid ? (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                            <span>💵 BOOKING CASH (BAYAR DI LOKASI)</span>
                          </span>
                        ) : isFailed ? (
                          <span className="text-[10px] font-black bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <i className="fa-solid fa-circle-xmark text-red-600"></i> GAGAL
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-400 px-2.5 py-0.5 rounded-full inline-block">
                            ⏳ PENDING (20m)
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2.5 py-0.5 rounded-full inline-block">
                            ✓ Selesai (+{b.ptsEarned} Pts)
                          </span>
                        )}

                        {onDeleteBooking && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteOrderId(
                                confirmDeleteOrderId === b.id ? null : b.id
                              )
                            }
                            title="Hapus pesanan ini (pelanggan iseng / asal booking)"
                            className={`tactile-btn px-2 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 transition ${
                              confirmDeleteOrderId === b.id
                                ? 'bg-red-600 text-white border-red-700'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Panel Konfirmasi Hapus Pesanan Baru / Pesanan Iseng */}
                    {onDeleteBooking && confirmDeleteOrderId === b.id && (
                      <div className="bg-red-50 border-2 border-red-400 rounded-xl p-2.5 space-y-2 animate-fade">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-red-950 leading-tight">
                              Hapus Permanen Pesanan #{`GA-${String(b.id).slice(-6)}`}?
                            </p>
                            <p className="text-[11px] text-red-800 leading-snug mt-0.5">
                              Pesanan <b>{b.customer}</b> ({b.datePretty} • Jam <b>{b.time} WIB</b>) akan dihapus permanen agar tidak menumpuk, dan slot jam <b>{b.time} WIB</b> otomatis dibuka kembali.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteBooking(b.id);
                              setConfirmDeleteOrderId(null);
                            }}
                            className="tactile-btn bg-red-600 hover:bg-red-700 text-white font-black py-2 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                            <span>Ya, Hapus Permanen</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteOrderId(null)}
                            className="tactile-btn bg-white hover:bg-stone-100 text-stone-700 font-bold py-2 px-2.5 rounded-lg text-[11px] border border-stone-300"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Detail Pelanggan, Layanan, & Jadwal (Ukuran Font Jelas & Mudah Dibaca) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-[#0B261C]">{b.customer}</span>
                        <span className="text-xs text-stone-600 font-mono font-semibold">
                          ({b.wa})
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-stone-900 leading-snug">
                        {b.items}
                      </h3>
                      <p className="text-xs text-stone-600 pt-0.5">
                        <i className="fa-regular fa-calendar mr-1.5 text-emerald-800"></i>
                        <b>{b.datePretty}</b> • Jam{' '}
                        <b className="text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {b.time} WIB
                        </b>
                      </p>
                      {b.previousSchedule && (
                        <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                          <i className="fa-solid fa-calendar-check text-amber-700"></i>
                          <span>
                            Reschedule dari jadwal awal: <s className="text-stone-500">{b.previousSchedule}</s>
                          </span>
                        </p>
                      )}
                      {b.healthNote && (
                        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-2.5 text-xs space-y-0.5">
                          <span className="text-[11px] font-black text-[#0B261C] flex items-center gap-1.5">
                            <i className="fa-solid fa-notes-medical text-emerald-800"></i>
                            <span>Catatan Keluhan / Fokus Pijat:</span>
                          </span>
                          <p className="text-stone-800 font-semibold leading-snug">
                            {b.healthNote}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Info Metode Pembayaran, Pembayaran Melalui Apa, & Struk Screenshot Pelanggan */}
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2.5 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                              Pembayaran Melalui:
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                isCashOrder
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : b.payMethodType === 'qris'
                                  ? 'bg-cyan-100 text-cyan-950 border border-cyan-300'
                                  : 'bg-indigo-100 text-indigo-950 border border-indigo-300'
                              }`}
                            >
                              {isCashOrder
                                ? '💵 CASH / DI TEMPAT'
                                : b.payMethodType === 'qris'
                                ? '📱 QRIS ONLINE'
                                : '🏦 TRANSFER BANK'}
                            </span>
                          </div>

                          <p className="text-xs text-[#0B261C] font-black leading-snug">
                            {b.paymentChannel || b.payMethod}
                          </p>

                          {b.vaNumber && (
                            <p className="text-[11px] font-mono text-stone-600 leading-snug">
                              {b.payMethodType === 'qris'
                                ? `NMID Tujuan: ${b.vaNumber}`
                                : isCashOrder
                                ? b.vaNumber
                                : `Rekening Tujuan: ${b.vaNumber}`}
                            </p>
                          )}

                          <p className="font-black text-emerald-950 text-sm pt-0.5">
                            Total Tagihan: {formatRupiah(b.total)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onViewReceipt(b)}
                          className="tactile-btn bg-white hover:bg-stone-100 text-[#0B261C] border border-stone-300 font-extrabold px-3 py-2 rounded-xl text-xs shadow-xs flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                        >
                          <i className="fa-solid fa-receipt text-amber-600"></i>
                          <span>Lihat Struk</span>
                        </button>
                      </div>

                      {/* TAMPILAN STRUK SCREENSHOT PEMBAYARAN ONLINE (QRIS/TRANSFER) ATAU KETERANGAN CASH DI TEMPAT */}
                      {isCashOrder ? (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 flex-wrap text-xs font-black text-amber-950">
                          <span>💵 Bayar di Tempat (Cash)</span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                            Dibayar di Kasir Saat Kedatangan
                          </span>
                        </div>
                      ) : b.paymentProofImage || b.refundRequest?.proofImage ? (
                        <div className="bg-white p-3 rounded-xl border-2 border-emerald-400 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-[#0B261C] flex items-center gap-1.5">
                              <i className="fa-solid fa-camera-retro text-emerald-700"></i>
                              <span>Struk Screenshot Pembayaran Pelanggan:</span>
                            </span>
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                              ✓ Terlampir • Siap Dicek
                            </span>
                          </div>

                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-stone-600 font-bold">Dibayar Melalui:</span>
                            <span className="font-black text-[#0B261C]">
                              {b.paymentChannel || b.payMethod}
                            </span>
                          </div>

                          <div
                            onClick={() => handleOpenProofInspector(b)}
                            className="relative h-40 w-full rounded-xl overflow-hidden bg-stone-950 border border-stone-300 cursor-pointer group"
                          >
                            <img
                              src={b.paymentProofImage || b.refundRequest?.proofImage}
                              alt={`Struk Screenshot Pembayaran ${b.customer}`}
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white">
                                Klik foto untuk Zoom & Cek Asli/Palsu
                              </span>
                              <span className="bg-[#D4AF37] text-[#0B261C] text-[10px] font-black px-2 py-0.5 rounded-md">
                                🔍 Perbesar Struk
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenProofInspector(b)}
                              className="tactile-btn bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-2 px-3 rounded-xl text-xs border border-[#D4AF37]/50 flex items-center justify-center gap-1.5"
                            >
                              <i className="fa-solid fa-magnifying-glass-plus"></i>
                              <span>Cek Asli / Palsu (Zoom)</span>
                            </button>

                            <label className="tactile-btn bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2 px-3 rounded-xl text-xs border border-stone-300 flex items-center justify-center gap-1.5 cursor-pointer text-center">
                              <i className="fa-solid fa-camera"></i>
                              <span>Update Foto Bukti</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleAdminUploadProofForOrder(b, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50/90 border-2 border-dashed border-amber-400 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                                <i className="fa-solid fa-triangle-exclamation text-amber-700"></i>
                                <span>Belum Ada Lampiran Struk Screenshot</span>
                              </span>
                              <p className="text-[11px] text-stone-600 leading-snug">
                                Metode: <b>{b.paymentChannel || b.payMethod}</b>. Silakan minta screenshot bukti transfer ke WA pelanggan atau lampirkan foto bukti di bawah:
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={`https://wa.me/${
                                b.wa.replace(/[^0-9]/g, '').startsWith('0')
                                  ? '62' + b.wa.replace(/[^0-9]/g, '').slice(1)
                                  : b.wa.replace(/[^0-9]/g, '')
                              }?text=${encodeURIComponent(
                                `Halo Kak *${b.customer}*, kami dari *Admin Griya Ayu Sport Massage & Spa*.\n\nMohon kirimkan *foto screenshot bukti pembayaran* untuk booking *#GA-${String(
                                  b.id
                                ).slice(-6)}* (${b.paymentChannel || b.payMethod} • ${formatRupiah(
                                  b.total
                                )}) pada jadwal *${b.datePretty} Jam ${
                                  b.time
                                } WIB* untuk verifikasi mutasi kami ya. Terima kasih 🙏`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tactile-btn bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 text-center"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                              <span>Minta Screenshot WA</span>
                            </a>

                            <label className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black py-2 px-2.5 rounded-xl text-[11px] border border-[#D4AF37]/50 flex items-center justify-center gap-1.5 cursor-pointer text-center">
                              <i className="fa-solid fa-upload"></i>
                              <span>Lampirkan Screenshot</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleAdminUploadProofForOrder(b, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* PANEL VERIFIKASI PENGAJUAN REFUND PELANGGAN (ADMIN)       */}
                    {/* ========================================================= */}
                    {(isRefundWaiting || isRefundDone) && b.refundRequest && (
                      <div
                        className={`p-3 rounded-2xl border-2 space-y-2.5 text-xs ${
                          isRefundWaiting
                            ? 'bg-amber-50/95 border-amber-400'
                            : 'bg-stone-100 border-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-center border-b border-amber-200/80 pb-2">
                          <span className="text-[11px] font-black text-[#0B261C] flex items-center gap-1.5">
                            <i className="fa-solid fa-file-invoice-dollar text-amber-700"></i>
                            <span>Detail Pengajuan Pembatalan / Refund:</span>
                          </span>
                          <span className="text-[9px] font-bold text-stone-500">
                            {b.refundRequest.requestedAt}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-amber-200 space-y-1.5 text-[11px]">
                          <div>
                            <span className="text-stone-500 font-bold block text-[10px]">
                              Alasan Pembatalan Pelanggan:
                            </span>
                            <p className="font-black text-stone-900">{b.refundRequest.reason}</p>
                          </div>

                          {b.refundRequest.isCashCancellation ? (
                            <div className="pt-1 border-t border-stone-100 text-amber-900 font-bold text-[10px]">
                              📌 Pesanan metode Cash / Bayar di Tempat (Pembatalan Jadwal)
                            </div>
                          ) : (
                            <>
                              <div className="pt-1.5 border-t border-stone-100 flex justify-between items-center gap-2">
                                <div>
                                  <span className="text-stone-500 font-bold block text-[10px]">
                                    Rekening / E-Wallet Tujuan Refund:
                                  </span>
                                  <p className="font-black text-[#0B261C]">
                                    {b.refundRequest.bankName} •{' '}
                                    <span className="font-mono">{b.refundRequest.accountNumber}</span>
                                  </p>
                                  <p className="text-[10px] font-semibold text-stone-600">
                                    a.n. {b.refundRequest.accountHolder}
                                  </p>
                                </div>
                                {b.refundRequest.accountNumber && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onCopyText(
                                        b.refundRequest!.accountNumber!,
                                        `No. Rekening Refund (${b.refundRequest!.bankName})`
                                      )
                                    }
                                    className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black px-2.5 py-1.5 rounded-xl text-[10px] flex items-center gap-1 flex-shrink-0"
                                  >
                                    <i className="fa-regular fa-copy"></i>
                                    <span>Salin Rek</span>
                                  </button>
                                )}
                              </div>

                              {/* Foto Bukti Transfer / QRIS Awal yang Diupload Pelanggan */}
                              {b.refundRequest.proofImage && (
                                <div className="pt-1.5 border-t border-stone-100 space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-stone-500 font-bold text-[10px]">
                                      Bukti Pembayaran Awal (TF / QRIS):
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewProofOrder(b)}
                                      className="text-[10px] font-black text-emerald-800 underline"
                                    >
                                      Perbesar Bukti
                                    </button>
                                  </div>
                                  <div
                                    onClick={() => setPreviewProofOrder(b)}
                                    className="relative h-36 w-full rounded-xl overflow-hidden border border-stone-300 bg-stone-900 cursor-pointer"
                                  >
                                    <img
                                      src={b.refundRequest.proofImage}
                                      alt={`Bukti Bayar ${b.customer}`}
                                      className="w-full h-full object-contain"
                                    />
                                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[9px] font-bold px-2 py-0.5 rounded">
                                      🔍 Klik untuk Perbesar
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* 2 Tombol Aksi untuk Admin jika status masih Menunggu Cek Refund Admin */}
                        {isRefundWaiting && (
                          <div className="space-y-2 pt-1">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-emerald-900 flex items-center gap-1.5">
                              <i className="fa-solid fa-lock-open text-emerald-700"></i>
                              <span>
                                Jadwal Jam <b>{b.time} WIB</b> sudah otomatis kembali tidak terkunci.
                                Silakan transfer dana refund ke rekening pelanggan di atas, lalu klik
                                tombol ACC di bawah:
                              </span>
                            </div>

                            {/* Tombol 1: ACC Permintaan Refund & Ubah ke Refund Selesai */}
                            <a
                              href={approveRefundWa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => onApproveRefund(b.id)}
                              className="tactile-btn gold-shimmer-card w-full min-h-[42px] bg-gradient-to-r from-[#0B261C] via-emerald-900 to-[#0B261C] text-[#D4AF37] font-black py-2.5 px-3 rounded-xl text-[11px] border border-[#D4AF37] shadow-sm flex items-center justify-center gap-1.5 text-center"
                            >
                              <i className="fa-solid fa-circle-check text-amber-300"></i>
                              <span>ACC Refund & Ubah Status ke "Refund Selesai" (+Kirim WA)</span>
                            </a>

                            {/* Tombol 2: Tolak Refund */}
                            {rejectingOrderId === b.id ? (
                              <div className="bg-white p-2.5 rounded-xl border border-red-300 space-y-2">
                                <label className="text-[10px] font-black text-red-800 block">
                                  Alasan Penolakan Refund (Dikirim ke Pelanggan):
                                </label>
                                <input
                                  type="text"
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-[11px] font-medium text-stone-900"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setRejectingOrderId(null)}
                                    className="tactile-btn bg-stone-200 text-stone-700 font-bold px-3 py-1.5 rounded-lg text-[10px]"
                                  >
                                    Batal
                                  </button>
                                  <a
                                    href={
                                      buildAdminRejectRefundWaMessage(b, rejectReasonInput).url
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      onRejectRefund(b.id, rejectReasonInput);
                                      setRejectingOrderId(null);
                                    }}
                                    className="tactile-btn flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1"
                                  >
                                    <i className="fa-solid fa-circle-xmark"></i>
                                    <span>Konfirmasi Tolak Refund & WA Pelanggan</span>
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingOrderId(b.id);
                                  setRejectReasonInput(
                                    'Bukti pembayaran tidak ditemukan pada mutasi rekening atau tidak valid.'
                                  );
                                }}
                                className="tactile-btn w-full bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 font-black py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                              >
                                <i className="fa-solid fa-ban"></i>
                                <span>Tolak Refund (Kembalikan Status Aktif)</span>
                              </button>
                            )}
                          </div>
                        )}

                        {isRefundDone && (
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <span className="text-[10px] font-bold text-emerald-800">
                              ✓ Status: Refund Selesai • Jadwal Jam {b.time} WIB tidak terkunci
                            </span>
                            <a
                              href={approveRefundWa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tactile-btn bg-[#25D366] text-white font-black px-2.5 py-1.5 rounded-xl text-[10px] flex items-center gap-1"
                            >
                              <i className="fa-brands fa-whatsapp"></i> Kirim WA Refund Selesai
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* TOMBOL KONFIRMASI / LUNAS CASH & PESAN WA OTOMATIS        */}
                    {/* ========================================================= */}
                    {isPaid && !isRefundWaiting && !isRefundDone && (
                      <div className="bg-emerald-50/90 p-3 rounded-2xl border border-emerald-300 space-y-2">
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-user-check text-emerald-700 text-xs"></i>
                            <span>
                              {isLunasOrder
                                ? `Status Pembayaran: LUNAS (${
                                    isCashOrder
                                      ? 'Cash'
                                      : b.payMethodType === 'qris'
                                      ? 'QRIS'
                                      : 'Transfer Bank'
                                  })`
                                : `Booking Cash (Bayar di Lokasi) — ${b.customer}:`}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedConfirmOrderId(isConfirmOpen ? null : b.id)
                            }
                            className="text-[11px] font-extrabold text-emerald-800 underline flex-shrink-0"
                          >
                            {isConfirmOpen ? 'Tutup Teks WA' : 'Preview Teks WA'}
                          </button>
                        </div>

                        {isConfirmOpen && (
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 space-y-1.5">
                            <p className="text-xs text-stone-700 whitespace-pre-line leading-relaxed font-medium">
                              {confirmMsg.text}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                onCopyText(confirmMsg.text, 'Kata-kata Konfirmasi WA Pelanggan')
                              }
                              className="tactile-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2 rounded-lg text-xs"
                            >
                              <i className="fa-regular fa-copy mr-1"></i>
                              Salin Teks Konfirmasi WA
                            </button>
                          </div>
                        )}

                        {!isLunasOrder && !isCompleted ? (
                          <a
                            href={confirmMsg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onVerifyPayment(b.id)}
                            className="tactile-btn gold-shimmer-card w-full min-h-[44px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2.5 px-3 rounded-xl text-xs border border-amber-300 shadow-sm flex items-center justify-center gap-2 text-center"
                          >
                            <i className="fa-solid fa-money-bill-wave text-emerald-900 text-sm"></i>
                            <span>Terima Pembayaran Cash (Ubah Jadi LUNAS) & Kirim WA</span>
                          </a>
                        ) : !isConfirmedAcc && !isCompleted ? (
                          <a
                            href={confirmMsg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onVerifyPayment(b.id)}
                            className="tactile-btn w-full min-h-[42px] bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2.5 px-3 rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 text-center"
                          >
                            <i className="fa-brands fa-whatsapp text-sm"></i>
                            <span>Kirim WA Konfirmasi Jadwal (Sudah Lunas)</span>
                          </a>
                        ) : (
                          <div className="flex items-center justify-between gap-2 flex-wrap bg-emerald-100/90 border border-emerald-300 rounded-xl px-3 py-2">
                            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                              <i className="fa-solid fa-circle-check text-emerald-600"></i>
                              <span>Terkonfirmasi & Lunas</span>
                            </span>
                            <a
                              href={confirmMsg.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tactile-btn bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-2xs"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                              <span>Kirim WA</span>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tombol Selesai Treatment & Kirim Poin */}
                    {!isRefundWaiting && !isRefundDone && (
                      <div className="space-y-1.5">
                        {!isCompleted ? (
                          <button
                            type="button"
                            onClick={() => onCompleteTreatment(b.id)}
                            className="tactile-btn gold-shimmer-card w-full bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-2.5 rounded-xl text-xs border border-[#D4AF37]/50 shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-crown text-amber-400"></i>
                            <span>Selesai Treatment & Kirim +{b.ptsEarned} Poin</span>
                          </button>
                        ) : (
                          <div className="text-center text-xs font-bold text-emerald-800 bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                            ✓ Treatment Selesai • +{b.ptsEarned} Poin Telah Masuk ke Akun Member
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tombol Hapus Pesanan di Bagian Bawah Kartu (Untuk Pelanggan Iseng / Asal Booking) */}
                    {onDeleteBooking && confirmDeleteOrderId !== b.id && (
                      <div className="pt-1 border-t border-stone-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteOrderId(b.id)}
                          className="tactile-btn text-[11px] font-extrabold text-red-700 hover:text-red-800 bg-red-50/80 hover:bg-red-100 border border-red-200/90 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>
                          <span>Hapus Pesanan (Pelanggan Asal Booking / Batal)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MODAL INSPEKSI & CEK KEASLIAN STRUK SCREENSHOT PEMBAYARAN PELANGGAN (ZOOM 1X - 3X) */}
        {previewProofOrder &&
          (previewProofOrder.paymentProofImage || previewProofOrder.refundRequest?.proofImage) && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Inspeksi Keaslian Struk Screenshot Pembayaran Pelanggan"
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 animate-fade"
              onClick={() => setPreviewProofOrder(null)}
            >
              <div
                className="bg-[#F9F6F0] w-full max-w-md max-h-[94vh] overflow-y-auto rounded-3xl p-4 space-y-3 shadow-2xl border-2 border-[#D4AF37]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Inspeksi Bukti */}
                <div className="flex justify-between items-start gap-2 border-b border-stone-200 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase bg-[#0B261C] text-[#D4AF37] px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                      <i className="fa-solid fa-shield-halved"></i>
                      <span>Cek Keaslian Struk Screenshot Pembayaran</span>
                    </span>
                    <h3 className="text-sm font-black text-[#0B261C] mt-1">
                      {previewProofOrder.customer} ({previewProofOrder.wa})
                    </h3>
                    <p className="text-xs font-bold text-stone-600">
                      Order #GA-{String(previewProofOrder.id).slice(-6)} • Jadwal{' '}
                      {previewProofOrder.datePretty} ({previewProofOrder.time} WIB)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewProofOrder(null)}
                    className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-800 font-black text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Kotak Rincian Pembayaran Melalui Apa & Parameter Cek Asli/Palsu */}
                <div className="bg-white p-3 rounded-2xl border border-stone-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-stone-500 font-bold shrink-0">Pembayaran Melalui:</span>
                    <span className="font-black text-[#0B261C] text-right">
                      {previewProofOrder.paymentChannel || previewProofOrder.payMethod}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-stone-500 font-bold shrink-0"> Kategori Metode:</span>
                    <span className="font-extrabold text-emerald-900 text-right">
                      {previewProofOrder.payMethodType === 'qris'
                        ? 'QRIS Resmi Griya Ayu (NMID: ID1026618031821)'
                        : 'Transfer Rekening Resmi (a.n. KARTINI)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-stone-100">
                    <span className="text-stone-500 font-bold">Nominal Wajib Sesuai:</span>
                    <span className="font-black text-sm text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {formatRupiah(previewProofOrder.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500 font-bold">Waktu Input Booking:</span>
                    <span className="font-bold text-stone-700">{previewProofOrder.createdAt}</span>
                  </div>
                </div>

                {/* Panduan Singkat Cek Asli atau Palsu */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[11px] text-amber-950 space-y-1">
                  <span className="font-black block">
                    🔎 Panduan Cek Struk Asli vs Palsu:
                  </span>
                  <p className="leading-snug text-stone-700">
                    Gunakan tombol <b>Zoom (1x–3x)</b> di bawah untuk memeriksa: <b>(1) Nominal {formatRupiah(previewProofOrder.total)}</b>, <b>(2) Nama Penerima ADMIN GRIYA AYU SPA / KARTINI</b>, <b>(3) Jam & Tanggal Transaksi</b>, dan <b>(4) Mutasi Masuk</b>.
                  </p>
                </div>

                {/* Kontrol Zoom Gambar (1x, 1.5x, 2x, 2.5x, 3x) */}
                <div className="flex items-center justify-between gap-1.5 bg-stone-900 text-white px-3 py-2 rounded-xl text-xs font-black">
                  <span className="text-[11px] text-[#D4AF37]">Zoom Struk:</span>
                  <div className="flex items-center gap-1">
                    {[1, 1.5, 2, 2.5, 3].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setProofZoomLevel(z)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition ${
                          proofZoomLevel === z
                            ? 'bg-[#D4AF37] text-[#0B261C]'
                            : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        {z}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Area Gambar Screenshot yang Bisa Di-Zoom & Di-Scroll */}
                <div className="max-h-[52vh] overflow-auto rounded-2xl border-2 border-stone-800 bg-stone-950 p-2 flex items-center justify-center">
                  <img
                    src={
                      previewProofOrder.paymentProofImage ||
                      previewProofOrder.refundRequest?.proofImage
                    }
                    alt="Struk Screenshot Pembayaran Pelanggan"
                    style={{
                      transform: `scale(${proofZoomLevel})`,
                      transformOrigin: 'top center',
                    }}
                    className="w-full h-auto object-contain transition-transform duration-150"
                  />
                </div>

                {/* Tombol Verifikasi Asli / Tolak jika Bukti Palsu */}
                {confirmRejectFakeId === previewProofOrder.id ? (
                  <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-3 space-y-2">
                    <label className="text-xs font-black text-red-900 block">
                      Alasan Penolakan (Struk Palsu / Dana Tidak Masuk Mutasi):
                    </label>
                    <input
                      type="text"
                      value={fakePaymentReason}
                      onChange={(e) => setFakePaymentReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-red-300 bg-white text-xs font-bold text-stone-900"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmRejectFakeId(null)}
                        className="tactile-btn bg-stone-200 text-stone-800 font-bold py-2 px-3 rounded-xl text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onRejectFakePayment) {
                            onRejectFakePayment(previewProofOrder.id, fakePaymentReason);
                          }
                          setConfirmRejectFakeId(null);
                          setPreviewProofOrder(null);
                        }}
                        className="tactile-btn flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-ban"></i>
                        <span>Tolak & Batalkan</span>
                      </button>
                    </div>
                    {onDeleteBooking && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteBooking(previewProofOrder.id);
                          setConfirmRejectFakeId(null);
                          setPreviewProofOrder(null);
                        }}
                        className="tactile-btn w-full bg-red-600 hover:bg-red-700 text-white font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                        <span>Hapus Permanen Pesanan Ini (Booking Iseng)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={buildAdminWaConfirmationMessage(previewProofOrder).url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          onVerifyPayment(previewProofOrder.id);
                          setPreviewProofOrder(null);
                        }}
                        className="tactile-btn bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 text-center"
                      >
                        <i className="fa-solid fa-circle-check"></i>
                        <span>Bukti Asli (ACC & WA)</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setConfirmRejectFakeId(previewProofOrder.id)}
                        className="tactile-btn bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>Bukti Palsu / Tolak</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewProofOrder(null)}
                      className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs"
                    >
                      Tutup Preview Bukti Screenshot
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* =============================================================== */}
        {/* SUB-TAB 2: BAR NOTIFIKASI ADMIN & BOT AUTO-SHARE PROMO WA       */}
        {/* =============================================================== */}
        {adminSubTab === 'notifications' && (
          <div className="space-y-3.5 animate-page-enter">
            {/* BAGIAN A: BOT SHARE PROMO OTOMATIS KE SEMUA WA PELANGGAN (TEKS & GAMBAR) */}
            <form
              onSubmit={handleRunPromoBot}
              className="bg-gradient-to-b from-[#0B261C] to-[#123829] text-white p-4 rounded-2xl border-2 border-[#D4AF37] shadow-lg space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-[#D4AF37] text-[#0B261C] px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <i className="fa-solid fa-robot"></i> WA BLAST BOT OTOMATIS
                  </span>
                  <h2 className="text-sm font-black text-white mt-1 leading-snug">
                    Share Promo Griya Ayu ke Semua WA Pelanggan
                  </h2>
                  <p className="text-xs text-emerald-200 mt-0.5 leading-snug">
                    Kirim promo berupa <b>Teks & Gambar</b> otomatis ke seluruh nomor WA member &
                    bar notifikasi pelanggan.
                  </p>
                </div>
                <span className="text-xs font-black bg-white/10 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/30 flex-shrink-0 whitespace-nowrap">
                  {storedCustomers.length} Member
                </span>
              </div>

              {/* Pilih Cepat Template Promo Menarik */}
              <div>
                <span className="text-xs font-bold text-amber-200 block mb-1.5">
                  Pilih Cepat Template Promo:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-black">
                  {PROMO_TEMPLATES.map((tpl, i) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectPromoPreset(tpl)}
                      className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-200 border border-white/20 py-2 px-2 rounded-xl truncate"
                    >
                      🔥 Promo #{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview & Upload Gambar Promo */}
              <div className="bg-black/30 p-3 rounded-xl border border-white/15 space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-[#D4AF37]">
                    1. Gambar / Poster Promo:
                  </span>
                  <input
                    type="file"
                    id="promoImageUploadInput"
                    accept="image/*"
                    onChange={handlePromoImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="promoImageUploadInput"
                    className="tactile-btn bg-[#D4AF37] text-[#0B261C] text-[11px] font-black px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    <i className="fa-solid fa-image mr-1"></i>Upload Gambar Promo
                  </label>
                </div>

                {promoImage && (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-[#D4AF37]/50">
                    <img
                      src={promoImage}
                      alt="Preview Gambar Promo"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded">
                      Kode: {promoCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Input Judul & Kode Promo */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label
                    htmlFor="promoTitleInput"
                    className="text-xs font-black text-amber-200 block mb-1"
                  >
                    2. Judul Promo:
                  </label>
                  <input
                    id="promoTitleInput"
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white text-stone-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="promoCodeInput"
                    className="text-xs font-black text-amber-200 block mb-1"
                  >
                    Kode Promo:
                  </label>
                  <input
                    id="promoCodeInput"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Input Kata-Kata Teks Promo */}
              <div>
                <label
                  htmlFor="promoMessageInput"
                  className="text-xs font-black text-amber-200 block mb-1"
                >
                  3. Kata-Kata Teks Promo (Otomatis Dikirim ke WA Pelanggan):
                </label>
                <textarea
                  id="promoMessageInput"
                  rows={4}
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white text-stone-900 text-xs font-medium leading-relaxed"
                />
              </div>

              {/* Status Pengiriman Bot Otomatis ke Semua Nomor WA Pelanggan */}
              <div className="bg-black/35 p-3 rounded-xl border border-white/10 space-y-2">
                <span className="text-xs font-black text-emerald-300 block">
                  Daftar Target Bot WA Pelanggan ({storedCustomers.length} Nomor Aktif):
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {storedCustomers.map((c) => {
                    const isSent = botSentList.includes(c.phone);
                    const rawPhone = c.phone.replace(/[^0-9]/g, '');
                    const waTarget = rawPhone.startsWith('0')
                      ? '62' + rawPhone.slice(1)
                      : rawPhone;
                    const singlePromoWaUrl = `https://wa.me/${waTarget}?text=${encodeURIComponent(
                      `*${promoTitle}*\nKode Promo: *${promoCode}*\nPoster Promo: ${promoImage}\n\n${promoMessage}`
                    )}`;

                    return (
                      <div
                        key={c.phone}
                        className="flex justify-between items-center gap-2 bg-white/10 px-3 py-2 rounded-lg text-xs"
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-white">{c.name}</span>{' '}
                          <span className="font-mono text-emerald-200">({c.phone})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isSent && (
                            <span className="text-[10px] font-black bg-emerald-500 text-stone-950 px-2 py-0.5 rounded whitespace-nowrap">
                              ✓ Bot Terkirim
                            </span>
                          )}
                          <a
                            href={singlePromoWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#25D366] text-white font-black px-2.5 py-1 rounded text-[11px] flex items-center gap-1 whitespace-nowrap"
                          >
                            <i className="fa-brands fa-whatsapp"></i> WA
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={botRunning}
                className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-yellow-500 text-[#0B261C] font-black py-3 rounded-xl shadow-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 text-center"
              >
                <i className="fa-solid fa-robot text-sm"></i>
                <span>
                  {botRunning
                    ? 'Bot Sedang Mengirim ke Semua WA Pelanggan...'
                    : `Share Promo ke Semua WA Pelanggan (${storedCustomers.length} Member)`}
                </span>
              </button>
            </form>

            {/* BAGIAN B: BAR NOTIFIKASI PEMBAYARAN MASUK ADMIN */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
              <div className="flex justify-between items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5 min-w-0">
                  <i className="fa-solid fa-bell text-amber-600 flex-shrink-0"></i>
                  <span className="truncate">Bar Notifikasi Pembayaran Masuk (Admin)</span>
                </h3>
                <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full flex-shrink-0">
                  {adminNotifications.length} Notif
                </span>
              </div>

              {adminNotifications.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">
                  Belum ada notifikasi pembayaran baru.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {adminNotifications.map((n) => {
                    const matchedOrder = n.orderId
                      ? bookings.find((b) => b.id === n.orderId)
                      : undefined;
                    return (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2"
                      >
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase bg-emerald-800 text-amber-300 px-2 py-0.5 rounded">
                            🔔 Pembayaran Masuk & Jam Terkunci
                          </span>
                          <span className="text-[10px] text-stone-500 font-semibold">
                            {n.createdAt}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#0B261C]">{n.title}</h4>
                        <p className="text-xs text-stone-700 leading-relaxed">{n.message}</p>

                        {matchedOrder && (
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-300 space-y-2 text-xs">
                            <div className="flex justify-between items-center gap-2 flex-wrap">
                              <span className="text-stone-500 font-bold">Pembayaran Melalui:</span>
                              <span className="font-black text-[#0B261C]">
                                {matchedOrder.paymentChannel || matchedOrder.payMethod}
                              </span>
                            </div>

                            {(matchedOrder.paymentProofImage ||
                              matchedOrder.refundRequest?.proofImage) && (
                              <div className="space-y-1.5">
                                <div
                                  onClick={() => handleOpenProofInspector(matchedOrder)}
                                  className="relative h-32 w-full rounded-lg overflow-hidden bg-stone-950 border border-stone-300 cursor-pointer"
                                >
                                  <img
                                    src={
                                      matchedOrder.paymentProofImage ||
                                      matchedOrder.refundRequest?.proofImage
                                    }
                                    alt={`Bukti Bayar ${matchedOrder.customer}`}
                                    className="w-full h-full object-contain"
                                  />
                                  <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[#D4AF37] text-[10px] font-black px-2 py-0.5 rounded">
                                    🔍 Klik Cek Keaslian Struk
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProofInspector(matchedOrder)}
                                  className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2 px-3 rounded-lg text-[11px] flex items-center justify-center gap-1.5"
                                >
                                  <i className="fa-solid fa-magnifying-glass-plus"></i>
                                  <span>Lihat & Cek Asli/Palsu Struk Screenshot</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {n.waConfirmationText && (
                          <div className="bg-white p-2.5 rounded-xl border border-stone-200 space-y-1.5">
                            <span className="text-[10px] font-black text-stone-500 uppercase block">
                              Kata-Kata Konfirmasi Siap Kirim ke WA Pelanggan ({n.customerName}):
                            </span>
                            <p className="text-xs text-stone-700 whitespace-pre-line leading-snug">
                              {n.waConfirmationText}
                            </p>
                          </div>
                        )}

                        {n.waConfirmationUrl && (
                          <div className="flex gap-2">
                            <a
                              href={n.waConfirmationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (n.orderId) onVerifyPayment(n.orderId);
                              }}
                              className="tactile-btn flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow text-center"
                            >
                              <i className="fa-brands fa-whatsapp text-sm"></i>
                              <span>Langsung Share Konfirmasi ke WA Pelanggan</span>
                            </a>
                            {n.waConfirmationText && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCopyText(
                                    n.waConfirmationText!,
                                    'Kata-kata Konfirmasi WA Pelanggan'
                                  )
                                }
                                className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold px-3 py-2 rounded-xl text-xs flex-shrink-0"
                              >
                                Salin
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* SUB-TAB 3: ATUR JAM OPERASIONAL STUDIO & JADWAL HOME SERVICE    */}
        {/* =============================================================== */}
        {adminSubTab === 'schedule' && (
          <div className="space-y-3 animate-page-enter">
            {/* Sub-Navigasi Pilihan: Jadwal Home Service vs Jadwal Studio */}
            <div className="bg-[#0B261C] p-1.5 rounded-2xl border-2 border-[#D4AF37] shadow-md grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setScheduleSectionTab('home_service')}
                className={`tactile-btn py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  scheduleSectionTab === 'home_service'
                    ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] shadow-sm'
                    : 'bg-white/5 text-stone-200 hover:bg-white/10'
                }`}
              >
                <i className="fa-solid fa-car-side"></i>
                <span>Jadwal Home Service</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleSectionTab('studio')}
                className={`tactile-btn py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  scheduleSectionTab === 'studio'
                    ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] shadow-sm'
                    : 'bg-white/5 text-stone-200 hover:bg-white/10'
                }`}
              >
                <i className="fa-solid fa-house-chimney-medical"></i>
                <span>Jadwal Studio</span>
              </button>
            </div>

            {/* =========================================================== */}
            {/* TAB A: PENGATURAN JADWAL OPERASIONAL HOME SERVICE (DINAMIS) */}
            {/* =========================================================== */}
            {scheduleSectionTab === 'home_service' && (
              <div className="space-y-3 animate-page-enter">
                {/* 1. Toggle Cepat Status Layanan Home Service (Aktif / Nonaktif Sementara) */}
                <div
                  className={`p-4 rounded-2xl border-2 shadow-sm transition space-y-2.5 ${
                    hsDraft.enabled
                      ? 'bg-gradient-to-br from-[#0B261C] via-[#123d2d] to-[#0B261C] text-white border-[#D4AF37]'
                      : 'bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 text-white border-red-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          hsDraft.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                            : 'bg-red-500/25 text-red-200 border-red-400/50'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            hsDraft.enabled ? 'bg-emerald-400 animate-ping' : 'bg-red-400'
                          }`}
                        ></span>
                        <span>
                          {hsDraft.enabled
                            ? 'LAYANAN HOME SERVICE AKTIF'
                            : 'NONAKTIF SEMENTARA (TERAPIS PENUH)'}
                        </span>
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-[#D4AF37] leading-snug">
                        Status Layanan Home Service
                      </h3>
                      <p className="text-[11px] text-stone-200 leading-relaxed">
                        Matikan toggle ini jika sewaktu-waktu seluruh terapis sedang penuh agar pelanggan tidak bisa memesan sesi Home Service sementara waktu.
                      </p>
                    </div>

                    {/* Toggle Switch Besar */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hsDraft.enabled}
                      onClick={handleToggleHsGlobalStatus}
                      className={`tactile-btn px-3.5 py-2.5 rounded-2xl font-black text-xs border-2 flex items-center gap-2 flex-shrink-0 shadow-md transition ${
                        hsDraft.enabled
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-[#071A12] border-emerald-200'
                          : 'bg-red-600 hover:bg-red-500 text-white border-red-300'
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          hsDraft.enabled ? 'fa-toggle-on text-base' : 'fa-toggle-off text-base'
                        }`}
                      ></i>
                      <span>{hsDraft.enabled ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Daftar Hari (Senin s/d Minggu) + Toggle Buka/Tutup & Jam Buka - Jam Tutup per Hari */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-stone-100 pb-2.5">
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-check text-emerald-700"></i>
                        <span>Hari &amp; Jam Operasional Home Service (Senin – Minggu)</span>
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Atur hari buka/libur serta jam operasional layanan Home Service untuk masing-masing hari.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyHoursToAllDays('09:00', '20:00')}
                      className="tactile-btn bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                    >
                      <i className="fa-regular fa-clock"></i>
                      <span>Setel 09:00–20:00 Semua Hari</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {hsDraft.days.map((dayItem) => (
                      <div
                        key={dayItem.dayOfWeek}
                        className={`p-3 rounded-2xl border transition ${
                          dayItem.isOpen
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-stone-100 border-stone-300 opacity-85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {/* Nama Hari & Badge Status */}
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                dayItem.isOpen ? 'bg-emerald-600' : 'bg-red-500'
                              }`}
                            ></span>
                            <span className="text-xs sm:text-sm font-black text-[#0B261C]">
                              {dayItem.dayName}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                dayItem.isOpen
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-red-100 text-red-800 border border-red-300'
                              }`}
                            >
                              {dayItem.isOpen ? 'AKTIF / BUKA' : 'TUTUP / LIBUR'}
                            </span>
                          </div>

                          {/* Toggle Switch Aktif / Tutup per Hari */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dayItem.isOpen}
                            onClick={() => handleToggleHsDayOpen(dayItem.dayOfWeek)}
                            className={`tactile-btn px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 transition ${
                              dayItem.isOpen
                                ? 'bg-[#0B261C] text-[#D4AF37] border-[#D4AF37]/60'
                                : 'bg-red-600 text-white border-red-700'
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                dayItem.isOpen ? 'fa-toggle-on text-emerald-400' : 'fa-toggle-off'
                              }`}
                            ></i>
                            <span>{dayItem.isOpen ? 'Aktif' : 'Tutup'}</span>
                          </button>
                        </div>

                        {/* Input Jam Buka & Jam Tutup per Hari */}
                        {dayItem.isOpen ? (
                          <div className="mt-2.5 pt-2 border-t border-emerald-200/70 grid grid-cols-2 gap-2 items-center">
                            <div>
                              <label className="text-[10px] font-extrabold text-stone-600 block mb-0.5">
                                Jam Buka ({dayItem.dayName}):
                              </label>
                              <input
                                type="time"
                                value={dayItem.openTime}
                                onChange={(e) =>
                                  handleChangeHsDayHours(
                                    dayItem.dayOfWeek,
                                    'openTime',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-black text-[#0B261C]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-extrabold text-stone-600 block mb-0.5">
                                Jam Tutup ({dayItem.dayName}):
                              </label>
                              <input
                                type="time"
                                value={dayItem.closeTime}
                                onChange={(e) =>
                                  handleChangeHsDayHours(
                                    dayItem.dayOfWeek,
                                    'closeTime',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-black text-[#0B261C]"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[11px] font-bold text-red-700">
                            Layanan Home Service libur pada hari {dayItem.dayName}.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Pengaturan Daftar Slot Jam Home Service (Pilih / Tambah / Hapus) */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                      <i className="fa-solid fa-clock text-amber-600"></i>
                      <span>Daftar Slot Jam Home Service</span>
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Pilih slot jam yang aktif, tambahkan jam baru, atau hapus slot jam Home Service. Slot yang tampil ke pelanggan akan mengikuti jam buka–tutup hari terkait.
                    </p>
                  </div>

                  {/* Grid Slot Jam Home Service */}
                  <div className="space-y-1.5">
                    {hsDraft.slots.map((slot) => (
                      <div
                        key={slot.time}
                        className={`flex justify-between items-center gap-2 p-2.5 rounded-xl border transition ${
                          slot.active
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-stone-100 border-stone-300 opacity-85'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-sm font-black ${
                              slot.active ? 'text-[#0B261C]' : 'text-stone-400 line-through'
                            }`}
                          >
                            {slot.time} WIB
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              slot.active
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-stone-300 text-stone-700'
                            }`}
                          >
                            {slot.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleHsSlotActive(slot.time)}
                            className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-black transition ${
                              slot.active
                                ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                                : 'bg-[#0B261C] text-[#D4AF37]'
                            }`}
                          >
                            {slot.active ? 'Matikan' : 'Aktifkan'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveHsSlot(slot.time)}
                            aria-label={`Hapus slot ${slot.time}`}
                            className="tactile-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg text-xs font-black"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Form Tambah Slot Jam Home Service Baru */}
                  <div className="pt-2 border-t border-stone-200 flex gap-2">
                    <input
                      type="time"
                      value={newHsSlotInput}
                      onChange={(e) => setNewHsSlotInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 bg-white min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleAddHsSlot}
                      className="tactile-btn bg-emerald-800 hover:bg-emerald-900 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Tambah Slot Jam</span>
                    </button>
                  </div>
                </div>

                {/* 4. Tombol Simpan Pengaturan Jadwal & Reset Default */}
                <div className="bg-[#0B261C] p-3.5 rounded-2xl border-2 border-[#D4AF37] shadow-lg space-y-2.5">
                  {hasUnsavedHsChanges && (
                    <div className="bg-amber-400/20 border border-amber-300/50 text-amber-200 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-info text-[#D4AF37]"></i>
                      <span>Klik tombol di bawah untuk menyimpan perubahan jam operasional.</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveHomeServiceSchedule}
                    className="tactile-btn gold-shimmer-card w-full min-h-[46px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wider border border-amber-200 shadow-md flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-floppy-disk"></i>
                    <span>Simpan Pengaturan Jadwal</span>
                  </button>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-stone-300">
                    <span>Jadwal default: Senin–Minggu (09:00 – 20:00)</span>
                    <button
                      type="button"
                      onClick={handleResetHomeServiceDefault}
                      className="text-amber-300 hover:underline font-bold"
                    >
                      Reset ke Default
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================== */}
            {/* TAB B: PENGATURAN JADWAL STUDIO                             */}
            {/* =========================================================== */}
            {scheduleSectionTab === 'studio' && (
              <div className="space-y-3 animate-page-enter">
                {/* 1. Atur Hari Libur Rutin Mingguan */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-xmark text-red-600"></i>
                      <span>1. Atur Libur Mingguan Studio</span>
                    </h3>
                    <span className="text-[11px] font-bold text-stone-500">Klik Hari untuk Ubah</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {dayNames.map((name, idx) => {
                      const isOff = closedWeekdays.includes(idx);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onToggleWeekdayHoliday(idx)}
                          className={`tactile-btn py-2 px-1.5 rounded-xl border text-xs font-black transition truncate ${
                            isOff
                              ? 'bg-red-600 text-white border-red-700 shadow-xs'
                              : 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:border-emerald-400'
                          }`}
                        >
                          {name}
                          <span
                            className={`block text-[10px] font-bold ${
                              isOff ? 'text-red-100' : 'text-emerald-700'
                            }`}
                          >
                            {isOff ? 'LIBUR' : 'Buka'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Liburkan Tanggal Tertentu (Cuti / Acara) */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
                  <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                    <i className="fa-solid fa-ban text-amber-600"></i>
                    <span>2. Liburkan Tanggal Tertentu</span>
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customDateInput}
                      onChange={(e) => setCustomDateInput(e.target.value)}
                      min={todayIso}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 bg-white min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDate}
                      className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black px-3.5 py-2 rounded-xl text-xs whitespace-nowrap flex-shrink-0"
                    >
                      + Liburkan
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {closedSpecificDates.length > 0 ? (
                      closedSpecificDates.map((dt) => (
                        <span
                          key={dt}
                          className="inline-flex items-center gap-1.5 bg-red-100 text-red-900 border border-red-300 text-xs font-black px-2.5 py-1 rounded-lg"
                        >
                          Libur: {dt}
                          <button
                            type="button"
                            onClick={() => onRemoveSpecificHoliday(dt)}
                            aria-label={`Buka kembali ${dt}`}
                            className="text-red-700 font-black hover:text-red-900"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-stone-400">Belum ada tanggal libur khusus.</span>
                    )}
                  </div>
                </div>

                {/* 3. Buka / Tutup Jam Operasional Tertentu */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                      <i className="fa-regular fa-clock text-emerald-700"></i>
                      <span>3. Buka / Tutup Jam Operasional Studio</span>
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    {masterTimeSlots.map((slot) => (
                      <div
                        key={slot.time}
                        className={`flex justify-between items-center gap-2 p-2.5 rounded-xl border transition ${
                          slot.active
                            ? 'bg-white border-stone-200'
                            : 'bg-stone-100 border-stone-300 opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-sm font-black ${
                              slot.active ? 'text-[#0B261C]' : 'text-stone-400 line-through'
                            }`}
                          >
                            {slot.time} WIB
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              slot.active
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-stone-300 text-stone-700'
                            }`}
                          >
                            {slot.active ? 'Buka' : 'Tutup'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleMasterSlot(slot.time)}
                          className={`tactile-btn px-3 py-1.5 rounded-lg text-xs font-black transition flex-shrink-0 ${
                            slot.active
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-[#0B261C] text-[#D4AF37]'
                          }`}
                        >
                          {slot.active ? 'Matikan Jam' : 'Buka Jam'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Tambah Jam Baru */}
                  <div className="pt-2 border-t border-stone-200 flex gap-2">
                    <input
                      type="time"
                      value={newSlotTimeInput}
                      onChange={(e) => setNewSlotTimeInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 bg-white min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewSlot}
                      className="tactile-btn bg-emerald-800 hover:bg-emerald-900 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                    >
                      <i className="fa-solid fa-plus"></i> Tambah Jam
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* SUB-TAB 4: BAR AKUN KHUSUS ADMIN                                */}
        {/* =============================================================== */}
        {adminSubTab === 'account' && (
          <div className="space-y-3.5 animate-page-enter">
            {/* PANEL LAPORAN KEUANGAN ADMIN: OMZET HARI INI & OMZET BULANAN (KHUSUS DI BAR AKUN) */}
            <section
              aria-label="Ringkasan Laporan Keuangan Admin"
              className="bg-gradient-to-br from-[#071A12] via-[#0B261C] to-stone-900 text-white p-4 rounded-2xl border-2 border-[#D4AF37] shadow-lg space-y-3"
            >
              {/* 1. KARTU RINGKASAN OMZET HARI INI (REAL-TIME) */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/15">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>OMZET HARI INI (REAL-TIME)</span>
                    </span>
                    <span className="text-xs font-bold text-amber-200/90">{todayPretty}</span>
                  </div>

                  <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF3B0] via-[#D4AF37] to-[#F3E5AB] tracking-tight">
                    {formatRupiah(todayOmzetTotal)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-emerald-200 font-bold flex items-center gap-1">
                      <i className="fa-solid fa-circle-check text-emerald-400"></i>
                      <span>{todayVerifiedOrders.length} Pesanan Sukses Terverifikasi Hari Ini</span>
                    </span>
                    {todayWaitingVerifyCount > 0 && (
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        ⏳ {todayWaitingVerifyCount} Menunggu ACC
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. REKAPITULASI OMZET BULANAN & TOMBOL UNDUH EXCEL (CSV) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                      REKAPITULASI OMZET BULANAN
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                      <span className="text-lg font-black text-white">
                        {formatRupiah(monthlyOmzetTotal)}
                      </span>
                      <span className="text-xs text-stone-300 font-semibold">
                        ({monthlyVerifiedOrders.length} Transaksi • {monthLabelIndo})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="month"
                      aria-label="Pilih Bulan Laporan Omzet"
                      value={selectedMonthPrefix}
                      onChange={(e) =>
                        setSelectedMonthPrefix(e.target.value || getCurrentMonthPrefix())
                      }
                      className="bg-black/40 text-amber-200 border border-[#D4AF37]/50 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Rincian Singkat Rekap Bulanan (Collapsible) */}
                {showMonthlyDetails && (
                  <div className="bg-black/35 rounded-xl border border-white/15 p-2.5 space-y-1.5 max-h-44 overflow-y-auto text-xs">
                    <div className="flex justify-between items-center text-[10px] font-black text-amber-300 border-b border-white/10 pb-1">
                      <span>RINCIAN TRANSAKSI ({monthLabelIndo.toUpperCase()})</span>
                      <span>NOMINAL OMZET</span>
                    </div>
                    {monthlyVerifiedOrders.length === 0 ? (
                      <p className="text-stone-400 text-center py-2">
                        Belum ada transaksi terverifikasi pada bulan {monthLabelIndo}.
                      </p>
                    ) : (
                      monthlyVerifiedOrders.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-start gap-2 py-1 border-b border-white/5 last:border-none"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-white truncate">
                              {item.datePretty} • {item.customer}
                            </p>
                            <p className="text-[11px] text-emerald-200 truncate">{item.items}</p>
                            <p className="text-[10px] text-stone-400">{item.payMethod}</p>
                          </div>
                          <span className="font-black text-[#D4AF37] whitespace-nowrap flex-shrink-0">
                            {formatRupiah(item.total)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Baris Tombol Unduh Laporan Bulanan (Excel .XLSX) & Toggle Rincian */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadMonthlyCsv}
                    className="tactile-btn gold-shimmer-card flex-1 min-h-[42px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#071A12] font-black py-2.5 px-3 rounded-xl text-xs border border-amber-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-file-excel text-emerald-950 text-sm flex-shrink-0"></i>
                    <span className="truncate">Unduh Laporan Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMonthlyDetails((prev) => !prev)}
                    className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-200 border border-white/20 font-bold px-3 py-2 rounded-xl text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {showMonthlyDetails ? 'Tutup Rincian' : 'Rincian'}
                  </button>
                </div>
              </div>
            </section>

            <AccountPanel
              currentUser={currentUser}
              isAdmin={true}
              bookings={bookings}
              customers={storedCustomers}
              language={language}
              onChangeLanguage={onChangeLanguage}
              onUpdateUser={onUpdateUser}
              onUpdateCustomerAccount={onUpdateCustomerAccount}
              onViewReceipt={onViewReceipt}
              onLogout={onLogout}
              onShowToast={onShowToast}
            />
          </div>
        )}

        {/* =============================================================== */}
        {/* SUB-TAB BARU: KELOLA PENUKARAN POIN (MANAJEMEN REWARD POIN)     */}
        {/* =============================================================== */}
        {adminSubTab === 'rewards' && (
          <div className="space-y-2.5 animate-page-enter">
            {/* Kartu Header & Ringkasan Katalog Reward (Ringkas & Hemat Tempat) */}
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-gift text-amber-500 text-xs"></i>
                    <h2 className="text-sm font-black text-[#0B261C] truncate">
                      Kelola Penukaran Poin
                    </h2>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">
                    Otomatis tampil di halaman Poin pelanggan
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddRewardModal}
                  className="tactile-btn gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2 px-3 rounded-xl text-xs border border-amber-300 shadow-xs flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                >
                  <i className="fa-solid fa-plus-circle text-xs"></i>
                  <span>+ Tambah Reward</span>
                </button>
              </div>

              {/* Statistik Singkat Reward (Baris Ringkas) */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-stone-50 border border-stone-200 rounded-xl py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-500">Total</span>
                  <span className="text-xs font-black text-[#0B261C]">
                    {managedRewards.length}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800">Aktif</span>
                  <span className="text-xs font-black text-emerald-900">
                    {managedRewards.filter((r) => r.available !== false).length}
                  </span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800">Off</span>
                  <span className="text-xs font-black text-amber-900">
                    {managedRewards.filter((r) => r.available === false).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Daftar Item Reward Poin (Padat & Rapi) */}
            <div className="space-y-2">
              {managedRewards.length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-center space-y-2">
                  <i className="fa-solid fa-gift text-2xl text-stone-400"></i>
                  <p className="text-xs font-black text-stone-800">
                    Belum Ada Katalog Reward Poin
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddRewardModal}
                    className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black text-xs px-3.5 py-2 rounded-xl border border-[#D4AF37]"
                  >
                    + Tambah Reward Pertama
                  </button>
                </div>
              ) : (
                managedRewards.map((item, idx) => {
                  const isAvailable = item.available !== false;
                  const isDeletingThis = deletingRewardId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition space-y-2 shadow-2xs ${
                        isAvailable
                          ? 'bg-white border-stone-200/90'
                          : 'bg-stone-100 border-stone-300 opacity-85'
                      }`}
                    >
                      {/* Baris Atas: Nama Reward, Status & Nominal Poin */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-stone-400">
                              #{idx + 1}
                            </span>
                            <h3 className="text-xs sm:text-sm font-black text-[#0B261C] leading-snug">
                              {item.title || item.label}
                            </h3>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-stone-200 text-stone-700 border-stone-300'
                              }`}
                            >
                              {isAvailable
                                ? `✓ ${item.stockInfo || 'Tersedia'}`
                                : `✕ ${item.stockInfo || 'Habis'}`}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-stone-600 leading-snug mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <span className="bg-[#0B261C] text-[#D4AF37] text-xs font-black px-2.5 py-1 rounded-xl border border-[#D4AF37] flex-shrink-0 whitespace-nowrap">
                          👑 {item.cost} Poin
                        </span>
                      </div>

                      {/* Konfirmasi Hapus Inline (Jika Klik Hapus) */}
                      {isDeletingThis ? (
                        <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 space-y-2 animate-fade">
                          <p className="text-[11px] font-black text-red-900">
                            Hapus reward &ldquo;{item.title || item.label}&rdquo; ({item.cost} Poin)?
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteReward(item)}
                              className="tactile-btn flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                              <span>Ya, Hapus</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRewardId(null)}
                              className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-1.5 px-2.5 rounded-lg text-[11px]"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Baris Tombol Aksi Admin: Edit, Toggle Status, Hapus */
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRewardModal(item)}
                            className="tactile-btn flex-1 bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-1.5 px-2.5 rounded-xl text-[11px] border border-[#D4AF37]/50 flex items-center justify-center gap-1"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleRewardAvailability(item)}
                            className={`tactile-btn py-1.5 px-2.5 rounded-xl text-[11px] font-black border flex items-center justify-center gap-1 ${
                              isAvailable
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                            }`}
                          >
                            <i
                              className={
                                isAvailable ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'
                              }
                            ></i>
                            <span>{isAvailable ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingRewardId(item.id)}
                            className="tactile-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-black py-1.5 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* SUB-TAB BARU: KELOLA LAYANAN SPORT MASSAGE & SPA                */}
        {/* =============================================================== */}
        {adminSubTab === 'services' && (
          <div className="space-y-2.5 animate-page-enter">
            {/* Kartu Header & Filter Katalog Layanan (Ringkas, Padat & Tanpa Ruang Kosong) */}
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-spa text-[#D4AF37] text-xs"></i>
                    <h2 className="text-sm font-black text-[#0B261C] truncate">
                      Kelola Layanan &amp; SPA
                    </h2>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">
                    Satuan ({managedSingleServices.filter((s) => s.available !== false).length}/{managedSingleServices.length}) • Paket Hemat ({managedPackageServices.filter((p) => p.available !== false).length}/{managedPackageServices.length})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAddServiceModal(serviceTabMode)}
                  className="tactile-btn gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2 px-3 rounded-xl text-xs border border-amber-300 shadow-xs flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                >
                  <i className="fa-solid fa-plus-circle text-xs"></i>
                  <span>+ Tambah Layanan</span>
                </button>
              </div>

              {/* Switch Tab: Layanan Satuan vs Paket Hemat */}
              <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl text-xs font-black gap-1">
                <button
                  type="button"
                  onClick={() => setServiceTabMode('single')}
                  className={`tactile-btn py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    serviceTabMode === 'single'
                      ? 'bg-[#0B261C] text-[#D4AF37] shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <i className="fa-solid fa-hands-holding-circle text-[11px]"></i>
                  <span>Layanan Satuan ({managedSingleServices.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceTabMode('package')}
                  className={`tactile-btn py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                    serviceTabMode === 'package'
                      ? 'bg-[#0B261C] text-[#D4AF37] shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <i className="fa-solid fa-fire-flame-curved text-[11px]"></i>
                  <span>Paket Hemat ({managedPackageServices.length})</span>
                </button>
              </div>

              {/* Pencarian & Filter Kategori Cepat */}
              <div className="space-y-1.5">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[11px]"></i>
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="Cari layanan Sport Massage / SPA..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold text-stone-800 focus:outline-none focus:border-[#0B261C]"
                  />
                  {serviceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setServiceSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'sport', label: '💪 Sport' },
                    { id: 'wellness', label: '🌸 SPA' },
                    { id: 'kebugaran', label: 'Kebugaran' },
                    { id: 'otot_cedera', label: 'Cedera' },
                    { id: 'spa_tubuh', label: 'Spa Tubuh' },
                    { id: 'bekam', label: 'Bekam' },
                    { id: 'khusus_wanita', label: '👩 Wanita' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setServiceCategoryFilter(
                          cat.id as 'all' | 'sport' | 'wellness' | ServiceGridCategory
                        )
                      }
                      className={`tactile-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap border transition ${
                        serviceCategoryFilter === cat.id
                          ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Daftar Kartu Layanan (Padat, Rapi & Tidak Makan Tempat) */}
            <div className="space-y-2">
              {filteredManagedServices.length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-center space-y-2">
                  <p className="text-xs font-black text-stone-800">
                    Tidak Ada Layanan pada Filter Ini
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAddServiceModal(serviceTabMode)}
                    className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black text-xs px-3.5 py-2 rounded-xl border border-[#D4AF37]"
                  >
                    + Tambah Layanan Baru
                  </button>
                </div>
              ) : (
                filteredManagedServices.map((item, idx) => {
                  const isAvailable = item.available !== false;
                  const isDeletingThis = deletingServiceId === item.id;
                  const isFemaleOnly = item.gender === 'female';
                  const isMaleOnly = item.gender === 'male';
                  const isSportCat =
                    item.category === 'sport' || (!item.category && !isFemaleOnly);
                  const hasSpots =
                    item.id === 's2' || item.id === 's4' || Boolean(item.hasInjurySpots);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition space-y-2 shadow-2xs ${
                        isAvailable
                          ? 'bg-white border-stone-200/90'
                          : 'bg-stone-100 border-stone-300 opacity-85'
                      }`}
                    >
                      {/* Baris Utama: Info Layanan di Kiri + Harga & Poin di Kanan */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-black text-stone-400">
                              #{idx + 1}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-stone-200 text-stone-700 border-stone-300'
                              }`}
                            >
                              {isAvailable ? '✓ Aktif' : '✕ Off'}
                            </span>
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                isSportCat
                                  ? 'bg-sky-100 text-sky-950'
                                  : 'bg-pink-100 text-pink-900'
                              }`}
                            >
                              {isSportCat ? '💪 Sport' : '🌸 SPA'}
                            </span>
                            <span className="text-[10px] font-bold bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">
                              {isFemaleOnly
                                ? '👩 Wanita'
                                : isMaleOnly
                                ? '👨 Pria'
                                : '👨👩 Umum'}
                            </span>
                            {hasSpots && (
                              <span className="text-[10px] font-extrabold text-orange-900 bg-orange-100 px-1.5 py-0.5 rounded">
                                🎯 Titik Cedera
                              </span>
                            )}
                          </div>

                          <h3 className="text-xs sm:text-sm font-black text-[#0B261C] leading-snug">
                            {item.name}
                          </h3>

                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-stone-600">
                            <span className="font-bold text-stone-700 inline-flex items-center gap-1">
                              <i className="fa-regular fa-clock text-emerald-700 text-[10px]"></i>
                              {item.duration}
                            </span>
                            {item.tag && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-amber-900">{item.tag}</span>
                              </>
                            )}
                          </div>

                          {item.desc && (
                            <p className="text-[11px] text-stone-500 leading-snug line-clamp-2">
                              {item.desc}
                            </p>
                          )}
                        </div>

                        {/* Kolom Kanan: Harga & Poin */}
                        <div className="text-right flex-shrink-0 space-y-1">
                          <div className="text-xs sm:text-sm font-black text-emerald-900 whitespace-nowrap">
                            {formatRupiah(item.price)}
                          </div>
                          {item.normalPrice && item.normalPrice > item.price && (
                            <div className="text-[10px] line-through text-stone-400 font-bold whitespace-nowrap">
                              {formatRupiah(item.normalPrice)}
                            </div>
                          )}
                          <span className="inline-block bg-[#0B261C] text-[#D4AF37] text-[10px] font-black px-2 py-0.5 rounded-lg border border-[#D4AF37]">
                            +{item.points} Poin
                          </span>
                        </div>
                      </div>

                      {/* Konfirmasi Hapus Inline */}
                      {isDeletingThis ? (
                        <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 space-y-2 animate-fade">
                          <p className="text-[11px] font-black text-red-900">
                            Hapus layanan &ldquo;{item.name}&rdquo; ({formatRupiah(item.price)})?
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteService(item, serviceTabMode)}
                              className="tactile-btn flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                              <span>Ya, Hapus</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingServiceId(null)}
                              className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-1.5 px-2.5 rounded-lg text-[11px]"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Tombol Aksi Admin Ringkas: Edit, Aktif/Nonaktif, Hapus */
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEditServiceModal(item, serviceTabMode)}
                            className="tactile-btn flex-1 bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-1.5 px-2.5 rounded-xl text-[11px] border border-[#D4AF37]/50 flex items-center justify-center gap-1"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleServiceAvailability(item, serviceTabMode)
                            }
                            className={`tactile-btn py-1.5 px-2.5 rounded-xl text-[11px] font-black border flex items-center justify-center gap-1 ${
                              isAvailable
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                            }`}
                          >
                            <i
                              className={
                                isAvailable ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'
                              }
                            ></i>
                            <span>{isAvailable ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingServiceId(item.id)}
                            className="tactile-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-black py-1.5 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Opsi Kembalikan Daftar Layanan Bawaan (Baris Ringkas) */}
            <div className="bg-stone-100 px-3 py-2 rounded-xl border border-stone-200/90 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-stone-600 truncate">
                Kembalikan daftar layanan bawaan?
              </span>
              {confirmResetServices ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleResetServicesToDefault}
                    className="tactile-btn bg-red-600 text-white font-black text-[11px] px-2.5 py-1 rounded-lg"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetServices(false)}
                    className="tactile-btn bg-stone-200 text-stone-800 font-bold text-[11px] px-2.5 py-1 rounded-lg"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetServices(true)}
                  className="tactile-btn bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-bold text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0"
                >
                  <i className="fa-solid fa-rotate-left mr-1"></i>
                  Reset Default
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MODAL FORM TAMBAH / EDIT LAYANAN SPORT MASSAGE & SPA (ADMIN)      */}
      {/* ================================================================= */}
      {serviceModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-page-enter"
          role="dialog"
          aria-modal="true"
          aria-label={
            editingServiceId
              ? 'Edit Layanan Sport Massage & SPA'
              : 'Tambah Layanan Sport Massage & SPA Baru'
          }
        >
          <div className="bg-white w-full max-w-md rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header Modal */}
            <div className="bg-[#0B261C] text-white px-4 py-3.5 border-b border-[#D4AF37]/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <i className="fa-solid fa-spa text-[#D4AF37] text-base"></i>
                <h3 className="text-sm sm:text-base font-black text-[#D4AF37] truncate">
                  {editingServiceId
                    ? 'Edit Layanan Sport Massage / SPA'
                    : 'Tambah Layanan Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="text-stone-300 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={handleSaveServiceForm}
              className="p-4 space-y-3.5 overflow-y-auto text-xs sm:text-sm"
            >
              {/* Pilihan Jenis Katalog: Layanan Satuan vs Paket Hemat */}
              <div>
                <span className="block font-black text-[#0B261C] mb-1.5">
                  Jenis Layanan:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceTypeInput('single')}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      serviceTypeInput === 'single'
                        ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C] shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-hands-holding-circle"></i>
                    <span>Layanan Satuan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceTypeInput('package')}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      serviceTypeInput === 'package'
                        ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C] shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-fire-flame-curved"></i>
                    <span>Paket Hemat</span>
                  </button>
                </div>
              </div>

              {/* Kategori Utama: Sport Massage vs SPA & Wellness */}
              <div>
                <span className="block font-black text-[#0B261C] mb-1.5">
                  Kategori Utama Treatment:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceCategoryInput('sport')}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      serviceCategoryInput === 'sport'
                        ? 'bg-sky-900 text-amber-300 border-sky-950 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <span>💪 Sport Massage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceCategoryInput('wellness')}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      serviceCategoryInput === 'wellness'
                        ? 'bg-pink-800 text-amber-200 border-pink-950 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <span>🌸 SPA &amp; Wellness</span>
                  </button>
                </div>
              </div>

              {/* Nama Layanan */}
              <div>
                <label className="block font-black text-[#0B261C] mb-1">
                  Nama Layanan / Paket <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={serviceNameInput}
                  onChange={(e) => {
                    setServiceNameInput(e.target.value);
                    setServiceFormError('');
                  }}
                  placeholder="Contoh: Pijat Sport Recovery / Aromatherapy Body Spa"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-bold text-stone-900 focus:outline-none"
                />
              </div>

              {/* Durasi Layanan + Pilihan Cepat */}
              <div>
                <label className="block font-black text-[#0B261C] mb-1">
                  Durasi Sesi Terapi <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={serviceDurationInput}
                  onChange={(e) => setServiceDurationInput(e.target.value)}
                  placeholder="Contoh: 60 Menit / 90 Menit"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2 font-bold text-stone-900 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {['30 Menit', '45 Menit', '60 Menit', '90 Menit', '120 Menit', '150 Menit'].map(
                    (dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setServiceDurationInput(dur)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          serviceDurationInput === dur
                            ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                            : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {dur}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Harga & Poin Loyalitas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Harga Layanan (Rp) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={5000}
                    value={servicePriceInput}
                    onChange={(e) => {
                      setServicePriceInput(e.target.value);
                      setServiceFormError('');
                    }}
                    placeholder="Contoh: 200000"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-black text-emerald-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Bonus Poin Member
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={servicePointsInput}
                    onChange={(e) => setServicePointsInput(e.target.value)}
                    placeholder="Contoh: 15"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-black text-[#0B261C] focus:outline-none"
                  />
                </div>
              </div>

              {/* Harga Normal / Coret (Opsional untuk Paket Hemat / Promo) & Tag Singkat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Harga Normal / Coret (Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={serviceNormalPriceInput}
                    onChange={(e) => setServiceNormalPriceInput(e.target.value)}
                    placeholder="Kosongkan jika tidak ada"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3 py-2 font-bold text-stone-700 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Label / Tag Singkat
                  </label>
                  <input
                    type="text"
                    value={serviceTagInput}
                    onChange={(e) => setServiceTagInput(e.target.value)}
                    placeholder="Misal: Pemulihan Otot"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3 py-2 font-bold text-stone-800 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Target Gender Pelanggan */}
              <div>
                <span className="block font-black text-[#0B261C] mb-1.5">
                  Target Pelanggan (Gender):
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'all', label: '👨👩 Semua Gender' },
                    { id: 'female', label: '👩 Khusus Wanita' },
                    { id: 'male', label: '👨 Khusus Pria' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setServiceGenderInput(g.id as 'all' | 'female' | 'male');
                        if (
                          g.id === 'female' &&
                          !serviceGridCatsInput.includes('khusus_wanita')
                        ) {
                          setServiceGridCatsInput((prev) => [...prev, 'khusus_wanita']);
                        }
                      }}
                      className={`tactile-btn py-2 px-2 rounded-xl font-black text-[11px] border text-center ${
                        serviceGenderInput === g.id
                          ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                          : 'bg-stone-100 text-stone-700 border-stone-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kategori Ikon di Halaman Pelanggan (Bisa Pilih Lebih dari 1) */}
              <div>
                <span className="block font-black text-[#0B261C] mb-1">
                  Tampilkan pada Ikon Kategori Pelanggan:
                </span>
                <p className="text-[11px] text-stone-500 mb-1.5">
                  Pilih satu atau beberapa kategori agar layanan mudah ditemukan pelanggan:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GRID_CATEGORY_OPTIONS.map((opt) => {
                    const active = serviceGridCatsInput.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleGridCatInput(opt.id)}
                        className={`tactile-btn px-3 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition ${
                          active
                            ? 'bg-emerald-900 text-[#D4AF37] border-emerald-950 shadow-2xs'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            active ? 'fa-square-check text-[#D4AF37]' : 'fa-square text-stone-300'
                          }`}
                        ></i>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deskripsi & Manfaat Layanan */}
              <div>
                <label className="block font-black text-[#0B261C] mb-1">
                  Deskripsi / Manfaat Layanan
                </label>
                <textarea
                  rows={2}
                  value={serviceDescInput}
                  onChange={(e) => setServiceDescInput(e.target.value)}
                  placeholder="Jelaskan manfaat terapi atau isi paket layanan untuk pelanggan..."
                  className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl p-3 font-medium text-stone-800 focus:outline-none leading-relaxed text-xs"
                />
              </div>

              {/* Opsi Tambahan: Pilihan Titik Keluhan Otot (Khusus Layanan Satuan) */}
              {serviceTypeInput === 'single' && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-black text-[#0B261C] block text-xs">
                      🎯 Aktifkan Pilihan Titik Keluhan / Cedera?
                    </span>
                    <span className="text-[11px] text-stone-600 block">
                      Jika aktif, pelanggan bisa memilih titik anatomi tubuh (Lutut, Pinggang, Bahu, dll) saat memilih layanan ini.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceHasInjurySpotsInput(!serviceHasInjurySpotsInput)}
                    className={`tactile-btn px-3 py-2 rounded-xl font-black text-xs border flex-shrink-0 ${
                      serviceHasInjurySpotsInput
                        ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    {serviceHasInjurySpotsInput ? '✓ Aktif' : 'Tidak'}
                  </button>
                </div>
              )}

              {/* Status Ketersediaan Layanan */}
              <div>
                <span className="block font-black text-[#0B261C] mb-1.5">
                  Status Layanan di Halaman Pelanggan:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceAvailableInput(true)}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      serviceAvailableInput
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Aktif / Tersedia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceAvailableInput(false)}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      !serviceAvailableInput
                        ? 'bg-stone-800 text-amber-300 border-stone-900 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-eye-slash"></i>
                    <span>Nonaktif / Sembunyikan</span>
                  </button>
                </div>
              </div>

              {serviceFormError && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-red-600"></i>
                  <span>{serviceFormError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="tactile-btn gold-shimmer-card flex-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs sm:text-sm border border-amber-300 shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>
                    {editingServiceId ? 'Simpan Perubahan Layanan' : 'Simpan Layanan Baru'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL FORM TAMBAH / EDIT REWARD POIN (KHUSUS ADMIN)               */}
      {/* ================================================================= */}
      {rewardModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-page-enter"
          role="dialog"
          aria-modal="true"
          aria-label={editingRewardId ? 'Edit Reward Poin' : 'Tambah Reward Poin Baru'}
        >
          <div className="bg-white w-full max-w-md rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="bg-[#0B261C] text-white px-4 py-3.5 border-b border-[#D4AF37]/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-gift text-[#D4AF37] text-base"></i>
                <h3 className="text-sm sm:text-base font-black text-[#D4AF37]">
                  {editingRewardId ? 'Edit Reward Penukaran Poin' : 'Tambah Reward Poin Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRewardModalOpen(false)}
                className="text-stone-300 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={handleSaveRewardForm}
              className="p-4 space-y-3.5 overflow-y-auto text-xs sm:text-sm"
            >
              <div>
                <label className="block font-black text-[#0B261C] mb-1">
                  Nama Reward / Hadiah <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={rewardTitleInput}
                  onChange={(e) => {
                    setRewardTitleInput(e.target.value);
                    setRewardFormError('');
                  }}
                  placeholder="Contoh: Gratis Bekam / Diskon 20k / Gratis Totok Wajah"
                  className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-bold text-stone-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Jumlah Poin Dibutuhkan <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={rewardCostInput}
                    onChange={(e) => {
                      setRewardCostInput(e.target.value);
                      setRewardFormError('');
                    }}
                    placeholder="Contoh: 50"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-black text-[#0B261C] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-black text-[#0B261C] mb-1">
                    Keterangan Stok / Kuota
                  </label>
                  <input
                    type="text"
                    value={rewardStockInput}
                    onChange={(e) => setRewardStockInput(e.target.value)}
                    placeholder="Contoh: Tersedia / Stok 10"
                    className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl px-3.5 py-2.5 font-bold text-stone-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-[#0B261C] mb-1">
                  Catatan / Deskripsi Bebas (Syarat &amp; Ketentuan)
                </label>
                <textarea
                  rows={3}
                  value={rewardDescInput}
                  onChange={(e) => setRewardDescInput(e.target.value)}
                  placeholder="Contoh: Diskon 20k untuk semua treatment, Gratis Bekam 45 menit, atau Syarat & Ketentuan bebas diisi admin..."
                  className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] rounded-xl p-3 font-medium text-stone-800 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <span className="block font-black text-[#0B261C] mb-1.5">
                  Status Ketersediaan di Katalog Pelanggan:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRewardAvailableInput(true)}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      rewardAvailableInput
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Aktif / Tersedia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRewardAvailableInput(false)}
                    className={`tactile-btn py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-1.5 ${
                      !rewardAvailableInput
                        ? 'bg-stone-800 text-amber-300 border-stone-900 shadow-xs'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    <i className="fa-solid fa-eye-slash"></i>
                    <span>Nonaktif / Habis</span>
                  </button>
                </div>
              </div>

              {rewardFormError && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-red-600"></i>
                  <span>{rewardFormError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRewardModalOpen(false)}
                  className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="tactile-btn gold-shimmer-card flex-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs sm:text-sm border border-amber-300 shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>{editingRewardId ? 'Simpan Perubahan' : 'Simpan Reward Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION KHUSUS ADMIN (6 MENU ADMIN - RAPI & TIDAK TABRAKAN) */}
      <nav
        aria-label="Navigasi Admin"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-stone-900 text-stone-400 border-t-2 border-[#D4AF37]/50 grid grid-cols-6 gap-0.5 py-1.5 px-1 text-[9.5px] font-bold z-40 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setAdminSubTab('orders')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 relative py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'orders'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-clipboard-check text-sm"></i>
          <span className="leading-none truncate max-w-full">{isEn ? 'Orders' : 'Pesanan'}</span>
          {paidUnverifiedCount > 0 && (
            <span className="absolute top-0.5 right-1 bg-emerald-500 text-stone-950 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {paidUnverifiedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('services')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'services'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-spa text-sm"></i>
          <span className="leading-none truncate max-w-full">
            {isEn ? 'Services' : 'Layanan'}
          </span>
        </button>
        <button
          type="button"
          onClick={handleOpenNotifTab}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 relative py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'notifications'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-bullhorn text-sm"></i>
          <span className="leading-none truncate max-w-full">Notif</span>
          {unreadAdminNotifs > 0 && (
            <span className="absolute top-0.5 right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadAdminNotifs}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('rewards')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'rewards'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-gift text-sm"></i>
          <span className="leading-none truncate max-w-full">
            {isEn ? 'Rewards' : 'Poin'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('schedule')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'schedule'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-calendar-day text-sm"></i>
          <span className="leading-none truncate max-w-full">{isEn ? 'Schedule' : 'Atur Jam'}</span>
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('account')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl min-w-0 transition ${
            adminSubTab === 'account'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-user-shield text-sm"></i>
          <span className="leading-none truncate max-w-full">{isEn ? 'Account' : 'Akun'}</span>
        </button>
      </nav>
    </div>
  );
};
