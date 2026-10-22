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
  compressImageFileToDataUrl,
  buildCustomerBookingWaToAdminMessage,
  buildCustomerToAdminRefundWaMessage,
  GRIYA_AYU_QRIS_IMAGE,
  GRIYA_AYU_QRIS_NMID,
  GRIYA_AYU_QRIS_MERCHANT,
  GRIYA_AYU_BANK_ACCOUNTS,
  GRIYA_AYU_ADDRESS,
  GRIYA_AYU_MAPS_URL,
} from '../utils/spaLogic.ts';
import {
  SINGLE_CATALOG,
  PACKAGE_CATALOG,
  ANATOMY_LOCATIONS,
  POINT_REWARDS,
} from '../data/mockData.ts';
import { AccountPanel } from './AccountPanel.tsx';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface CustomerDashboardProps {
  currentUser: User;
  bookings: BookingOrder[];
  notifications: AppNotification[];
  masterTimeSlots: TimeSlot[];
  closedWeekdays: number[];
  closedSpecificDates: string[];
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
    existingOrderId?: number | null;
    silentReceipt?: boolean;
  }) => BookingOrder | null;
  onRequestRefund?: (orderId: number, refundInfo: RefundRequestInfo) => void;
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
  closedWeekdays,
  closedSpecificDates,
  language,
  onChangeLanguage,
  onUpdateUser,
  onOpenPaymentModal,
  onConfirmWizardBooking,
  onRequestRefund,
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

  // Point reward selection (di Langkah 3)
  const [selectedRewardId, setSelectedRewardId] = useState<string>('none');

  // State Pembayaran di Langkah 3 (QRIS Timer 20 Menit + Metode + Bukti Bayar + ID Pesanan Pending di Riwayat)
  const [step3PendingOrderId, setStep3PendingOrderId] = useState<number | null>(null);
  const [step3ExpiresAt, setStep3ExpiresAt] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [step3MethodType, setStep3MethodType] = useState<PaymentMethodType>('qris');
  const [step3ProofImage, setStep3ProofImage] = useState<string>('');
  const [step3ProofError, setStep3ProofError] = useState<string>('');

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

  // State Modal Formulir Pengajuan Pembatalan / Refund
  const [refundModalOrder, setRefundModalOrder] = useState<BookingOrder | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundBankName, setRefundBankName] = useState<string>('Bank BCA');
  const [refundAccountNumber, setRefundAccountNumber] = useState<string>('');
  const [refundAccountHolder, setRefundAccountHolder] = useState<string>('');
  const [refundProofImage, setRefundProofImage] = useState<string>('');
  const [refundFormError, setRefundFormError] = useState<string>('');

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
      refundModalOrder.payMethod.toLowerCase().includes('tempat') ||
      refundModalOrder.paymentStatus === 'Pending';

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

  // Generate kalender: menampilkan 2 hari sebelumnya (misal tgl 18 & 19 yang otomatis abu-abu/terlewat) + hari ini (tgl 20) + 29 hari ke depan
  const calendarDays = React.useMemo(() => {
    const days: Array<{
      iso: string;
      pretty: string;
      dayName: string;
      dayNum: number;
      monthName: string;
      isHoliday: boolean;
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
      const holiday = isDateHoliday(iso, dayIdx, closedWeekdays, closedSpecificDates);
      const past = iso < todayIso;

      days.push({
        iso,
        pretty,
        dayName: dayLabels[dayIdx],
        dayNum: d.getDate(),
        monthName: monthLabels[d.getMonth()],
        isHoliday: holiday,
        isPast: past,
        isToday: iso === todayIso,
      });
    }
    return days;
  }, [closedWeekdays, closedSpecificDates, todayIso]);

  // Otomatis koreksi jika tanggal terpilih sudah lewat atau hari libur, serta reset jam jika sudah terlewat
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
    }
  }, [nowMs, todayIso, selectedDateIso, selectedTimeSlot, calendarDays]);

  // Pricing calculation
  const pricing = calculateOrderPricing(
    serviceMode,
    chosenSingleIds,
    chosenPackageId,
    SINGLE_CATALOG,
    PACKAGE_CATALOG,
    selectedRewardId,
    POINT_REWARDS,
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
      if (id === 's2' || id === 's4') {
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
      });
    }
  };

  const userBookings = bookings.filter(
    (b) =>
      b.customer.toLowerCase() === currentUser.name.toLowerCase() ||
      b.wa.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')
  );

  const pendingUserBookings = userBookings.filter(
    (b) => b.paymentStatus === 'Pending' && b.expiresAt > nowMs
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
            <div className="space-y-3 animate-page-enter">
              {/* 1. GRID KATEGORI UTAMA (GRID ICON CARD 2 BARIS X 3 KOLOM ALA TRAVELOKA) */}
              <div className="bg-white p-3.5 rounded-3xl shadow-sm border border-stone-200/90 space-y-2.5">
                <div className="flex justify-between items-center gap-2">
                  <h2 className="text-base font-black text-[#0B261C]">
                    {isEn ? 'Treatment Categories' : 'Pilih Kategori Terapi'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowPriceListImages(!showPriceListImages)}
                    className="tactile-btn text-xs font-black bg-amber-50 hover:bg-amber-100 text-[#0B261C] px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1.5 flex-shrink-0"
                  >
                    <i className="fa-solid fa-image text-amber-700"></i>
                    <span>{showPriceListImages ? 'Tutup Brosur' : 'Brosur Harga'}</span>
                  </button>
                </div>

                {/* Brosur Price List Resmi (Collapsible) */}
                {showPriceListImages && (
                  <div className="p-3 rounded-2xl bg-stone-900 text-white space-y-2 border border-[#D4AF37]/60 animate-page-enter">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <img
                          src="/assets/aistudio/image_2b8cf505.png"
                          alt="Price List Griya Ayu Sport Massage"
                          className="w-full rounded-xl border border-[#D4AF37]/40 object-cover"
                        />
                        <p className="text-xs text-center font-bold text-amber-200">
                          Semua Gender (👨👩)
                        </p>
                      </div>
                      <div className="space-y-1">
                        <img
                          src="/assets/aistudio/image_2d1f81d9.png"
                          alt="Price List Griya Ayu Willness Massage"
                          className="w-full rounded-xl border border-[#D4AF37]/40 object-cover"
                        />
                        <p className="text-xs text-center font-bold text-pink-200">
                          Khusus Wanita (👩)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid 2 Baris x 3 Kolom Ikon Bulat Berwarna ala Traveloka */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Kategori 1: Pijat Kebugaran */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedGridCategory(
                        selectedGridCategory === 'kebugaran' ? 'all' : 'kebugaran'
                      )
                    }
                    className={`tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border ${
                      selectedGridCategory === 'kebugaran'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-hands-holding-circle text-lg"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
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
                    className={`tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border ${
                      selectedGridCategory === 'otot_cedera'
                        ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-person-running text-lg"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
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
                    className={`tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border ${
                      selectedGridCategory === 'spa_tubuh'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-spa text-lg"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
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
                    className={`tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border ${
                      selectedGridCategory === 'bekam'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-heart-pulse text-lg"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
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
                    className={`tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border ${
                      selectedGridCategory === 'khusus_wanita'
                        ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-500/25'
                        : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/60'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 text-white flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-venus text-lg"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
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
                    className="tactile-btn py-2.5 px-1.5 rounded-2xl flex flex-col items-center text-center gap-1.5 transition border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white flex items-center justify-center shadow-sm">
                      <i className="fa-brands fa-whatsapp text-xl"></i>
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#0B261C] leading-tight">
                      Tanya Admin WA
                    </span>
                  </a>
                </div>
              </div>

              {/* 2. KARTU LAYANAN DI BAWAH GRID (RAPI, JELAS, FONT BESAR) */}
              <div className="bg-white p-3.5 rounded-3xl shadow-sm border border-stone-200/90 space-y-3">
                {/* Bar Judul Kategori Aktif & Reset Semua Layanan */}
                <div className="flex justify-between items-center gap-2">
                  <h3 className="text-base font-black text-[#0B261C] truncate">
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
                      className="tactile-btn text-xs font-black text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-xl border border-emerald-300 flex-shrink-0"
                    >
                      Lihat Semua
                    </button>
                  ) : (
                    <span className="text-xs font-black bg-emerald-100 text-emerald-950 px-2.5 py-1 rounded-xl border border-emerald-300 flex-shrink-0">
                      {serviceMode === 'single'
                        ? `${chosenSingleIds.length} Dipilih`
                        : chosenPackageId
                        ? '1 Paket'
                        : '0 Dipilih'}
                    </span>
                  )}
                </div>

                {/* Switch Mode: Layanan Satuan vs Paket Hemat */}
                <div className="flex bg-stone-100 p-1 rounded-2xl text-xs sm:text-sm font-black">
                  <button
                    type="button"
                    onClick={() => setServiceMode('single')}
                    className={`tactile-btn flex-1 py-2 rounded-xl transition ${
                      serviceMode === 'single'
                        ? 'bg-[#0B261C] text-[#D4AF37] shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {isEn ? 'Single Services' : 'Layanan Satuan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceMode('package')}
                    className={`tactile-btn flex-1 py-2 rounded-xl transition ${
                      serviceMode === 'package'
                        ? 'bg-[#0B261C] text-[#D4AF37] shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    🔥 {isEn ? 'Bundle Packages' : 'Paket Hemat'}
                  </button>
                </div>

                {/* Daftar Kartu Layanan Ringkas & Mudah Dibaca */}
                {serviceMode === 'single' ? (
                  <div className="space-y-2.5">
                    {SINGLE_CATALOG.filter((item) => {
                      if (selectedGridCategory === 'all') return true;
                      return item.gridCategories?.includes(selectedGridCategory);
                    }).map((s) => {
                      const isSelected = chosenSingleIds.includes(s.id);
                      const isFemaleOnly = s.gender === 'female';
                      const badgeLabel =
                        s.genderBadge || (isFemaleOnly ? '👩 Khusus Wanita' : '👨👩 Semua Gender');
                      const hasInjuryTopping = s.id === 's2' || s.id === 's4';
                      const serviceSpots = injurySpotsByService[s.id] || [];
                      const isToppingOpen = isSelected && hasInjuryTopping && openInjuryServiceId === s.id;

                      return (
                        <div
                          key={s.id}
                          className={`w-full rounded-2xl border-2 transition overflow-hidden ${
                            isSelected
                              ? 'border-[#0B261C] bg-emerald-50/90 shadow-sm'
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
                            className="tactile-btn w-full p-3.5 text-left cursor-pointer flex justify-between items-center gap-3"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              {/* Nama Layanan (Font Besar & Jelas) */}
                              <h4 className="font-extrabold text-sm sm:text-base text-[#0B261C] leading-snug">
                                {s.name}
                              </h4>

                              {/* Baris Info Ringkas: Durasi & Badge Gender */}
                              <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-stone-600">
                                <span className="inline-flex items-center gap-1 text-stone-700">
                                  <i className="fa-regular fa-clock text-emerald-700"></i>
                                  {s.duration}
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
                              </div>

                              {/* Ringkasan Titik Keluhan Terpilih (Tampil Rapi di Kartu Saat Selesai Dipilih) */}
                              {isSelected && hasInjuryTopping && !isToppingOpen && (
                                <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-black text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                    <span>🎯 Titik Keluhan:</span>
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
                                    className="tactile-btn text-[11px] font-black text-[#0B261C] bg-white hover:bg-amber-50 border border-stone-300 px-2.5 py-1 rounded-lg shadow-2xs"
                                  >
                                    <i className="fa-solid fa-pen-to-square mr-1 text-amber-700"></i>
                                    Ubah Titik
                                  </button>
                                </div>
                              )}

                              {/* Harga Besar & Poin */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="font-black text-sm sm:text-base text-emerald-900">
                                  {formatRupiah(s.price)}
                                </span>
                                <span className="text-xs font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md">
                                  +{s.points} Poin
                                </span>
                              </div>
                            </div>

                            {/* Tombol Centang / Pilih Layanan Simpel */}
                            <div
                              className={`px-3.5 py-2.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center gap-1.5 flex-shrink-0 transition ${
                                isSelected
                                  ? 'bg-[#0B261C] border-[#0B261C] text-[#D4AF37] shadow-xs'
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
                    {PACKAGE_CATALOG.filter((p) => {
                      if (selectedGridCategory === 'all') return true;
                      return p.gridCategories?.includes(selectedGridCategory);
                    }).map((p) => {
                      const isSelected = chosenPackageId === p.id;
                      const isFemaleOnly = p.gender === 'female';
                      const badgeLabel =
                        p.genderBadge || (isFemaleOnly ? '👩 Khusus Wanita' : '👨👩 Semua Gender');

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
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black">
                                {p.tag}
                              </span>
                            </div>

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

              {/* BAGIAN B: GRID SLOT JAM OPERASIONAL */}
              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200/90 space-y-3">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-[#0B261C]">
                    {isEn ? 'Select Session Time' : 'Pilih Jam Sesi'}
                  </h2>
                  <span className="bg-emerald-50 text-emerald-950 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-black">
                    🕒 Sekarang {currentTimeHm} WIB
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {masterTimeSlots.map((slot) => {
                    const status = isSlotAvailable(
                      slot.time,
                      selectedDateIso,
                      masterTimeSlots,
                      bookings,
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
                    {POINT_REWARDS.map((r) => {
                      const hasEnoughPoints = currentUser.points >= r.cost;
                      return (
                        <option key={r.id} value={r.id} disabled={!hasEnoughPoints}>
                          {r.label}{' '}
                          {!hasEnoughPoints ? `(Kurang ${r.cost - currentUser.points} Poin)` : ''}
                        </option>
                      );
                    })}
                  </select>
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
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border-2 border-dashed border-emerald-700/50 space-y-2.5 animate-fade">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-[#0B261C] flex items-center gap-1.5">
                        <i className="fa-solid fa-camera text-emerald-800"></i>
                        <span>Upload Bukti Transfer / Screenshot QRIS *</span>
                      </label>
                      <span className="text-[10px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md">
                        Wajib Diunggah
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Unggah foto resi atau screenshot bukti pembayaran{' '}
                      <b>{step3MethodType === 'qris' ? 'QRIS Griya Ayu' : 'Transfer Bank'}</b> untuk
                      diverifikasi oleh Admin dan mengunci jadwal Anda.
                    </p>

                    <label className="tactile-btn w-full min-h-[46px] bg-white hover:bg-stone-50 text-[#0B261C] border-2 border-[#0B261C]/20 rounded-xl px-3.5 py-2.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-2xs">
                      <i className="fa-solid fa-cloud-arrow-up text-emerald-700 text-sm"></i>
                      <span>
                        {step3ProofImage
                          ? 'Ganti Foto Bukti Pembayaran'
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
                          <span>✓ Preview Bukti Pembayaran Siap Dikirim:</span>
                          <button
                            type="button"
                            onClick={() => setStep3ProofImage('')}
                            className="text-red-600 hover:underline"
                          >
                            Hapus Foto
                          </button>
                        </div>
                        <div className="h-40 w-full rounded-lg overflow-hidden bg-stone-900 border border-stone-200">
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
                        slot jam <b>{selectedTimeSlot} WIB</b> secara permanen (status:{' '}
                        <b>Berhasil / Menunggu Verifikasi Admin</b>) dan membuka <b>Struk Digital</b>.
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
                const isFailed =
                  !isPaid &&
                  !isRefundWaiting &&
                  !isRefundDone &&
                  (b.paymentStatus === 'Gagal' ||
                    b.paymentStatus === 'Kedaluwarsa' ||
                    remMs <= 0);
                const isDone = b.status === 'Completed';

                // Pesanan aktif yang dapat mengajukan pembatalan/refund
                const isActiveBooking =
                  !isRefundWaiting && !isRefundDone && !isDone && !isFailed;
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
                        : isRefundDone
                        ? 'border-stone-200 bg-stone-50/70 opacity-90'
                        : isFailed
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
                          ) : isConfirmedAcc ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                              ✓ BERHASIL • TERKONFIRMASI (ACC ADMIN)
                            </span>
                          ) : isWaitingAdminVerify ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                              ✓ PEMBAYARAN BERHASIL • Menunggu Verifikasi Admin
                            </span>
                          ) : isCashBooking ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                              ✓ BOOKING BERHASIL • Cash (Bayar di Lokasi)
                            </span>
                          ) : isPaid ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                              ✓ STATUS: BERHASIL (Jam Terkunci)
                            </span>
                          ) : isFailed ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                              ✕ STATUS: GAGAL (Waktu 20 Menit Habis)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-400 animate-pulse">
                              ⏳ STATUS: PENDING (Sisa Waktu {formatCountdown(remMs)})
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
                        <p className="text-xs text-emerald-900 font-bold">
                          Metode: {b.payMethod}
                          {b.vaNumber && !b.payMethod.includes('QRIS') ? ` (${b.vaNumber})` : ''}
                        </p>
                      </div>
                      <span className="font-black text-sm text-[#0B261C] whitespace-nowrap">
                        {formatRupiah(b.total)}
                      </span>
                    </div>

                    {/* Keterangan jika waktu 20 menit sudah berakhir (GAGAL) */}
                    {isFailed && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-800 flex items-start gap-2">
                        <i className="fa-solid fa-ban text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>
                          <b>Batas waktu pembayaran 20 menit telah berakhir (GAGAL).</b> Anda tidak
                          dapat melakukan pembayaran lagi pada pesanan ini. Silakan buat booking
                          baru di menu Booking.
                        </span>
                      </div>
                    )}

                    {/* Keterangan jika masih Pending (< 20 Menit) */}
                    {!isPaid && !isFailed && !isRefundWaiting && !isRefundDone && (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[11px] text-amber-950 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-stopwatch text-amber-700 animate-bounce"></i>
                          <span>
                            Selesaikan pembayaran sebelum <b>{formatCountdown(remMs)}</b> berakhir agar pesanan tidak gagal.
                          </span>
                        </div>
                        <span className="font-mono font-black text-xs bg-[#0B261C] text-[#D4AF37] px-2.5 py-1 rounded-lg flex-shrink-0">
                          {formatCountdown(remMs)}
                        </span>
                      </div>
                    )}

                    {/* Keterangan jika sebelumnya pengajuan refund pernah ditolak Admin */}
                    {b.refundRejectedReason && isActiveBooking && (
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
                        {isFailed ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 min-h-[44px] bg-stone-200 text-stone-500 border border-stone-300 font-black py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-85"
                          >
                            <i className="fa-solid fa-lock"></i>
                            <span>Waktu 20 Menit Habis — Tidak Bisa Bayar Lagi</span>
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

                        {/* Tombol Batalkan Booking / Ajukan Refund pada Setiap Pesanan Aktif */}
                        {isActiveBooking && (
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
                              b.payMethod.toLowerCase().includes('cash') ||
                              b.paymentStatus === 'Pending'
                                ? 'Batalkan Booking'
                                : 'Batalkan & Ajukan Refund'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Keterangan Batas Waktu 1 Jam Sebelum Jadwal SPA Dimulai */}
                      {isActiveBooking && !refundEligibility.canRefund && (
                        <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-relaxed flex items-start gap-1.5">
                          <i className="fa-solid fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
                          <span>
                            Pembatalan & refund hanya dapat dilakukan maksimal 1 jam sebelum jadwal
                            SPA dimulai.
                          </span>
                        </p>
                      )}

                      {isActiveBooking && refundEligibility.canRefund && (
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
      {/* TAB 4: SISTEM POIN LOYALITAS BERTAHAP (MICRO-REWARDS)             */}
      {/* ================================================================= */}
      {customerTab === 'rewards' && (
        <div className="p-4 space-y-3.5 flex-1 animate-page-enter">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm space-y-3.5">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-sm font-black text-[#0B261C] flex items-center gap-1.5">
                  <i className="fa-solid fa-award text-amber-500"></i>
                  <span>
                    {isEn
                      ? 'Tiered Loyalty Micro-Rewards'
                      : 'Poin Loyalitas Bertahap (Micro-Rewards)'}
                  </span>
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed mt-1">
                  Kumpulkan poin dari setiap kedatangan terapi. Poin ditukarkan dengan{' '}
                  <b>Bonus Layanan / Micro-Rewards Gratis Bertahap</b> (bukan potongan harga uang
                  tunai).
                </p>
              </div>
              <span className="text-xs font-black bg-[#0B261C] text-[#D4AF37] px-3 py-1.5 rounded-xl whitespace-nowrap border border-[#D4AF37]/50 shadow-xs">
                👑 {currentUser.points} Poin
              </span>
            </div>

            {/* Panduan Perolehan Poin Setiap Transaksi */}
            <div className="bg-[#0B261C] text-white p-3.5 rounded-2xl border border-[#D4AF37]/50 space-y-2 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37] block">
                📈 Skema Perolehan Poin Setiap Transaksi:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200">Layanan Rp 100rb</span>
                  <span className="font-black text-amber-300">+5 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200">Layanan Rp 150rb</span>
                  <span className="font-black text-amber-300">+10 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200">Layanan Rp 250rb</span>
                  <span className="font-black text-amber-300">+15 Poin</span>
                </div>
                <div className="bg-black/30 px-3 py-2 rounded-xl flex justify-between items-center border border-white/10">
                  <span className="text-stone-200">Layanan Rp 400rb</span>
                  <span className="font-black text-amber-300">+20 Poin</span>
                </div>
              </div>
            </div>

            {/* Daftar 5 Tahap Micro-Rewards */}
            <div className="space-y-2.5 pt-1">
              {[
                {
                  tier: 'Tahap 1 • Micro-Reward Awal',
                  title: '🍵 Gratis Wedang Rempah / Jahe Merah & Aromaterapi',
                  desc: 'Minuman herbal penghangat tubuh & relaksasi aromaterapi seusai sesi.',
                  cost: 30,
                },
                {
                  tier: 'Tahap 2 • Micro-Reward Ekstra Durasi',
                  title: '💆‍♀️ Gratis Ekstra Durasi Pijat Kepala & Leher (+15 Menit)',
                  desc: 'Tambahan waktu relaksasi fokus area kepala, pelipis & leher.',
                  cost: 60,
                },
                {
                  tier: 'Tahap 3 • Reward Layanan Wajah',
                  title: '🎁 GRATIS Layanan Totok Wajah (30 - 45 Menit)',
                  desc: 'Senilai Rp 100.000 — Melancarkan peredaran darah & menyegarkan wajah.',
                  cost: 100,
                },
                {
                  tier: 'Tahap 4 • Reward Layanan Populer',
                  title: '🎁 GRATIS Bekam / Lulur Badan / Willness Massage 60m',
                  desc: 'Senilai Rp 150.000 — Bebas pilih 1 layanan gratis saat kunjungan.',
                  cost: 150,
                },
                {
                  tier: 'Tahap 5 • VIP Grand Reward',
                  title: '👑 GRATIS Sesi Injury Muscle / Hot Stone / Willness 90m',
                  desc: 'Senilai Rp 250.000 — Apresiasi tertinggi untuk member setia Griya Ayu.',
                  cost: 250,
                },
              ].map((item) => {
                const unlocked = currentUser.points >= item.cost;
                return (
                  <div
                    key={item.cost}
                    className={`p-3.5 rounded-2xl border shadow-xs flex justify-between items-center gap-3 ${
                      unlocked
                        ? 'bg-emerald-50/90 border-emerald-300'
                        : 'bg-stone-50 border-stone-200/90 opacity-90'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">
                        {item.tier}
                      </span>
                      <h3 className="text-xs sm:text-sm font-black text-[#0B261C] leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-stone-500 leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`text-xs font-black px-3 py-1.5 rounded-xl block ${
                          unlocked
                            ? 'bg-[#0B261C] text-[#D4AF37]'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {item.cost} Poin
                      </span>
                      <span className="text-[9px] font-bold text-stone-500 block mt-1">
                        {unlocked
                          ? '✓ Bisa Diklaim'
                          : `Kurang ${item.cost - currentUser.points} Pts`}
                      </span>
                    </div>
                  </div>
                );
              })}
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

