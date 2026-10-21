import React, { useState } from 'react';
import {
  User,
  BookingOrder,
  TimeSlot,
  Language,
  AppNotification,
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
} from '../utils/spaLogic.ts';
import { PROMO_TEMPLATES, INITIAL_USERS } from '../data/mockData.ts';
import { AccountPanel } from './AccountPanel.tsx';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface AdminDashboardProps {
  currentUser: User;
  bookings: BookingOrder[];
  notifications: AppNotification[];
  masterTimeSlots: TimeSlot[];
  closedWeekdays: number[];
  closedSpecificDates: string[];
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onUpdateUser: (updated: User) => void;
  onVerifyPayment: (orderId: number) => void;
  onCompleteTreatment: (orderId: number) => void;
  onApproveRefund: (orderId: number) => void;
  onRejectRefund: (orderId: number, rejectReason?: string) => void;
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
  bookings,
  notifications,
  masterTimeSlots,
  closedWeekdays,
  closedSpecificDates,
  language,
  onChangeLanguage,
  onUpdateUser,
  onVerifyPayment,
  onCompleteTreatment,
  onApproveRefund,
  onRejectRefund,
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
    'orders' | 'notifications' | 'schedule' | 'account'
  >('orders');
  const [orderFilter, setOrderFilter] = useState<
    'all' | 'refund_pending' | 'active' | 'refund_done'
  >('all');
  const [customDateInput, setCustomDateInput] = useState<string>(() => getTodayIso());
  const [newSlotTimeInput, setNewSlotTimeInput] = useState<string>('20:30');
  const [expandedConfirmOrderId, setExpandedConfirmOrderId] = useState<number | null>(null);
  const [previewProofOrder, setPreviewProofOrder] = useState<BookingOrder | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>(
    'Bukti pembayaran tidak ditemukan pada mutasi rekening atau tidak sesuai.'
  );

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
      (b.paymentStatus === 'Menunggu Verifikasi Admin' ||
        b.paymentStatus === 'Booking Cash (Bayar di Lokasi)')
  ).length;

  const monthlyVerifiedOrders = bookings.filter((b) =>
    isMonthRevenueOrder(b, selectedMonthPrefix)
  );
  const monthlyOmzetTotal = monthlyVerifiedOrders.reduce((sum, b) => sum + b.total, 0);
  const monthLabelIndo = formatMonthYearIndo(selectedMonthPrefix);

  const handleDownloadMonthlyCsv = () => {
    downloadMonthlyRevenueCsv(monthlyVerifiedOrders, selectedMonthPrefix);
    onShowToast(
      'Laporan Bulanan Diunduh (CSV/Excel)! 📊',
      `File "Laporan_Omzet_Bulanan_Griya_Ayu_${selectedMonthPrefix}.csv" (${monthlyVerifiedOrders.length} transaksi • Total ${formatRupiah(
        monthlyOmzetTotal
      )}) berhasil diunduh dan siap dibuka di Microsoft Excel.`
    );
  };

  const adminNotifications = notifications.filter((n) => n.target === 'admin');
  const unreadAdminNotifs = adminNotifications.filter((n) => !n.read).length;
  const paidUnverifiedCount = bookings.filter(
    (b) =>
      b.paymentStatus === 'Menunggu Verifikasi Admin' ||
      b.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ||
      (b.paymentStatus === 'Berhasil' && b.status === 'Paid')
  ).length;
  const refundPendingCount = bookings.filter(
    (b) => b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested'
  ).length;

  const filteredBookings = bookings.filter((b) => {
    const isRefWait =
      b.paymentStatus === 'Menunggu Cek Refund Admin' || b.status === 'Refund_Requested';
    const isRefDone =
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.status === 'Refund_Completed' ||
      b.status === 'Cancelled';
    if (orderFilter === 'refund_pending') return isRefWait;
    if (orderFilter === 'refund_done') return isRefDone;
    if (orderFilter === 'active') return !isRefWait && !isRefDone;
    return true;
  });

  const storedCustomers: User[] = React.useMemo(() => {
    return loadCustomersPersistently(INITIAL_USERS);
  }, [adminSubTab, bookings.length]);

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

  return (
    <div className="flex-1 flex flex-col pb-28">
      {/* HEADER DASHBOARD ADMIN RISMAWATI */}
      <header className="bg-gradient-to-r from-stone-900 via-[#0B261C] to-stone-900 text-white px-4 py-4 rounded-b-3xl shadow-lg border-b-2 border-[#D4AF37]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.35)]"
              />
            ) : (
              <GriyaAyuLogo size="sm" showBadge={false} floating={false} />
            )}
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded">
                {isEn ? 'OFFICIAL ADMIN PANEL' : 'DASHBOARD ADMIN RESMI'}
              </span>
              <h1 className="text-sm font-black text-white mt-0.5">{currentUser.name}</h1>
              <p className="text-[10px] text-emerald-200">WA Admin: 0851-8311-0392</p>
            </div>
          </div>

          {/* Kanan Atas: Lonceng Bar Notifikasi Admin + Akun Admin */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenNotifTab}
              aria-label="Buka Bar Notifikasi & Bot Promo Admin"
              className="tactile-btn relative w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center"
            >
              <i className="fa-solid fa-bell text-xs"></i>
              {unreadAdminNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                  {unreadAdminNotifs}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('account')}
              aria-label="Buka Pengaturan Akun Admin"
              className="tactile-btn bg-white/10 hover:bg-white/20 text-[10px] font-bold px-2.5 py-2 rounded-xl border border-[#D4AF37]/50 transition flex items-center gap-1"
            >
              <i className="fa-solid fa-user-gear text-amber-300"></i>
              <span>{isEn ? 'Account' : 'Akun'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Konten Utama Admin */}
      <div className="p-3.5 space-y-3.5 flex-1">
        {/* Sub-Tab Navigation Bar (4 Tab Admin) */}
        <div className="grid grid-cols-4 gap-1 bg-stone-200 p-1 rounded-2xl text-[10px] font-black">
          <button
            type="button"
            onClick={() => setAdminSubTab('orders')}
            className={`tactile-btn py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition ${
              adminSubTab === 'orders'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-clipboard-check"></i>
            <span>Pesanan ({bookings.length})</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNotifTab}
            className={`tactile-btn py-2 px-1 rounded-xl flex items-center justify-center gap-1 relative transition ${
              adminSubTab === 'notifications'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bullhorn"></i>
            <span>Notif & Bot</span>
            {unreadAdminNotifs > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('schedule')}
            className={`tactile-btn py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition ${
              adminSubTab === 'schedule'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-sliders"></i>
            <span>Atur Jam</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('account')}
            className={`tactile-btn py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition ${
              adminSubTab === 'account'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-user-shield"></i>
            <span>Akun</span>
          </button>
        </div>

        {/* =============================================================== */}
        {/* SUB-TAB 1: DAFTAR PESANAN & VERIFIKASI REFUND ADMIN             */}
        {/* =============================================================== */}
        {adminSubTab === 'orders' && (
          <div className="space-y-3 animate-page-enter">
            {/* Penanda Khusus / Alert jika ada pesanan yang Menunggu Cek Refund Admin */}
            {refundPendingCount > 0 && (
              <div className="bg-amber-50 border-2 border-amber-400 p-3.5 rounded-2xl shadow-xs flex items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-sm font-black flex-shrink-0 animate-pulse">
                    <i className="fa-solid fa-rotate-left"></i>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded">
                      Perlu Verifikasi Admin
                    </span>
                    <h3 className="text-xs font-black text-[#0B261C] mt-0.5">
                      {refundPendingCount} Pesanan Menunggu Cek Refund Admin
                    </h3>
                    <p className="text-[10px] text-stone-600 leading-snug">
                      Cek alasan batal, rekening tujuan, dan foto bukti transfer/QRIS di bawah.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOrderFilter(orderFilter === 'refund_pending' ? 'all' : 'refund_pending')
                  }
                  className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black px-3 py-2 rounded-xl text-[10px] whitespace-nowrap shadow-xs"
                >
                  {orderFilter === 'refund_pending' ? 'Lihat Semua' : 'Filter Refund'}
                </button>
              </div>
            )}

            {/* Filter Tab Kelola Pesanan */}
            <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-2xl border border-stone-200 text-[10px] font-black shadow-2xs">
              <button
                type="button"
                onClick={() => setOrderFilter('all')}
                className={`py-2 px-1 rounded-xl transition ${
                  orderFilter === 'all'
                    ? 'bg-[#0B261C] text-[#D4AF37]'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Semua ({bookings.length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('refund_pending')}
                className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1 ${
                  orderFilter === 'refund_pending'
                    ? 'bg-amber-500 text-stone-950'
                    : refundPendingCount > 0
                    ? 'bg-amber-50 text-amber-900 border border-amber-300'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>Cek Refund</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[9px]">
                  {refundPendingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('active')}
                className={`py-2 px-1 rounded-xl transition ${
                  orderFilter === 'active'
                    ? 'bg-[#0B261C] text-[#D4AF37]'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Aktif / Lunas
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('refund_done')}
                className={`py-2 px-1 rounded-xl transition ${
                  orderFilter === 'refund_done'
                    ? 'bg-[#0B261C] text-[#D4AF37]'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Batal / Refund
              </button>
            </div>

            <div className="flex justify-between items-center px-1">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-stone-700">
                Kelola Pesanan & Pengelolaan Refund
              </h2>
              <span className="text-[10px] font-bold text-emerald-800">
                Batal / Refund = Jam Terbuka Kembali
              </span>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 text-center text-stone-500 text-xs">
                Tidak ada pesanan pada filter ini.
              </div>
            ) : (
              filteredBookings.map((b) => {
                const isPaid = isOrderLockedStatus(b);
                const isConfirmedAcc =
                  b.paymentStatus === 'Terkonfirmasi (ACC Admin)' || b.status === 'Verified';
                const isWaitingVerify = b.paymentStatus === 'Menunggu Verifikasi Admin';
                const isCashOrder =
                  b.payMethodType === 'cash' ||
                  b.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ||
                  b.payMethod.toLowerCase().includes('cash') ||
                  b.payMethod.toLowerCase().includes('tempat');
                const isFailed = b.paymentStatus === 'Gagal';
                const isRefundWaiting =
                  b.paymentStatus === 'Menunggu Cek Refund Admin' ||
                  b.status === 'Refund_Requested';
                const isRefundDone =
                  b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
                  b.status === 'Refund_Completed' ||
                  b.status === 'Cancelled';
                const isCompleted = b.status === 'Completed';
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
                        : isConfirmedAcc
                        ? 'border-2 border-emerald-500 bg-emerald-50/20'
                        : isPaid
                        ? 'border-stone-200'
                        : 'border-amber-300 bg-amber-50/30'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-[#0B261C]">{b.customer}</span>
                          <span className="text-[10px] text-stone-500 font-mono">({b.wa})</span>
                        </div>
                        <h3 className="font-extrabold text-xs text-stone-800 mt-0.5">{b.items}</h3>
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          <i className="fa-regular fa-calendar mr-1"></i>
                          <b>{b.datePretty}</b> • Jam{' '}
                          <b className="text-emerald-900">{b.time} WIB</b>
                        </p>
                      </div>

                      {/* Status Pembayaran / Verifikasi / Refund Badge */}
                      <div className="text-right space-y-1">
                        {isRefundWaiting ? (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap animate-pulse">
                            <i className="fa-solid fa-clock-rotate-left text-amber-700"></i>
                            <span>MENUNGGU CEK REFUND ADMIN</span>
                          </span>
                        ) : isRefundDone ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            <i className="fa-solid fa-circle-check text-emerald-700"></i>
                            <span>
                              {b.status === 'Refund_Completed' ? 'REFUND SELESAI' : 'DIBATALKAN'}
                            </span>
                          </span>
                        ) : isConfirmedAcc ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-500 px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            <i className="fa-solid fa-circle-check text-emerald-600"></i>
                            <span>TERKONFIRMASI (ACC ADMIN)</span>
                          </span>
                        ) : isWaitingVerify ? (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap animate-pulse">
                            <i className="fa-solid fa-hourglass-half text-amber-700"></i>
                            <span>MENUNGGU VERIFIKASI ADMIN</span>
                          </span>
                        ) : isCashOrder && isPaid ? (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            <span>💵 BOOKING CASH (BAYAR DI LOKASI)</span>
                          </span>
                        ) : isPaid ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            <i className="fa-solid fa-circle-check text-emerald-600"></i> BAYAR BERHASIL
                          </span>
                        ) : isFailed ? (
                          <span className="text-[9px] font-black bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                            <i className="fa-solid fa-circle-xmark text-red-600"></i> GAGAL
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-400 px-2 py-0.5 rounded-full block whitespace-nowrap">
                            ⏳ PENDING (20m)
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[8px] font-black bg-[#0B261C] text-[#D4AF37] px-2 py-0.5 rounded-full block">
                            ✓ Selesai (+{b.ptsEarned} Pts)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info Metode Pembayaran, Bukti Transfer/QRIS atau Keterangan Cash, & Struk */}
                    <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-stone-600 font-bold">{b.payMethod}</p>
                          {b.vaNumber && (
                            <p className="text-[9px] font-mono text-stone-500">
                              ID/VA: {b.vaNumber}
                            </p>
                          )}
                          <p className="font-black text-emerald-950 text-xs mt-0.5">
                            {formatRupiah(b.total)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onViewReceipt(b)}
                          className="tactile-btn bg-white hover:bg-stone-100 text-[#0B261C] border border-stone-300 font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] shadow-xs flex items-center gap-1"
                        >
                          <i className="fa-solid fa-receipt text-amber-600"></i>
                          <span>Lihat Struk</span>
                        </button>
                      </div>

                      {/* TAMPILAN BUKTI PEMBAYARAN (QRIS/TRANSFER) ATAU KETERANGAN CASH DI TEMPAT */}
                      {isCashOrder ? (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 text-[10px] font-black text-amber-950">
                          <span>💵 Bayar di Tempat (Cash)</span>
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                            Dibayar di Kasir Saat Kedatangan
                          </span>
                        </div>
                      ) : b.paymentProofImage ? (
                        <div className="bg-white p-2 rounded-xl border border-emerald-200 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-[#0B261C] flex items-center gap-1">
                              <i className="fa-solid fa-image text-emerald-700"></i>
                              <span>Bukti Transfer / QRIS Pelanggan:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewProofOrder(b)}
                              className="text-[10px] font-black text-emerald-800 underline"
                            >
                              Perbesar Foto Bukti
                            </button>
                          </div>
                          <div
                            onClick={() => setPreviewProofOrder(b)}
                            className="relative h-28 w-full rounded-lg overflow-hidden bg-stone-900 border border-stone-300 cursor-pointer"
                          >
                            <img
                              src={b.paymentProofImage}
                              alt={`Bukti Bayar ${b.customer}`}
                              className="w-full h-full object-contain"
                            />
                            <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[9px] font-bold px-2 py-0.5 rounded">
                              🔍 Klik untuk Perbesar Bukti
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-[10px] text-stone-600 flex items-center justify-between">
                          <span>Metode: QRIS / Transfer Bank</span>
                          <span className="font-bold text-emerald-800">Cek Mutasi / Struk</span>
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
                    {/* TOMBOL ACC / VERIFIKASI PESANAN & PESAN WA OTOMATIS       */}
                    {/* ========================================================= */}
                    {isPaid && !isRefundWaiting && !isRefundDone && (
                      <div className="bg-emerald-50/90 p-3 rounded-2xl border border-emerald-300 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-user-check text-emerald-700 text-xs"></i>
                            <span>
                              {isConfirmedAcc
                                ? `Status: Terkonfirmasi (ACC Admin)`
                                : `Verifikasi Pesanan & Kirim WA ke ${b.customer}:`}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedConfirmOrderId(isConfirmOpen ? null : b.id)
                            }
                            className="text-[9px] font-extrabold text-emerald-800 underline"
                          >
                            {isConfirmOpen ? 'Tutup Teks WA' : 'Preview Teks WA'}
                          </button>
                        </div>

                        {isConfirmOpen && (
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 space-y-1.5">
                            <p className="text-[10px] text-stone-700 whitespace-pre-line leading-relaxed font-medium">
                              {confirmMsg.text}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                onCopyText(confirmMsg.text, 'Kata-kata Verifikasi ACC WA Pelanggan')
                              }
                              className="tactile-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-1.5 rounded-lg text-[10px]"
                            >
                              <i className="fa-regular fa-copy mr-1"></i>
                              Salin Teks Verifikasi WA
                            </button>
                          </div>
                        )}

                        {!isConfirmedAcc && !isCompleted ? (
                          <a
                            href={confirmMsg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onVerifyPayment(b.id)}
                            className="tactile-btn gold-shimmer-card w-full min-h-[42px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-2.5 px-3 rounded-xl text-xs border border-amber-300 shadow-sm flex items-center justify-center gap-2 text-center"
                          >
                            <i className="fa-solid fa-circle-check text-emerald-900 text-sm"></i>
                            <span>ACC / Verifikasi Pesanan</span>
                          </a>
                        ) : (
                          <div className="flex items-center justify-between gap-2 bg-emerald-100/90 border border-emerald-300 rounded-xl px-2.5 py-2">
                            <span className="text-[10px] font-black text-emerald-950 flex items-center gap-1">
                              <i className="fa-solid fa-circle-check text-emerald-600"></i>
                              <span>Terkonfirmasi (ACC Admin)</span>
                            </span>
                            <a
                              href={confirmMsg.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tactile-btn bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-1.5 px-2.5 rounded-lg text-[10px] flex items-center gap-1 shadow-2xs"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                              <span>Kirim WA ACC</span>
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
                            className="tactile-btn gold-shimmer-card w-full bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] font-black py-2 rounded-xl text-[11px] border border-[#D4AF37]/50 shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-crown text-amber-400"></i>
                            <span>Selesai Treatment & Kirim +{b.ptsEarned} Poin</span>
                          </button>
                        ) : (
                          <div className="text-center text-[10px] font-bold text-emerald-800 bg-emerald-50 py-1.5 rounded-xl border border-emerald-200">
                            ✓ Treatment Selesai • +{b.ptsEarned} Poin Telah Masuk ke Akun Member
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MODAL PREVIEW FOTO BUKTI PEMBAYARAN PELANGGAN (BOOKING / REFUND) */}
        {previewProofOrder &&
          (previewProofOrder.paymentProofImage || previewProofOrder.refundRequest?.proofImage) && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade"
              onClick={() => setPreviewProofOrder(null)}
            >
              <div
                className="bg-white w-full max-w-sm rounded-3xl p-4 space-y-3 shadow-2xl border-2 border-[#D4AF37]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      Bukti Pembayaran Pelanggan ({previewProofOrder.payMethod})
                    </span>
                    <h3 className="text-xs font-black text-[#0B261C] mt-0.5">
                      {previewProofOrder.customer} • {formatRupiah(previewProofOrder.total)}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewProofOrder(null)}
                    className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-black text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-stone-200 bg-stone-950">
                  <img
                    src={
                      previewProofOrder.refundRequest?.proofImage ||
                      previewProofOrder.paymentProofImage
                    }
                    alt="Bukti Transfer Pelanggan"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProofOrder(null)}
                  className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs"
                >
                  Tutup Preview Bukti
                </button>
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
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#D4AF37] text-[#0B261C] px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <i className="fa-solid fa-robot"></i> WA BLAST BOT OTOMATIS
                  </span>
                  <h2 className="text-xs font-black text-white mt-1">
                    Share Promo Griya Ayu ke Semua WA Pelanggan
                  </h2>
                  <p className="text-[10px] text-emerald-200">
                    Kirim promo berupa <b>Teks & Gambar</b> otomatis ke seluruh nomor WA member &
                    bar notifikasi pelanggan.
                  </p>
                </div>
                <span className="text-[10px] font-black bg-white/10 text-amber-300 px-2 py-1 rounded-lg border border-amber-400/30">
                  {storedCustomers.length} Member
                </span>
              </div>

              {/* Pilih Cepat Template Promo Menarik */}
              <div>
                <span className="text-[10px] font-bold text-amber-200 block mb-1">
                  Pilih Cepat Template Promo:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[9px] font-black">
                  {PROMO_TEMPLATES.map((tpl, i) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectPromoPreset(tpl)}
                      className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-200 border border-white/20 py-1.5 px-2 rounded-xl truncate"
                    >
                      🔥 Promo #{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview & Upload Gambar Promo */}
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/15 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-[#D4AF37]">
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
                    className="tactile-btn bg-[#D4AF37] text-[#0B261C] text-[9px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
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
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded">
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
                    className="text-[10px] font-black text-amber-200 block mb-1"
                  >
                    2. Judul Promo:
                  </label>
                  <input
                    id="promoTitleInput"
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white text-stone-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="promoCodeInput"
                    className="text-[10px] font-black text-amber-200 block mb-1"
                  >
                    Kode Promo:
                  </label>
                  <input
                    id="promoCodeInput"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Input Kata-Kata Teks Promo */}
              <div>
                <label
                  htmlFor="promoMessageInput"
                  className="text-[10px] font-black text-amber-200 block mb-1"
                >
                  3. Kata-Kata Teks Promo (Otomatis Dikirim ke WA Pelanggan):
                </label>
                <textarea
                  id="promoMessageInput"
                  rows={4}
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white text-stone-900 text-[11px] font-medium leading-relaxed"
                />
              </div>

              {/* Status Pengiriman Bot Otomatis ke Semua Nomor WA Pelanggan */}
              <div className="bg-black/35 p-2.5 rounded-xl border border-white/10 space-y-1.5">
                <span className="text-[10px] font-black text-emerald-300 block">
                  Daftar Target Bot WA Pelanggan ({storedCustomers.length} Nomor Aktif):
                </span>
                <div className="space-y-1 max-h-28 overflow-y-auto">
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
                        className="flex justify-between items-center bg-white/10 px-2.5 py-1.5 rounded-lg text-[10px]"
                      >
                        <div>
                          <span className="font-bold text-white">{c.name}</span>{' '}
                          <span className="font-mono text-emerald-200">({c.phone})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSent && (
                            <span className="text-[9px] font-black bg-emerald-500 text-stone-950 px-1.5 py-0.5 rounded">
                              ✓ Bot Terkirim
                            </span>
                          )}
                          <a
                            href={singlePromoWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#25D366] text-white font-black px-2 py-0.5 rounded text-[9px] flex items-center gap-1"
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
                className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-yellow-500 text-[#0B261C] font-black py-3 rounded-xl shadow-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2"
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
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-bell text-amber-600"></i>
                  <span>Bar Notifikasi Pembayaran Masuk (Admin)</span>
                </h3>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                  {adminNotifications.length} Notif
                </span>
              </div>

              {adminNotifications.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">
                  Belum ada notifikasi pembayaran baru.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {adminNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-black uppercase bg-emerald-800 text-amber-300 px-2 py-0.5 rounded">
                          🔔 Pembayaran Berhasil & Jam Terkunci
                        </span>
                        <span className="text-[9px] text-stone-500 font-semibold">
                          {n.createdAt}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-[#0B261C]">{n.title}</h4>
                      <p className="text-[11px] text-stone-700 leading-relaxed">{n.message}</p>

                      {n.waConfirmationText && (
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200 space-y-1.5">
                          <span className="text-[9px] font-black text-stone-500 uppercase block">
                            Kata-Kata Konfirmasi Siap Kirim ke WA Pelanggan ({n.customerName}):
                          </span>
                          <p className="text-[10px] text-stone-700 whitespace-pre-line leading-snug">
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
                            className="tactile-btn flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 shadow"
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
                              className="tactile-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold px-3 py-2 rounded-xl text-[10px]"
                            >
                              Salin
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* SUB-TAB 3: ATUR JAM OPERASIONAL & HARI LIBUR                    */}
        {/* =============================================================== */}
        {adminSubTab === 'schedule' && (
          <div className="space-y-3 animate-page-enter">
            {/* 1. Atur Hari Libur Rutin Mingguan */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1">
                  <i className="fa-solid fa-calendar-xmark text-red-600"></i>
                  <span>1. Atur Libur Mingguan</span>
                </h3>
                <span className="text-[9px] font-bold text-stone-500">Klik Hari untuk Ubah</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {dayNames.map((name, idx) => {
                  const isOff = closedWeekdays.includes(idx);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onToggleWeekdayHoliday(idx)}
                      className={`tactile-btn py-1.5 px-2 rounded-xl border text-[11px] font-black transition ${
                        isOff
                          ? 'bg-red-600 text-white border-red-700 shadow-xs'
                          : 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:border-emerald-400'
                      }`}
                    >
                      {name}
                      <span
                        className={`block text-[8px] font-bold ${
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
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2">
              <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1">
                <i className="fa-solid fa-ban text-amber-600"></i>
                <span>2. Liburkan Tanggal Tertentu</span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  min={todayIso}
                  className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomDate}
                  className="tactile-btn bg-[#0B261C] text-[#D4AF37] font-black px-3 py-1.5 rounded-xl text-xs"
                >
                  + Liburkan
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {closedSpecificDates.length > 0 ? (
                  closedSpecificDates.map((dt) => (
                    <span
                      key={dt}
                      className="inline-flex items-center gap-1.5 bg-red-100 text-red-900 border border-red-300 text-[10px] font-black px-2 py-0.5 rounded-lg"
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
                  <span className="text-[10px] text-stone-400">Belum ada tanggal libur khusus.</span>
                )}
              </div>
            </div>

            {/* 3. Buka / Tutup Jam Operasional Tertentu */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
              <div>
                <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1">
                  <i className="fa-regular fa-clock text-emerald-700"></i>
                  <span>3. Buka / Tutup Jam Operasional</span>
                </h3>
              </div>

              <div className="space-y-1.5">
                {masterTimeSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`flex justify-between items-center p-2 rounded-xl border transition ${
                      slot.active
                        ? 'bg-white border-stone-200'
                        : 'bg-stone-100 border-stone-300 opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black ${
                          slot.active ? 'text-[#0B261C]' : 'text-stone-400 line-through'
                        }`}
                      >
                        {slot.time} WIB
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          slot.active
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-stone-300 text-stone-700'
                        }`}
                      >
                        {slot.active ? 'Buka' : 'Tutup (Abu-Abu)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleMasterSlot(slot.time)}
                      className={`tactile-btn px-2.5 py-1 rounded-lg text-[10px] font-black transition ${
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
                  className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddNewSlot}
                  className="tactile-btn bg-emerald-800 hover:bg-emerald-900 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <i className="fa-solid fa-plus"></i> Tambah Jam
                </button>
              </div>
            </div>
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
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>OMZET HARI INI (REAL-TIME)</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-200/90">{todayPretty}</span>
                  </div>

                  <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFF3B0] via-[#D4AF37] to-[#F3E5AB] tracking-tight">
                    {formatRupiah(todayOmzetTotal)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <span className="text-emerald-200 font-bold flex items-center gap-1">
                      <i className="fa-solid fa-circle-check text-emerald-400"></i>
                      <span>{todayVerifiedOrders.length} Pesanan Sukses Terverifikasi Hari Ini</span>
                    </span>
                    {todayWaitingVerifyCount > 0 && (
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-md font-bold text-[9px]">
                        ⏳ {todayWaitingVerifyCount} Menunggu ACC
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. REKAPITULASI OMZET BULANAN & TOMBOL UNDUH EXCEL (CSV) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 block">
                      REKAPITULASI OMZET BULANAN
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-base font-black text-white">
                        {formatRupiah(monthlyOmzetTotal)}
                      </span>
                      <span className="text-[10px] text-stone-300 font-semibold">
                        ({monthlyVerifiedOrders.length} Transaksi • {monthLabelIndo})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="month"
                      aria-label="Pilih Bulan Laporan Omzet"
                      value={selectedMonthPrefix}
                      onChange={(e) =>
                        setSelectedMonthPrefix(e.target.value || getCurrentMonthPrefix())
                      }
                      className="bg-black/40 text-amber-200 border border-[#D4AF37]/50 rounded-xl px-2 py-1 text-[10px] font-bold"
                    />
                  </div>
                </div>

                {/* Rincian Singkat Rekap Bulanan (Collapsible) */}
                {showMonthlyDetails && (
                  <div className="bg-black/35 rounded-xl border border-white/15 p-2.5 space-y-1.5 max-h-44 overflow-y-auto text-[10px]">
                    <div className="flex justify-between items-center text-[9px] font-black text-amber-300 border-b border-white/10 pb-1">
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
                          <div className="min-w-0">
                            <p className="font-black text-white truncate">
                              {item.datePretty} • {item.customer}
                            </p>
                            <p className="text-[9px] text-emerald-200 truncate">{item.items}</p>
                            <p className="text-[9px] text-stone-400">{item.payMethod}</p>
                          </div>
                          <span className="font-black text-[#D4AF37] whitespace-nowrap">
                            {formatRupiah(item.total)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Baris Tombol Unduh Laporan Bulanan (Excel/CSV) & Toggle Rincian */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadMonthlyCsv}
                    className="tactile-btn gold-shimmer-card flex-1 min-h-[42px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#071A12] font-black py-2.5 px-3 rounded-xl text-[11px] border border-amber-200 shadow-md flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-file-excel text-emerald-950 text-sm"></i>
                    <span>Unduh Laporan Bulanan (Excel/CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMonthlyDetails((prev) => !prev)}
                    className="tactile-btn bg-white/10 hover:bg-white/20 text-amber-200 border border-white/20 font-bold px-3 py-2 rounded-xl text-[10px] whitespace-nowrap"
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
              language={language}
              onChangeLanguage={onChangeLanguage}
              onUpdateUser={onUpdateUser}
              onViewReceipt={onViewReceipt}
              onLogout={onLogout}
              onShowToast={onShowToast}
            />
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION KHUSUS ADMIN (4 MENU ADMIN) */}
      <nav
        aria-label="Navigasi Admin"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-stone-900 text-stone-400 border-t-2 border-[#D4AF37]/50 grid grid-cols-4 py-1.5 px-2 text-[10px] font-bold z-40 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setAdminSubTab('orders')}
          className={`tactile-btn flex flex-col items-center justify-center gap-1 relative py-1.5 rounded-xl transition ${
            adminSubTab === 'orders'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-clipboard-check text-sm"></i>
          <span>{isEn ? 'Orders' : 'Pesanan'}</span>
          {paidUnverifiedCount > 0 && (
            <span className="absolute top-0.5 right-3 bg-emerald-500 text-stone-950 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {paidUnverifiedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleOpenNotifTab}
          className={`tactile-btn flex flex-col items-center justify-center gap-1 relative py-1.5 rounded-xl transition ${
            adminSubTab === 'notifications'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-bullhorn text-sm"></i>
          <span>Notif & Promo</span>
          {unreadAdminNotifs > 0 && (
            <span className="absolute top-0.5 right-3 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadAdminNotifs}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('schedule')}
          className={`tactile-btn flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition ${
            adminSubTab === 'schedule'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-calendar-day text-sm"></i>
          <span>{isEn ? 'Schedule' : 'Atur Jam'}</span>
        </button>
        <button
          type="button"
          onClick={() => setAdminSubTab('account')}
          className={`tactile-btn flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition ${
            adminSubTab === 'account'
              ? 'text-[#D4AF37] bg-[#D4AF37]/15 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <i className="fa-solid fa-user-shield text-sm"></i>
          <span>{isEn ? 'Account' : 'Akun Admin'}</span>
        </button>
      </nav>
    </div>
  );
};
