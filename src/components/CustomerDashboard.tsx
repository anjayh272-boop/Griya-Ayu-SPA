import React, { useState, useEffect } from 'react';
import {
  User,
  BookingOrder,
  TimeSlot,
  Language,
  AppNotification,
  PaymentMethodType,
  RefundRequestInfo,
  ServiceGridCategory,
  PointReward,
  ServiceItem,
  HomeServiceScheduleConfig,
} from '../types/index.ts';
import {
  calculateOrderPricing,
  formatRupiah,
  formatDatePretty,
  formatCountdown,
  getTodayIso,
  getCurrentTimeHm,
  isDatePast,
  isTimeSlotPast,
  isDateHoliday,
  isSlotAvailable,
  isOrderLockedStatus,
  getPaymentMethodDetails,
  checkBookingRefundEligibility,
  checkBookingRescheduleEligibility,
  compressImageFileToDataUrl,
  buildCustomerBookingWaToAdminMessage,
  buildCustomerToAdminRefundWaMessage,
  normalizeHomeServiceSchedule,
  isHomeServiceDateAvailable,
  getActiveHomeServiceSlotsForDate,
  GRIYA_AYU_QRIS_IMAGE,
  GRIYA_AYU_QRIS_NMID,
  GRIYA_AYU_QRIS_MERCHANT,
  GRIYA_AYU_BANK_ACCOUNTS,
  GRIYA_AYU_ADDRESS,
  GRIYA_AYU_MAPS_URL,
  QRIS_PAYMENT_CHANNELS,
  BANK_TRANSFER_CHANNELS,
} from '../utils/spaLogic.ts';
import {
  SINGLE_CATALOG,
  PACKAGE_CATALOG,
  ANATOMY_LOCATIONS,
  POINT_REWARDS,
  DEFAULT_HOME_SERVICE_SCHEDULE,
} from '../data/mockData.ts';
import { AccountPanel } from './AccountPanel.tsx';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface CustomerDashboardProps {
  currentUser: User;
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
  onOpenPaymentModal: (orderDraft: {
    total: number;
    scheduleDatePretty: string;
    scheduleDateIso: string;
    selectedTimeSlot: string;
    itemsSummary: string;
    pointsEarned: number;
    pointsRedeemedCost: number;
    healthNote?: string;
  }) => void;
  onConfirmWizardBooking?: (draft: {
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
    paymentChannel?: string;
    healthNote?: string;
    existingOrderId?: number | null;
    silentReceipt?: boolean;
  }) => BookingOrder | null;
  onCancelPendingBooking?: (orderId: number) => void;
  onRequestRefund?: (orderId: number, refundInfo: RefundRequestInfo) => void;
  onRescheduleBooking?: (
    orderId: number,
    newDateIso: string,
    newDatePretty: string,
    newTimeSlot: string
  ) => void;
  onRedeemPointReward?: (reward: PointReward) => void;
  onCopyText?: (text: string, label: string) => void;
  onViewReceipt: (order: BookingOrder) => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
  onShowToast: (title: string, message: string, waUrl?: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser,
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
  onOpenPaymentModal,
  onConfirmWizardBooking,
  onCancelPendingBooking,
  onRequestRefund,
  onRescheduleBooking,
  onRedeemPointReward,
  onCopyText,
  onViewReceipt,
  onMarkNotificationsRead,
  onLogout,
  onShowToast,
}) => {
  const isEn = language === 'en';
  const [customerTab, setCustomerTab] = useState<
    'booking' | 'history' | 'notifications' | 'rewards' | 'account'
  >('booking');

  useEffect(() => {
    const handleOpenBookingFromNotif = () => {
      setCustomerTab('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('griya-open-booking-dashboard', handleOpenBookingFromNotif);
    return () => {
      window.removeEventListener('griya-open-booking-dashboard', handleOpenBookingFromNotif);
    };
  }, []);

  // State Wizard Bertahap (Langkah 1: Pilih Layanan -> Langkah 2: Pilih Tanggal & Jam -> Langkah 3: Pembayaran & Konfirmasi)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);

  // Tick every second so pending 20-minute countdowns stay live
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Service selection state (mulai dari 0 pilihan tanpa batasan maksimum)
  const [serviceMode, setServiceMode] = useState<'single' | 'package'>('single');
  const [selectedGridCategory, setSelectedGridCategory] = useState<'all' | ServiceGridCategory>('all');
  const [showPriceListImages, setShowPriceListImages] = useState<boolean>(false);
  const [zoomedBrochure, setZoomedBrochure] = useState<{
    src: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [brochureZoomLevel, setBrochureZoomLevel] = useState<number>(1);
  const [chosenSingleIds, setChosenSingleIds] = useState<string[]>([]);
  const [chosenPackageId, setChosenPackageId] = useState<string>('');
  const [injurySpotsByService, setInjurySpotsByService] = useState<Record<string, string[]>>({
    s2: ['Lutut (Knee)'],
    s4: ['Pinggang / Saraf Kejepit (Low Back)'],
  });
  const [openInjuryServiceId, setOpenInjuryServiceId] = useState<string | null>(null);

  // Pilihan lokasi sesi: Studio vs Home Service (+Biaya Perjalanan)
  const [visitType, setVisitType] = useState<'studio' | 'home_service'>('studio');

  // Calendar date state (otomatis default ke tanggal hari ini)
  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => getTodayIso());
  const [selectedDatePretty, setSelectedDatePretty] = useState<string>(() =>
    formatDatePretty(new Date())
  );

  // Time slot selection
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Point reward selection (di Langkah 3 & Modal Konfirmasi Tukar Poin di Tab Poin)
  const [selectedRewardId, setSelectedRewardId] = useState<string>('none');
  const [redeemConfirmReward, setRedeemConfirmReward] = useState<PointReward | null>(null);

  // State Pembayaran di Langkah 3 (QRIS Timer 20 Menit + Metode + Bukti Bayar + ID Pesanan Pending di Riwayat)
  const [step3PendingOrderId, setStep3PendingOrderId] = useState<number | null>(null);
  const [step3ExpiresAt, setStep3ExpiresAt] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [step3MethodType, setStep3MethodType] = useState<PaymentMethodType>('qris');
  const [step3PaymentChannel, setStep3PaymentChannel] = useState<string>(
    QRIS_PAYMENT_CHANNELS[0]
  );
  const [step3ProofImage, setStep3ProofImage] = useState<string>('');
  const [step3ProofError, setStep3ProofError] = useState<string>('');
  const [step3HealthNote, setStep3HealthNote] = useState<string>('');

  const handleStep3ProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setStep3ProofImage(compressed);
      setStep3ProofError('');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setStep3ProofImage(reader.result);
          setStep3ProofError('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // State Modal Konfirmasi Pembatalan Pesanan Berstatus "Pending Pembayaran" (1-Klik Tanpa Form Rekening/Bukti Transfer)
  const [pendingCancelModalOrder, setPendingCancelModalOrder] = useState<BookingOrder | null>(null);

  // Sinkronkan step3PendingOrderId jika pesanan pending tersebut dibatalkan atau kedaluwarsa
  useEffect(() => {
    if (!step3PendingOrderId) return;
    const matched = bookings.find((b) => b.id === step3PendingOrderId);
    if (matched && matched.status === 'Cancelled') {
      setStep3PendingOrderId(null);
      if (bookingStep === 3) {
        setSelectedTimeSlot(null);
        setBookingStep(1);
      }
    }
  }, [bookings, step3PendingOrderId, bookingStep]);

  const handleConfirmCancelPendingOrder = () => {
    if (!pendingCancelModalOrder) return;
    const targetId = pendingCancelModalOrder.id;
    if (onCancelPendingBooking) {
      onCancelPendingBooking(targetId);
    }
    if (step3PendingOrderId === targetId) {
      setStep3PendingOrderId(null);
      setSelectedTimeSlot(null);
      setBookingStep(1);
    }
    setPendingCancelModalOrder(null);
  };

  // State Modal Formulir Pengajuan Pembatalan / Refund (Khusus Pesanan Lunas / Terkonfirmasi)
  const [refundModalOrder, setRefundModalOrder] = useState<BookingOrder | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundBankName, setRefundBankName] = useState<string>('Bank BCA');
  const [refundAccountNumber, setRefundAccountNumber] = useState<string>('');
  const [refundAccountHolder, setRefundAccountHolder] = useState<string>('');
  const [refundProofImage, setRefundProofImage] = useState<string>('');
  const [refundFormError, setRefundFormError] = useState<string>('');

  // State Modal Reschedule Mandiri (Ganti Jadwal maksimal 4 jam sebelum jadwal awal)
  const [rescheduleModalOrder, setRescheduleModalOrder] = useState<BookingOrder | null>(null);
  const [rescheduleDateIso, setRescheduleDateIso] = useState<string>(() => getTodayIso());
  const [rescheduleDatePretty, setRescheduleDatePretty] = useState<string>(() =>
    formatDatePretty(new Date())
  );
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string>('');

  const handleOpenRescheduleModal = (order: BookingOrder) => {
    setRescheduleModalOrder(order);
    setRescheduleDateIso(order.date);
    setRescheduleDatePretty(order.datePretty);
    setRescheduleTimeSlot(null);
    setRescheduleError('');
  };

  const handleSubmitRescheduleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalOrder || !onRescheduleBooking) return;

    const eligibility = checkBookingRescheduleEligibility(
      rescheduleModalOrder.date,
      rescheduleModalOrder.time,
      nowMs
    );
    if (!eligibility.canReschedule) {
      setRescheduleError(
        'Batas waktu ganti jadwal (maksimal 4 jam sebelum jadwal awal) sudah terlewati.'
      );
      return;
    }

    if (!rescheduleTimeSlot) {
      setRescheduleError('Silakan pilih jam sesi baru yang tersedia terlebih dahulu.');
      return;
    }

    if (
      rescheduleDateIso === rescheduleModalOrder.date &&
      rescheduleTimeSlot === rescheduleModalOrder.time
    ) {
      setRescheduleError('Silakan pilih tanggal atau jam yang berbeda dari jadwal awal Anda.');
      return;
    }

    if (
      isDatePast(rescheduleDateIso, nowMs) ||
      isTimeSlotPast(rescheduleDateIso, rescheduleTimeSlot, nowMs)
    ) {
      setRescheduleError(
        'Tanggal atau jam baru yang dipilih sudah terlewat. Silakan pilih jadwal lain.'
      );
      return;
    }

    onRescheduleBooking(
      rescheduleModalOrder.id,
      rescheduleDateIso,
      rescheduleDatePretty,
      rescheduleTimeSlot
    );
    setRescheduleModalOrder(null);
  };

  const handleOpenRefundModal = (order: BookingOrder) => {
    setRefundModalOrder(order);
    setRefundReason(order.refundRequest?.reason || 'Ada keperluan mendadak');
    setRefundBankName(order.refundRequest?.bankName || 'Bank BCA');
    setRefundAccountNumber(order.refundRequest?.accountNumber || '');
    setRefundAccountHolder(order.refundRequest?.accountHolder || order.customer);
    setRefundProofImage(order.refundRequest?.proofImage || order.paymentProofImage || '');
    setRefundFormError('');
  };

  const handleRefundProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setRefundProofImage(compressed);
      setRefundFormError('');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setRefundProofImage(reader.result);
          setRefundFormError('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRefundForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder || !onRequestRefund) return;

    const isCashOrder =
      refundModalOrder.payMethodType === 'cash' ||
      refundModalOrder.payMethod.toLowerCase().includes('cash') ||
      refundModalOrder.payMethod.toLowerCase().includes('tempat');

    if (!refundReason.trim()) {
      setRefundFormError('Mohon isi alasan pembatalan jadwal terlebih dahulu.');
      return;
    }

    if (!isCashOrder) {
      if (!refundBankName.trim() || !refundAccountNumber.trim() || !refundAccountHolder.trim()) {
        setRefundFormError(
          'Mohon lengkapi Nama Bank/E-Wallet, Nomor Rekening, dan Atas Nama tujuan pengembalian dana (refund).'
        );
        return;
      }
    }

    const nowStr = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const refundInfo: RefundRequestInfo = {
      reason: refundReason.trim(),
      bankName: isCashOrder ? undefined : refundBankName.trim(),
      accountNumber: isCashOrder ? undefined : refundAccountNumber.trim(),
      accountHolder: isCashOrder ? undefined : refundAccountHolder.trim(),
      proofImage: isCashOrder
        ? undefined
        : refundProofImage || refundModalOrder.paymentProofImage || undefined,
      requestedAt: nowStr,
      isCashCancellation: isCashOrder,
    };

    onRequestRefund(refundModalOrder.id, refundInfo);
    setRefundModalOrder(null);
  };

  const todayIso = getTodayIso(nowMs);
  const currentTimeHm = getCurrentTimeHm(nowMs);

  const activeHomeServiceSchedule = React.useMemo(
    () => normalizeHomeServiceSchedule(homeServiceSchedule || DEFAULT_HOME_SERVICE_SCHEDULE),
    [homeServiceSchedule]
  );

  // Status ketersediaan Home Service pada tanggal yang sedang dipilih pelanggan
  const selectedDateHomeServiceStatus = React.useMemo(
    () =>
      isHomeServiceDateAvailable(
        selectedDateIso,
        activeHomeServiceSchedule,
        closedSpecificDates
      ),
    [selectedDateIso, activeHomeServiceSchedule, closedSpecificDates]
  );

  // Daftar slot jam Home Service yang aktif untuk tanggal terpilih
  const activeHomeServiceSlotsForSelectedDate = React.useMemo(
    () => getActiveHomeServiceSlotsForDate(selectedDateIso, activeHomeServiceSchedule),
    [selectedDateIso, activeHomeServiceSchedule]
  );

  // Generate kalender: menampilkan 2 hari sebelumnya (misal tgl 18 & 19 yang otomatis abu-abu/terlewat) + hari ini (tgl 20) + 29 hari ke depan
  const calendarDays = React.useMemo(() => {
    const days: Array<{
      iso: string;
      pretty: string;
      dayName: string;
      dayNum: number;
      monthName: string;
      isHoliday: boolean;
      isStudioHoliday: boolean;
      isHomeServiceClosed: boolean;
      isPast: boolean;
      isToday: boolean;
    }> = [];

    const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthLabels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    const nowDate = new Date(nowMs);
    const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - 2);

    for (let i = 0; i < 32; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;
      const dayIdx = d.getDay();
      const pretty = `${dayLabels[dayIdx]}, ${d.getDate()} ${monthLabels[d.getMonth()]} ${yyyy}`;
      const studioHoliday = isDateHoliday(iso, dayIdx, closedWeekdays, closedSpecificDates);
      const hsAvailability = isHomeServiceDateAvailable(
        iso,
        activeHomeServiceSchedule,
        closedSpecificDates
      );
      const homeServiceClosed = !hsAvailability.available;
      const holiday = visitType === 'home_service' ? homeServiceClosed : studioHoliday;
      const past = iso < todayIso;

      days.push({
        iso,
        pretty,
        dayName: dayLabels[dayIdx],
        dayNum: d.getDate(),
        monthName: monthLabels[d.getMonth()],
        isHoliday: holiday,
        isStudioHoliday: studioHoliday,
        isHomeServiceClosed: homeServiceClosed,
        isPast: past,
        isToday: iso === todayIso,
      });
    }
    return days;
  }, [
    closedWeekdays,
    closedSpecificDates,
    activeHomeServiceSchedule,
    visitType,
    todayIso,
    nowMs,
  ]);

  // Otomatis koreksi jika tanggal terpilih sudah lewat, serta reset jam jika sudah terlewat atau tidak tersedia pada mode Home Service
  useEffect(() => {
    if (isDatePast(selectedDateIso, nowMs)) {
      const firstOpen = calendarDays.find((d) => !d.isPast && !d.isHoliday);
      if (firstOpen) {
        setSelectedDateIso(firstOpen.iso);
        setSelectedDatePretty(firstOpen.pretty);
      } else {
        setSelectedDateIso(todayIso);
        setSelectedDatePretty(formatDatePretty(new Date(nowMs)));
      }
      setSelectedTimeSlot(null);
      return;
    }

    if (selectedTimeSlot && isTimeSlotPast(selectedDateIso, selectedTimeSlot, nowMs)) {
      setSelectedTimeSlot(null);
      return;
    }

    if (visitType === 'home_service') {
      if (!selectedDateHomeServiceStatus.available) {
        if (selectedTimeSlot) setSelectedTimeSlot(null);
        return;
      }
      if (
        selectedTimeSlot &&
        !activeHomeServiceSlotsForSelectedDate.some((s) => s.time === selectedTimeSlot)
      ) {
        setSelectedTimeSlot(null);
      }
    }
  }, [
    nowMs,
    todayIso,
    selectedDateIso,
    selectedTimeSlot,
    calendarDays,
    visitType,
    selectedDateHomeServiceStatus,
    activeHomeServiceSlotsForSelectedDate,
  ]);

  // Daftar reward poin yang dikelola Admin (hanya menampilkan yang aktif/tersedia di halaman pelanggan)
  const allManagedRewards = pointRewards && pointRewards.length > 0 ? pointRewards : POINT_REWARDS;
  const catalogPointRewards = React.useMemo(
    () =>
      allManagedRewards
        .filter((r) => r.id !== 'none' && r.available !== false)
        .sort((a, b) => a.cost - b.cost),
    [allManagedRewards]
  );
  const activePointRewardsWithNone = React.useMemo(() => {
    const noneOption: PointReward = {
      id: 'none',
      title: 'Simpan Poin (Tabung Poin Loyalitas)',
      label: 'Simpan Poin (Tabung Poin Loyalitas)',
      cost: 0,
      cut: 0,
      available: true,
    };
    return [noneOption, ...catalogPointRewards];
  }, [catalogPointRewards]);

  // Katalog layanan Sport Massage & SPA yang dikelola Admin (hanya menampilkan yang aktif)
  const activeSingleCatalog = React.useMemo(() => {
    const source =
      singleServices && singleServices.length > 0 ? singleServices : SINGLE_CATALOG;
    return source.filter((s) => s.available !== false);
  }, [singleServices]);

  const activePackageCatalog = React.useMemo(() => {
    const source =
      packageServices && Array.isArray(packageServices)
        ? packageServices
        : PACKAGE_CATALOG;
    return source.filter((p) => p.available !== false);
  }, [packageServices]);

  // Pricing calculation
  const pricing = calculateOrderPricing(
    serviceMode,
    chosenSingleIds,
    chosenPackageId,
    activeSingleCatalog,
    activePackageCatalog,
    selectedRewardId,
    activePointRewardsWithNone,
    currentUser.points,
    injurySpotsByService
  );

  const finalItemsSummary =
    visitType === 'home_service'
      ? `${pricing.titleStr} [Home Service + Biaya Perjalanan]`
      : pricing.titleStr;

  const toggleSingleItem = (id: string) => {
    if (chosenSingleIds.includes(id)) {
      const updated = chosenSingleIds.filter((item) => item !== id);
      setChosenSingleIds(updated);
      if (openInjuryServiceId === id) {
        setOpenInjuryServiceId(null);
      }
    } else {
      const updated = [...chosenSingleIds, id];
      setChosenSingleIds(updated);
      const serviceObj = activeSingleCatalog.find((item) => item.id === id);
      const needsSpots =
        id === 's2' || id === 's4' || Boolean(serviceObj?.hasInjurySpots);
      if (needsSpots) {
        setInjurySpotsByService((prev) => {
          const current = prev[id] || [];
          if (current.length > 0) return prev;
          return {
            ...prev,
            [id]: [
              id === 's4'
                ? 'Pinggang / Saraf Kejepit (Low Back)'
                : 'Lutut (Knee)',
            ],
          };
        });
        setOpenInjuryServiceId(id);
      }
    }
  };

  const toggleInjurySpotForService = (serviceId: string, spot: string) => {
    setInjurySpotsByService((prev) => {
      const current = prev[serviceId] || [];
      const exists = current.includes(spot);
      if (exists) {
        // Jangan biarkan kosong sama sekali jika sudah dipilih, minimal 1 titik atau bisa dikosongkan lalu dipilih lagi
        const filtered = current.filter((item) => item !== spot);
        return { ...prev, [serviceId]: filtered };
      }
      return { ...prev, [serviceId]: [...current, spot] };
    });
  };

  const handleDateSelect = (
    iso: string,
    pretty: string,
    isHoliday: boolean,
    isPast: boolean = false
  ) => {
    if (isPast || isDatePast(iso, nowMs)) {
      onShowToast(
        isEn ? 'Date Has Passed' : 'Tanggal Sudah Terlewat',
        `Tanggal ${pretty} sudah terlewat dan terkunci. Silakan pilih tanggal hari ini atau tanggal berikutnya yang masih tersedia.`
      );
      return;
    }
    if (visitType === 'home_service') {
      setSelectedDateIso(iso);
      setSelectedDatePretty(pretty);
      setSelectedTimeSlot(null);
      if (isHoliday) {
        onShowToast(
          'Home Service Tidak Tersedia',
          'Maaf, layanan Home Service tidak tersedia pada hari tersebut.'
        );
      }
      return;
    }
    if (isHoliday) {
      onShowToast(
        isEn ? 'Closed on Selected Date' : 'Jadwal Sedang Libur',
        `Mohon maaf, pada hari ${pretty} Griya Ayu sedang LIBUR operasional. Silakan pilih tanggal lain yang tersedia.`
      );
      return;
    }
    setSelectedDateIso(iso);
    setSelectedDatePretty(pretty);
    setSelectedTimeSlot(null);
  };

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setBookingStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dari Langkah 1 -> Langkah 2
  const handleGoToStep2 = () => {
    if (
      (serviceMode === 'single' && chosenSingleIds.length === 0) ||
      (serviceMode === 'package' && !chosenPackageId)
    ) {
      onShowToast(
        'Pilih Layanan Terapi',
        'Silakan pilih minimal 1 layanan terlebih dahulu sebelum lanjut ke pemilihan jadwal.'
      );
      return;
    }
    goToStep(2);
  };

  // Dari Langkah 2 -> Langkah 3 (Otomatis simpan ke Bar Riwayat sebagai Pending 20 Menit agar tidak hilang jika aplikasi ke-close / ke-refresh)
  const handleGoToStep3 = () => {
    if (
      (serviceMode === 'single' && chosenSingleIds.length === 0) ||
      (serviceMode === 'package' && !chosenPackageId)
    ) {
      goToStep(1);
      onShowToast(
        'Pilih Layanan Terapi',
        'Silakan pilih minimal 1 layanan terlebih dahulu sebelum lanjut ke pembayaran.'
      );
      return;
    }
    if (isDatePast(selectedDateIso, nowMs)) {
      onShowToast(
        'Tanggal Sudah Terlewat',
        'Tanggal yang dipilih sudah terlewat. Silakan pilih tanggal hari ini atau tanggal berikutnya.'
      );
      return;
    }
    if (visitType === 'home_service' && !selectedDateHomeServiceStatus.available) {
      onShowToast(
        'Home Service Tidak Tersedia',
        'Maaf, layanan Home Service tidak tersedia pada hari tersebut.'
      );
      return;
    }
    if (!selectedTimeSlot) {
      onShowToast(
        isEn ? 'Select Session Time' : 'Pilih Jam Sesi Terapi',
        isEn
          ? 'Please select an available time slot before proceeding to payment.'
          : 'Silakan pilih salah satu jam sesi terapi yang tersedia pada Langkah 2 sebelum lanjut ke pembayaran.'
      );
      return;
    }
    if (isTimeSlotPast(selectedDateIso, selectedTimeSlot, nowMs)) {
      setSelectedTimeSlot(null);
      onShowToast(
        'Jam Sesi Sudah Terlewat',
        `Jam ${selectedTimeSlot} WIB pada hari ini sudah terlewat (Waktu sekarang: ${currentTimeHm} WIB). Silakan pilih jam berikutnya yang masih tersedia.`
      );
      return;
    }

    if (onConfirmWizardBooking) {
      const savedPending = onConfirmWizardBooking({
        total: pricing.finalPrice,
        scheduleDatePretty: selectedDatePretty,
        scheduleDateIso: selectedDateIso,
        selectedTimeSlot,
        itemsSummary: finalItemsSummary,
        pointsEarned: pricing.pts,
        pointsRedeemedCost: pricing.rewardObj.cost,
        payMethodType: step3MethodType,
        markAsPaid: false,
        healthNote: step3HealthNote.trim() || undefined,
        existingOrderId: step3PendingOrderId,
        silentReceipt: true,
      });
      if (savedPending) {
        setStep3PendingOrderId(savedPending.id);
        setStep3ExpiresAt(savedPending.expiresAt);
      } else {
        setStep3ExpiresAt(Date.now() + 20 * 60 * 1000);
      }
    } else {
      setStep3ExpiresAt(Date.now() + 20 * 60 * 1000);
    }

    goToStep(3);
  };

  // Konfirmasi Pembayaran di Langkah 3 -> Dinamis sesuai metode (QRIS/TF wajib bukti vs Cash langsung kunci)
  const handleConfirmStep3Payment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTimeSlot) return;

    // Jika batas waktu 20 menit sudah berakhir -> tidak bisa melakukan pembayaran lagi (Gagal)
    if (Date.now() >= step3ExpiresAt) {
      onShowToast(
        'Waktu Pembayaran 20 Menit Berakhir (Gagal) ⏳',
        'Maaf, batas waktu pembayaran 20 menit telah berakhir sehingga Anda tidak dapat melakukan pembayaran lagi pada pesanan ini. Silakan pilih jadwal kembali.'
      );
      return;
    }

    if (isDatePast(selectedDateIso, nowMs) || isTimeSlotPast(selectedDateIso, selectedTimeSlot, nowMs)) {
      setSelectedTimeSlot(null);
      goToStep(2);
      onShowToast(
        'Jadwal Sudah Terlewat',
        'Tanggal atau jam sesi yang Anda pilih baru saja terlewat. Silakan pilih jadwal lain yang masih aktif.'
      );
      return;
    }

    const requiresProof = step3MethodType === 'qris' || step3MethodType === 'bank_transfer';
    if (requiresProof && !step3ProofImage) {
      setStep3ProofError(
        'Pelanggan wajib mengunggah foto / screenshot bukti transfer atau QRIS sebelum mengunci jadwal.'
      );
      onShowToast(
        'Wajib Upload Bukti Bayar',
        'Silakan unggah foto/screenshot bukti pembayaran QRIS atau Transfer Bank terlebih dahulu.'
      );
      return;
    }

    if (onConfirmWizardBooking) {
      const resolvedChannel =
        step3MethodType === 'cash'
          ? 'Cash / Bayar di Tempat'
          : step3PaymentChannel ||
            (step3MethodType === 'qris'
              ? QRIS_PAYMENT_CHANNELS[0]
              : BANK_TRANSFER_CHANNELS[0]);

      const createdOrder = onConfirmWizardBooking({
        total: pricing.finalPrice,
        scheduleDatePretty: selectedDatePretty,
        scheduleDateIso: selectedDateIso,
        selectedTimeSlot,
        itemsSummary: finalItemsSummary,
        pointsEarned: pricing.pts,
        pointsRedeemedCost: pricing.rewardObj.cost,
        payMethodType: step3MethodType,
        markAsPaid: true,
        paymentProofImage: requiresProof ? step3ProofImage : undefined,
        paymentChannel: resolvedChannel,
        healthNote: step3HealthNote.trim() || undefined,
        existingOrderId: step3PendingOrderId,
        silentReceipt: false,
      });

      if (createdOrder) {
        // Reset kembali ke Langkah 1 untuk pemesanan berikutnya (Struk Digital langsung terbuka otomatis)
        setBookingStep(1);
        setChosenSingleIds([]);
        setChosenPackageId('');
        setOpenInjuryServiceId(null);
        setSelectedTimeSlot(null);
        setStep3PendingOrderId(null);
        setStep3ProofImage('');
        setStep3ProofError('');
        setStep3HealthNote('');
      }
    } else {
      onOpenPaymentModal({
        total: pricing.finalPrice,
        scheduleDatePretty: selectedDatePretty,
        scheduleDateIso: selectedDateIso,
        selectedTimeSlot,
        itemsSummary: finalItemsSummary,
        pointsEarned: pricing.pts,
        pointsRedeemedCost: pricing.rewardObj.cost,
        healthNote: step3HealthNote.trim() || undefined,
      });
    }
  };

  const userBookings = bookings.filter(
    (b) =>
      b.customer.toLowerCase() === currentUser.name.toLowerCase() ||
      b.wa.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')
  );

  const pendingUserBookings = userBookings.filter(
    (b) =>
      b.status === 'Pending_Payment' &&
      b.paymentStatus === 'Pending' &&
      b.expiresAt > nowMs
  );

  const customerNotifications = notifications.filter(
    (n) =>
      n.target === 'all_customers' ||
      (n.target === 'customer' &&
        (!n.targetPhone ||
          n.targetPhone.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')))
  );

  const unreadNotifCount = customerNotifications.filter((n) => !n.read).length;

  const handleOpenNotifTab = () => {
    setCustomerTab('notifications');
    onMarkNotificationsRead();
  };

  const step3RemainingMs = Math.max(0, step3ExpiresAt - nowMs);
  const step3MethodInfo = getPaymentMethodDetails(step3MethodType, currentUser.phone);

  return (
    <div className="flex-1 flex flex-col pb-28">
      {/* ================================================================= */}
      {/* HEADER ATAS RINGKAS & JELAS                                       */}
      {/* ================================================================= */}
      <header className="bg-gradient-to-b from-[#0B261C] via-[#0f3326] to-[#144533] text-white px-3.5 py-2.5 rounded-b-3xl shadow-md border-b border-[#D4AF37]/50">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GriyaAyuLogo size="sm" showBadge={false} floating={true} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-brand text-sm sm:text-base font-bold tracking-wide text-[#D4AF37] whitespace-nowrap leading-tight">
                  GRIYA AYU
                </h1>
                <span className="text-[9px] leading-none bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-amber-300 px-1.5 py-0.5 rounded font-black whitespace-nowrap flex-shrink-0">
                  AIFMO-P
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 font-medium truncate mt-0.5">
                <i className="fa-solid fa-location-dot text-amber-400 mr-1"></i>
                Graha Cipta 5 Blok E7 No.3
              </p>
            </div>
          </div>

          {/* Kanan Atas: Maps Cepat & Lonceng Notifikasi */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a
              href={GRIYA_AYU_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-btn bg-black/30 hover:bg-black/50 border border-[#D4AF37]/50 text-amber-300 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl flex items-center gap-1 whitespace-nowrap"
            >
              <i className="fa-solid fa-map-location-dot text-xs"></i>
              <span>Maps</span>
            </a>

            <button
              type="button"
              onClick={handleOpenNotifTab}
              aria-label="Buka Bar Notifikasi Pelanggan"
              className="tactile-btn relative w-9 h-9 rounded-xl bg-black/30 hover:bg-black/50 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center flex-shrink-0"
            >
              <i className="fa-solid fa-bell text-xs"></i>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Banner Peringatan Jika Ada Pembayaran yang Masih Pending (20 Menit) */}
        {pendingUserBookings.length > 0 && (
          <div className="mt-2.5 bg-amber-400 text-[#0B261C] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2.5 shadow-sm border border-amber-200">
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-stopwatch text-base animate-bounce flex-shrink-0"></i>
              <div className="truncate">
                <span className="text-xs font-black block leading-tight">
                  ⏳ Menunggu Bayar ({formatCountdown(pendingUserBookings[0].expiresAt - nowMs)})
                </span>
                <span className="text-xs font-bold block truncate">
                  Jam {pendingUserBookings[0].time} WIB belum terkunci
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewReceipt(pendingUserBookings[0])}
              className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-xs font-black px-3 py-2 rounded-xl flex-shrink-0 shadow-xs"
            >
              Bayar
            </button>
          </div>
        )}
      </header>

      {/* ================================================================= */}
      {/* TAB 1: STEP-BY-STEP WIZARD BOOKING (3 LANGKAH BERTAHAP)           */}
      {/* ================================================================= */}
      {customerTab === 'booking' && (
        <div className="p-3.5 space-y-3 animate-page-enter">
          {/* PROGRESS BAR WIZARD 3 LANGKAH RINGKAS & JELAS */}
          <div className="bg-[#0B261C] p-1.5 rounded-2xl border border-[#D4AF37]/60 shadow-sm grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className={`tactile-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition ${
                bookingStep === 1
                  ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] shadow-xs'
                  : bookingStep > 1
                  ? 'bg-emerald-900/90 text-amber-300'
                  : 'text-stone-300'
              }`}
            >
              <span>{bookingStep > 1 ? '✓' : '1.'}</span>
              <span>Layanan</span>
            </button>

            <button
              type="button"
              onClick={() => handleGoToStep2()}
              className={`tactile-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition ${
                bookingStep === 2
                  ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] shadow-xs'
                  : bookingStep > 2
                  ? 'bg-emerald-900/90 text-amber-300'
                  : 'text-stone-300'
              }`}
            >
              <span>{bookingStep > 2 ? '✓' : '2.'}</span>
              <span>Jadwal</span>
            </button>

            <button
              type="button"
              onClick={() => handleGoToStep3()}
              className={`tactile-btn py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition ${
                bookingStep === 3
                  ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] shadow-xs'
                  : 'text-stone-300'
              }`}
            >
              <span>3.</span>
              <span>Bayar</span>
            </button>
          </div>

          {/* =============================================================== */}
          {/* WIZARD LANGKAH 1: GRID ICON CARD ALA TRAVELOKA & KARTU LAYANAN  */}
          {/* =============================================================== */}
          {bookingStep === 1 && (
            <div className="space-y-2.5 animate-page-enter">
              {/* 1. GRID KATEGORI UTAMA (GRID ICON CARD 2 BARIS X 3 KOLOM RINGKAS) */}
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-stone-200/90 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <h2 className="text-sm font-black text-[#0B261C]">
                    {isEn ? 'Treatment Categories' : 'Pilih Kategori Terapi'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowPriceListImages(!showPriceListImages)}
                    className="tactile-btn text-[11px] font-black bg-amber-50 hover:bg-amber-100 text-[#0B261C] px-2.5 py-1 rounded-xl border border-amber-300 flex items-center gap-1 flex-shrink-0"
                  >
                    <i className="fa-solid fa-image text-amber-700"></i>
                    <span>{showPriceListImages ? 'Tutup Brosur' : 'Brosur Harga'}</span>
                  </button>
                </div>

                {/* Brosur Price List Resmi (Collapsible + Bisa Diklik & Zoom) */}
                {showPriceListImages && (
                  <div className="p-2.5 rounded-2xl bg-stone-900 text-white space-y-2 border border-[#D4AF37]/60 animate-page-enter">
                    <div className="flex items-center justify-between gap-2 bg-white/10 px-2.5 py-1.5 rounded-xl border border-[#D4AF37]/30">
                      <p className="text-[11px] font-bold text-amber-200 flex items-center gap-1.5">
                        <i className="fa-solid fa-magnifying-glass-plus text-[#D4AF37]"></i>
                        <span>Klik gambar brosur untuk perbesar &amp; zoom agar mudah dibaca</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setZoomedBrochure({
                            src: '/assets/aistudio/image_2b8cf505.png',
                            title: 'Brosur Griya Ayu Sport Massage',
                            subtitle: 'Semua Gender (👨👩)',
                          });
                          setBrochureZoomLevel(1.5);
                        }}
                        className="tactile-btn group text-left space-y-1 bg-stone-800/90 hover:bg-stone-800 p-1.5 rounded-xl border border-[#D4AF37]/40 hover:border-[#D4AF37] transition focus:outline-none"
                      >
                        <div className="relative overflow-hidden rounded-lg">
                          <img
                            src="/assets/aistudio/image_2b8cf505.png"
                            alt="Price List Griya Ayu Sport Massage"
                            className="w-full rounded-lg object-cover group-hover:scale-105 transition duration-200"
                          />
                          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[#D4AF37] text-[10px] font-black px-2 py-0.5 rounded-lg border border-[#D4AF37]/60 flex items-center gap-1 shadow">
                            <i className="fa-solid fa-magnifying-glass-plus"></i>
                            <span>Perbesar</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-center font-bold text-amber-200">
                          Semua Gender (👨👩)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setZoomedBrochure({
                            src: '/assets/aistudio/image_2d1f81d9.png',
                            title: 'Brosur Griya Ayu Willness Massage',
                            subtitle: 'Khusus Wanita (👩)',
                          });
                          setBrochureZoomLevel(1.5);
                        }}
                        className="tactile-btn group text-left space-y-1 bg-stone-800/90 hover:bg-stone-800 p-1.5 rounded-xl border border-[#D4AF37]/40 hover:border-[#D4AF37] transition focus:outline-none"
                      >
                        <div className="relative overflow-hidden rounded-lg">
                          <img
                            src="/assets/aistudio/image_2d1f81d9.png"
                            alt="Price List Griya Ayu Willness Massage"
                            className="w-full rounded-lg object-cover group-hover:scale-105 transition duration-200"
                          />
                          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[#D4AF37] text-[10px] font-black px-2 py-0.5 rounded-lg border border-[#D4AF37]/60 flex items-center gap-1 shadow">
                            <i className="fa-solid fa-magnifying-glass-plus"></i>
                            <span>Perbesar</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-center font-bold text-pink-200">
                          Khusus Wanita (👩)
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid 2 Baris x 3 Kolom Ikon Bulat Berwarna (Padat & Rapi) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Kategori 1: Pijat Kebugaran */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'kebugaran' ? 'all' : 'kebugaran'
                      )
                    }
                    className={`tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border ${
                      selectedGridCategory === 'kebugaran'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-xs">
                      <i className="fa-solid fa-hands-holding-circle text-sm"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Pijat Kebugaran
                    </span>
                  </button>

                  {/* Kategori 2: Terapi Otot & Cedera */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'otot_cedera' ? 'all' : 'otot_cedera'
                      )
                    }
                    className={`tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border ${
                      selectedGridCategory === 'otot_cedera'
                        ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-xs">
                      <i className="fa-solid fa-person-running text-sm"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Terapi Otot & Cedera
                    </span>
                  </button>

                  {/* Kategori 3: Spa Perawatan Tubuh */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'spa_tubuh' ? 'all' : 'spa_tubuh'
                      )
                    }
                    className={`tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border ${
                      selectedGridCategory === 'spa_tubuh'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-xs">
                      <i className="fa-solid fa-spa text-sm"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Spa Perawatan Tubuh
                    </span>
                  </button>

                  {/* Kategori 4: Terapi Bekam */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'bekam' ? 'all' : 'bekam'
                      )
                    }
                    className={`tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border ${
                      selectedGridCategory === 'bekam'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-xs">
                      <i className="fa-solid fa-heart-pulse text-sm"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Terapi Bekam
                    </span>
                  </button>

                  {/* Kategori 5: Khusus Wanita */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'khusus_wanita' ? 'all' : 'khusus_wanita'
                      )
                    }
                    className={`tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border ${
                      selectedGridCategory === 'khusus_wanita'
                        ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 text-white flex items-center justify-center shadow-xs">
                      <i className="fa-solid fa-venus text-sm"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Khusus Wanita
                    </span>
                  </button>

                  {/* Kategori 6: Tanya Admin WA */}
                  <a
                    href={`https://wa.me/6287765573476?text=${encodeURIComponent(
                      `Halo Admin Griya Ayu, saya ${currentUser.name} (${currentUser.phone}) ingin konsultasi memilih terapi yang cocok sebelum booking.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tactile-btn py-2 px-1 rounded-xl flex flex-col items-center text-center gap-1 transition border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white flex items-center justify-center shadow-xs">
                      <i className="fa-brands fa-whatsapp text-base"></i>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0B261C] leading-tight">
                      Tanya Admin WA
                    </span>
                  </a>
                </div>
              </div>

              {/* 2. KARTU LAYANAN DI BAWAH GRID (RINGKAS, PADAT & JELAS) */}
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-stone-200/90 space-y-2.5">
                {/* Bar Judul Kategori Aktif & Reset Semua Layanan */}
                <div className="flex justify-between items-center gap-2">
                  <h3 className="text-sm font-black text-[#0B261C] truncate">
                    {selectedGridCategory === 'all' && 'Daftar Layanan Terapi'}
                    {selectedGridCategory === 'kebugaran' && 'Pijat Kebugaran (👨👩)'}
                    {selectedGridCategory === 'otot_cedera' && 'Terapi Otot & Cedera'}
                    {selectedGridCategory === 'spa_tubuh' && 'Spa Perawatan Tubuh'}
                    {selectedGridCategory === 'bekam' && 'Terapi Bekam'}
                    {selectedGridCategory === 'khusus_wanita' && 'Khusus Wanita (👩)'}
                  </h3>
                  {selectedGridCategory !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setSelectedGridCategory('all')}
                      className="tactile-btn text-[11px] font-black text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 flex-shrink-0"
                    >
                      Lihat Semua
                    </button>
                  ) : (
                    <span className="text-[11px] font-black bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-300 flex-shrink-0">
                      {serviceMode === 'single'
                        ? `${chosenSingleIds.length} Dipilih`
                        : chosenPackageId
                        ? '1 Paket'
                        : '0 Dipilih'}
                    </span>
                  )}
                </div>

                {/* Switch Mode: Layanan Satuan vs Paket Hemat */}
                <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setServiceMode('single')}
                    className={`tactile-btn flex-1 py-1.5 rounded-lg transition ${
                      serviceMode === 'single'
                        ? 'bg-[#0B261C] text-[#D4AF37] shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {isEn ? 'Single Services' : 'Layanan Satuan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceMode('package')}
                    className={`tactile-btn flex-1 py-1.5 rounded-lg transition ${
                      serviceMode === 'package'
                        ? 'bg-[#0B261C] text-[#D4AF37] shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    🔥 {isEn ? 'Bundle Packages' : 'Paket Hemat'}
                  </button>
                </div>

                {/* Daftar Kartu Layanan Ringkas & Mudah Dibaca */}
                {serviceMode === 'single' ? (
                  <div className="space-y-2">
                    {activeSingleCatalog.filter((item) => {
                      if (selectedGridCategory === 'all') return true;
                      return item.gridCategories?.includes(selectedGridCategory);
                    }).map((s) => {
                      const isSelected = chosenSingleIds.includes(s.id);
                      const isFemaleOnly = s.gender === 'female';
                      const isMaleOnly = s.gender === 'male';
                      const badgeLabel =
                        s.genderBadge ||
                        (isFemaleOnly
                          ? '👩 Khusus Wanita'
                          : isMaleOnly
                          ? '👨 Khusus Pria'
                          : '👨👩 Semua Gender');
                      const hasInjuryTopping =
                        s.id === 's2' || s.id === 's4' || Boolean(s.hasInjurySpots);
                      const serviceSpots = injurySpotsByService[s.id] || [];
                      const isToppingOpen = isSelected && hasInjuryTopping && openInjuryServiceId === s.id;

                      return (
                        <div
                          key={s.id}
                          className={`w-full rounded-xl border transition overflow-hidden ${
                            isSelected
                              ? 'border-2 border-[#0B261C] bg-emerald-50/90 shadow-2xs'
                              : 'border-stone-200 bg-white hover:border-emerald-700/40'
                          }`}
                        >
                          {/* Baris Utama Kartu Layanan */}
                          <div
                            onClick={() => toggleSingleItem(s.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleSingleItem(s.id);
                              }
                            }}
                            className="tactile-btn w-full p-2.5 text-left cursor-pointer flex justify-between items-center gap-2.5"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              {/* Nama Layanan */}
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#0B261C] leading-snug">
                                {s.name}
                              </h4>

                              {/* Baris Info Ringkas: Durasi & Badge Gender */}
                              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold text-stone-600">
                                <span className="inline-flex items-center gap-1 text-stone-700">
                                  <i className="fa-regular fa-clock text-emerald-700 text-[10px]"></i>
                                  {s.duration}
                                </span>
                                <span>•</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] ${
                                    isFemaleOnly
                                      ? 'bg-pink-100/90 text-pink-900'
                                      : 'bg-sky-100/90 text-sky-950'
                                  }`}
                                >
                                  {badgeLabel}
                                </span>
                              </div>

                              {s.desc && (
                                <p className="text-[11px] text-stone-500 leading-snug line-clamp-1">
                                  {s.desc}
                                </p>
                              )}

                              {/* Ringkasan Titik Keluhan Terpilih */}
                              {isSelected && hasInjuryTopping && !isToppingOpen && (
                                <div className="pt-0.5 flex items-center gap-1 flex-wrap">
                                  <span className="text-[10px] font-black text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                    <span>🎯 Titik:</span>
                                    <span className="font-extrabold">
                                      {serviceSpots.length > 0
                                        ? serviceSpots.join(', ')
                                        : 'Belum dipilih'}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenInjuryServiceId(s.id);
                                    }}
                                    className="tactile-btn text-[10px] font-black text-[#0B261C] bg-white hover:bg-amber-50 border border-stone-300 px-2 py-0.5 rounded"
                                  >
                                    Ubah
                                  </button>
                                </div>
                              )}

                              {/* Harga & Poin */}
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="font-black text-xs sm:text-sm text-emerald-900">
                                  {formatRupiah(s.price)}
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded">
                                  +{s.points} Poin
                                </span>
                              </div>
                            </div>

                            {/* Tombol Centang / Pilih Layanan Simpel */}
                            <div
                              className={`px-3 py-2 rounded-xl border font-black text-xs flex items-center gap-1 flex-shrink-0 transition ${
                                isSelected
                                  ? 'bg-[#0B261C] border-[#0B261C] text-[#D4AF37] shadow-2xs'
                                  : 'bg-stone-50 border-stone-300 text-[#0B261C]'
                              }`}
                            >
                              <i
                                className={`fa-solid ${
                                  isSelected
                                    ? 'fa-circle-check text-[#D4AF37]'
                                    : 'fa-plus text-stone-500'
                                }`}
                              ></i>
                              <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                            </div>
                          </div>

                          {/* SUB-MENU / TOPPING TITIK KELUHAN LANGSUNG DI BAWAH LAYANAN YANG DIPILIH */}
                          {isToppingOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="p-3.5 bg-amber-50/95 border-t-2 border-amber-300 space-y-2.5 animate-page-enter"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <p className="text-xs sm:text-sm font-black text-[#0B261C] flex items-center gap-1.5">
                                    <i className="fa-solid fa-person-running text-amber-600"></i>
                                    <span>
                                      {isEn
                                        ? 'Select Complaint / Injury Spots (Multiple Allowed):'
                                        : 'Pilih Titik Keluhan (Bisa Pilih Beberapa Titik):'}
                                    </span>
                                  </p>
                                  <p className="text-[11px] font-semibold text-stone-600 mt-0.5">
                                    Klik satu atau beberapa titik keluhan di bawah, lalu tekan tombol{' '}
                                    <b>Selesai</b>.
                                  </p>
                                </div>
                                <span className="text-[11px] font-black bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-lg flex-shrink-0">
                                  {serviceSpots.length} Titik
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {ANATOMY_LOCATIONS.map((loc) => {
                                  const isLocActive = serviceSpots.includes(loc);
                                  return (
                                    <button
                                      key={loc}
                                      type="button"
                                      onClick={() => toggleInjurySpotForService(s.id, loc)}
                                      className={`tactile-btn text-xs font-extrabold px-3 py-2 rounded-xl border flex items-center gap-1.5 transition ${
                                        isLocActive
                                          ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C] shadow-xs'
                                          : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50'
                                      }`}
                                    >
                                      <i
                                        className={`fa-solid ${
                                          isLocActive
                                            ? 'fa-square-check text-[#D4AF37]'
                                            : 'fa-square text-stone-300'
                                        }`}
                                      ></i>
                                      <span>{loc}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="pt-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-stone-600 truncate">
                                  {serviceSpots.length > 0
                                    ? `Dipilih: ${serviceSpots.join(', ')}`
                                    : 'Silakan pilih minimal 1 titik keluhan'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (serviceSpots.length === 0) {
                                      setInjurySpotsByService((prev) => ({
                                        ...prev,
                                        [s.id]: [
                                          s.id === 's4'
                                            ? 'Pinggang / Saraf Kejepit (Low Back)'
                                            : 'Lutut (Knee)',
                                        ],
                                      }));
                                    }
                                    setOpenInjuryServiceId(null);
                                  }}
                                  className="tactile-btn bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black text-xs px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5 flex-shrink-0 border border-[#D4AF37]/60"
                                >
                                  <i className="fa-solid fa-check"></i>
                                  <span>Selesai</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Daftar Paket Hemat di Bawah Grid */
                  <div className="space-y-2.5">
                    {activePackageCatalog.filter((p) => {
                      if (selectedGridCategory === 'all') return true;
                      return p.gridCategories?.includes(selectedGridCategory);
                    }).map((p) => {
                      const isSelected = chosenPackageId === p.id;
                      const isFemaleOnly = p.gender === 'female';
                      const isMaleOnly = p.gender === 'male';
                      const badgeLabel =
                        p.genderBadge ||
                        (isFemaleOnly
                          ? '👩 Khusus Wanita'
                          : isMaleOnly
                          ? '👨 Khusus Pria'
                          : '👨👩 Semua Gender');

                      return (
                        <div
                          key={p.id}
                          onClick={() => setChosenPackageId(isSelected ? '' : p.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setChosenPackageId(isSelected ? '' : p.id);
                            }
                          }}
                          className={`tactile-btn w-full p-3.5 rounded-2xl border-2 text-left cursor-pointer flex justify-between items-center gap-3 transition ${
                            isSelected
                              ? 'border-[#0B261C] bg-amber-50/90 shadow-sm'
                              : 'border-stone-200 bg-white hover:border-amber-400'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="font-extrabold text-sm sm:text-base text-[#0B261C] leading-snug">
                              {p.name}
                            </h4>

                            <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-stone-600">
                              <span className="inline-flex items-center gap-1 text-stone-700">
                                <i className="fa-regular fa-clock text-emerald-700"></i>
                                {p.duration}
                              </span>
                              <span>•</span>
                              <span
                                className={`px-2 py-0.5 rounded-md font-extrabold ${
                                  isFemaleOnly
                                    ? 'bg-pink-100/90 text-pink-900'
                                    : 'bg-sky-100/90 text-sky-950'
                                }`}
                              >
                                {badgeLabel}
                              </span>
                              {p.tag && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">
                                  {p.tag}
                                </span>
                              )}
                            </div>

                            {p.desc && (
                              <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-2">
                                {p.desc}
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-0.5">
                              {p.normalPrice && (
                                <span className="text-xs line-through text-stone-400">
                                  {formatRupiah(p.normalPrice)}
                                </span>
                              )}
                              <span className="font-black text-sm sm:text-base text-emerald-900">
                                {formatRupiah(p.price)}
                              </span>
                              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                                +{p.points} Poin
                              </span>
                            </div>
                          </div>

                          <div
                            className={`px-3.5 py-2.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center gap-1.5 flex-shrink-0 transition ${
                              isSelected
                                ? 'bg-[#0B261C] border-[#0B261C] text-[#D4AF37] shadow-xs'
                                : 'bg-stone-50 border-stone-300 text-[#0B261C]'
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                isSelected ? 'fa-circle-check text-[#D4AF37]' : 'fa-plus text-stone-500'
                              }`}
                            ></i>
                            <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Floating Sticky Ringkasan Layanan & Tombol Lanjut (Langsung Muncul & Tetap Ada Saat Scroll) */}
                <div
                  className={
                    (serviceMode === 'single' && chosenSingleIds.length > 0) ||
                    (serviceMode === 'package' && Boolean(chosenPackageId))
                      ? 'sticky bottom-[62px] z-30 pt-2'
                      : 'pt-3 border-t border-stone-200'
                  }
                >
                  {(serviceMode === 'single' && chosenSingleIds.length > 0) ||
                  (serviceMode === 'package' && Boolean(chosenPackageId)) ? (
                    <div className="bg-[#0B261C]/95 backdrop-blur-md text-white p-3.5 rounded-2xl border-2 border-[#D4AF37] shadow-[0_12px_32px_rgba(0,0,0,0.45)] space-y-2.5">
                      <div className="flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-xs text-emerald-300 font-bold block">
                            Layanan Dipilih (
                            {serviceMode === 'single'
                              ? `${chosenSingleIds.length} Layanan`
                              : '1 Paket'}
                            ):
                          </span>
                          <p className="text-sm font-extrabold text-white truncate mt-0.5">
                            {pricing.titleStr}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-base font-black text-[#D4AF37] block">
                            {formatRupiah(pricing.subtotal)}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-300">
                            +{pricing.pts} Poin
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoToStep2}
                        className="tactile-btn gold-shimmer-card w-full min-h-[46px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2.5 px-4 rounded-xl shadow-md border border-amber-200 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition"
                      >
                        <span>Lanjut Jadwal & Pembayaran</span>
                        <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-stone-100 text-stone-600 p-3 rounded-2xl border border-stone-200 text-center text-xs font-bold">
                      Pilih minimal 1 layanan di atas untuk memunculkan tombol lanjut pembayaran
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* WIZARD LANGKAH 2: PILIH TANGGAL (30 HARI) & JAM OPERASIONAL     */}
          {/* =============================================================== */}
          {bookingStep === 2 && (
            <div className="space-y-3 animate-page-enter">
              {/* Info Singkat Layanan Terpilih di Atas Langkah 2 */}
              <div className="bg-[#0B261C] text-white p-3.5 rounded-2xl border border-[#D4AF37]/50 shadow-sm flex justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-[#D4AF37] block">
                    Layanan Terpilih • {formatRupiah(pricing.subtotal)}
                  </span>
                  <p className="text-sm font-extrabold text-white truncate mt-0.5">
                    {pricing.titleStr}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-300 border border-[#D4AF37]/40 text-xs font-black px-3 py-2 rounded-xl flex-shrink-0"
                >
                  Ubah
                </button>
              </div>

              {/* Opsi Lokasi Terapi: Studio vs Home Service */}
              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200/90 space-y-2">
                <h3 className="text-sm font-black text-[#0B261C]">
                  Pilih Lokasi Terapi
                </h3>
                <div className="grid grid-cols-2 gap-2.5 text-sm font-black">
                  <button
                    type="button"
                    onClick={() => setVisitType('studio')}
                    className={`tactile-btn p-3 rounded-2xl border-2 text-left transition ${
                      visitType === 'studio'
                        ? 'border-[#0B261C] bg-emerald-50/90 text-[#0B261C] shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>🏠 Di Studio</span>
                      {visitType === 'studio' && (
                        <i className="fa-solid fa-circle-check text-emerald-700"></i>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-stone-500 block mt-0.5 leading-snug">
                      Graha Cipta 5 E7/3
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisitType('home_service')}
                    className={`tactile-btn p-3 rounded-2xl border-2 text-left transition ${
                      visitType === 'home_service'
                        ? 'border-[#0B261C] bg-amber-50/90 text-[#0B261C] shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>🚗 Home Service</span>
                      {visitType === 'home_service' && (
                        <i className="fa-solid fa-circle-check text-amber-600"></i>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-amber-800 block mt-0.5 leading-snug">
                      + Biaya Perjalanan
                    </span>
                  </button>
                </div>
              </div>

              {/* BAGIAN A: KALENDER HORIZONTAL 30 HARI */}
              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200/90 space-y-2.5">
                <div className="flex justify-between items-center gap-2">
                  <h2 className="text-base font-black text-[#0B261C]">
                    {isEn ? 'Select Date' : 'Pilih Tanggal'}
                  </h2>
                  <span className="text-xs font-black text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-xl">
                    {selectedDatePretty}
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {calendarDays.map((item) => {
                    const isSelected = item.iso === selectedDateIso;

                    if (item.isPast) {
                      return (
                        <button
                          key={item.iso}
                          type="button"
                          disabled
                          aria-label={`Tanggal ${item.pretty} Sudah Terlewat`}
                          className="flex-shrink-0 w-15 py-2 rounded-2xl border border-stone-300 bg-stone-200 text-stone-400 flex flex-col items-center justify-center cursor-not-allowed opacity-85"
                        >
                          <span className="text-xs font-extrabold uppercase text-stone-400">
                            {item.dayName}
                          </span>
                          <span className="text-base font-black leading-tight my-0.5 line-through text-stone-400">
                            {item.dayNum}
                          </span>
                          <span className="text-[10px] font-black bg-stone-300 text-stone-600 px-1.5 rounded uppercase">
                            {isEn ? 'PAST' : 'LEWAT'}
                          </span>
                        </button>
                      );
                    }

                    if (item.isHoliday) {
                      return (
                        <button
                          key={item.iso}
                          type="button"
                          onClick={() => handleDateSelect(item.iso, item.pretty, true, false)}
                          className="flex-shrink-0 w-15 py-2 rounded-2xl border border-red-200 bg-red-50/80 text-red-400 flex flex-col items-center justify-center cursor-not-allowed"
                        >
                          <span className="text-xs font-extrabold uppercase">{item.dayName}</span>
                          <span className="text-base font-black leading-tight my-0.5 line-through">
                            {item.dayNum}
                          </span>
                          <span className="text-[10px] font-black bg-red-200 text-red-800 px-1.5 rounded">
                            LIBUR
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.iso}
                        type="button"
                        onClick={() => handleDateSelect(item.iso, item.pretty, false, false)}
                        className={`tactile-btn flex-shrink-0 w-15 py-2 rounded-2xl border-2 transition flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#0B261C] text-white border-[#D4AF37] shadow-sm'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-emerald-600/40'
                        }`}
                      >
                        <span
                          className={`text-xs font-extrabold uppercase ${
                            isSelected ? 'text-[#D4AF37]' : 'text-stone-500'
                          }`}
                        >
                          {item.dayName}
                        </span>
                        <span className="text-base font-black leading-tight my-0.5">
                          {item.dayNum}
                        </span>
                        {item.isToday ? (
                          <span
                            className={`text-[10px] font-black px-1.5 rounded uppercase ${
                              isSelected
                                ? 'bg-[#D4AF37] text-[#0B261C]'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {isEn ? 'TODAY' : 'HARI INI'}
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-emerald-200' : 'text-stone-500'
                            }`}
                          >
                            {item.monthName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BAGIAN B: GRID SLOT JAM OPERASIONAL (SINKRON DENGAN JADWAL STUDIO / HOME SERVICE) */}
              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200/90 space-y-3">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <div>
                    <h2 className="text-base font-black text-[#0B261C]">
                      {visitType === 'home_service'
                        ? isEn
                          ? 'Select Home Service Time'
                          : 'Pilih Jam Sesi Home Service'
                        : isEn
                        ? 'Select Session Time'
                        : 'Pilih Jam Sesi'}
                    </h2>
                    {visitType === 'home_service' && selectedDateHomeServiceStatus.available && (
                      <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                        🚗 Jam Operasional Hari {selectedDateHomeServiceStatus.daySchedule.dayName}:{' '}
                        {selectedDateHomeServiceStatus.daySchedule.openTime} –{' '}
                        {selectedDateHomeServiceStatus.daySchedule.closeTime} WIB
                      </p>
                    )}
                  </div>
                  <span className="bg-emerald-50 text-emerald-950 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-black">
                    🕒 Sekarang {currentTimeHm} WIB
                  </span>
                </div>

                {/* Jika Pelanggan Memilih Home Service & Hari Tersebut Ditutup/Libur oleh Admin */}
                {visitType === 'home_service' && !selectedDateHomeServiceStatus.available ? (
                  <div className="bg-red-50 border-2 border-red-300 text-red-900 p-4 rounded-2xl space-y-2 text-center animate-fade">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center mx-auto text-base">
                      <i className="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <h4 className="text-xs sm:text-sm font-black text-red-900">
                      Maaf, layanan Home Service tidak tersedia pada hari tersebut
                    </h4>
                    <p className="text-xs text-red-800 leading-relaxed">
                      {selectedDateHomeServiceStatus.reason === 'service_disabled'
                        ? 'Layanan Home Service sedang dinonaktifkan sementara oleh Admin karena seluruh terapis sedang penuh. Silakan pilih lokasi Di Studio atau pilih jadwal lain.'
                        : `Jadwal layanan Home Service pada hari ${selectedDateHomeServiceStatus.daySchedule.dayName} (${selectedDatePretty}) sedang tutup/libur. Silakan pilih tanggal lain yang tersedia atau beralih ke lokasi Di Studio.`}
                    </p>
                  </div>
                ) : visitType === 'home_service' &&
                  activeHomeServiceSlotsForSelectedDate.length === 0 ? (
                  <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-2xl space-y-1.5 text-center animate-fade">
                    <i className="fa-regular fa-clock text-amber-700 text-lg"></i>
                    <p className="text-xs sm:text-sm font-black">
                      Maaf, layanan Home Service tidak tersedia pada hari tersebut
                    </p>
                    <p className="text-xs text-amber-900">
                      Tidak ada slot jam Home Service yang aktif pada rentang jam operasional hari ini. Silakan pilih tanggal lain.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {(visitType === 'home_service'
                      ? activeHomeServiceSlotsForSelectedDate
                      : masterTimeSlots
                    ).map((slot) => {
                      const status = isSlotAvailable(
                        slot.time,
                        selectedDateIso,
                        visitType === 'home_service'
                          ? activeHomeServiceSlotsForSelectedDate
                          : masterTimeSlots,
                        bookings.filter((b) => b.id !== step3PendingOrderId),
                        nowMs
                      );
                      const isSelected = selectedTimeSlot === slot.time;

                      if (status.reason === 'past') {
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled
                            aria-label={`Jam ${slot.time} Sudah Terlewat`}
                            className="py-3 px-2 rounded-2xl bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed flex flex-col items-center justify-center opacity-85"
                          >
                            <span className="text-sm sm:text-base font-black line-through text-stone-400">
                              {slot.time}
                            </span>
                            <span className="text-xs font-bold text-stone-500 mt-0.5">
                              {isEn ? 'Passed' : 'Terlewat'}
                            </span>
                          </button>
                        );
                      }

                      if (status.reason === 'booked') {
                        return (
                          <button
                            key={slot.time}
                            disabled
                            aria-label={`Jam ${slot.time} Terkunci`}
                            className="py-3 px-2 rounded-2xl bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed flex flex-col items-center justify-center opacity-85"
                          >
                            <span className="text-sm sm:text-base font-black line-through">
                              {slot.time}
                            </span>
                            <span className="text-xs font-bold text-stone-500 mt-0.5">
                              {isEn ? 'Locked' : 'Penuh'}
                            </span>
                          </button>
                        );
                      }

                      if (status.reason === 'closed') {
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() =>
                              onShowToast(
                                'Jam Sedang Tutup',
                                `Jam ${slot.time} sedang ditutup sementara oleh Admin. Silakan pilih jam lain yang tersedia.`
                              )
                            }
                            className="py-3 px-2 rounded-2xl striped-disabled text-stone-500 border border-stone-300 cursor-not-allowed flex flex-col items-center justify-center"
                          >
                            <span className="text-sm sm:text-base font-bold">{slot.time}</span>
                            <span className="text-xs font-bold bg-stone-300 text-stone-700 px-1.5 rounded mt-0.5">
                              {isEn ? 'Closed' : 'Tutup'}
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot.time)}
                          className={`tactile-btn py-3 px-2 rounded-2xl border-2 transition flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-[#0B261C] text-white border-[#D4AF37] shadow-sm'
                              : 'bg-white text-[#0B261C] border-emerald-700/40 hover:border-emerald-800'
                          }`}
                        >
                          <span className="text-sm sm:text-base font-black">{slot.time}</span>
                          <span
                            className={`text-xs font-extrabold mt-0.5 ${
                              isSelected ? 'text-[#D4AF37]' : 'text-emerald-700'
                            }`}
                          >
                            {isSelected
                              ? isEn
                                ? '✓ Selected'
                                : '✓ Dipilih'
                              : isEn
                              ? 'Available'
                              : 'Tersedia'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tombol Navigasi Bawah Langkah 2 (Sticky Saat Jam Sesi Dipilih) */}
                <div
                  className={
                    selectedTimeSlot
                      ? 'sticky bottom-[62px] z-30 pt-2'
                      : 'pt-3 border-t border-stone-200'
                  }
                >
                  <div
                    className={`flex gap-2.5 ${
                      selectedTimeSlot
                        ? 'bg-[#0B261C]/95 backdrop-blur-md p-2.5 rounded-2xl border-2 border-[#D4AF37] shadow-[0_12px_32px_rgba(0,0,0,0.45)]'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="tactile-btn min-h-[46px] bg-stone-100 hover:bg-stone-200 text-stone-800 font-black py-2.5 px-4 rounded-xl text-xs sm:text-sm border border-stone-300 flex items-center justify-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                      <span>Kembali</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGoToStep3}
                      className="tactile-btn gold-shimmer-card flex-1 min-h-[46px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2.5 px-4 rounded-xl shadow-md border border-amber-200 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <span>
                        {selectedTimeSlot
                          ? `Lanjut Pembayaran (${selectedTimeSlot})`
                          : 'Lanjut ke Pembayaran'}
                      </span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* WIZARD LANGKAH 3: PEMBAYARAN & KONFIRMASI (QRIS TIMER 20M)      */}
          {/* =============================================================== */}
          {bookingStep === 3 && (
            <div className="space-y-4 animate-page-enter">
              {/* 1. Ringkasan Pesanan & Opsi Tukar Poin */}
              <div className="bg-[#0B261C] text-white p-4 rounded-2xl shadow-md border border-[#D4AF37]/60 space-y-3.5">
                <div className="flex justify-between items-center border-b border-white/15 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37] block">
                      Langkah 3 dari 3 • Ringkasan & Poin
                    </span>
                    <h2 className="text-sm font-black text-white mt-0.5">
                      Ringkasan Pesanan & Penukaran Poin
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-300 border border-[#D4AF37]/40 text-[10px] font-black px-3 py-1.5 rounded-xl"
                  >
                    ← Ubah Jadwal
                  </button>
                </div>

                {/* Detail Ringkasan Pesanan */}
                <div className="bg-black/35 p-3.5 rounded-2xl space-y-2 text-xs border border-white/10 leading-relaxed">
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-emerald-200 flex-shrink-0">Layanan:</span>
                    <span className="font-bold text-white text-right">{pricing.titleStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-200">Tipe Kunjungan:</span>
                    <span className="font-bold text-amber-300">
                      {visitType === 'home_service'
                        ? '🚗 Home Service (+Biaya Perjalanan)'
                        : '🏠 Studio Griya Ayu'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-200">Tanggal & Jam:</span>
                    <span className="font-black text-[#D4AF37]">
                      {selectedDatePretty} • {selectedTimeSlot} WIB
                    </span>
                  </div>
                  <div className="border-t border-white/15 pt-2 mt-1 flex justify-between items-center">
                    <div>
                      <span className="text-stone-300 font-bold block text-[11px]">
                        Total Tagihan Otomatis:
                      </span>
                      <span className="text-[11px] font-extrabold text-emerald-400">
                        Perolehan +{pricing.pts} Poin Loyalitas
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#D4AF37]">
                        {formatRupiah(pricing.finalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown Tukar Poin Loyalitas Bertahap (Micro-Rewards Non-Potongan Harga) */}
                <div>
                  <label
                    htmlFor="pointRewardSelector"
                    className="text-xs font-black text-[#D4AF37] flex items-center gap-1.5 mb-1"
                  >
                    <i className="fa-solid fa-gift"></i>
                    <span>
                      Tukar Poin Loyalitas / Micro-Rewards (Saldo: {currentUser.points} Poin)
                    </span>
                  </label>
                  <p className="text-[10px] text-emerald-200/85 mb-2 leading-relaxed">
                    *Poin ditukarkan dengan bonus hadiah/layanan gratis bertahap (bukan potongan
                    harga tagihan).
                  </p>
                  <select
                    id="pointRewardSelector"
                    value={selectedRewardId}
                    onChange={(e) => setSelectedRewardId(e.target.value)}
                    className="w-full bg-[#144533] border border-[#D4AF37]/50 text-white text-xs font-bold p-3 rounded-xl focus:outline-none"
                  >
                    {activePointRewardsWithNone.map((r) => {
                      const hasEnoughPoints = currentUser.points >= r.cost;
                      const displayLabel =
                        r.id === 'none'
                          ? r.label
                          : `🎁 (${r.cost} Poin) ${r.title || r.label}`;
                      return (
                        <option key={r.id} value={r.id} disabled={!hasEnoughPoints}>
                          {displayLabel}{' '}
                          {!hasEnoughPoints ? `(Kurang ${r.cost - currentUser.points} Poin)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Form Catatan Keluhan Fisik (Health / Treatment Note) Saat Booking */}
                <div className="bg-black/30 p-3.5 rounded-2xl border border-[#D4AF37]/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="step3HealthNoteInput"
                      className="text-xs font-black text-[#D4AF37] flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-notes-medical"></i>
                      <span>Catatan Keluhan / Fokus Pijat</span>
                    </label>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded">
                      Opsional
                    </span>
                  </div>
                  <textarea
                    id="step3HealthNoteInput"
                    rows={2}
                    value={step3HealthNote}
                    onChange={(e) => setStep3HealthNote(e.target.value)}
                    placeholder="Catatan Keluhan / Fokus Pijat (Contoh: Nyeri bahu kanan, cedera engkel ringan, hindari area pinggang)"
                    className="w-full p-2.5 rounded-xl bg-white/95 border border-[#D4AF37]/60 text-stone-900 text-xs font-medium focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[10px] text-emerald-200/85 leading-snug">
                    Catatan ini akan disimpan ke dalam data booking dan tampil pada Struk Digital serta Dashboard Admin / Terapis.
                  </p>
                </div>
              </div>

              {/* 2. Pilihan Metode Pembayaran Dinamis (QRIS / Transfer Bank / Cash) */}
              <div className="bg-white p-4 rounded-2xl shadow-md border-2 border-[#D4AF37] space-y-4">
                {/* Informasi Tersimpan Otomatis di Bar Riwayat */}
                <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-[11px] text-emerald-950">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-floppy-disk text-emerald-700 flex-shrink-0"></i>
                    <span className="font-bold leading-snug">
                      Booking ini otomatis tersimpan di <b>Bar Riwayat (Pending 20 Menit)</b>. Jika aplikasi ke-close atau ke-refresh, Anda tetap bisa lanjut bayar dari menu <b>Riwayat</b>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerTab('history')}
                    className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-[10px] font-black px-2.5 py-1.5 rounded-lg flex-shrink-0"
                  >
                    Buka Riwayat
                  </button>
                </div>

                {/* Banner Countdown Timer 20 Menit atau Status Gagal jika Waktu Habis */}
                {step3RemainingMs <= 0 ? (
                  <div className="bg-red-50 border-2 border-red-400 text-red-900 px-3.5 py-3 rounded-2xl space-y-1.5 animate-fade">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase flex items-center gap-1.5 text-red-800">
                        <i className="fa-solid fa-ban"></i>
                        <span>Waktu Pembayaran 20 Menit Berakhir (GAGAL)</span>
                      </span>
                      <span className="bg-red-700 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-lg">
                        00:00
                      </span>
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed text-red-800">
                      Batas waktu pembayaran 20 menit telah habis sehingga Anda tidak dapat melakukan pembayaran lagi pada pesanan ini. Silakan kembali ke Langkah 2 untuk membuat jadwal baru.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-[#0B261C] px-3.5 py-2.5 rounded-2xl flex justify-between items-center shadow-xs animate-fade">
                    <div className="flex items-center gap-2.5">
                      <i className="fa-solid fa-stopwatch text-base animate-bounce"></i>
                      <div>
                        <span className="text-[10px] font-black uppercase block leading-none">
                          Countdown Timer Pembayaran (20 Menit)
                        </span>
                        <span className="text-[11px] font-bold mt-0.5 block">
                          Selesaikan pembayaran sebelum waktu habis untuk kunci jam {selectedTimeSlot} WIB
                        </span>
                      </div>
                    </div>
                    <span className="bg-[#0B261C] text-[#D4AF37] font-mono font-black text-sm px-3 py-1 rounded-xl border border-[#D4AF37]">
                      {formatCountdown(step3RemainingMs)}
                    </span>
                  </div>
                )}

                {/* Pilihan 3 Tab Metode Pembayaran: QRIS, Transfer Bank, Cash / Bayar di Tempat */}
                <div>
                  <span className="text-xs font-black text-stone-700 block mb-2">
                    Pilih Metode Pembayaran:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-black">
                    {(
                      [
                        {
                          id: 'qris',
                          label: 'QRIS',
                          sub: 'Griya Ayu',
                          icon: 'fa-solid fa-qrcode',
                        },
                        {
                          id: 'bank_transfer',
                          label: 'Transfer Bank',
                          sub: 'BCA / Mandiri',
                          icon: 'fa-solid fa-building-columns',
                        },
                        {
                          id: 'cash',
                          label: 'Cash / Di Tempat',
                          sub: 'Bayar di Lokasi',
                          icon: 'fa-solid fa-money-bill-wave',
                        },
                      ] as Array<{
                        id: PaymentMethodType;
                        label: string;
                        sub: string;
                        icon: string;
                      }>
                    ).map((m) => {
                      const isActive = step3MethodType === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={step3RemainingMs <= 0}
                          onClick={() => {
                            if (step3RemainingMs <= 0) return;
                            setStep3MethodType(m.id);
                            setStep3ProofError('');
                            const defaultChan =
                              m.id === 'qris'
                                ? QRIS_PAYMENT_CHANNELS[0]
                                : m.id === 'bank_transfer'
                                ? BANK_TRANSFER_CHANNELS[0]
                                : 'Cash / Bayar di Tempat';
                            setStep3PaymentChannel(defaultChan);
                            if (onConfirmWizardBooking && selectedTimeSlot && step3PendingOrderId) {
                              onConfirmWizardBooking({
                                total: pricing.finalPrice,
                                scheduleDatePretty: selectedDatePretty,
                                scheduleDateIso: selectedDateIso,
                                selectedTimeSlot,
                                itemsSummary: finalItemsSummary,
                                pointsEarned: pricing.pts,
                                pointsRedeemedCost: pricing.rewardObj.cost,
                                payMethodType: m.id,
                                markAsPaid: false,
                                paymentChannel: defaultChan,
                                existingOrderId: step3PendingOrderId,
                                silentReceipt: true,
                              });
                            }
                          }}
                          className={`tactile-btn py-2.5 px-2 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-0.5 text-center ${
                            isActive
                              ? 'bg-[#0B261C] text-[#D4AF37] border-[#D4AF37] shadow-sm'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          <i
                            className={`${m.icon} text-sm ${
                              isActive ? 'text-[#D4AF37]' : 'text-[#0B261C]'
                            }`}
                          ></i>
                          <span className="leading-tight mt-0.5">{m.label}</span>
                          <span
                            className={`text-[9px] font-bold leading-none ${
                              isActive ? 'text-emerald-200' : 'text-stone-400'
                            }`}
                          >
                            {m.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Konten Informasi Dinamis Sesuai Tab Metode Pembayaran yang Dipilih */}
                {step3MethodType === 'qris' && (
                  <div key="tab-qris" className="space-y-3 animate-fade">
                    {/* Kartu QRIS Griya Ayu Resmi Terbaru (GoPay Merchant - ADMIN GRIYA AYU SPA) */}
                    <div className="max-w-[320px] mx-auto rounded-2xl overflow-hidden shadow-md border-2 border-[#00AED6] bg-[#00AED6] p-2.5 text-center space-y-2">
                      <div className="flex justify-between items-center text-white px-1.5">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-qrcode text-xs"></i>
                          <span className="text-[10px] font-black tracking-wide uppercase">
                            QRIS RESMI GRIYA AYU SPA
                          </span>
                        </div>
                        <span className="text-[10px] font-black bg-white text-[#0B261C] px-2.5 py-0.5 rounded-full shadow-xs">
                          {formatRupiah(pricing.finalPrice)}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl overflow-hidden shadow-inner w-full max-w-[280px] mx-auto">
                        <img
                          src={GRIYA_AYU_QRIS_IMAGE}
                          alt={`QRIS Resmi ${GRIYA_AYU_QRIS_MERCHANT} (NMID: ${GRIYA_AYU_QRIS_NMID})`}
                          className="w-full h-auto object-contain block mx-auto"
                        />
                      </div>

                      <p className="text-[10px] font-bold text-white leading-snug px-1">
                        Scan menggunakan GoPay, BCA, Mandiri, BNI, BRI, DANA, OVO, ShopeePay & semua
                        M-Banking
                      </p>
                    </div>

                    {/* Kotak Informasi Detail QRIS Griya Ayu */}
                    <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/90 space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                        <span className="font-black text-[#0B261C] flex items-center gap-1.5">
                          <i className="fa-solid fa-qrcode text-amber-600"></i>
                          <span>Detail QRIS Resmi Griya Ayu</span>
                        </span>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                          Standar GPN
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Nama Merchant:</span>
                          <span className="font-black text-[#0B261C] text-right">
                            {GRIYA_AYU_QRIS_MERCHANT}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">NMID QRIS Nasional:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-stone-900">
                              {GRIYA_AYU_QRIS_NMID} (A01)
                            </span>
                            {onCopyText && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCopyText(GRIYA_AYU_QRIS_NMID, 'NMID QRIS Griya Ayu')
                                }
                                className="text-[10px] font-black bg-stone-200 hover:bg-stone-300 text-stone-800 px-2 py-0.5 rounded-md"
                              >
                                Salin
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-stone-200">
                          <span className="text-stone-600 font-bold">Total Nominal QRIS:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-emerald-900">
                              {formatRupiah(pricing.finalPrice)}
                            </span>
                            {onCopyText && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCopyText(String(pricing.finalPrice), 'Nominal Pembayaran')
                                }
                                className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2.5 py-1 rounded-lg"
                              >
                                Salin Nominal
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step3MethodType === 'bank_transfer' && (
                  <div key="tab-bank-transfer" className="space-y-3 animate-fade">
                    <div className="bg-[#0B261C] text-white p-3.5 rounded-2xl border border-[#D4AF37]/60 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37] block">
                          Transfer Rekening Resmi Griya Ayu
                        </span>
                        <p className="text-xs font-bold text-emerald-100 mt-0.5">
                          Silakan transfer ke salah satu rekening BCA / Mandiri di bawah ini:
                        </p>
                      </div>
                      <i className="fa-solid fa-building-columns text-xl text-[#D4AF37]"></i>
                    </div>

                    {/* Daftar Kartu Rekening BCA & Mandiri a.n. Griya Ayu / Rismawati */}
                    <div className="space-y-2.5">
                      {GRIYA_AYU_BANK_ACCOUNTS.map((acc) => (
                        <div
                          key={acc.id}
                          className="bg-stone-50 p-3.5 rounded-2xl border-2 border-stone-200 hover:border-[#D4AF37] transition flex justify-between items-center gap-2 shadow-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2.5 py-0.5 rounded-md">
                                {acc.bankName}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                Resmi
                              </span>
                            </div>
                            <p className="text-base font-black text-[#0B261C] font-mono tracking-wider mt-1.5">
                              {acc.accountNumberFormatted}
                            </p>
                            <p className="text-xs font-bold text-stone-600 mt-0.5">
                              a.n. <b className="text-[#0B261C]">{acc.accountHolder}</b>
                            </p>
                          </div>

                          {onCopyText && (
                            <button
                              type="button"
                              onClick={() =>
                                onCopyText(
                                  acc.accountNumber,
                                  `No. Rekening ${acc.bankName} (${acc.accountNumber})`
                                )
                              }
                              className="tactile-btn bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs flex-shrink-0 border border-[#D4AF37]/50"
                            >
                              <i className="fa-regular fa-copy"></i>
                              <span>Salin No. Rek</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Baris Total Nominal Transfer */}
                    <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-stone-600 font-bold block text-[11px]">
                          Total Nominal yang Ditransfer:
                        </span>
                        <span className="font-black text-base text-[#0B261C]">
                          {formatRupiah(pricing.finalPrice)}
                        </span>
                      </div>
                      {onCopyText && (
                        <button
                          type="button"
                          onClick={() =>
                            onCopyText(String(pricing.finalPrice), 'Nominal Transfer')
                          }
                          className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          <i className="fa-regular fa-copy"></i>
                          <span>Salin Nominal</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {step3MethodType === 'cash' && (
                  <div key="tab-cash" className="space-y-3 animate-fade">
                    <div className="bg-amber-50/90 p-4 rounded-2xl border-2 border-[#D4AF37] space-y-3 shadow-xs">
                      <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-[#0B261C] text-[#D4AF37] flex items-center justify-center text-base flex-shrink-0 shadow-xs">
                            <i className="fa-solid fa-money-bill-wave"></i>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-900 text-amber-300 px-2 py-0.5 rounded-md inline-block">
                              Bayar Langsung Saat Kedatangan
                            </span>
                            <h3 className="text-xs sm:text-sm font-black text-[#0B261C] mt-0.5">
                              Cash / Bayar di Tempat (Studio / Lokasi)
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Tagihan Bayar di Tempat:</span>
                          <span className="font-black text-sm text-[#0B261C]">
                            {formatRupiah(pricing.finalPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Jadwal Kedatangan:</span>
                          <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                            {selectedDatePretty} • {selectedTimeSlot} WIB
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-2 pt-1 border-t border-stone-100">
                          <span className="text-stone-500 flex-shrink-0">Lokasi Pembayaran:</span>
                          <span className="font-bold text-[#0B261C] text-right">
                            {visitType === 'home_service'
                              ? 'Dibayarkan langsung ke Terapis saat tiba di lokasi Home Service'
                              : `Kasir Studio Griya Ayu (${GRIYA_AYU_ADDRESS})`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-[11px] text-stone-700 bg-amber-100/70 p-2.5 rounded-xl leading-relaxed">
                        <i className="fa-solid fa-circle-info text-amber-800 mt-0.5"></i>
                        <span>
                          Klik tombol <b>BOOKING & KUNCI JADWAL (BAYAR DI TEMPAT)</b> di bawah untuk
                          mengunci slot jam <b>{selectedTimeSlot} WIB</b> dan menerbitkan{' '}
                          <b>Struk Digital</b>. Mohon hadir <b>10 menit sebelum jadwal</b> dimulai.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* KOTAK UPLOAD BUKTI TRANSFER / SCREENSHOT QRIS: WAJIB UNTUK QRIS & TRANSFER BANK */}
                {(step3MethodType === 'qris' || step3MethodType === 'bank_transfer') && (
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border-2 border-dashed border-emerald-700/50 space-y-3 animate-fade">
                    {/* Pilihan Pembayaran Melalui Aplikasi / Bank Apa */}
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1.5">
                      <label
                        htmlFor="step3PaymentChannelSelect"
                        className="text-xs font-black text-[#0B261C] flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-building-columns text-emerald-700"></i>
                        <span>
                          Pembayaran Melalui Aplikasi / Bank Apa: <span className="text-red-600">*</span>
                        </span>
                      </label>
                      <select
                        id="step3PaymentChannelSelect"
                        value={step3PaymentChannel}
                        onChange={(e) => setStep3PaymentChannel(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-300 focus:border-[#0B261C] text-stone-900 text-xs font-bold p-2.5 rounded-xl focus:outline-none"
                      >
                        {(step3MethodType === 'qris'
                          ? QRIS_PAYMENT_CHANNELS
                          : BANK_TRANSFER_CHANNELS
                        ).map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-stone-500">
                        Pilih aplikasi M-Banking / E-Wallet atau rekening tujuan yang Anda gunakan agar Admin mudah mencocokkan mutasi & struk screenshot.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-[#0B261C] flex items-center gap-1.5">
                        <i className="fa-solid fa-camera text-emerald-800"></i>
                        <span>Upload Struk Screenshot Pembayaran Online *</span>
                      </label>
                      <span className="text-[10px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md">
                        Wajib Diunggah
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Unggah foto resi atau screenshot bukti pembayaran{' '}
                      <b>{step3PaymentChannel}</b> untuk dicek keasliannya oleh Admin dan mengunci jadwal Anda.
                    </p>

                    <label className="tactile-btn w-full min-h-[46px] bg-white hover:bg-stone-50 text-[#0B261C] border-2 border-[#0B261C]/20 rounded-xl px-3.5 py-2.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
                      <i className="fa-solid fa-cloud-arrow-up text-emerald-700 text-sm"></i>
                      <span>
                        {step3ProofImage
                          ? 'Ganti Foto Struk Screenshot Pembayaran'
                          : 'Pilih Foto / Screenshot Bukti Bayar'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStep3ProofUpload}
                        className="hidden"
                      />
                    </label>

                    {step3ProofImage && (
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-300 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black text-emerald-900">
                          <span>✓ Preview Struk Screenshot Siap Dikirim ke Admin:</span>
                          <button
                            type="button"
                            onClick={() => setStep3ProofImage('')}
                            className="text-red-600 hover:underline"
                          >
                            Hapus Foto
                          </button>
                        </div>
                        <div className="h-44 w-full rounded-lg overflow-hidden bg-stone-900 border border-stone-200">
                          <img
                            src={step3ProofImage}
                            alt="Preview Bukti Pembayaran"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {step3ProofError && (
                      <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-2.5 text-[11px] font-bold flex items-center gap-1.5">
                        <i className="fa-solid fa-triangle-exclamation text-red-600"></i>
                        <span>{step3ProofError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tombol Emas Utama Konfirmasi Pembayaran / Booking Dinamis */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmStep3Payment()}
                    disabled={
                      step3RemainingMs <= 0 ||
                      ((step3MethodType === 'qris' || step3MethodType === 'bank_transfer') &&
                        !step3ProofImage)
                    }
                    className={`tactile-btn w-full min-h-[52px] font-black py-3.5 px-4 rounded-2xl shadow-md border text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 text-center leading-snug transition ${
                      step3RemainingMs <= 0
                        ? 'bg-red-100 text-red-700 border-red-300 cursor-not-allowed'
                        : (step3MethodType === 'qris' || step3MethodType === 'bank_transfer') &&
                          !step3ProofImage
                        ? 'bg-stone-200 text-stone-500 border-stone-300 cursor-not-allowed'
                        : 'gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] border-amber-200'
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        step3RemainingMs <= 0 ? 'fa-ban' : 'fa-lock'
                      } text-sm flex-shrink-0`}
                    ></i>
                    <span>
                      {step3RemainingMs <= 0
                        ? 'WAKTU 20 MENIT HABIS — PEMBAYARAN GAGAL'
                        : step3MethodType === 'cash'
                        ? 'BOOKING & KUNCI JADWAL (BAYAR DI TEMPAT)'
                        : 'SAYA SUDAH BAYAR & KIRIM BUKTI (KUNCI JADWAL)'}
                    </span>
                  </button>
                  <p className="text-[11px] text-stone-500 text-center mt-2 leading-relaxed">
                    {step3RemainingMs <= 0 ? (
                      <span className="text-red-700 font-bold">
                        Waktu pembayaran 20 menit telah berakhir. Anda tidak dapat melakukan pembayaran lagi pada pesanan ini.
                      </span>
                    ) : step3MethodType === 'cash' ? (
                      <>
                        Klik tombol di atas untuk mengunci slot jam secara permanen dan menerbitkan
                        Struk Digital. Pembayaran dilakukan di kasir saat kedatangan.
                      </>
                    ) : (
                      <>
                        Unggah bukti transfer/QRIS lalu klik tombol di atas untuk langsung mengunci
                        slot jam <b>{selectedTimeSlot} WIB</b> secara permanen (status otomatis{' '}
                        <b>LUNAS</b>) dan membuka <b>Struk Digital</b>.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: JADWAL SAYA & RIWAYAT PEMBAYARAN (PENDING / BERHASIL)      */}
      {/* ================================================================= */}
      {customerTab === 'history' && (
        <div className="p-4 space-y-3.5 flex-1 animate-page-enter">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm space-y-1.5">
            <h2 className="text-sm font-black text-[#0B261C]">
              {isEn
                ? 'My Schedule & Payment Receipts'
                : 'Jadwal Saya & Riwayat Booking'}
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              Lanjutkan pembayaran yang masih <b>Pending (batas 20 menit)</b>, lihat{' '}
              <b>Struk Digital</b>, atau ajukan <b>Pembatalan / Refund</b> (maksimal{' '}
              <b>1 jam sebelum jadwal SPA dimulai</b>).
            </p>
          </div>

          {userBookings.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto text-lg">
                <i className="fa-regular fa-calendar-check"></i>
              </div>
              <h3 className="text-sm font-black text-stone-800">Belum Ada Riwayat Booking</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Jadwal yang Anda pesan beserta struknya akan muncul di halaman ini.
              </p>
              <button
                type="button"
                onClick={() => setCustomerTab('booking')}
                className="tactile-btn gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-5 rounded-2xl text-xs shadow-sm mt-1"
              >
                Buat Booking Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {userBookings.map((b) => {
                const isPaid = isOrderLockedStatus(b);
                const isConfirmedAcc =
                  b.paymentStatus === 'Terkonfirmasi (ACC Admin)' || b.status === 'Verified';
                const isWaitingAdminVerify = b.paymentStatus === 'Menunggu Verifikasi Admin';
                const isCashBooking = b.paymentStatus === 'Booking Cash (Bayar di Lokasi)';
                const isRefundWaiting =
                  b.paymentStatus === 'Menunggu Cek Refund Admin' ||
                  b.status === 'Refund_Requested';
                const isRefundDone =
                  b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
                  b.status === 'Refund_Completed' ||
                  Boolean(b.refundRequest && b.status === 'Cancelled');
                const remMs = Math.max(0, b.expiresAt - nowMs);

                // Kondisi 1: Pesanan Pending Pembayaran yang dibatalkan langsung oleh pelanggan (1-Klik)
                const isCancelledPending =
                  !isPaid &&
                  !isRefundWaiting &&
                  !isRefundDone &&
                  b.status === 'Cancelled' &&
                  b.paymentStatus === 'Dibatalkan';

                // Kondisi 2: Pesanan Pending Pembayaran yang waktu hitung mundurnya habis (00:00 / Auto-Cancel)
                const isExpiredPending =
                  !isPaid &&
                  !isRefundWaiting &&
                  !isRefundDone &&
                  !isCancelledPending &&
                  (b.paymentStatus === 'Dibatalkan (Waktu Habis / Kedaluwarsa)' ||
                    b.paymentStatus === 'Kedaluwarsa' ||
                    b.paymentStatus === 'Gagal' ||
                    remMs <= 0);

                // Kondisi 3: Pesanan masih berstatus "Pending Pembayaran" aktif (menunggu transfer / QRIS belum dibayar)
                const isPendingPayment =
                  !isPaid &&
                  !isRefundWaiting &&
                  !isRefundDone &&
                  !isCancelledPending &&
                  !isExpiredPending &&
                  (b.status === 'Pending_Payment' || b.paymentStatus === 'Pending') &&
                  remMs > 0;

                const isDone = b.status === 'Completed';

                // Pesanan yang SUDAH LUNAS / TERKONFIRMASI yang dapat mengajukan pembatalan / refund
                const isActivePaidBooking =
                  isPaid && !isRefundWaiting && !isRefundDone && !isDone;
                const refundEligibility = checkBookingRefundEligibility(
                  b.date,
                  b.time,
                  nowMs
                );

                return (
                  <div
                    key={b.id}
                    className={`bg-white p-4 rounded-2xl border shadow-sm space-y-3 animate-page-enter ${
                      isRefundWaiting
                        ? 'border-2 border-amber-400 bg-amber-50/20'
                        : isRefundDone || isCancelledPending
                        ? 'border-stone-200 bg-stone-50/70 opacity-90'
                        : isExpiredPending
                        ? 'border-2 border-red-300 bg-red-50/20'
                        : isPaid
                        ? 'border-stone-200/90'
                        : 'border-2 border-amber-400'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRefundWaiting ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400 inline-flex items-center gap-1">
                              <i className="fa-solid fa-clock-rotate-left text-amber-700"></i>
                              <span>MENUNGGU CEK REFUND ADMIN</span>
                            </span>
                          ) : isRefundDone ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 inline-flex items-center gap-1">
                              <i className="fa-solid fa-circle-check text-emerald-700"></i>
                              <span>
                                {b.status === 'Refund_Completed'
                                  ? 'REFUND SELESAI • Jadwal Tidak Terkunci'
                                  : 'DIBATALKAN • Jadwal Tidak Terkunci'}
                              </span>
                            </span>
                          ) : isCancelledPending ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-800 border border-stone-400 inline-flex items-center gap-1">
                              <i className="fa-solid fa-ban text-stone-700"></i>
                              <span>DIBATALKAN • Slot Jadwal Dilepaskan</span>
                            </span>
                          ) : isConfirmedAcc ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                              ✓ LUNAS • TERKONFIRMASI ADMIN
                            </span>
                          ) : isCashBooking ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-400">
                              💵 BOOKING CASH • Bayar di Lokasi
                            </span>
                          ) : isWaitingAdminVerify || isPaid ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                              ✓ STATUS: LUNAS (Jam Terkunci)
                            </span>
                          ) : isExpiredPending ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 inline-flex items-center gap-1">
                              <i className="fa-solid fa-hourglass-end text-red-600"></i>
                              <span>Dibatalkan (Waktu Habis / Kedaluwarsa)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-400 animate-pulse">
                              ⏳ PENDING PEMBAYARAN
                            </span>
                          )}

                          {isDone && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#0B261C] text-[#D4AF37]">
                              +{b.ptsEarned} Poin Masuk
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-xs sm:text-sm text-[#0B261C] leading-snug pt-0.5">
                          {b.items}
                        </h3>
                        <p className="text-xs text-stone-500">
                          <i className="fa-regular fa-calendar mr-1.5"></i>
                          {b.datePretty} • Jam <b>{b.time} WIB</b>
                        </p>
                        {b.previousSchedule && (
                          <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                            <i className="fa-solid fa-calendar-check text-[10px]"></i>
                            <span>
                              Reschedule dari: <s className="text-stone-400">{b.previousSchedule}</s>
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-emerald-900 font-bold">
                          Metode: {b.payMethod}
                          {b.vaNumber && !b.payMethod.includes('QRIS') ? ` (${b.vaNumber})` : ''}
                        </p>
                        {b.healthNote && (
                          <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-2.5 py-1.5 text-[11px] text-stone-800 mt-1">
                            <span className="font-black text-[#0B261C] block text-[10px]">
                              🩺 Catatan Keluhan / Fokus Pijat:
                            </span>
                            <span className="font-semibold leading-snug">{b.healthNote}</span>
                          </div>
                        )}
                      </div>
                      <span className="font-black text-sm text-[#0B261C] whitespace-nowrap">
                        {formatRupiah(b.total)}
                      </span>
                    </div>

                    {/* Keterangan jika pesanan Pending dibatalkan langsung oleh pelanggan */}
                    {isCancelledPending && (
                      <div className="bg-stone-100 border border-stone-300 rounded-xl p-2.5 text-[11px] text-stone-700 flex items-start gap-2">
                        <i className="fa-solid fa-circle-check text-emerald-700 mt-0.5 flex-shrink-0"></i>
                        <span>
                          <b>Status: Dibatalkan.</b> Pesanan ini telah dibatalkan sebelum pembayaran
                          dan slot jadwal <b>{b.time} WIB</b> telah dilepaskan kembali.
                        </span>
                      </div>
                    )}

                    {/* Keterangan jika waktu hitung mundur habis (00:00) -> Auto-Cancel / Kedaluwarsa */}
                    {isExpiredPending && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-800 flex items-start gap-2">
                        <i className="fa-solid fa-ban text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>
                          <b>Dibatalkan (Waktu Habis / Kedaluwarsa).</b> Batas waktu hitung mundur
                          pembayaran telah habis (00:00) dan slot jadwal <b>{b.time} WIB</b> telah
                          dilepaskan secara otomatis. Silakan buat booking baru di menu Booking.
                        </span>
                      </div>
                    )}

                    {/* Penghitung Waktu Mundur (Countdown Timer) "Sisa Waktu Pembayaran / Booking" saat Status Pending Pembayaran */}
                    {isPendingPayment && (
                      <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 border-2 border-[#D4AF37] rounded-2xl p-3 text-xs text-[#0B261C] flex items-center justify-between gap-2.5 shadow-2xs">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#0B261C] text-[#D4AF37] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <i className="fa-solid fa-stopwatch animate-bounce text-xs"></i>
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-[11px] uppercase tracking-wide text-[#0B261C] block">
                              Sisa Waktu Pembayaran / Booking
                            </span>
                            <span className="text-[11px] text-stone-700 leading-snug block mt-0.5">
                              Selesaikan pembayaran sebelum waktu habis (00:00) agar jadwal tidak
                              otomatis dibatalkan.
                            </span>
                          </div>
                        </div>
                        <div className="bg-[#0B261C] text-[#D4AF37] border border-[#D4AF37] px-3 py-1.5 rounded-xl text-right flex-shrink-0 shadow-xs">
                          <span className="text-[9px] font-bold text-emerald-200 block uppercase leading-none">
                            Timer
                          </span>
                          <span className="font-mono font-black text-sm block mt-0.5">
                            {formatCountdown(remMs)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Keterangan jika sebelumnya pengajuan refund pernah ditolak Admin */}
                    {b.refundRejectedReason && isActivePaidBooking && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-800 space-y-0.5">
                        <span className="font-black block">
                          <i className="fa-solid fa-circle-exclamation mr-1"></i>
                          Pengajuan Refund Sebelumnya Ditolak Admin:
                        </span>
                        <p className="leading-snug">{b.refundRejectedReason}</p>
                      </div>
                    )}

                    {/* Box Status Menunggu Cek Refund Admin + Tombol Pintasan WA Otomatis ke Admin */}
                    {isRefundWaiting && b.refundRequest && (
                      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <span className="font-black text-amber-950 text-[11px] flex items-center gap-1.5">
                            <i className="fa-solid fa-hourglass-half text-amber-600"></i>
                            <span>Pesanan Dibatalkan • Menunggu ACC Refund Admin</span>
                          </span>
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                            🔓 Jadwal {b.time} WIB Sudah Tidak Terkunci
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 space-y-1 text-[11px] text-stone-700">
                          <p>
                            <b>ID Booking:</b> #GA-{String(b.id).slice(-6)}
                          </p>
                          <p>
                            <b>Alasan Pembatalan:</b> {b.refundRequest.reason}
                          </p>
                          {!b.refundRequest.isCashCancellation && b.refundRequest.bankName && (
                            <p>
                              <b>Rekening Tujuan Refund:</b> {b.refundRequest.bankName} •{' '}
                              <span className="font-mono font-bold text-[#0B261C]">
                                {b.refundRequest.accountNumber}
                              </span>{' '}
                              (a.n. {b.refundRequest.accountHolder})
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <a
                            href={buildCustomerToAdminRefundWaMessage(b)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tactile-btn flex-1 min-h-[42px] bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs"
                          >
                            <i className="fa-brands fa-whatsapp text-base"></i>
                            <span>Kirim Permintaan Refund ke WhatsApp Admin</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenRefundModal(b)}
                            className="tactile-btn bg-white hover:bg-stone-100 text-stone-700 border border-amber-300 font-bold py-2 px-3 rounded-xl text-[11px]"
                          >
                            Ubah No. Rekening
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Box Status Refund Selesai / Dibatalkan */}
                    {isRefundDone && (
                      <div className="bg-stone-100 border border-stone-200 rounded-xl p-2.5 text-[11px] text-stone-700 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-emerald-900">
                            <i className="fa-solid fa-circle-check text-emerald-700 mr-1.5"></i>
                            {b.status === 'Refund_Completed'
                              ? 'Refund Selesai (Dana telah ditransfer Admin & jadwal kembali tidak terkunci).'
                              : 'Booking telah dibatalkan & jadwal kembali tidak terkunci.'}
                          </span>
                          {b.refundRequest?.processedAt && (
                            <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">
                              {b.refundRequest.processedAt}
                            </span>
                          )}
                        </div>
                        {b.refundRequest?.accountNumber && (
                          <p className="text-[10px] text-stone-500">
                            Rekening Tujuan: <b>{b.refundRequest.bankName}</b> •{' '}
                            <span className="font-mono font-bold">
                              {b.refundRequest.accountNumber}
                            </span>{' '}
                            (a.n. {b.refundRequest.accountHolder})
                          </p>
                        )}
                      </div>
                    )}

                    {/* Baris Tombol Utama: Kirim Bukti Booking ke WA Admin, Lihat Struk / Bayar Pending & Batalkan / Ajukan Refund */}
                    <div className="space-y-2 pt-2 border-t border-stone-100">
                      {isPaid && !isRefundWaiting && !isRefundDone && (
                        <a
                          href={buildCustomerBookingWaToAdminMessage(b).url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tactile-btn w-full min-h-[44px] bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs border border-emerald-500"
                        >
                          <i className="fa-brands fa-whatsapp text-base"></i>
                          <span>Kirim Bukti Booking ke WhatsApp Admin</span>
                        </a>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        {isExpiredPending ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 min-h-[44px] bg-stone-200 text-stone-500 border border-stone-300 font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-85"
                          >
                            <i className="fa-solid fa-lock"></i>
                            <span>Dibatalkan (Waktu Habis / Kedaluwarsa)</span>
                          </button>
                        ) : isCancelledPending ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 min-h-[44px] bg-stone-200 text-stone-600 border border-stone-300 font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-85"
                          >
                            <i className="fa-solid fa-ban"></i>
                            <span>Pesanan Telah Dibatalkan</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewReceipt(b)}
                            className={`tactile-btn flex-1 min-h-[44px] font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs ${
                              isPaid || isRefundWaiting || isRefundDone
                                ? 'bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37]'
                                : 'gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] border border-amber-300'
                            }`}
                          >
                            <i className={`fa-solid ${isPaid ? 'fa-receipt' : 'fa-qrcode'}`}></i>
                            <span>
                              {isPaid || isRefundWaiting || isRefundDone
                                ? 'Lihat Struk Digital Resmi'
                                : `Lanjutkan Pembayaran (${formatCountdown(remMs)})`}
                            </span>
                          </button>
                        )}

                        {/* Kondisi Khusus Status "Pending Pembayaran": Tombol "Batalkan Pesanan" (1-Klik Konfirmasi Tanpa Form Rekening/Bukti Transfer) */}
                        {isPendingPayment && (
                          <button
                            type="button"
                            onClick={() => setPendingCancelModalOrder(b)}
                            className="tactile-btn flex-1 min-h-[44px] bg-red-50 hover:bg-red-100 text-red-800 border-2 border-red-300 font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
                          >
                            <i className="fa-solid fa-xmark"></i>
                            <span>Batalkan Pesanan</span>
                          </button>
                        )}

                        {/* Alur Refund / Pembatalan Khusus untuk Pesanan yang Sudah Lunas / Terkonfirmasi */}
                        {isActivePaidBooking && (
                          <button
                            type="button"
                            disabled={!refundEligibility.canRefund}
                            onClick={() => {
                              if (refundEligibility.canRefund) {
                                handleOpenRefundModal(b);
                              }
                            }}
                            className={`tactile-btn flex-1 min-h-[44px] font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 border transition ${
                              refundEligibility.canRefund
                                ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-300 shadow-xs'
                                : 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed opacity-80'
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                refundEligibility.canRefund ? 'fa-rotate-left' : 'fa-lock'
                              }`}
                            ></i>
                            <span>
                              {b.payMethodType === 'cash' ||
                              b.payMethod.toLowerCase().includes('cash')
                                ? 'Batalkan Booking'
                                : 'Batalkan & Ajukan Refund'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Tombol Reschedule Mandiri (Hanya untuk Booking Confirmed / Lunas, Maks. 4 Jam Sebelum Jadwal Awal) */}
                      {isActivePaidBooking && (() => {
                        const rescheduleEligibility = checkBookingRescheduleEligibility(
                          b.date,
                          b.time,
                          nowMs
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            <button
                              type="button"
                              disabled={!rescheduleEligibility.canReschedule}
                              onClick={() => {
                                if (rescheduleEligibility.canReschedule) {
                                  handleOpenRescheduleModal(b);
                                }
                              }}
                              className={`tactile-btn w-full min-h-[42px] font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 border transition ${
                                rescheduleEligibility.canReschedule
                                  ? 'bg-amber-50 hover:bg-amber-100 text-[#0B261C] border-[#D4AF37] shadow-xs'
                                  : 'bg-stone-100 text-stone-400 border-stone-300 cursor-not-allowed opacity-80'
                              }`}
                            >
                              <i
                                className={`fa-solid ${
                                  rescheduleEligibility.canReschedule
                                    ? 'fa-calendar-days text-amber-700'
                                    : 'fa-lock'
                                }`}
                              ></i>
                              <span>Ajukan Ganti Jadwal (Reschedule)</span>
                            </button>
                            <p className="text-[10px] text-stone-500 flex items-center justify-between px-1">
                              <span>
                                <i className="fa-regular fa-calendar-check mr-1 text-amber-700"></i>
                                Batas reschedule mandiri: maks. 4 jam sebelum jadwal awal
                              </span>
                              <span
                                className={`font-bold ${
                                  rescheduleEligibility.canReschedule
                                    ? 'text-emerald-800'
                                    : 'text-red-600'
                                }`}
                              >
                                {rescheduleEligibility.canReschedule
                                  ? `Bisa ganti jadwal (${rescheduleEligibility.remainingLabel})`
                                  : 'Lewat batas 4 jam'}
                              </span>
                            </p>
                          </div>
                        );
                      })()}

                      {/* Keterangan Batas Waktu 1 Jam Sebelum Jadwal SPA Dimulai (Khusus Pesanan Lunas/Terkonfirmasi) */}
                      {isActivePaidBooking && !refundEligibility.canRefund && (
                        <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-relaxed flex items-start gap-1.5">
                          <i className="fa-solid fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
                          <span>
                            Pembatalan & refund hanya dapat dilakukan maksimal 1 jam sebelum jadwal
                            SPA dimulai.
                          </span>
                        </p>
                      )}

                      {isActivePaidBooking && refundEligibility.canRefund && (
                        <p className="text-[10px] text-stone-500 flex items-center justify-between px-1">
                          <span>
                            <i className="fa-regular fa-clock mr-1 text-emerald-700"></i>
                            Batas pembatalan/refund: maks. 1 jam sebelum sesi
                          </span>
                          <span className="font-bold text-emerald-800">
                            Sisa waktu: {refundEligibility.remainingLabel}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL KONFIRMASI SEDERHANA BATALKAN PESANAN PENDING (1-KLIK)      */}
      {/* ================================================================= */}
      {pendingCancelModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pendingCancelModalTitle"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade"
        >
          <div className="bg-[#F9F6F0] w-full max-w-sm rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden animate-modal-pop">
            {/* Header Modal Konfirmasi Batalkan Pesanan */}
            <div className="bg-gradient-to-r from-[#0B261C] via-[#123829] to-[#0B261C] text-white p-4 border-b border-[#D4AF37]/60 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-calendar-xmark text-sm"></i>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37] block">
                    Pending Pembayaran
                  </span>
                  <h3 id="pendingCancelModalTitle" className="text-sm font-black text-white">
                    Konfirmasi Batalkan Pesanan
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingCancelModalOrder(null)}
                aria-label="Tutup Konfirmasi Pembatalan"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {/* Ringkasan Singkat Pesanan Pending */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-stone-400 uppercase font-mono">
                    #GA-{String(pendingCancelModalOrder.id).slice(-6)}
                  </span>
                  <span className="text-xs font-black text-[#0B261C]">
                    {formatRupiah(pendingCancelModalOrder.total)}
                  </span>
                </div>
                <p className="font-black text-[#0B261C] text-xs leading-snug">
                  {pendingCancelModalOrder.items}
                </p>
                <p className="text-[11px] text-stone-600">
                  📅 {pendingCancelModalOrder.datePretty} • Jam{' '}
                  <b>{pendingCancelModalOrder.time} WIB</b>
                </p>
              </div>

              {/* Pesan Konfirmasi Sederhana */}
              <div className="bg-amber-50 border border-[#D4AF37]/70 rounded-2xl p-3.5 text-stone-800 leading-relaxed flex items-start gap-2.5">
                <i className="fa-solid fa-circle-question text-amber-700 text-base mt-0.5 flex-shrink-0"></i>
                <p className="font-bold text-xs text-[#0B261C] leading-relaxed">
                  Apakah Anda yakin ingin membatalkan pesanan ini? Slot jadwal yang Anda pilih akan
                  dilepaskan kembali.
                </p>
              </div>

              {/* Tombol Pilihan: "Ya, Batalkan" dan "Kembali" */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingCancelModalOrder(null)}
                  className="tactile-btn min-h-[44px] bg-stone-200 hover:bg-stone-300 text-stone-800 font-black py-2.5 px-4 rounded-2xl text-xs border border-stone-300 transition"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelPendingOrder}
                  className="tactile-btn min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-black py-2.5 px-4 rounded-2xl text-xs shadow-md border border-red-700 flex items-center justify-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>Ya, Batalkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL FORMULIR PENGAJUAN PEMBATALAN / REFUND                      */}
      {/* ================================================================= */}
      {refundModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refundModalTitle"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade overflow-y-auto"
        >
          <div className="bg-[#F9F6F0] w-full max-w-sm rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Header Modal Refund */}
            <div className="bg-gradient-to-r from-[#0B261C] via-[#123829] to-[#0B261C] text-white p-4 border-b border-[#D4AF37]/60 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-400/20 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/40">
                  Verifikasi Admin Griya Ayu
                </span>
                <h3 id="refundModalTitle" className="text-sm font-black text-white mt-1">
                  Formulir Pembatalan & Pengajuan Refund
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRefundModalOrder(null)}
                aria-label="Tutup Formulir Refund"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitRefundForm}
              className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs"
            >
              {/* Ringkasan Jadwal yang Dibatalkan */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-stone-400 uppercase">
                    Pesanan #GA-{String(refundModalOrder.id).slice(-6)}
                  </span>
                  <span className="text-xs font-black text-emerald-900">
                    {formatRupiah(refundModalOrder.total)}
                  </span>
                </div>
                <p className="font-black text-[#0B261C] text-xs leading-snug">
                  {refundModalOrder.items}
                </p>
                <p className="text-[11px] text-stone-600">
                  📅 {refundModalOrder.datePretty} • Jam <b>{refundModalOrder.time} WIB</b>
                </p>
                <p className="text-[11px] font-bold text-amber-900">
                  💳 Metode Awal: {refundModalOrder.payMethod}
                </p>
              </div>

              {/* 1. Alasan Pembatalan (Wajib untuk Semua Metode) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="refundReasonInput"
                  className="text-xs font-black text-[#0B261C] block"
                >
                  1. Alasan Pembatalan <span className="text-red-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[
                    'Ada keperluan mendadak',
                    'Ingin ganti jadwal / hari lain',
                    'Kondisi kesehatan kurang fit',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setRefundReason(preset);
                        setRefundFormError('');
                      }}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition ${
                        refundReason === preset
                          ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  id="refundReasonInput"
                  rows={2}
                  value={refundReason}
                  onChange={(e) => {
                    setRefundReason(e.target.value);
                    setRefundFormError('');
                  }}
                  placeholder="Tuliskan alasan pembatalan jadwal SPA Anda..."
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-xs font-medium focus:outline-none focus:border-[#0B261C]"
                />
              </div>

              {/* Jika Metode Pembayaran BUKAN Cash (QRIS / Transfer BCA / Mandiri), Wajib Isi Rekening & Upload Bukti */}
              {!(
                refundModalOrder.payMethodType === 'cash' ||
                refundModalOrder.payMethod.toLowerCase().includes('cash') ||
                refundModalOrder.payMethod.toLowerCase().includes('tempat')
              ) ? (
                <>
                  {/* 2. Info Rekening / E-Wallet Tujuan Pengembalian Dana */}
                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 space-y-2.5 shadow-xs">
                    <span className="text-xs font-black text-[#0B261C] block">
                      2. Rekening / E-Wallet Tujuan Refund <span className="text-red-600">*</span>
                    </span>

                    <div>
                      <span className="text-[11px] font-bold text-stone-600 block mb-1">
                        Pilih / Ketik Nama Bank atau E-Wallet:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {['Bank BCA', 'Bank Mandiri', 'Bank BRI', 'Bank BNI', 'GoPay', 'DANA', 'OVO', 'ShopeePay'].map(
                          (bName) => (
                            <button
                              key={bName}
                              type="button"
                              onClick={() => setRefundBankName(bName)}
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition ${
                                refundBankName === bName
                                  ? 'bg-[#0B261C] text-[#D4AF37] border-[#0B261C]'
                                  : 'bg-stone-50 text-stone-700 border-stone-300'
                              }`}
                            >
                              {bName}
                            </button>
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        value={refundBankName}
                        onChange={(e) => {
                          setRefundBankName(e.target.value);
                          setRefundFormError('');
                        }}
                        placeholder="Contoh: Bank BCA / Mandiri / GoPay / DANA"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="refundAccNumInput"
                        className="text-[11px] font-bold text-stone-600 block mb-1"
                      >
                        Nomor Rekening / Nomor E-Wallet:
                      </label>
                      <input
                        id="refundAccNumInput"
                        type="text"
                        value={refundAccountNumber}
                        onChange={(e) => {
                          setRefundAccountNumber(e.target.value);
                          setRefundFormError('');
                        }}
                        placeholder="Masukkan nomor rekening / nomor HP e-wallet"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-stone-900 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="refundAccHolderInput"
                        className="text-[11px] font-bold text-stone-600 block mb-1"
                      >
                        Atas Nama Pemilik Rekening:
                      </label>
                      <input
                        id="refundAccHolderInput"
                        type="text"
                        value={refundAccountHolder}
                        onChange={(e) => {
                          setRefundAccountHolder(e.target.value);
                          setRefundFormError('');
                        }}
                        placeholder="Nama lengkap sesuai rekening / e-wallet"
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* 3. Lampiran Bukti Pembayaran Awal (Otomatis Terlampir / Opsional) */}
                  <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 space-y-2.5 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#0B261C]">
                        3. Bukti Pembayaran Awal (Opsional)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800">
                        {refundProofImage ? '✓ Otomatis Terlampir' : 'Screenshot QRIS / TF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      Bukti transaksi saat booking otomatis dilampirkan. Anda juga dapat mengunggah ulang screenshot jika diperlukan.
                    </p>

                    <input
                      type="file"
                      id="refundProofFileInput"
                      accept="image/*"
                      onChange={handleRefundProofUpload}
                      className="hidden"
                    />

                    {refundProofImage ? (
                      <div className="space-y-2">
                        <div className="relative h-44 w-full rounded-xl overflow-hidden border-2 border-emerald-500 bg-stone-900">
                          <img
                            src={refundProofImage}
                            alt="Preview Bukti Pembayaran"
                            className="w-full h-full object-contain"
                          />
                          <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            ✓ Bukti Siap Diverifikasi
                          </span>
                        </div>
                        <label
                          htmlFor="refundProofFileInput"
                          className="tactile-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2 rounded-xl text-center block cursor-pointer border border-stone-300"
                        >
                          <i className="fa-solid fa-camera-rotate mr-1.5"></i>
                          Ganti Foto Bukti Pembayaran
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="refundProofFileInput"
                        className="tactile-btn w-full min-h-[84px] border-2 border-dashed border-[#D4AF37] bg-amber-50/60 hover:bg-amber-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-xl text-[#0B261C]"></i>
                        <span className="font-black text-[#0B261C] text-xs">
                          Klik untuk Upload Screenshot Bukti TF / QRIS
                        </span>
                        <span className="text-[10px] text-stone-500">
                          Format JPG / PNG dari galeri HP Anda
                        </span>
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-[11px] text-amber-950 leading-relaxed flex items-start gap-2">
                  <i className="fa-solid fa-circle-info text-amber-700 mt-0.5"></i>
                  <span>
                    Pesanan ini menggunakan metode <b>Cash / Bayar di Tempat</b>. Anda cukup
                    mengisi alasan pembatalan di atas untuk mengajukan pembatalan jadwal ke Admin.
                  </span>
                </div>
              )}

              {refundFormError && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-red-600"></i>
                  <span>{refundFormError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(null)}
                  className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-3 px-4 rounded-2xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="tactile-btn gold-shimmer-card flex-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs shadow-md border border-amber-300 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Kirim Pengajuan Refund ke Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL RESCHEDULE MANDIRI (GANTI TANGGAL & JAM TANPA BAYAR ULANG)  */}
      {/* ================================================================= */}
      {rescheduleModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rescheduleModalTitle"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade overflow-y-auto"
        >
          <div className="bg-[#F9F6F0] w-full max-w-sm rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="bg-gradient-to-r from-[#0B261C] via-[#123829] to-[#0B261C] text-white p-4 border-b border-[#D4AF37]/60 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-400/20 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/40">
                  Reschedule Mandiri • Tanpa Biaya Tambahan
                </span>
                <h3 id="rescheduleModalTitle" className="text-sm font-black text-white mt-1">
                  Ajukan Ganti Jadwal (Reschedule)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOrder(null)}
                aria-label="Tutup Modal Reschedule"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitRescheduleForm}
              className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs"
            >
              {/* Info Pesanan Saat Ini */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-stone-400 uppercase">
                    Kode Booking #GA-{String(rescheduleModalOrder.id).slice(-6)}
                  </span>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                    Layanan & Pembayaran Tetap
                  </span>
                </div>
                <p className="font-black text-[#0B261C] text-xs leading-snug">
                  {rescheduleModalOrder.items}
                </p>
                <p className="text-[11px] text-stone-600">
                  Jadwal Awal: <b>{rescheduleModalOrder.datePretty} • Jam {rescheduleModalOrder.time} WIB</b>
                </p>
              </div>

              {/* 1. Pilih Tanggal Baru */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-[#0B261C] block">
                  1. Pilih Tanggal Baru:
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1.5">
                  {calendarDays
                    .filter((d) => !d.isPast)
                    .map((d) => {
                      const isSelected = rescheduleDateIso === d.iso;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          disabled={d.isHoliday}
                          onClick={() => {
                            if (d.isHoliday) return;
                            setRescheduleDateIso(d.iso);
                            setRescheduleDatePretty(d.pretty);
                            setRescheduleTimeSlot(null);
                            setRescheduleError('');
                          }}
                          className={`tactile-btn min-w-[66px] p-2 rounded-2xl border-2 flex flex-col items-center justify-center transition flex-shrink-0 ${
                            d.isHoliday
                              ? 'bg-red-50 text-red-400 border-red-200 cursor-not-allowed opacity-70'
                              : isSelected
                              ? 'bg-[#0B261C] text-white border-[#D4AF37] shadow-xs'
                              : 'bg-white text-stone-800 border-stone-200 hover:border-emerald-700'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold ${
                              isSelected ? 'text-[#D4AF37]' : 'text-stone-500'
                            }`}
                          >
                            {d.dayName}
                          </span>
                          <span className="text-sm font-black leading-tight mt-0.5">
                            {d.dayNum}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              isSelected ? 'text-emerald-200' : 'text-stone-500'
                            }`}
                          >
                            {d.isHoliday ? 'Libur' : d.monthName}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 2. Pilih Jam Sesi Baru */}
              <div className="space-y-1.5">
                <span className="text-xs font-black text-[#0B261C] block">
                  2. Pilih Jam Sesi Baru ({rescheduleDatePretty}):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {masterTimeSlots.map((slot) => {
                    const isCurrentBookingSlot =
                      rescheduleDateIso === rescheduleModalOrder.date &&
                      slot.time === rescheduleModalOrder.time;
                    const otherBookings = bookings.filter(
                      (b) => b.id !== rescheduleModalOrder.id
                    );
                    const status = isSlotAvailable(
                      slot.time,
                      rescheduleDateIso,
                      masterTimeSlots,
                      otherBookings,
                      nowMs
                    );
                    const isSelected = rescheduleTimeSlot === slot.time;

                    if (isCurrentBookingSlot) {
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled
                          className="py-2.5 px-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 cursor-not-allowed flex flex-col items-center justify-center"
                        >
                          <span className="text-xs font-black">{slot.time}</span>
                          <span className="text-[9px] font-bold">Jadwal Awal</span>
                        </button>
                      );
                    }

                    if (!status.available) {
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled
                          className="py-2.5 px-2 rounded-xl bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed flex flex-col items-center justify-center"
                        >
                          <span className="text-xs font-bold line-through">{slot.time}</span>
                          <span className="text-[9px] font-bold">
                            {status.reason === 'booked'
                              ? 'Penuh'
                              : status.reason === 'closed'
                              ? 'Tutup'
                              : 'Lewat'}
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => {
                          setRescheduleTimeSlot(slot.time);
                          setRescheduleError('');
                        }}
                        className={`tactile-btn py-2.5 px-2 rounded-xl border-2 flex flex-col items-center justify-center transition ${
                          isSelected
                            ? 'bg-[#0B261C] text-white border-[#D4AF37] shadow-xs'
                            : 'bg-white text-[#0B261C] border-emerald-700/40 hover:border-emerald-800'
                        }`}
                      >
                        <span className="text-xs font-black">{slot.time}</span>
                        <span
                          className={`text-[9px] font-extrabold ${
                            isSelected ? 'text-[#D4AF37]' : 'text-emerald-700'
                          }`}
                        >
                          {isSelected ? '✓ Dipilih' : 'Tersedia'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {rescheduleError && (
                <div className="bg-red-50 border border-red-300 text-red-800 p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-red-600"></i>
                  <span>{rescheduleError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOrder(null)}
                  className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold py-3 px-4 rounded-2xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="tactile-btn gold-shimmer-card flex-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs shadow-md border border-amber-300 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-calendar-check"></i>
                  <span>Simpan Jadwal Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: BAR NOTIFIKASI PELANGGAN (PROMO GAMBAR+TEKS & UPDATE)      */}
      {/* ================================================================= */}
      {customerTab === 'notifications' && (
        <div className="p-4 space-y-3.5 flex-1 animate-page-enter">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm flex justify-between items-center gap-2">
            <div>
              <h2 className="text-sm font-black text-[#0B261C] flex items-center gap-1.5">
                <i className="fa-solid fa-bell text-amber-500"></i>
                <span>
                  {isEn
                    ? 'Customer Notifications & Special Promos'
                    : 'Bar Notifikasi & Promo Griya Ayu'}
                </span>
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Info status pembayaran, konfirmasi Admin, dan promo resmi Griya Ayu.
              </p>
            </div>
            <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full flex-shrink-0">
              {customerNotifications.length} Info
            </span>
          </div>

          {customerNotifications.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm text-center text-xs text-stone-500">
              Belum ada notifikasi masuk.
            </div>
          ) : (
            <div className="space-y-3.5">
              {customerNotifications.map((n) => {
                const isPromo = n.type === 'promo_broadcast';
                return (
                  <div
                    key={n.id}
                    className={`rounded-2xl overflow-hidden border shadow-sm transition ${
                      isPromo
                        ? 'bg-gradient-to-b from-amber-50/90 to-white border-2 border-[#D4AF37]'
                        : 'bg-white border-stone-200/90'
                    }`}
                  >
                    {isPromo && n.promoImage && (
                      <div className="relative h-40 w-full bg-stone-900 overflow-hidden">
                        <img
                          src={n.promoImage}
                          alt={n.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2.5 left-2.5 bg-[#0B261C]/90 text-[#D4AF37] text-[10px] font-black px-3 py-1 rounded-full border border-[#D4AF37]">
                          🤖 PROMO RESMI GRIYA AYU
                        </div>
                        {n.promoCode && (
                          <div className="absolute bottom-2.5 right-2.5 bg-amber-400 text-[#0B261C] text-xs font-black px-3 py-1 rounded-xl shadow">
                            Kode: {n.promoCode}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                            isPromo
                              ? 'bg-[#0B261C] text-[#D4AF37]'
                              : n.type === 'payment_success' ||
                                n.type === 'admin_confirmed' ||
                                n.type === 'refund_approved'
                              ? 'bg-emerald-100 text-emerald-900'
                              : n.type === 'refund_rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isPromo
                            ? '🎁 Promo Spesial Member'
                            : n.type === 'admin_confirmed'
                            ? '✓ Konfirmasi Admin'
                            : n.type === 'refund_requested' ||
                              n.type === 'refund_approved' ||
                              n.type === 'refund_rejected'
                            ? '↺ Info Pembatalan / Refund'
                            : '🔔 Info Pembayaran'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-semibold">
                          {n.createdAt}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-[#0B261C] leading-snug">{n.title}</h3>
                      <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed">
                        {n.message}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <a
                          href={GRIYA_AYU_MAPS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tactile-btn flex-1 bg-emerald-50 hover:bg-emerald-100 text-[#0B261C] border border-emerald-300 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-location-dot text-red-600"></i>
                          <span>Lokasi Maps</span>
                        </a>
                        {isPromo && (
                          <button
                            type="button"
                            onClick={() => setCustomerTab('booking')}
                            className="tactile-btn gold-shimmer-card flex-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <i className="fa-solid fa-calendar-check"></i>
                            <span>Pakai Promo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: HALAMAN POIN PELANGGAN (TERHUBUNG KATALOG REWARD ADMIN)    */}
      {/* ================================================================= */}
      {customerTab === 'rewards' && (
        <div className="p-4 space-y-4 flex-1 animate-page-enter">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
            {/* Header Saldo Poin Pelanggan */}
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-base font-black text-[#0B261C] flex items-center gap-2">
                  <i className="fa-solid fa-crown text-amber-500"></i>
                  <span>
                    {isEn ? 'Loyalty Points & Rewards Catalog' : 'Katalog Penukaran Poin Member'}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1">
                  Kumpulkan poin dari setiap kedatangan terapi dan tukarkan langsung dengan{' '}
                  <b>Reward / Hadiah Spesial</b> dari Griya Ayu di bawah ini.
                </p>
              </div>
              <div className="bg-[#0B261C] text-[#D4AF37] px-3.5 py-2 rounded-2xl whitespace-nowrap border-2 border-[#D4AF37] shadow-sm text-right flex-shrink-0">
                <span className="text-[10px] font-bold text-emerald-200 block uppercase leading-none">
                  Saldo Poin Anda
                </span>
                <span className="text-sm sm:text-base font-black block mt-0.5">
                  👑 {currentUser.points} Poin
                </span>
              </div>
            </div>

            {/* Panduan Perolehan Poin Setiap Transaksi */}
            <div className="bg-[#0B261C] text-white p-3.5 rounded-2xl border border-[#D4AF37]/50 space-y-2 shadow-xs">
              <span className="text-xs font-black uppercase tracking-wider text-[#D4AF37] block">
                📈 Skema Perolehan Poin Setiap Transaksi:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200 font-semibold">Layanan Rp 100rb</span>
                  <span className="font-black text-amber-300">+5 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200 font-semibold">Layanan Rp 150rb</span>
                  <span className="font-black text-amber-300">+10 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200 font-semibold">Layanan Rp 250rb</span>
                  <span className="font-black text-amber-300">+15 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200 font-semibold">Layanan Rp 400rb</span>
                  <span className="font-black text-amber-300">+20 Poin</span>
                </div>
              </div>
            </div>

            {/* Daftar Kartu Katalog Reward yang Dikelola Admin */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#0B261C] flex items-center gap-1.5">
                  <i className="fa-solid fa-gift text-emerald-800"></i>
                  <span>Daftar Hadiah &amp; Penawaran Poin Aktif</span>
                </h3>
                <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  {catalogPointRewards.length} Reward Tersedia
                </span>
              </div>

              {catalogPointRewards.length === 0 ? (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center space-y-1.5">
                  <i className="fa-solid fa-box-open text-2xl text-stone-400"></i>
                  <p className="text-sm font-bold text-stone-700">
                    Belum ada katalog reward yang aktif saat ini.
                  </p>
                  <p className="text-xs text-stone-500">
                    Silakan cek kembali nanti untuk penawaran hadiah poin terbaru dari Admin Griya Ayu.
                  </p>
                </div>
              ) : (
                catalogPointRewards.map((item, idx) => {
                  const unlocked = currentUser.points >= item.cost;
                  const rewardTitle = item.title || item.label;
                  const rewardDesc =
                    item.description ||
                    'Tukarkan poin member Anda untuk menikmati penawaran spesial dari Griya Ayu Sport Massage & SPA.';
                  const stockBadge = item.stockInfo || 'Tersedia';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border-2 transition space-y-3 ${
                        unlocked
                          ? 'bg-emerald-50/90 border-emerald-500/80 shadow-sm'
                          : 'bg-stone-50 border-stone-200/90'
                      }`}
                    >
                      {/* Baris Atas: Nomor Urut / Stok & Jumlah Poin yang Dibutuhkan */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check text-emerald-600"></i>
                          <span>
                            Reward #{idx + 1} · {stockBadge}
                          </span>
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-black px-3 py-1 rounded-xl border ${
                            unlocked
                              ? 'bg-[#0B261C] text-[#D4AF37] border-[#D4AF37]'
                              : 'bg-stone-200 text-stone-700 border-stone-300'
                          }`}
                        >
                          Butuh {item.cost} Poin
                        </span>
                      </div>

                      {/* Nama Reward & Catatan/Keterangan dari Admin */}
                      <div className="space-y-1.5">
                        <h4 className="text-sm sm:text-base font-black text-[#0B261C] leading-snug">
                          {rewardTitle}
                        </h4>
                        <div className="bg-white/90 border border-stone-200/80 rounded-xl p-2.5 text-xs sm:text-sm text-stone-700 leading-relaxed">
                          <span className="font-extrabold text-[#0B261C] block text-[11px] uppercase tracking-wide mb-0.5">
                            📝 Catatan / Keterangan Admin:
                          </span>
                          <p className="whitespace-pre-line">{rewardDesc}</p>
                        </div>
                      </div>

                      {/* Baris Bawah: Info Kecukupan Poin & Tombol "Tukar Poin" */}
                      <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-stone-200/80">
                        <div className="text-xs font-bold">
                          {unlocked ? (
                            <span className="text-emerald-800 flex items-center gap-1.5">
                              <i className="fa-solid fa-unlock text-emerald-600"></i>
                              <span>
                                Poin Anda cukup! (Sisa {currentUser.points - item.cost} Poin jika ditukar)
                              </span>
                            </span>
                          ) : (
                            <span className="text-stone-500 flex items-center gap-1.5">
                              <i className="fa-solid fa-lock text-stone-400"></i>
                              <span>
                                Kurang <b>{item.cost - currentUser.points} Poin</b> lagi untuk menukar hadiah ini
                              </span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!unlocked}
                          onClick={() => {
                            if (!unlocked) return;
                            setRedeemConfirmReward(item);
                          }}
                          className={`tactile-btn py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition flex-shrink-0 ${
                            unlocked
                              ? 'gold-shimmer-card bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] border border-amber-300 shadow-sm cursor-pointer'
                              : 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed opacity-75'
                          }`}
                        >
                          <i className={unlocked ? 'fa-solid fa-gift' : 'fa-solid fa-lock'}></i>
                          <span>{unlocked ? 'Tukar Poin' : 'Tukar Poin (Belum Cukup)'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL KONFIRMASI TUKAR POIN PELANGGAN                             */}
      {/* ================================================================= */}
      {redeemConfirmReward && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-page-enter"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Tukar Poin"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden">
            <div className="bg-[#0B261C] text-white p-4 border-b border-[#D4AF37]/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-gift text-[#D4AF37] text-base"></i>
                <h3 className="text-sm sm:text-base font-black text-[#D4AF37]">
                  Konfirmasi Tukar Poin
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRedeemConfirmReward(null)}
                className="text-stone-300 hover:text-white text-xs font-bold px-2 py-1 rounded-lg"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs sm:text-sm">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
                <span className="text-[11px] font-black uppercase text-emerald-800 block">
                  Hadiah yang Dipilih:
                </span>
                <p className="text-sm sm:text-base font-black text-[#0B261C] leading-snug">
                  {redeemConfirmReward.title || redeemConfirmReward.label}
                </p>
                {redeemConfirmReward.description && (
                  <p className="text-xs text-stone-600 whitespace-pre-line pt-1 border-t border-emerald-200/70">
                    {redeemConfirmReward.description}
                  </p>
                )}
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600 font-semibold">Saldo Poin Saat Ini:</span>
                  <span className="font-black text-[#0B261C]">{currentUser.points} Poin</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600 font-semibold">Poin yang Dibutuhkan:</span>
                  <span className="font-black text-amber-700">-{redeemConfirmReward.cost} Poin</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-stone-200">
                  <span className="text-[#0B261C] font-extrabold">Sisa Poin Setelah Ditukar:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {Math.max(0, currentUser.points - redeemConfirmReward.cost)} Poin
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const target = redeemConfirmReward;
                    setRedeemConfirmReward(null);
                    if (onRedeemPointReward) {
                      onRedeemPointReward(target);
                    }
                  }}
                  className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs sm:text-sm border border-amber-300 shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-check-circle"></i>
                  <span>Tukar {redeemConfirmReward.cost} Poin Sekarang</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = redeemConfirmReward;
                    setSelectedRewardId(target.id);
                    setRedeemConfirmReward(null);
                    setCustomerTab('booking');
                    onShowToast(
                      'Reward Dipasang ke Booking! 🎁',
                      `Reward "${target.title || target.label}" (${target.cost} Poin) telah dipilih otomatis untuk sesi booking terapi Anda.`
                    );
                  }}
                  className="tactile-btn w-full bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-2.5 px-4 rounded-2xl text-xs border border-[#D4AF37]/50 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-calendar-plus"></i>
                  <span>Pakai Saat Booking Layanan Terapi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRedeemConfirmReward(null)}
                  className="tactile-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-4 rounded-2xl text-xs"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 5: BAR AKUN KHUSUS PELANGGAN                                  */}
      {/* ================================================================= */}
      {customerTab === 'account' && (
        <AccountPanel
          currentUser={currentUser}
          isAdmin={false}
          bookings={bookings}
          language={language}
          onChangeLanguage={onChangeLanguage}
          onUpdateUser={onUpdateUser}
          onViewReceipt={onViewReceipt}
          onLogout={onLogout}
          onShowToast={onShowToast}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL LIGHTBOX ZOOM BROSUR HARGA (KLIK & PERBESAR MUDAH DIBACA)    */}
      {/* ================================================================= */}
      {zoomedBrochure && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col animate-page-enter"
          role="dialog"
          aria-modal="true"
          aria-label={zoomedBrochure.title}
        >
          {/* Header Modal Brosur */}
          <div className="bg-[#0B261C] text-white px-4 py-3 border-b border-[#D4AF37]/50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-[#D4AF37] truncate">
                {zoomedBrochure.title}
              </h3>
              <p className="text-xs text-stone-200 font-bold truncate">
                {zoomedBrochure.subtitle} • Geser gambar saat di-zoom
              </p>
            </div>
            <button
              type="button"
              onClick={() => setZoomedBrochure(null)}
              className="tactile-btn bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0 shadow-md"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
              <span>Tutup</span>
            </button>
          </div>

          {/* Bar Pilihan Ganti Brosur & Kontrol Zoom */}
          <div className="bg-stone-900 px-3 py-2.5 border-b border-stone-700 flex flex-wrap items-center justify-between gap-2">
            {/* Tombol Ganti Brosur */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setZoomedBrochure({
                    src: '/assets/aistudio/image_2b8cf505.png',
                    title: 'Brosur Griya Ayu Sport Massage',
                    subtitle: 'Semua Gender (👨👩)',
                  })
                }
                className={`tactile-btn text-xs font-extrabold px-3 py-1.5 rounded-xl border transition ${
                  zoomedBrochure.src.includes('image_2b8cf505')
                    ? 'bg-[#D4AF37] text-[#0B261C] border-amber-300 shadow'
                    : 'bg-stone-800 text-stone-300 border-stone-600 hover:text-white'
                }`}
              >
                👨👩 Semua Gender
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoomedBrochure({
                    src: '/assets/aistudio/image_2d1f81d9.png',
                    title: 'Brosur Griya Ayu Willness Massage',
                    subtitle: 'Khusus Wanita (👩)',
                  })
                }
                className={`tactile-btn text-xs font-extrabold px-3 py-1.5 rounded-xl border transition ${
                  zoomedBrochure.src.includes('image_2d1f81d9')
                    ? 'bg-pink-400 text-[#0B261C] border-pink-200 shadow'
                    : 'bg-stone-800 text-stone-300 border-stone-600 hover:text-white'
                }`}
              >
                👩 Khusus Wanita
              </button>
            </div>

            {/* Kontrol Zoom (- / % / + / Reset) */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() =>
                  setBrochureZoomLevel((prev) => Math.max(1, Number((prev - 0.5).toFixed(1))))
                }
                disabled={brochureZoomLevel <= 1}
                className="tactile-btn bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white font-black text-xs w-8 h-8 rounded-xl border border-stone-600 flex items-center justify-center"
                title="Perkecil"
              >
                <i className="fa-solid fa-magnifying-glass-minus"></i>
              </button>
              <button
                type="button"
                onClick={() => setBrochureZoomLevel((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
                className="tactile-btn bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/50 font-black text-xs px-2.5 py-1.5 rounded-xl min-w-[60px] text-center"
                title="Klik untuk ubah ukuran zoom"
              >
                {Math.round(brochureZoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setBrochureZoomLevel((prev) => Math.min(3.5, Number((prev + 0.5).toFixed(1))))
                }
                disabled={brochureZoomLevel >= 3.5}
                className="tactile-btn bg-[#D4AF37] hover:bg-amber-400 disabled:opacity-40 text-[#0B261C] font-black text-xs w-8 h-8 rounded-xl border border-amber-200 flex items-center justify-center"
                title="Perbesar"
              >
                <i className="fa-solid fa-magnifying-glass-plus"></i>
              </button>
            </div>
          </div>

          {/* Area Gambar Brosur yang Bisa Di-Scroll & Di-Klik untuk Zoom */}
          <div
            className="flex-1 overflow-auto p-3 sm:p-6 flex items-start justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setZoomedBrochure(null);
              }
            }}
          >
            <div
              style={{
                width: `${brochureZoomLevel * 100}%`,
                maxWidth: brochureZoomLevel === 1 ? '480px' : 'none',
              }}
              className="transition-all duration-150 mx-auto"
            >
              <img
                src={zoomedBrochure.src}
                alt={zoomedBrochure.title}
                onClick={() =>
                  setBrochureZoomLevel((prev) => (prev >= 3 ? 1 : Number((prev + 0.5).toFixed(1))))
                }
                className={`w-full h-auto rounded-2xl border-2 border-[#D4AF37] shadow-2xl select-none ${
                  brochureZoomLevel >= 3 ? 'cursor-zoom-out' : 'cursor-zoom-in'
                }`}
              />
            </div>
          </div>

          {/* Footer Petunjuk Singkat */}
          <div className="bg-[#0B261C] text-stone-200 text-xs font-bold px-4 py-2.5 border-t border-[#D4AF37]/40 flex items-center justify-between gap-2">
            <span>💡 Ketuk gambar langsung atau tombol (+) untuk memperbesar tulisan</span>
            <button
              type="button"
              onClick={() => setBrochureZoomLevel(1)}
              className="tactile-btn text-[#D4AF37] underline font-black text-xs flex-shrink-0"
            >
              Reset 100%
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BOTTOM NAVIGATION BAR KHUSUS PELANGGAN (RAPI & TIDAK MAKAN TEMPAT)*/}
      {/* ================================================================= */}
      <nav
        aria-label="Navigasi Pelanggan"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-[#0B261C] text-stone-300 border-t border-[#D4AF37]/50 grid grid-cols-5 py-1.5 px-1 text-[10px] font-bold z-40 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setCustomerTab('booking')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl transition min-w-0 ${
            customerTab === 'booking'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-extrabold'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-calendar-plus text-sm"></i>
          <span className="text-[10px] leading-tight truncate max-w-full">Booking</span>
        </button>

        <button
          type="button"
          onClick={() => setCustomerTab('history')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 relative py-1 px-0.5 rounded-xl transition min-w-0 ${
            customerTab === 'history'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-extrabold'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-receipt text-sm"></i>
          <span className="text-[10px] leading-tight truncate max-w-full">
            {isEn ? 'Receipts' : 'Riwayat'}
          </span>
          {pendingUserBookings.length > 0 && (
            <span className="absolute top-0.5 right-2 bg-amber-400 text-[#0B261C] text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {pendingUserBookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleOpenNotifTab}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 relative py-1 px-0.5 rounded-xl transition min-w-0 ${
            customerTab === 'notifications'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-extrabold'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-bell text-sm"></i>
          <span className="text-[10px] leading-tight truncate max-w-full">
            {isEn ? 'Notif' : 'Notifikasi'}
          </span>
          {unreadNotifCount > 0 && (
            <span className="absolute top-0.5 right-2 bg-red-500 text-white text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse">
              {unreadNotifCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCustomerTab('rewards')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl transition min-w-0 ${
            customerTab === 'rewards'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-extrabold'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-crown text-sm"></i>
          <span className="text-[10px] leading-tight truncate max-w-full">
            {isEn ? 'Points' : 'Poin'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCustomerTab('account')}
          className={`tactile-btn flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl transition min-w-0 ${
            customerTab === 'account'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-extrabold'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-circle-user text-sm"></i>
          <span className="text-[10px] leading-tight truncate max-w-full">
            {isEn ? 'Account' : 'Akun'}
          </span>
        </button>
      </nav>
    </div>
  );
};

