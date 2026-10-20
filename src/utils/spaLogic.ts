import type {
  ServiceItem,
  PointReward,
  BookingOrder,
  TimeSlot,
  User,
  PaymentMethodType,
} from '../types/index.ts';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('IDR', 'Rp')
    .trim();
}

export function formatDatePretty(date: Date): string {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dayIdx = date.getDay();
  return `${days[dayIdx]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00:00';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GRIYA_AYU_BANK_ACCOUNTS = [
  {
    id: 'bca',
    bankName: 'BANK BCA',
    accountNumber: '7390881234',
    accountNumberFormatted: '7390 8812 34',
    accountHolder: 'Griya Ayu / Rismawati',
  },
  {
    id: 'mandiri',
    bankName: 'BANK MANDIRI',
    accountNumber: '1560012889912',
    accountNumberFormatted: '1560 0128 8991 2',
    accountHolder: 'Griya Ayu / Rismawati',
  },
] as const;

export const GRIYA_AYU_LOGO_IMAGE = '/assets/aistudio/image_002cb314.png';
export const GRIYA_AYU_QRIS_IMAGE = '/assets/aistudio/image_2c1d837f.png';
export const GRIYA_AYU_QRIS_NMID = 'ID1026618031821';
export const GRIYA_AYU_QRIS_MERCHANT = 'ADMIN GRIYA AYU SPA';

export function getPaymentMethodDetails(
  methodType: PaymentMethodType,
  customerPhone: string = '081288997766'
): {
  label: string;
  shortBank: string;
  vaNumber: string;
  isQris: boolean;
  isCash: boolean;
} {
  const cleanDigits = customerPhone.replace(/[^0-9]/g, '').slice(-10) || '8518311039';
  switch (methodType) {
    case 'qris':
      return {
        label: 'QRIS Griya Ayu (GoPay / M-Banking / E-Wallet)',
        shortBank: 'QRIS ADMIN GRIYA AYU SPA',
        vaNumber: 'ID1026618031821',
        isQris: true,
        isCash: false,
      };
    case 'bank_transfer':
      return {
        label: 'Transfer Bank (BCA / Mandiri a.n. Griya Ayu / Rismawati)',
        shortBank: 'TRANSFER BANK (BCA / MANDIRI)',
        vaNumber: 'BCA 7390881234 / Mandiri 1560012889912',
        isQris: false,
        isCash: false,
      };
    case 'cash':
      return {
        label: 'Cash / Bayar di Tempat (Saat Kedatangan)',
        shortBank: 'CASH / BAYAR DI TEMPAT',
        vaNumber: 'Bayar Tunai di Kasir Griya Ayu',
        isQris: false,
        isCash: true,
      };
    case 'va_bca':
      return {
        label: 'Transfer Bank BCA (a.n. Griya Ayu / Rismawati)',
        shortBank: 'BANK BCA',
        vaNumber: '7390 8812 34',
        isQris: false,
        isCash: false,
      };
    case 'va_mandiri':
      return {
        label: 'Transfer Bank Mandiri (a.n. Griya Ayu / Rismawati)',
        shortBank: 'BANK MANDIRI',
        vaNumber: '1560 0128 8991 2',
        isQris: false,
        isCash: false,
      };
    case 'va_bri':
      return {
        label: 'BRI Virtual Account (BRIVA)',
        shortBank: 'BANK BRI (BRIVA)',
        vaNumber: `8881 ${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4)}`,
        isQris: false,
        isCash: false,
      };
    case 'va_bni':
      return {
        label: 'BNI Virtual Account',
        shortBank: 'BANK BNI (VA)',
        vaNumber: `8241 ${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4)}`,
        isQris: false,
        isCash: false,
      };
  }
}

export const GRIYA_AYU_ADDRESS = 'PERUMAHAN GRAHA CIPTA 5 BLOK E7 NO.3';
export const GRIYA_AYU_MAPS_URL = 'https://maps.app.goo.gl/CZY9eDC922v1byZQA';

export function isOrderLockedStatus(order: BookingOrder): boolean {
  return (
    order.paymentStatus === 'Berhasil' ||
    order.paymentStatus === 'Menunggu Verifikasi Admin' ||
    order.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ||
    order.paymentStatus === 'Terkonfirmasi (ACC Admin)'
  );
}

export function getTodayIso(nowMs: number = Date.now()): string {
  const now = new Date(nowMs);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeHm(nowMs: number = Date.now()): string {
  const now = new Date(nowMs);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Mengecek apakah suatu tanggal (YYYY-MM-DD) sudah terlewat dibandingkan hari ini.
 */
export function isDatePast(dateIso: string, nowMs: number = Date.now()): boolean {
  const todayIso = getTodayIso(nowMs);
  return dateIso < todayIso;
}

/**
 * Mengecek apakah slot jam pada tanggal tertentu sudah terlewat dibandingkan waktu saat ini.
 * Jika tanggal < hari ini -> otomatis terlewat.
 * Jika tanggal === hari ini -> cek apakah jam:menit slot <= jam:menit sekarang.
 */
export function isTimeSlotPast(
  dateIso: string,
  timeStr: string,
  nowMs: number = Date.now()
): boolean {
  const todayIso = getTodayIso(nowMs);
  if (dateIso < todayIso) return true;
  if (dateIso > todayIso) return false;

  const [slotH, slotM] = timeStr.split(':').map(Number);
  const slotMinutes = (slotH || 0) * 60 + (slotM || 0);

  const now = new Date(nowMs);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return slotMinutes <= currentMinutes;
}

export function getCurrentMonthPrefix(nowMs: number = Date.now()): string {
  const now = new Date(nowMs);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthYearIndo(monthPrefix: string): string {
  const [y, m] = monthPrefix.split('-');
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const mIdx = Math.max(0, Math.min(11, parseInt(m || '10', 10) - 1));
  return `${months[mIdx]} ${y || '2026'}`;
}

/**
 * Mengecek apakah pesanan merupakan pendapatan yang sah / sukses terverifikasi
 * (Bukan batal, bukan refund, bukan gagal/pending).
 */
export function isVerifiedRevenueOrder(order: BookingOrder): boolean {
  if (
    order.status === 'Cancelled' ||
    order.status === 'Refund_Requested' ||
    order.status === 'Refund_Completed' ||
    order.paymentStatus === 'Refund Selesai / Dibatalkan' ||
    order.paymentStatus === 'Menunggu Cek Refund Admin' ||
    order.paymentStatus === 'Gagal' ||
    order.paymentStatus === 'Kedaluwarsa' ||
    order.paymentStatus === 'Pending'
  ) {
    return false;
  }
  return (
    order.paymentStatus === 'Terkonfirmasi (ACC Admin)' ||
    order.paymentStatus === 'Berhasil' ||
    order.status === 'Verified' ||
    order.status === 'Completed'
  );
}

export function isTodayRevenueOrder(order: BookingOrder, todayIso: string = getTodayIso()): boolean {
  if (!isVerifiedRevenueOrder(order)) return false;
  return order.date === todayIso || order.verifiedDateIso === todayIso;
}

export function isMonthRevenueOrder(
  order: BookingOrder,
  monthPrefix: string = getCurrentMonthPrefix()
): boolean {
  if (!isVerifiedRevenueOrder(order)) return false;
  return (
    order.date.startsWith(monthPrefix) ||
    Boolean(order.verifiedDateIso && order.verifiedDateIso.startsWith(monthPrefix))
  );
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function downloadMonthlyRevenueCsv(
  orders: BookingOrder[],
  monthPrefix: string = getCurrentMonthPrefix()
): void {
  const monthLabel = formatMonthYearIndo(monthPrefix);
  const sorted = [...orders].sort((a, b) => {
    const dCmp = a.date.localeCompare(b.date);
    if (dCmp !== 0) return dCmp;
    return a.time.localeCompare(b.time);
  });

  const totalOmzet = sorted.reduce((sum, item) => sum + item.total, 0);

  const headers = [
    'No',
    'ID Booking',
    'Tanggal',
    'Jam (WIB)',
    'Nama Pelanggan',
    'No. WhatsApp',
    'Layanan',
    'Metode Pembayaran',
    'Status Verifikasi',
    'Nominal Omzet (Rp)',
    'Nominal Terformat',
  ];

  const rows: string[] = [];
  rows.push(
    `"LAPORAN OMZET BULANAN GRIYA AYU SPORT MASSAGE & SPA — PERIODE ${monthLabel.toUpperCase()}"`
  );
  rows.push(`"Dicetak pada: ${new Date().toLocaleString('id-ID')}","Total Transaksi: ${sorted.length}","Total Omzet: ${formatRupiah(totalOmzet)}"`);
  rows.push('');
  rows.push(headers.map(escapeCsvCell).join(','));

  if (sorted.length === 0) {
    rows.push(
      [
        '-',
        '-',
        monthPrefix,
        '-',
        'Belum ada transaksi terverifikasi pada bulan ini',
        '-',
        '-',
        '-',
        '-',
        0,
        'Rp 0',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  } else {
    sorted.forEach((order, idx) => {
      rows.push(
        [
          idx + 1,
          `GA-${String(order.id).slice(-6)}`,
          `${order.date} (${order.datePretty})`,
          `${order.time} WIB`,
          order.customer,
          order.wa,
          order.items,
          order.payMethod,
          order.paymentStatus,
          order.total,
          formatRupiah(order.total),
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });
  }

  rows.push('');
  rows.push(
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL OMZET BULANAN',
      totalOmzet,
      formatRupiah(totalOmzet),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  // Gunakan UTF-8 BOM (\uFEFF) agar langsung rapi saat dibuka di Microsoft Excel
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Laporan_Omzet_Bulanan_Griya_Ayu_${monthPrefix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pesan WhatsApp otomatis dari Pelanggan ke Admin (di Struk Digital & Selesai Booking)
 */
export function buildCustomerBookingWaToAdminMessage(order: BookingOrder): {
  text: string;
  url: string;
} {
  const invoiceCode = `GA-${String(order.id).slice(-6)}`;
  const methodLabel =
    order.payMethodType === 'qris'
      ? 'QRIS'
      : order.payMethodType === 'cash'
      ? 'Cash / Bayar di Tempat'
      : 'Transfer Bank (BCA / Mandiri)';

  const text =
    `*BUKTI BOOKING JADWAL - GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `----------------------------------------\n` +
    `🧾 *Nomor Transaksi:* #${invoiceCode}\n` +
    `👤 *Nama:* ${order.customer}\n` +
    `💆‍♀️ *Layanan:* ${order.items}\n` +
    `📅 *Tanggal & Jam:* ${order.datePretty} • Jam ${order.time} WIB\n` +
    `💳 *Metode Pembayaran:* ${methodLabel} (${formatRupiah(order.total)})\n` +
    `📌 *Status:* ${order.paymentStatus}\n` +
    `----------------------------------------\n` +
    `Halo Admin Griya Ayu, saya sudah melakukan booking jadwal melalui aplikasi. Mohon dicek dan dikonfirmasi ya, terima kasih!`;

  return {
    text,
    url: `https://wa.me/6285183110392?text=${encodeURIComponent(text)}`,
  };
}

/**
 * Pesan WhatsApp otomatis dari Admin ke Pelanggan saat klik "ACC / Verifikasi Pesanan"
 */
export function buildAdminWaConfirmationMessage(order: BookingOrder): {
  text: string;
  url: string;
} {
  const rawPhone = order.wa.replace(/[^0-9]/g, '');
  const waTarget = rawPhone.startsWith('0')
    ? '62' + rawPhone.slice(1)
    : rawPhone.startsWith('62')
    ? rawPhone
    : '62' + rawPhone;

  const methodShort =
    order.payMethodType === 'qris'
      ? 'QRIS'
      : order.payMethodType === 'cash'
      ? 'Cash / Bayar di Tempat'
      : 'Transfer Bank';

  const text = `Halo Kak ${order.customer}, pesanan Anda di GRIYA AYU SPORT MASSAGE & SPA untuk tanggal ${order.datePretty} jam ${order.time} WIB dengan metode ${methodShort} sudah kami VERIFIKASI / ACC. Jadwal Anda sudah terkunci. Kami tunggu kedatangannya di Griya Ayu (Perumahan Graha Cipta 5 Blok E7 No.3) maksimal 10 menit sebelum jadwal ya. Terima kasih!`;

  const url = `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`;
  return { text, url };
}

export function calculateOrderPricing(
  mode: 'single' | 'package',
  chosenSingleIds: string[],
  chosenPackageId: string,
  singleCatalog: ServiceItem[],
  packageCatalog: ServiceItem[],
  chosenRewardId: string,
  pointRewards: PointReward[],
  customerPoints: number,
  injurySpot?: string
): {
  titleStr: string;
  subtotal: number;
  pts: number;
  rewardObj: PointReward;
  finalPrice: number;
  discountAmount: number;
} {
  const titles: string[] = [];
  let subtotal = 0;
  let pts = 0;

  if (mode === 'single') {
    chosenSingleIds.forEach((id) => {
      const s = singleCatalog.find((item) => item.id === id);
      if (s) {
        if ((id === 's2' || id === 's4') && injurySpot) {
          titles.push(`${s.name} [${injurySpot}]`);
        } else {
          titles.push(s.name);
        }
        subtotal += s.price;
        pts += s.points;
      }
    });
  } else {
    const p = packageCatalog.find((item) => item.id === chosenPackageId);
    if (p) {
      titles.push(p.name);
      subtotal += p.price;
      pts += p.points;
    }
  }

  const foundReward = pointRewards.find((r) => r.id === chosenRewardId);
  const rewardObj =
    foundReward && customerPoints >= foundReward.cost ? foundReward : pointRewards[0];

  // Poin tidak digunakan untuk potongan harga (discountAmount = 0), melainkan bonus Micro-Rewards
  const discountAmount = 0;
  const finalPrice = subtotal;

  if (rewardObj && rewardObj.cost > 0) {
    titles.push(`[Bonus Tukar ${rewardObj.cost} Poin: ${rewardObj.label}]`);
  }

  return {
    titleStr: titles.length > 0 ? titles.join(' + ') : 'Belum memilih layanan',
    subtotal,
    pts,
    rewardObj,
    finalPrice,
    discountAmount,
  };
}

export function isDateHoliday(
  dateIso: string,
  dayOfWeek: number,
  closedWeekdays: number[],
  closedSpecificDates: string[]
): boolean {
  return closedWeekdays.includes(dayOfWeek) || closedSpecificDates.includes(dateIso);
}

/**
 * Slot jam terkunci (abu-abu) apabila:
 * 1) Tanggal atau jam sudah terlewat ('past')
 * 2) Ditutup oleh Admin ('closed')
 * 3) Sudah dibooking pelanggan lain ('booked')
 */
export function isSlotAvailable(
  time: string,
  dateIso: string,
  masterSlots: TimeSlot[],
  bookings: BookingOrder[],
  nowMs: number = Date.now()
): { available: boolean; reason: 'available' | 'booked' | 'closed' | 'past' } {
  if (isTimeSlotPast(dateIso, time, nowMs)) {
    return { available: false, reason: 'past' };
  }

  const slotSetting = masterSlots.find((s) => s.time === time);
  if (!slotSetting || !slotSetting.active) {
    return { available: false, reason: 'closed' };
  }

  const isBooked = bookings.some(
    (b) =>
      b.date === dateIso &&
      b.time === time &&
      (isOrderLockedStatus(b) || b.paymentStatus === 'Menunggu Cek Refund Admin') &&
      b.status !== 'Cancelled' &&
      b.status !== 'Refund_Completed' &&
      b.status !== 'Pending_Payment'
  );

  if (isBooked) {
    return { available: false, reason: 'booked' };
  }

  return { available: true, reason: 'available' };
}

/**
 * Mengecek apakah pesanan masih memenuhi batas waktu minimal 1 jam (>= 60 menit) sebelum jadwal SPA dimulai.
 */
export function checkBookingRefundEligibility(
  dateIso: string,
  timeStr: string,
  nowMs: number = Date.now()
): {
  canRefund: boolean;
  diffMinutes: number;
  remainingLabel: string;
} {
  const [yyyy, mm, dd] = dateIso.split('-').map(Number);
  const [hh, min] = timeStr.split(':').map(Number);

  const realNow = new Date(nowMs);
  const targetDate = new Date(
    yyyy || realNow.getFullYear(),
    (mm || realNow.getMonth() + 1) - 1,
    dd || realNow.getDate(),
    hh || 0,
    min || 0,
    0
  );
  const diffMs = targetDate.getTime() - realNow.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) {
    return {
      canRefund: false,
      diffMinutes,
      remainingLabel:
        diffMinutes <= 0
          ? 'Jadwal sudah lewat / sedang berlangsung'
          : `Tinggal ${diffMinutes} menit lagi (< 1 jam)`,
    };
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const remainingLabel =
    hours >= 24
      ? `${Math.floor(hours / 24)} hari ${hours % 24} jam lagi`
      : `${hours} jam ${mins} menit lagi`;

  return {
    canRefund: true,
    diffMinutes,
    remainingLabel,
  };
}

export function buildCustomerToAdminRefundWaMessage(order: BookingOrder): string {
  const invoiceCode = `GA-${String(order.id).slice(-6)}`;
  const req = order.refundRequest;
  const isCash = order.payMethodType === 'cash' || req?.isCashCancellation;

  const text =
    `*PENGAJUAN PEMBATALAN & REFUND - GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `----------------------------------------\n` +
    `🧾 *No. Struk:* #${invoiceCode}\n` +
    `👤 *Nama Pelanggan:* ${order.customer}\n` +
    `📱 *No. WA:* ${order.wa}\n` +
    `💆‍♀️ *Layanan:* ${order.items}\n` +
    `📅 *Jadwal Sesi:* ${order.datePretty} • Jam ${order.time} WIB\n` +
    `💳 *Metode Awal:* ${order.payMethod}\n` +
    `💰 *Nominal:* ${formatRupiah(order.total)}\n\n` +
    `📝 *DETAIL PENGAJUAN ${isCash ? 'PEMBATALAN' : 'REFUND'}:*\n` +
    `• *Alasan Batal:* ${req?.reason || '-'}\n` +
    (isCash
      ? `• *Keterangan:* Pembatalan pesanan Cash / Bayar di Tempat\n`
      : `• *Bank / E-Wallet Tujuan Refund:* ${req?.bankName || '-'}\n` +
        `• *No. Rekening / E-Wallet:* ${req?.accountNumber || '-'}\n` +
        `• *Atas Nama:* ${req?.accountHolder || '-'}\n` +
        `• *Bukti TF/QRIS Awal:* Sudah diunggah di aplikasi\n`) +
    `----------------------------------------\n` +
    `Halo Admin Griya Ayu, saya mengajukan ${
      isCash ? 'pembatalan jadwal' : 'pembatalan & pengembalian dana (refund)'
    } untuk pesanan di atas (diajukan > 1 jam sebelum jadwal). Mohon dicek ya, terima kasih! 🙏`;

  return `https://wa.me/6285183110392?text=${encodeURIComponent(text)}`;
}

export function buildAdminApproveRefundWaMessage(order: BookingOrder): {
  text: string;
  url: string;
} {
  const invoiceCode = `GA-${String(order.id).slice(-6)}`;
  const rawPhone = order.wa.replace(/[^0-9]/g, '');
  const waTarget = rawPhone.startsWith('0')
    ? '62' + rawPhone.slice(1)
    : rawPhone.startsWith('62')
    ? rawPhone
    : '62' + rawPhone;

  const req = order.refundRequest;
  const isCash = order.payMethodType === 'cash' || req?.isCashCancellation;

  const text =
    `Halo Kak *${order.customer}* 🙏✨\n` +
    `Kami dari *Admin Griya Ayu Sport Massage & Spa* mengabarkan bahwa pengajuan *${
      isCash ? 'Pembatalan Jadwal' : 'Pembatalan & Refund Dana'
    }* Kakak telah *DISETUJUI & SELESAI DIPROSES*:\n\n` +
    `🧾 *No. Struk:* #${invoiceCode}\n` +
    `💆‍♀️ *Layanan:* ${order.items}\n` +
    `📅 *Jadwal yang Dibatalkan:* ${order.datePretty} • Jam ${order.time} WIB\n` +
    (isCash
      ? `📌 *Status:* Jadwal telah resmi dibatalkan.\n\n`
      : `💰 *Nominal Refund:* ${formatRupiah(order.total)}\n` +
        `🏦 *Rekening Tujuan:* ${req?.bankName || '-'} - ${req?.accountNumber || '-'} (a.n. ${
          req?.accountHolder || order.customer
        })\n` +
        `✅ *Status Dana:* Dana refund telah kami proses/transfer kembali ke rekening Kakak.\n\n`) +
    `Terima kasih atas konfirmasinya. Kami tunggu reservasi Kakak di waktu berikutnya ya! Sehat selalu 🌿✨`;

  return {
    text,
    url: `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`,
  };
}

export function buildAdminRejectRefundWaMessage(
  order: BookingOrder,
  rejectReason: string = 'Bukti pembayaran tidak ditemukan pada mutasi rekening atau tidak sesuai.'
): {
  text: string;
  url: string;
} {
  const invoiceCode = `GA-${String(order.id).slice(-6)}`;
  const rawPhone = order.wa.replace(/[^0-9]/g, '');
  const waTarget = rawPhone.startsWith('0')
    ? '62' + rawPhone.slice(1)
    : rawPhone.startsWith('62')
    ? rawPhone
    : '62' + rawPhone;

  const text =
    `Halo Kak *${order.customer}* 🙏\n` +
    `Kami dari *Admin Griya Ayu Sport Massage & Spa* menginformasikan bahwa pengajuan refund untuk pesanan *#${invoiceCode}* (${order.datePretty} • Jam ${order.time} WIB) *BELUM DAPAT KAMI SETUJUI / DITOLAK*.\n\n` +
    `📌 *Catatan Admin:* ${rejectReason}\n\n` +
    `Jadwal sesi Kakak masih tetap aktif. Silakan hubungi kami atau kirimkan bukti mutasi pembayaran yang valid melalui WhatsApp ini. Terima kasih.`;

  return {
    text,
    url: `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`,
  };
}

export function applyPointsCompletion(customer: User, pointsEarned: number): User {
  return {
    ...customer,
    points: customer.points + pointsEarned,
  };
}

