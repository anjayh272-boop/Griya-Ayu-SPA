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
    accountNumber: '7285780985',
    accountNumberFormatted: '7285780985',
    accountHolder: 'KARTINI',
  },
  {
    id: 'mandiri',
    bankName: 'BANK MANDIRI',
    accountNumber: '1560010933630',
    accountNumberFormatted: '1560010933630',
    accountHolder: 'KARTINI',
  },
] as const;

export const GRIYA_AYU_LOGO_IMAGE = '/assets/aistudio/image_002cb314.png';
export const GRIYA_AYU_QRIS_IMAGE = '/assets/aistudio/image_2c1d837f.png';
export const GRIYA_AYU_QRIS_NMID = 'ID1026618031821';
export const GRIYA_AYU_QRIS_MERCHANT = 'ADMIN GRIYA AYU SPA';

export const GRIYA_AYU_ADMIN_PHONE = '087765573476';
export const GRIYA_AYU_ADMIN_PHONE_DISPLAY = '0877-6557-3476';
export const GRIYA_AYU_ADMIN_WA = '6287765573476';

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
  const cleanDigits = customerPhone.replace(/[^0-9]/g, '').slice(-10) || '8776557347';
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
        label: 'Transfer Bank (BCA / Mandiri a.n. KARTINI)',
        shortBank: 'TRANSFER BANK (BCA / MANDIRI)',
        vaNumber: 'BCA 7285780985 / Mandiri 1560010933630 (a.n. KARTINI)',
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
        label: 'Transfer Bank BCA (a.n. KARTINI)',
        shortBank: 'BANK BCA',
        vaNumber: '7285780985',
        isQris: false,
        isCash: false,
      };
    case 'va_mandiri':
      return {
        label: 'Transfer Bank Mandiri (a.n. KARTINI)',
        shortBank: 'BANK MANDIRI',
        vaNumber: '1560010933630',
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
    order.paymentStatus === 'Lunas' ||
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
  const isCash =
    order.payMethodType === 'cash' ||
    order.paymentStatus === 'Booking Cash (Bayar di Lokasi)';
  if (!isCash && order.paymentStatus === 'Menunggu Verifikasi Admin') {
    return true;
  }
  return (
    order.paymentStatus === 'Lunas' ||
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
    url: `https://wa.me/6287765573476?text=${encodeURIComponent(text)}`,
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
  injurySpot?: string | Record<string, string[]>
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
          if (typeof injurySpot === 'string') {
            titles.push(`${s.name} [${injurySpot}]`);
          } else {
            const spots = injurySpot[id];
            if (spots && spots.length > 0) {
              titles.push(`${s.name} [${spots.join(', ')}]`);
            } else {
              titles.push(s.name);
            }
          }
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

  const fallbackNoneReward: PointReward = {
    id: 'none',
    title: 'Simpan Poin (Tabung Poin Loyalitas)',
    label: 'Simpan Poin (Tabung Poin Loyalitas)',
    cost: 0,
    cut: 0,
    available: true,
  };
  const foundReward =
    chosenRewardId && chosenRewardId !== 'none'
      ? pointRewards.find((r) => r.id === chosenRewardId && r.available !== false)
      : undefined;
  const rewardObj =
    foundReward && customerPoints >= foundReward.cost
      ? foundReward
      : pointRewards.find((r) => r.id === 'none') || fallbackNoneReward;

  // Poin tidak digunakan untuk potongan harga (discountAmount = 0), melainkan bonus Micro-Rewards
  const discountAmount = 0;
  const finalPrice = subtotal;

  if (rewardObj && rewardObj.cost > 0) {
    titles.push(`[Bonus Tukar ${rewardObj.cost} Poin: ${rewardObj.title || rewardObj.label}]`);
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
 * Catatan: Begitu pesanan dibatalkan atau diajukan refund ('Cancelled', 'Refund_Requested', 'Refund_Completed'),
 * slot jam langsung kembali TIDAK TERKUNCI (terbuka kembali untuk pelanggan lain).
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
      isOrderLockedStatus(b) &&
      b.status !== 'Cancelled' &&
      b.status !== 'Refund_Requested' &&
      b.status !== 'Refund_Completed' &&
      b.paymentStatus !== 'Menunggu Cek Refund Admin' &&
      b.paymentStatus !== 'Refund Selesai / Dibatalkan' &&
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

  const text = isCash
    ? `Halo Admin Griya Ayu, saya ingin mengonfirmasi pembatalan booking *#${invoiceCode}* (${order.items} pada ${order.datePretty} • Jam ${order.time} WIB).\n\n` +
      `• *Nama Pelanggan:* ${order.customer}\n` +
      `• *Alasan Pembatalan:* ${req?.reason || '-'}\n` +
      `• *Metode:* Cash / Bayar di Tempat\n\n` +
      `Jadwal jam ${order.time} WIB telah saya batalkan (> 1 jam sebelum sesi). Terima kasih.`
    : `Halo Admin Griya Ayu, saya ingin mengajukan refund untuk pembatalan booking *#${invoiceCode}* ke nomor rekening *${req?.bankName || 'Bank/E-Wallet'} ${req?.accountNumber || '-'}* (a.n. *${req?.accountHolder || order.customer}*).\n\n` +
      `*RINCIAN PEMBATALAN & REFUND:*\n` +
      `----------------------------------------\n` +
      `🧾 *ID Pesanan:* #${invoiceCode}\n` +
      `👤 *Nama Pelanggan:* ${order.customer} (${order.wa})\n` +
      `💆‍♀️ *Layanan:* ${order.items}\n` +
      `📅 *Jadwal yang Dibatalkan:* ${order.datePretty} • Jam ${order.time} WIB\n` +
      `💳 *Metode Pembayaran Awal:* ${order.payMethod}\n` +
      `💰 *Nominal Refund:* ${formatRupiah(order.total)}\n` +
      `🏦 *Tujuan Refund:* ${req?.bankName || '-'} - ${req?.accountNumber || '-'} (a.n. ${req?.accountHolder || order.customer})\n` +
      `📝 *Alasan Pembatalan:* ${req?.reason || '-'}\n` +
      `----------------------------------------\n` +
      `Mohon dibantu proses pengembalian dananya ya Admin. Terima kasih! 🙏`;

  return `https://wa.me/6287765573476?text=${encodeURIComponent(text)}`;
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

// ============================================================================
// SISTEM PENYIMPANAN LOCALSTORAGE PERSISTENCE & PROTEKSI DATA OMZET / ADMIN
// ============================================================================

export const STORAGE_KEYS = {
  CUSTOMERS: 'griya_ayu_customers_live',
  BOOKINGS: 'griya_ayu_bookings_live',
  OMZET_LEDGER: 'griya_ayu_omzet_ledger_live',
  NOTIFICATIONS: 'griya_ayu_notifications_live',
  SLOTS: 'griya_ayu_slots_live',
  POINT_REWARDS: 'griya_ayu_point_rewards_live',
  CLOSED_WEEKDAYS: 'griya_ayu_closed_weekdays_live',
  CLOSED_DATES: 'griya_ayu_closed_dates_live',
  ADMIN_PROFILE: 'griya_ayu_admin_profile',
  ACTIVE_SESSION: 'griya_ayu_active_session',
  FONNTE_TOKEN: 'griya_ayu_fonnte_token_live',
  LANG: 'griya_ayu_lang',
} as const;

export const DEFAULT_FONNTE_TOKEN = 'f3iKmRXKoigZnWbLRGX4';

export function getFonnteToken(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FONNTE_TOKEN);
    const cleaned = (saved || '').replace(/[[\]\s]/g, '').trim();
    return cleaned || DEFAULT_FONNTE_TOKEN;
  } catch {
    return DEFAULT_FONNTE_TOKEN;
  }
}

export function saveFonnteToken(token: string): string {
  const cleaned = (token || '').replace(/[[\]\s]/g, '').trim() || DEFAULT_FONNTE_TOKEN;
  try {
    localStorage.setItem(STORAGE_KEYS.FONNTE_TOKEN, cleaned);
  } catch {
    // ignore
  }
  return cleaned;
}

/**
 * Mengirim kode OTP 6 digit langsung ke WhatsApp pelanggan secara real-time melalui API Fonnte.
 */
export async function sendFonnteOtpWhatsApp(
  targetPhone: string,
  otpCode: string
): Promise<{ ok: boolean; detail: string }> {
  const token = getFonnteToken();
  const cleanTarget = targetPhone.replace(/[^0-9]/g, '');
  const message = `*GRIYA AYU SPA*\n\nKode OTP verifikasi Anda adalah: *${otpCode}*\nJangan berikan kode ini kepada siapa pun.`;

  const formData = new FormData();
  formData.append('target', cleanTarget);
  formData.append('message', message);
  formData.append('countryCode', '62');

  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: token,
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || (data && data.status === false)) {
    return {
      ok: false,
      detail:
        data?.reason ||
        data?.detail ||
        'Gagal mengirim Kode OTP ke WhatsApp. Pastikan perangkat WhatsApp Fonnte terhubung.',
    };
  }

  return {
    ok: true,
    detail: 'Kode OTP telah dikirim ke WhatsApp Anda!',
  };
}

export function safeLoadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeSaveJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function normalizePhoneDigits(phone: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('62')) {
    return '0' + digits.slice(2);
  }
  return digits;
}

/**
 * Memuat daftar akun pelanggan dari localStorage tanpa pernah mereset data yang sudah ada.
 */
export function loadCustomersPersistently(fallback: User[] = []): User[] {
  const live = safeLoadJson<User[] | null>(STORAGE_KEYS.CUSTOMERS, null);
  if (Array.isArray(live)) {
    return live;
  }
  return fallback;
}

/**
 * Menyimpan daftar akun pelanggan ke localStorage.
 */
export function saveCustomersPersistently(customers: User[]): void {
  safeSaveJson(STORAGE_KEYS.CUSTOMERS, customers);
}

/**
 * Memuat riwayat booking & menggabungkannya dengan cadangan buku besar omzet (omzet ledger)
 * agar data transaksi terverifikasi (omzet harian & bulanan) tidak pernah hilang.
 */
export function loadBookingsPersistently(fallback: BookingOrder[] = []): BookingOrder[] {
  const mainList = safeLoadJson<BookingOrder[] | null>(STORAGE_KEYS.BOOKINGS, null);
  const ledgerList = safeLoadJson<BookingOrder[] | null>(STORAGE_KEYS.OMZET_LEDGER, null);

  const normalizeNonCashLunas = (b: BookingOrder): BookingOrder => {
    if (!b) return b;
    const isCash =
      b.payMethodType === 'cash' ||
      b.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ||
      (b.payMethod || '').toLowerCase().includes('cash');
    if (
      !isCash &&
      (b.paymentStatus === 'Menunggu Verifikasi Admin' || b.paymentStatus === 'Berhasil') &&
      b.status !== 'Cancelled' &&
      b.status !== 'Refund_Requested' &&
      b.status !== 'Refund_Completed'
    ) {
      return {
        ...b,
        paymentStatus: 'Lunas',
        verifiedDateIso: b.verifiedDateIso || b.date || getTodayIso(),
      };
    }
    return b;
  };

  const base: BookingOrder[] = (Array.isArray(mainList) ? mainList : fallback).map(
    normalizeNonCashLunas
  );
  const ledger: BookingOrder[] = (Array.isArray(ledgerList) ? ledgerList : []).map(
    normalizeNonCashLunas
  );

  if (ledger.length === 0) {
    return base;
  }

  // Pastikan setiap transaksi terverifikasi di buku besar omzet tetap ada dan terjaga status verifikasinya
  const mapById = new Map<number, BookingOrder>();
  base.forEach((b) => {
    if (b && typeof b.id === 'number') {
      mapById.set(b.id, b);
    }
  });

  ledger.forEach((ledgerOrder) => {
    if (!ledgerOrder || typeof ledgerOrder.id !== 'number') return;
    const existing = mapById.get(ledgerOrder.id);
    if (!existing) {
      mapById.set(ledgerOrder.id, ledgerOrder);
    } else if (!isVerifiedRevenueOrder(existing) && isVerifiedRevenueOrder(ledgerOrder)) {
      // Jika karena alasan tertentu status verifikasi di mainList belum terupdate sementara di ledger sudah terverifikasi (dan bukan refund)
      if (
        existing.status !== 'Refund_Requested' &&
        existing.status !== 'Refund_Completed' &&
        existing.status !== 'Cancelled'
      ) {
        mapById.set(ledgerOrder.id, {
          ...existing,
          status: ledgerOrder.status,
          paymentStatus: ledgerOrder.paymentStatus,
          verifiedDateIso: ledgerOrder.verifiedDateIso || existing.verifiedDateIso,
        });
      }
    }
  });

  return Array.from(mapById.values()).sort((a, b) => b.id - a.id);
}

/**
 * Menyimpan seluruh data booking sekaligus membackup transaksi terverifikasi (Omzet Harian & Bulanan)
 * ke buku besar khusus tanpa gambar berat agar 100% aman dari batas kuota memori browser.
 */
export function saveBookingsPersistently(bookings: BookingOrder[]): void {
  // 1. Amankan data Omzet Harian & Bulanan terlebih dahulu ke buku besar ringan (tanpa base64 foto)
  const verifiedLedger: BookingOrder[] = bookings
    .filter((b) => isVerifiedRevenueOrder(b))
    .map((b) => ({
      ...b,
      paymentProofImage: undefined,
      refundRequest: b.refundRequest
        ? { ...b.refundRequest, proofImage: undefined }
        : undefined,
    }));
  safeSaveJson(STORAGE_KEYS.OMZET_LEDGER, verifiedLedger);

  // 2. Simpan data booking lengkap beserta foto bukti transfer
  const savedFull = safeSaveJson(STORAGE_KEYS.BOOKINGS, bookings);
  if (savedFull) return;

  // 3. Fallback jika memori localStorage penuh (QuotaExceededError akibat banyak foto resolusi tinggi):
  //    Kompres/hapus base64 foto dari pesanan lama yang sudah selesai/dibatalkan terlebih dahulu,
  //    sehingga riwayat pesanan, status pembayaran, dan angka omzet TIDAK PERNAH GAGAL TERSIMPAN.
  const trimmedOldCompleted = bookings.map((b, idx) => {
    const isOldDone =
      idx >= 5 &&
      (b.status === 'Completed' ||
        b.status === 'Verified' ||
        b.status === 'Refund_Completed' ||
        b.status === 'Cancelled');
    if (!isOldDone) return b;
    return {
      ...b,
      paymentProofImage: undefined,
      refundRequest: b.refundRequest
        ? { ...b.refundRequest, proofImage: undefined }
        : undefined,
    };
  });

  if (safeSaveJson(STORAGE_KEYS.BOOKINGS, trimmedOldCompleted)) return;

  // 4. Fallback terakhir: simpan seluruh teks transaksi & omzet tanpa gambar base64
  const lightBookings = bookings.map((b) => ({
    ...b,
    paymentProofImage: undefined,
    refundRequest: b.refundRequest
      ? { ...b.refundRequest, proofImage: undefined }
      : undefined,
  }));
  safeSaveJson(STORAGE_KEYS.BOOKINGS, lightBookings);
}

export interface PersistedSession {
  user: User;
  isAdmin: boolean;
}

export function loadActiveSession(): PersistedSession | null {
  const session = safeLoadJson<PersistedSession | null>(STORAGE_KEYS.ACTIVE_SESSION, null);
  if (!session || !session.user || !session.user.phone) return null;
  return session;
}

export function saveActiveSession(user: User, isAdmin: boolean): void {
  safeSaveJson(STORAGE_KEYS.ACTIVE_SESSION, { user, isAdmin });
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch {
    // ignore
  }
}

/**
 * Mengompres file foto bukti transfer / QRIS menjadi ukuran ringan (maks 800px, JPEG 0.72)
 * agar puluhan/ratusan foto bukti tetap muat di localStorage tanpa pernah error kuota penuh.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension: number = 800,
  quality: number = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (!resultStr) {
        reject(new Error('File gambar kosong'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Jika gagal decode di canvas, kembalikan data URL asli
        resolve(resultStr);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(resultStr);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < resultStr.length ? compressed : resultStr);
        } catch {
          resolve(resultStr);
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

