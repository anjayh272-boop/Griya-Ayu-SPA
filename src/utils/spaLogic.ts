import * as XLSX from 'xlsx';
import type {
  ServiceItem,
  PointReward,
  BookingOrder,
  TimeSlot,
  User,
  PaymentMethodType,
  HomeServiceDaySchedule,
  HomeServiceScheduleConfig,
} from '../types/index.ts';
import { DEFAULT_HOME_SERVICE_SCHEDULE } from '../data/mockData.ts';

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

export const QRIS_PAYMENT_CHANNELS = [
  'QRIS via BCA Mobile / myBCA',
  "QRIS via Livin' by Mandiri",
  'QRIS via BRImo (Bank BRI)',
  'QRIS via BNI Mobile / Wondr',
  'QRIS via GoPay',
  'QRIS via DANA',
  'QRIS via OVO',
  'QRIS via ShopeePay',
  'QRIS via SeaBank / Bank Digital',
] as const;

export const BANK_TRANSFER_CHANNELS = [
  'Transfer ke Bank BCA (7285780985 a.n. KARTINI)',
  'Transfer ke Bank Mandiri (1560010933630 a.n. KARTINI)',
] as const;

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
    order.paymentStatus === 'Dibatalkan' ||
    order.paymentStatus === 'Dibatalkan (Waktu Habis / Kedaluwarsa)' ||
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

function escapeCsvCellSemicolon(val: string | number): string {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

function formatWaTextForReport(rawWa: string): string {
  const digits = String(rawWa || '').replace(/[^0-9]/g, '');
  if (!digits) return '-';
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  if (!digits.startsWith('0')) return '0' + digits;
  return digits;
}

/**
 * Fallback CSV jika lingkungan browser gagal mengunduh file .xlsx native:
 * Menggunakan UTF-8 BOM (\uFEFF), pemisah titik koma (;), dan format '="08..."' untuk nomor telepon.
 */
function downloadMonthlyRevenueCsvFallback(
  sorted: BookingOrder[],
  monthLabel: string,
  periodSlug: string
): string {
  const totalOmzet = sorted.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const dataStartRow = 8;
  const lastDataRow = sorted.length > 0 ? dataStartRow + sorted.length - 1 : dataStartRow;

  const headers = [
    'No',
    'ID Booking',
    'Tanggal',
    'Jam (WIB)',
    'Nama Pelanggan',
    'No. WhatsApp',
    'Layanan',
    'Metode Pembayaran',
    'Nominal (Rp)',
    'Status',
  ];

  const rows: string[] = [];
  rows.push(escapeCsvCellSemicolon('GRIYA AYU SPORT MASSAGE & SPA'));
  rows.push(
    escapeCsvCellSemicolon(
      `Laporan Rekapitulasi Pendapatan & Omzet Bulanan - Periode ${monthLabel}`
    )
  );
  rows.push('');
  rows.push(
    [
      escapeCsvCellSemicolon('Total Transaksi'),
      escapeCsvCellSemicolon(
        sorted.length > 0 ? `=COUNTA(B${dataStartRow}:B${lastDataRow})` : 0
      ),
    ].join(';')
  );
  rows.push(
    [
      escapeCsvCellSemicolon('Total Omzet'),
      escapeCsvCellSemicolon(`=SUM(I${dataStartRow}:I${lastDataRow})`),
    ].join(';')
  );
  rows.push('');
  rows.push(headers.map(escapeCsvCellSemicolon).join(';'));

  if (sorted.length === 0) {
    rows.push(
      [
        '-',
        '',
        '-',
        '-',
        'Belum ada transaksi terverifikasi pada periode ini',
        '-',
        '-',
        '-',
        0,
        '-',
      ]
        .map(escapeCsvCellSemicolon)
        .join(';')
    );
  } else {
    sorted.forEach((order, idx) => {
      const cleanWa = formatWaTextForReport(order.wa);
      const timeStr = order.time?.includes('WIB') ? order.time : `${order.time} WIB`;
      rows.push(
        [
          idx + 1,
          `GA-${String(order.id).slice(-6)}`,
          order.date,
          timeStr,
          order.customer,
          `'="${cleanWa}"`,
          order.items,
          order.payMethod,
          Number(order.total) || 0,
          order.paymentStatus,
        ]
          .map(escapeCsvCellSemicolon)
          .join(';')
      );
    });
  }

  rows.push(
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL OMZET',
      `=SUM(I${dataStartRow}:I${lastDataRow})`,
      totalOmzet,
    ]
      .map(escapeCsvCellSemicolon)
      .join(';')
  );

  const fileName = `Laporan_Omzet_Griya_Ayu_${periodSlug}.csv`;
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return fileName;
}

/**
 * Mengunduh Laporan Rekapitulasi Pendapatan & Omzet Bulanan dalam format Excel asli (.xlsx)
 * menggunakan SheetJS (xlsx) lengkap dengan rumus =COUNTA(), =SUM(), format mata uang Rp #,##0,
 * proteksi teks nomor WhatsApp ('@'), dan auto column width (!cols).
 */
export function downloadMonthlyRevenueCsv(
  orders: BookingOrder[],
  monthPrefix: string = getCurrentMonthPrefix()
): string {
  const monthLabel = formatMonthYearIndo(monthPrefix);
  const periodSlug = monthLabel.replace(/\s+/g, '_');
  const fileName = `Laporan_Omzet_Griya_Ayu_${periodSlug}.xlsx`;

  const sorted = [...orders].sort((a, b) => {
    const dCmp = a.date.localeCompare(b.date);
    if (dCmp !== 0) return dCmp;
    return a.time.localeCompare(b.time);
  });

  const totalOmzet = sorted.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  try {
    // Baris 1-2: Judul & Subjudul
    // Baris 4-5: KPI Ringkasan (Total Transaksi & Total Omzet)
    // Baris 7: Header Tabel Utama (No | ID Booking | Tanggal | Jam (WIB) | Nama Pelanggan | No. WhatsApp | Layanan | Metode Pembayaran | Nominal (Rp) | Status)
    // Baris 8 dst: Data Transaksi
    // Baris Terakhir: TOTAL OMZET dengan rumus =SUM(...)
    const dataStartRow = 8; // 1-indexed Excel row
    const lastDataRow = sorted.length > 0 ? dataStartRow + sorted.length - 1 : dataStartRow;
    const totalRowNumber = lastDataRow + 1;

    const headers = [
      'No',
      'ID Booking',
      'Tanggal',
      'Jam (WIB)',
      'Nama Pelanggan',
      'No. WhatsApp',
      'Layanan',
      'Metode Pembayaran',
      'Nominal (Rp)',
      'Status',
    ];

    const aoa: (string | number)[][] = [
      ['GRIYA AYU SPORT MASSAGE & SPA', '', '', '', '', '', '', '', '', ''],
      [
        `Laporan Rekapitulasi Pendapatan & Omzet Bulanan - Periode ${monthLabel}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [],
      ['Total Transaksi', '', sorted.length, '', '', '', '', '', '', ''],
      ['Total Omzet', '', totalOmzet, '', '', '', '', '', '', ''],
      [],
      headers,
    ];

    if (sorted.length === 0) {
      aoa.push([
        '-',
        '',
        monthPrefix,
        '-',
        'Belum ada transaksi terverifikasi pada periode ini',
        '-',
        '-',
        '-',
        0,
        '-',
      ]);
    } else {
      sorted.forEach((order, idx) => {
        const cleanWa = formatWaTextForReport(order.wa);
        const cleanTime = (order.time || '').replace(/\s*WIB$/i, '').trim();
        const timeFormatted = cleanTime ? `${cleanTime} WIB` : '-';
        aoa.push([
          idx + 1,
          `GA-${String(order.id).slice(-6)}`,
          order.date,
          timeFormatted,
          order.customer || '-',
          cleanWa,
          order.items || '-',
          order.payMethod || '-',
          Number(order.total) || 0,
          order.paymentStatus || '-',
        ]);
      });
    }

    // Baris Total di paling bawah
    aoa.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL OMZET',
      totalOmzet,
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge sel untuk Judul, Subjudul, dan Label KPI
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // A1:J1 Judul Laporan
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // A2:J2 Subjudul Laporan
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, // A4:B4 Label Total Transaksi
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // A5:B5 Label Total Omzet
    ];

    // Set rumus KPI Ringkasan pada Baris 4 & Baris 5 (C4 dan C5)
    ws['C4'] = {
      t: 'n',
      f: `COUNTA(B${dataStartRow}:B${lastDataRow})`,
      v: sorted.length,
      z: '#,##0',
    };
    ws['C5'] = {
      t: 'n',
      f: `SUM(I${dataStartRow}:I${lastDataRow})`,
      v: totalOmzet,
      z: '"Rp" #,##0',
    };

    // Format spesifik setiap baris data transaksi (Baris 8 s/d lastDataRow)
    for (let rIdx = dataStartRow - 1; rIdx <= lastDataRow - 1; rIdx++) {
      // Kolom C (index 2): Tanggal (YYYY-MM-DD) -> string
      const dateRef = XLSX.utils.encode_cell({ r: rIdx, c: 2 });
      if (ws[dateRef]) {
        ws[dateRef].t = 's';
        ws[dateRef].z = '@';
      }

      // Kolom D (index 3): Jam (HH:mm WIB) -> string
      const timeRef = XLSX.utils.encode_cell({ r: rIdx, c: 3 });
      if (ws[timeRef]) {
        ws[timeRef].t = 's';
        ws[timeRef].z = '@';
      }

      // Kolom F (index 5): No. WhatsApp -> paksa tipe teks ('s') & format '@' agar tidak menjadi scientific (8.78E+10)
      const waRef = XLSX.utils.encode_cell({ r: rIdx, c: 5 });
      if (ws[waRef]) {
        ws[waRef].t = 's';
        ws[waRef].v = String(ws[waRef].v ?? '');
        ws[waRef].z = '@';
      }

      // Kolom I (index 8): Nominal (Rp) -> angka murni ('n') dengan number format "Rp" #,##0
      const nominalRef = XLSX.utils.encode_cell({ r: rIdx, c: 8 });
      if (ws[nominalRef]) {
        const numericVal = Number(ws[nominalRef].v) || 0;
        ws[nominalRef] = {
          t: 'n',
          v: numericVal,
          z: '"Rp" #,##0',
        };
      }
    }

    // Set rumus =SUM(...) pada baris TOTAL OMZET paling bawah (Kolom I)
    const totalCellRef = `I${totalRowNumber}`;
    ws[totalCellRef] = {
      t: 'n',
      f: `SUM(I${dataStartRow}:I${lastDataRow})`,
      v: totalOmzet,
      z: '"Rp" #,##0',
    };

    // Hitung lebar kolom otomatis (!cols) berdasarkan panjang teks terpanjang + batas minimal
    const minColWidths = [
      6,  // No
      16, // ID Booking (min 15)
      14, // Tanggal (YYYY-MM-DD)
      14, // Jam (WIB)
      20, // Nama Pelanggan (min 18)
      19, // No. WhatsApp (min 18)
      28, // Layanan (min 22)
      24, // Metode Pembayaran
      18, // Nominal (Rp)
      24, // Status
    ];

    const tableRowsForWidth = aoa.slice(6); // mulai dari baris header tabel (baris ke-7)
    ws['!cols'] = minColWidths.map((minW, colIdx) => {
      let maxLen = minW;
      for (const row of tableRowsForWidth) {
        const rawCell = row[colIdx];
        if (rawCell === undefined || rawCell === null) continue;
        const displayStr =
          colIdx === 8 && typeof rawCell === 'number'
            ? formatRupiah(rawCell)
            : String(rawCell);
        if (displayStr.length + 3 > maxLen) {
          maxLen = displayStr.length + 3;
        }
      }
      return { wch: Math.min(maxLen, 52) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Omzet ${monthLabel}`.slice(0, 31));

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return fileName;
  } catch {
    return downloadMonthlyRevenueCsvFallback(sorted, monthLabel, periodSlug);
  }
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

  const healthNoteLine = order.healthNote?.trim()
    ? `🩺 *Catatan Keluhan / Fokus Pijat:* ${order.healthNote.trim()}\n`
    : '';

  const text =
    `*BUKTI BOOKING JADWAL - GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `----------------------------------------\n` +
    `🧾 *Nomor Transaksi:* #${invoiceCode}\n` +
    `👤 *Nama:* ${order.customer}\n` +
    `💆‍♀️ *Layanan:* ${order.items}\n` +
    healthNoteLine +
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
        if ((id === 's2' || id === 's4' || s.hasInjurySpots) && injurySpot) {
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

  const isBooked = bookings.some((b) => {
    if (b.date !== dateIso || b.time !== time) return false;
    if (
      b.status === 'Cancelled' ||
      b.status === 'Refund_Requested' ||
      b.status === 'Refund_Completed' ||
      b.paymentStatus === 'Menunggu Cek Refund Admin' ||
      b.paymentStatus === 'Refund Selesai / Dibatalkan' ||
      b.paymentStatus === 'Dibatalkan' ||
      b.paymentStatus === 'Dibatalkan (Waktu Habis / Kedaluwarsa)' ||
      b.paymentStatus === 'Gagal' ||
      b.paymentStatus === 'Kedaluwarsa'
    ) {
      return false;
    }
    const isActivePending =
      b.status === 'Pending_Payment' &&
      b.paymentStatus === 'Pending' &&
      b.expiresAt > nowMs;
    return isOrderLockedStatus(b) || isActivePending;
  });

  if (isBooked) {
    return { available: false, reason: 'booked' };
  }

  return { available: true, reason: 'available' };
}

const DEFAULT_DAY_NAMES_MAP: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  0: 'Minggu',
};

const MONDAY_TO_SUNDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Menormalkan data jadwal Home Service agar selalu memiliki konfigurasi lengkap Senin s/d Minggu
 * dan daftar slot jam default jika data belum ada.
 */
export function normalizeHomeServiceSchedule(
  raw?: Partial<HomeServiceScheduleConfig> | null
): HomeServiceScheduleConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_HOME_SERVICE_SCHEDULE,
      days: DEFAULT_HOME_SERVICE_SCHEDULE.days.map((d) => ({ ...d })),
      slots: DEFAULT_HOME_SERVICE_SCHEDULE.slots.map((s) => ({ ...s })),
    };
  }

  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : true;

  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  const days: HomeServiceDaySchedule[] = MONDAY_TO_SUNDAY_ORDER.map((dayIdx) => {
    const found = rawDays.find((d) => d && Number(d.dayOfWeek) === dayIdx);
    return {
      dayOfWeek: dayIdx,
      dayName: found?.dayName || DEFAULT_DAY_NAMES_MAP[dayIdx] || 'Hari',
      isOpen: typeof found?.isOpen === 'boolean' ? found.isOpen : true,
      openTime:
        typeof found?.openTime === 'string' && /^\d{2}:\d{2}$/.test(found.openTime)
          ? found.openTime
          : '09:00',
      closeTime:
        typeof found?.closeTime === 'string' && /^\d{2}:\d{2}$/.test(found.closeTime)
          ? found.closeTime
          : '20:00',
    };
  });

  const rawSlots =
    Array.isArray(raw.slots) && raw.slots.length > 0
      ? raw.slots
      : DEFAULT_HOME_SERVICE_SCHEDULE.slots;

  const slots: TimeSlot[] = rawSlots
    .filter((s) => s && typeof s.time === 'string' && /^\d{2}:\d{2}$/.test(s.time))
    .map((s) => ({
      time: s.time,
      active: Boolean(s.active),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return {
    enabled,
    days,
    slots:
      slots.length > 0
        ? slots
        : DEFAULT_HOME_SERVICE_SCHEDULE.slots.map((s) => ({ ...s })),
    updatedAt: raw.updatedAt,
  };
}

/**
 * Mengambil jadwal operasional Home Service untuk tanggal tertentu (YYYY-MM-DD).
 */
export function getHomeServiceDaySchedule(
  dateIso: string,
  schedule?: HomeServiceScheduleConfig | null
): HomeServiceDaySchedule {
  const normalized = normalizeHomeServiceSchedule(schedule);
  const [yyyy, mm, dd] = (dateIso || '').split('-').map(Number);
  const d =
    yyyy && mm && dd ? new Date(yyyy, mm - 1, dd) : new Date();
  const dayOfWeek = d.getDay();
  return (
    normalized.days.find((item) => item.dayOfWeek === dayOfWeek) || {
      dayOfWeek,
      dayName: DEFAULT_DAY_NAMES_MAP[dayOfWeek] || 'Hari',
      isOpen: true,
      openTime: '09:00',
      closeTime: '20:00',
    }
  );
}

/**
 * Mengecek ketersediaan layanan Home Service pada tanggal tertentu (YYYY-MM-DD).
 */
export function isHomeServiceDateAvailable(
  dateIso: string,
  schedule?: HomeServiceScheduleConfig | null,
  closedSpecificDates: string[] = []
): {
  available: boolean;
  reason: 'available' | 'service_disabled' | 'day_closed' | 'specific_holiday';
  daySchedule: HomeServiceDaySchedule;
} {
  const normalized = normalizeHomeServiceSchedule(schedule);
  const daySchedule = getHomeServiceDaySchedule(dateIso, normalized);

  if (!normalized.enabled) {
    return {
      available: false,
      reason: 'service_disabled',
      daySchedule,
    };
  }

  if (closedSpecificDates.includes(dateIso)) {
    return {
      available: false,
      reason: 'specific_holiday',
      daySchedule,
    };
  }

  if (!daySchedule.isOpen) {
    return {
      available: false,
      reason: 'day_closed',
      daySchedule,
    };
  }

  return {
    available: true,
    reason: 'available',
    daySchedule,
  };
}

/**
 * Mengambil daftar slot jam Home Service yang aktif dan berada dalam jam operasional (openTime s/d closeTime)
 * pada tanggal yang dipilih pelanggan.
 */
export function getActiveHomeServiceSlotsForDate(
  dateIso: string,
  schedule?: HomeServiceScheduleConfig | null
): TimeSlot[] {
  const normalized = normalizeHomeServiceSchedule(schedule);
  const daySchedule = getHomeServiceDaySchedule(dateIso, normalized);
  if (!normalized.enabled || !daySchedule.isOpen) {
    return [];
  }

  return normalized.slots.filter(
    (s) =>
      s.active &&
      s.time >= daySchedule.openTime &&
      s.time <= daySchedule.closeTime
  );
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

/**
 * Mengecek apakah pesanan masih memenuhi batas waktu minimal 4 jam (>= 240 menit) sebelum jadwal awal
 * untuk melakukan ganti jadwal mandiri (Reschedule).
 */
export function checkBookingRescheduleEligibility(
  dateIso: string,
  timeStr: string,
  nowMs: number = Date.now()
): {
  canReschedule: boolean;
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

  if (diffMinutes < 240) {
    return {
      canReschedule: false,
      diffMinutes,
      remainingLabel:
        diffMinutes <= 0
          ? 'Jadwal sudah lewat / sedang berlangsung'
          : `Tinggal ${Math.floor(diffMinutes / 60)} jam ${diffMinutes % 60} menit lagi (< 4 jam)`,
    };
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const remainingLabel =
    hours >= 24
      ? `${Math.floor(hours / 24)} hari ${hours % 24} jam lagi`
      : `${hours} jam ${mins} menit lagi`;

  return {
    canReschedule: true,
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
  DELETED_BOOKING_IDS: 'griya_ayu_deleted_booking_ids_live',
  NOTIFICATIONS: 'griya_ayu_notifications_live',
  SLOTS: 'griya_ayu_slots_live',
  POINT_REWARDS: 'griya_ayu_point_rewards_live',
  SINGLE_SERVICES: 'griya_ayu_single_services_live',
  PACKAGE_SERVICES: 'griya_ayu_package_services_live',
  CLOSED_WEEKDAYS: 'griya_ayu_closed_weekdays_live',
  CLOSED_DATES: 'griya_ayu_closed_dates_live',
  HOME_SERVICE_SCHEDULE: 'griya_ayu_home_service_schedule_live',
  ADMIN_PROFILE: 'griya_ayu_admin_profile',
  CUSTOMER_SESSION: 'griya_customer_session',
  ACTIVE_SESSION: 'griya_customer_session',
  LEGACY_ACTIVE_SESSION: 'griya_ayu_active_session',
  FONNTE_TOKEN: 'griya_ayu_fonnte_token_live',
  LANG: 'griya_ayu_lang',
} as const;

export const CUSTOMER_SESSION_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 Hari (dalam milidetik)

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

export const GRIYA_AYU_DEFAULT_THERAPIST = 'Rismawati, AIFMO-P (Terapis Utama Griya Ayu)';

/**
 * Mengirim pesan WhatsApp melalui endpoint proxy Vercel Rewrite
 * (/wa-api/api/send-message).
 */
export async function sendWhatsAppViaVpsGateway(
  targetPhone: string,
  message: string
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  const cleanTarget = (targetPhone || '').replace(/[^0-9]/g, '');
  if (!cleanTarget) {
    return {
      ok: false,
      detail: 'Nomor tujuan WhatsApp tidak valid.',
    };
  }

  try {
    const response = await fetch('/wa-api/api/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: cleanTarget,
        message,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || (data && (data.status === false || data.success === false))) {
      return {
        ok: false,
        detail:
          data?.error ||
          data?.reason ||
          data?.detail ||
          data?.message ||
          'Gagal mengirim pesan ke WhatsApp Gateway.',
        data,
      };
    }

    return {
      ok: true,
      detail: 'Pesan WhatsApp berhasil dikirim ke nomor tujuan!',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : 'Gagal terhubung ke server WhatsApp Gateway.',
    };
  }
}

/**
 * Mengirim kode OTP 6 digit langsung ke WhatsApp pelanggan melalui HTTPS Cloudflare Tunnel WhatsApp Gateway.
 */
export async function sendOtpWhatsApp(
  targetPhone: string,
  otpCode: string
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  const message = `Halo! Kode OTP Griya Ayu Anda adalah: ${otpCode}. Jangan berikan kode ini kepada siapa pun.`;
  return sendWhatsAppViaVpsGateway(targetPhone, message);
}

export const sendFonnteOtpWhatsApp = sendOtpWhatsApp;

/**
 * Mengirim kata sandi baru hasil reset Admin ke WhatsApp pelanggan via WA Gateway.
 */
export async function sendPasswordResetWhatsApp(
  customerName: string,
  customerPhone: string,
  newPassword: string
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  const cleanTarget = normalizePhoneDigits(customerPhone) || customerPhone;
  const message = `Halo Kak ${customerName} 🌿\n\nKata sandi akun Griya Ayu Sport Massage & SPA Anda telah berhasil direset oleh Admin.\n\nKata sandi baru Anda: *${newPassword}*\n\nSilakan gunakan kata sandi ini untuk masuk ke website/aplikasi di https://griyaayu.vercel.app dan segera ganti kata sandi Anda demi keamanan akun. Terima kasih! 🙏✨`;
  return sendWhatsAppViaVpsGateway(cleanTarget, message);
}

/**
 * Generate kata sandi acak alfanumerik 6-8 karakter yang mudah dibaca (tanpa karakter ambigu 0/O/1/I/l).
 */
export function generateReadableRandomPassword(length: number = 7): string {
  const safeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const targetLen = Math.max(6, Math.min(8, length));
  let result = '';
  for (let i = 0; i < targetLen; i += 1) {
    const idx = Math.floor(Math.random() * safeChars.length);
    result += safeChars[idx];
  }
  return result;
}

const sentBookingConfirmationIds = new Set<number>();

/**
 * Mengirim notifikasi konfirmasi reservasi otomatis ke WhatsApp pelanggan
 * serta notifikasi pesanan baru ke WhatsApp Admin Griya Ayu saat booking berhasil dibuat.
 */
export async function sendBookingSummaryWhatsApp(
  order: BookingOrder,
  adminPhone: string = GRIYA_AYU_ADMIN_PHONE
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  if (order.id && sentBookingConfirmationIds.has(order.id)) {
    return {
      ok: true,
      detail: 'Notifikasi WhatsApp untuk booking ini sudah dikirim.',
    };
  }
  if (order.id) {
    sentBookingConfirmationIds.add(order.id);
  }

  const bookingCode = `GA-${String(order.id).slice(-6)}`;
  const jadwal = `${order.datePretty} • ${order.time} WIB`;
  const statusPembayaran =
    order.paymentStatus === 'Lunas' ||
    order.status === 'Verified' ||
    order.status === 'Completed'
      ? 'Lunas'
      : 'Menunggu Konfirmasi';
  const totalBiaya = formatRupiah(order.total);
  const customerTarget = normalizePhoneDigits(order.wa) || order.wa;

  const healthNoteLine = order.healthNote?.trim()
    ? `\n- Catatan Keluhan: ${order.healthNote.trim()}`
    : '';

  const customerMessage = `Halo ${order.customer}! Terima kasih telah melakukan reservasi di Griya Ayu Sport Massage & SPA.

Detail Reservasi Anda:
- Kode Booking: ${bookingCode}
- Layanan: ${order.items}${healthNoteLine}
- Tanggal & Waktu: ${jadwal}
- Status Pembayaran: ${statusPembayaran}
- Total: ${totalBiaya}

Mohon hadir 10 menit sebelum jadwal. Jika ada pertanyaan atau perubahan jadwal, silakan balas pesan ini. Terima kasih!`;

  const adminTarget = normalizePhoneDigits(adminPhone) || GRIYA_AYU_ADMIN_PHONE;
  const adminMessage = `Halo Admin Griya Ayu! Ada pesanan baru masuk:

- Kode Booking: ${bookingCode}
- Pelanggan: ${order.customer} (${customerTarget})
- Layanan: ${order.items}${healthNoteLine}
- Tanggal & Waktu: ${jadwal}
- Metode: ${order.payMethod}
- Status Pembayaran: ${statusPembayaran}
- Total: ${totalBiaya}`;

  try {
    const response = await fetch(
      '/wa-api/api/send-message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: customerTarget,
          message: customerMessage,
        }),
      }
    );

    const data = await response.json().catch(() => null);

    // Kirim notifikasi ringkas ke nomor WhatsApp Admin Griya Ayu
    if (adminTarget && adminTarget !== customerTarget) {
      void fetch(
        '/wa-api/api/send-message',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: adminTarget,
            message: adminMessage,
          }),
        }
      ).catch(() => null);
    }

    if (!response.ok || (data && (data.status === false || data.success === false))) {
      return {
        ok: false,
        detail:
          data?.error ||
          data?.reason ||
          data?.detail ||
          data?.message ||
          'Gagal mengirim konfirmasi booking ke WhatsApp Gateway.',
        data,
      };
    }

    return {
      ok: true,
      detail: 'Konfirmasi reservasi berhasil dikirim ke WhatsApp pelanggan & Admin!',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : 'Gagal menghubungi server WhatsApp Gateway.',
    };
  }
}

/**
 * Mengirim notifikasi WhatsApp otomatis ke pelanggan dan Admin Griya Ayu
 * saat terjadi pembatalan booking atau proses refund.
 */
export async function sendCancellationOrRefundWhatsApp(
  order: BookingOrder,
  adminPhone: string = GRIYA_AYU_ADMIN_PHONE
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  const bookingCode = `GA-${String(order.id).slice(-6)}`;
  const jadwalAwal = `${order.datePretty} • ${order.time} WIB`;
  const statusRefund =
    order.status === 'Refund_Completed'
      ? 'Dana Dikembalikan ke Rekening Asal'
      : 'Diproses';
  const customerTarget = normalizePhoneDigits(order.wa) || order.wa;

  const customerMessage = `Halo ${order.customer}, reservasi Anda di Griya Ayu Sport Massage & SPA dengan kode booking ${bookingCode} telah berhasil dibatalkan.

Detail:
- Layanan: ${order.items}
- Jadwal Awal: ${jadwalAwal}
- Status Refund: ${statusRefund}

Jika ada kendala terkait pengembalian dana, silakan hubungi admin kami dengan membalas pesan ini. Terima kasih.`;

  const adminTarget = normalizePhoneDigits(adminPhone) || GRIYA_AYU_ADMIN_PHONE;
  const refundAccountLine =
    order.refundRequest?.bankName && order.refundRequest?.accountNumber
      ? `\n- Rekening Refund: ${order.refundRequest.bankName} ${order.refundRequest.accountNumber} (a.n. ${order.refundRequest.accountHolder || order.customer})`
      : '';
  const reasonLine = order.refundRequest?.reason
    ? `\n- Alasan: ${order.refundRequest.reason}`
    : '';

  const adminMessage = `Halo Admin Griya Ayu! Informasi Pembatalan Booking / Refund:

- Kode Booking: ${bookingCode}
- Pelanggan: ${order.customer} (${customerTarget})
- Layanan: ${order.items}
- Jadwal Awal: ${jadwalAwal} (Slot Jadwal Dibuka Kembali)
- Status Refund: ${statusRefund}${refundAccountLine}${reasonLine}`;

  try {
    const response = await fetch(
      '/wa-api/api/send-message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: customerTarget,
          message: customerMessage,
        }),
      }
    );

    const data = await response.json().catch(() => null);

    // Kirim salinan ringkas informasi pembatalan ke nomor WA Admin
    if (adminTarget && adminTarget !== customerTarget) {
      void fetch(
        '/wa-api/api/send-message',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: adminTarget,
            message: adminMessage,
          }),
        }
      ).catch(() => null);
    }

    if (!response.ok || (data && (data.status === false || data.success === false))) {
      return {
        ok: false,
        detail:
          data?.error ||
          data?.reason ||
          data?.detail ||
          data?.message ||
          'Gagal mengirim notifikasi pembatalan ke WhatsApp Gateway.',
        data,
      };
    }

    return {
      ok: true,
      detail: 'Notifikasi pembatalan/refund berhasil dikirim ke WhatsApp pelanggan & Admin!',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : 'Gagal menghubungi server WhatsApp Gateway.',
    };
  }
}

/**
 * Mengirim notifikasi WhatsApp otomatis ke pelanggan dan Admin Griya Ayu
 * saat pelanggan melakukan ganti jadwal mandiri (Reschedule).
 */
export async function sendRescheduleBookingWhatsApp(
  order: BookingOrder,
  adminPhone: string = GRIYA_AYU_ADMIN_PHONE
): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  const bookingCode = `GA-${String(order.id).slice(-6)}`;
  const jadwalBaru = `${order.datePretty} • Jam ${order.time} WIB`;
  const customerTarget = normalizePhoneDigits(order.wa) || order.wa;

  const customerMessage = `Halo ${order.customer}, jadwal reservasi Anda di Griya Ayu (Kode: ${bookingCode}) telah berhasil diubah ke:
- Jadwal Baru: ${jadwalBaru}
- Layanan: ${order.items}
Sampai jumpa di lokasi!`;

  const adminTarget = normalizePhoneDigits(adminPhone) || GRIYA_AYU_ADMIN_PHONE;
  const adminMessage = `Halo Admin Griya Ayu! Pelanggan melakukan Reschedule (Ganti Jadwal Mandiri):
- Kode Booking: ${bookingCode}
- Pelanggan: ${order.customer} (${customerTarget})
- Jadwal Awal: ${order.previousSchedule || '-'} (Dibuka Kembali)
- Jadwal Baru: ${jadwalBaru} (Terkunci)
- Layanan: ${order.items}`;

  try {
    const response = await fetch(
      '/wa-api/api/send-message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: customerTarget,
          message: customerMessage,
        }),
      }
    );

    const data = await response.json().catch(() => null);

    // Kirim salinan ringkas informasi reschedule ke WA Admin
    if (adminTarget && adminTarget !== customerTarget) {
      void fetch(
        '/wa-api/api/send-message',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: adminTarget,
            message: adminMessage,
          }),
        }
      ).catch(() => null);
    }

    if (!response.ok || (data && (data.status === false || data.success === false))) {
      return {
        ok: false,
        detail:
          data?.error ||
          data?.reason ||
          data?.detail ||
          data?.message ||
          'Gagal mengirim notifikasi reschedule ke WhatsApp Gateway.',
        data,
      };
    }

    return {
      ok: true,
      detail: 'Notifikasi pembaruan jadwal berhasil dikirim ke WhatsApp pelanggan & Admin!',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : 'Gagal menghubungi server WhatsApp Gateway.',
    };
  }
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
 * Memuat daftar ID pesanan yang sudah dihapus permanen oleh Admin.
 */
export function loadDeletedBookingIds(): number[] {
  const ids = safeLoadJson<number[]>(STORAGE_KEYS.DELETED_BOOKING_IDS, []);
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'number') : [];
}

/**
 * Menandai 1 ID pesanan sebagai telah dihapus permanen agar tidak muncul lagi dari cache/mock.
 */
export function markBookingIdAsDeleted(orderId: number): number[] {
  const current = loadDeletedBookingIds();
  if (!current.includes(orderId)) {
    const next = [...current, orderId];
    safeSaveJson(STORAGE_KEYS.DELETED_BOOKING_IDS, next);
    return next;
  }
  return current;
}

/**
 * Menyaring dan mendeduplikasi daftar akun pelanggan agar:
 * - Tidak ada duplikasi nomor WhatsApp
 * - Hanya menghitung member valid (role 'customer' / 'member' atau non-admin)
 * - Status member tetap 'active'
 */
export function getValidMemberCustomers(users: User[]): User[] {
  if (!Array.isArray(users)) return [];
  const mapByPhone = new Map<string, User>();
  users.forEach((u) => {
    if (!u || !u.phone) return;
    const normPhone = normalizePhoneDigits(u.phone);
    if (!normPhone || normPhone.length < 5) return;
    if (
      u.role === 'admin' ||
      normPhone === '087765573476' ||
      normPhone === '081585921993'
    ) {
      return;
    }
    const existing = mapByPhone.get(normPhone);
    mapByPhone.set(normPhone, {
      ...(existing || {}),
      ...u,
      id: u.id || existing?.id || normPhone,
      phone: normPhone,
      role: u.role === 'member' || u.role === 'customer' ? u.role : 'customer',
      status: u.status || 'active',
    });
  });
  return Array.from(mapByPhone.values());
}

/**
 * Memuat daftar akun pelanggan dari localStorage tanpa pernah mereset data yang sudah ada.
 */
export function loadCustomersPersistently(fallback: User[] = []): User[] {
  const live = safeLoadJson<User[] | null>(STORAGE_KEYS.CUSTOMERS, null);
  if (Array.isArray(live)) {
    return getValidMemberCustomers(live);
  }
  return getValidMemberCustomers(fallback);
}

/**
 * Menyimpan daftar akun pelanggan ke localStorage (terdeduplikasi & menjaga integritas member).
 */
export function saveCustomersPersistently(customers: User[]): void {
  safeSaveJson(STORAGE_KEYS.CUSTOMERS, getValidMemberCustomers(customers));
}

/**
 * Memuat riwayat booking & menggabungkannya dengan cadangan buku besar omzet (omzet ledger)
 * agar data transaksi terverifikasi (omzet harian & bulanan) tidak pernah hilang,
 * kecuali yang sudah dihapus permanen oleh Admin.
 */
export function loadBookingsPersistently(fallback: BookingOrder[] = []): BookingOrder[] {
  const deletedSet = new Set(loadDeletedBookingIds());
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

  const base: BookingOrder[] = (Array.isArray(mainList) ? mainList : fallback)
    .filter((b) => b && !deletedSet.has(b.id))
    .map(normalizeNonCashLunas);
  const ledger: BookingOrder[] = (Array.isArray(ledgerList) ? ledgerList : [])
    .filter((b) => b && !deletedSet.has(b.id))
    .map(normalizeNonCashLunas);

  if (ledger.length === 0) {
    return base;
  }

  // Pastikan setiap transaksi terverifikasi di buku besar omzet tetap ada dan terjaga status verifikasinya
  const mapById = new Map<number, BookingOrder>();
  base.forEach((b) => {
    if (b && typeof b.id === 'number' && !deletedSet.has(b.id)) {
      mapById.set(b.id, b);
    }
  });

  ledger.forEach((ledgerOrder) => {
    if (!ledgerOrder || typeof ledgerOrder.id !== 'number' || deletedSet.has(ledgerOrder.id))
      return;
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
  const deletedSet = new Set(loadDeletedBookingIds());
  const cleanBookings = bookings.filter((b) => b && !deletedSet.has(b.id));
  // 1. Amankan data Omzet Harian & Bulanan terlebih dahulu ke buku besar ringan (tanpa base64 foto)
  const verifiedLedger: BookingOrder[] = cleanBookings
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
  const savedFull = safeSaveJson(STORAGE_KEYS.BOOKINGS, cleanBookings);
  if (savedFull) return;

  // 3. Fallback jika memori localStorage penuh (QuotaExceededError akibat banyak foto resolusi tinggi):
  //    Kompres/hapus base64 foto dari pesanan lama yang sudah selesai/dibatalkan terlebih dahulu,
  //    sehingga riwayat pesanan, status pembayaran, dan angka omzet TIDAK PERNAH GAGAL TERSIMPAN.
  const trimmedOldCompleted = cleanBookings.map((b, idx) => {
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
  const lightBookings = cleanBookings.map((b) => ({
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
  customer?: User;
  isAdmin: boolean;
  expiry: number;
  lastActivityAt?: number;
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem('griya_customer_session');
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
    sessionStorage.removeItem('griya_customer_session');
    sessionStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
  } catch {
    // ignore
  }
}

export function loadActiveSession(): PersistedSession | null {
  try {
    // Pastikan tidak pernah menggunakan sessionStorage untuk sesi login pelanggan
    sessionStorage.removeItem('griya_customer_session');
    sessionStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
  } catch {
    // ignore
  }

  let session = safeLoadJson<Partial<PersistedSession> | null>(
    'griya_customer_session',
    null
  );

  // Migrasi satu kali jika sebelumnya ada sesi di key lama
  if (!session) {
    const legacy = safeLoadJson<Partial<PersistedSession> | null>(
      STORAGE_KEYS.LEGACY_ACTIVE_SESSION,
      null
    );
    if (legacy && (legacy.user || legacy.customer)) {
      const migratedUser = (legacy.user || legacy.customer) as User;
      const migratedExpiry =
        typeof legacy.expiry === 'number' && legacy.expiry > 0
          ? legacy.expiry
          : Date.now() + (3 * 24 * 60 * 60 * 1000);
      session = {
        user: migratedUser,
        customer: migratedUser,
        isAdmin: Boolean(legacy.isAdmin),
        expiry: migratedExpiry,
        lastActivityAt: Date.now(),
      };
      safeSaveJson('griya_customer_session', session);
      try {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
      } catch {
        // ignore
      }
    }
  }

  if (!session) return null;

  const resolvedUser = session.user || session.customer;
  if (!resolvedUser || !resolvedUser.phone) {
    clearActiveSession();
    return null;
  }

  // Periksa timestamp kedaluwarsa (expiry): jika sudah lewat dari 3 hari, otomatis hapus sesi dari localStorage
  if (typeof session.expiry !== 'number' || Date.now() > session.expiry) {
    clearActiveSession();
    return null;
  }

  return {
    user: resolvedUser,
    customer: resolvedUser,
    isAdmin: Boolean(session.isAdmin),
    expiry: session.expiry,
    lastActivityAt: session.lastActivityAt,
  };
}

export function saveActiveSession(
  user: User,
  isAdmin: boolean,
  refreshExpiry: boolean = true
): void {
  try {
    sessionStorage.removeItem('griya_customer_session');
    sessionStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_SESSION);
  } catch {
    // ignore
  }

  const now = Date.now();
  let expiry = now + (3 * 24 * 60 * 60 * 1000);

  if (!refreshExpiry) {
    const existing = safeLoadJson<Partial<PersistedSession> | null>(
      'griya_customer_session',
      null
    );
    if (existing && typeof existing.expiry === 'number') {
      if (now > existing.expiry) {
        clearActiveSession();
        return;
      }
      expiry = existing.expiry;
    }
  }

  const payload: PersistedSession = {
    user,
    customer: user,
    isAdmin,
    expiry,
    lastActivityAt: now,
  };

  safeSaveJson('griya_customer_session', payload);
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

