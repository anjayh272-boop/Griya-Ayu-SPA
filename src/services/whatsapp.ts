import { BookingOrder } from '../types/index.ts';

export const WA_TUNNEL_SEND_MESSAGE_URL =
  'https://guitars-insured-execute-gardening.trycloudflare.com/api/send-message';

export interface WaToastEventDetail {
  title: string;
  message: string;
  ok: boolean;
}

function notifyWaStatus(title: string, message: string, ok: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<WaToastEventDetail>('griya-wa-toast', {
        detail: { title, message, ok },
      })
    );
  }
}

export const triggerWhatsApp = async (
  phone: string | number | undefined | null,
  message: string
): Promise<unknown> => {
  if (!phone) {
    notifyWaStatus('Gagal Kirim WA', 'Gagal kirim WA: Nomor telepon kosong!', false);
    return null;
  }

  let target = phone.toString().replace(/[^0-9]/g, '');
  if (target.startsWith('0')) target = '62' + target.slice(1);
  else if (target.startsWith('8')) target = '62' + target;

  console.log('[WA DISPATCH] Mengirim ke:', target);

  const payload = JSON.stringify({
    target: target,
    message: message,
  });

  try {
    let response: Response;
    try {
      response = await fetch(WA_TUNNEL_SEND_MESSAGE_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
      });
    } catch {
      // Fallback melalui proxy rewrite jika browser memblokir preflight CORS langsung
      response = await fetch('/wa-api/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
      });
    }

    const resData = await response.json().catch(() => ({ ok: response.ok }));
    console.log('[WA RESPONSE]', resData);
    notifyWaStatus(
      'Notifikasi WhatsApp Terkirim ✅',
      'Notifikasi WhatsApp berhasil dikirim ke ' + target,
      true
    );
    return resData;
  } catch (err) {
    console.error('[WA FETCH FAILED]', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyWaStatus(
      'Gagal Menghubungi WhatsApp Gateway ⚠️',
      'Gagal menghubungi WhatsApp Gateway: ' + errMsg,
      false
    );
    return null;
  }
};

export function getBookingTransactionNumber(bookingData: {
  id: number | string;
  transactionNumber?: string;
}): string {
  const raw = (bookingData.transactionNumber || '').trim();
  if (raw) {
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#GA-${String(bookingData.id).slice(-6)}`;
}

export function buildBookingReceiptWaMessage(bookingData: BookingOrder): string {
  const trxNumber = getBookingTransactionNumber(bookingData);
  const isCash =
    bookingData.payMethodType === 'cash' ||
    bookingData.paymentStatus === 'Booking Cash (Bayar di Lokasi)';
  const statusLabel =
    bookingData.paymentStatus === 'Lunas' ||
    bookingData.paymentStatus === 'Terkonfirmasi (ACC Admin)' ||
    bookingData.paymentStatus === 'Berhasil' ||
    (!isCash &&
      (bookingData.status === 'Paid' ||
        bookingData.status === 'Verified' ||
        bookingData.status === 'Completed'))
      ? 'LUNAS'
      : (bookingData.paymentStatus || bookingData.status || 'BERHASIL').toUpperCase();
  const customerName = bookingData.customer || 'Pelanggan Griya Ayu';
  const customerPhone = bookingData.wa || '-';
  const serviceName = bookingData.items || '-';
  const dateStr = bookingData.datePretty || bookingData.date || '-';
  const timeStr = bookingData.time || '-';
  const paymentMethod =
    bookingData.paymentChannel ||
    bookingData.payMethod ||
    (isCash
      ? 'Tunai di Kasir Studio / Terapis'
      : bookingData.payMethodType === 'qris'
      ? 'QRIS'
      : 'Transfer Bank');
  const totalFormatted = Number(bookingData.total || 0).toLocaleString('id-ID');

  return (
    `================================\n` +
    `🧾 *STRUK DIGITAL RESMI*\n` +
    `*GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `================================\n` +
    `*Nomor Transaksi:* ${trxNumber}\n` +
    `*Status Pesanan:* ✅ ${statusLabel}\n` +
    `--------------------------------\n` +
    `*Nama Pelanggan:* ${customerName}\n` +
    `*No. WhatsApp:* ${customerPhone}\n` +
    `*Layanan Terapi:* ${serviceName}\n` +
    `*Tanggal & Jam:* ${dateStr} • ${timeStr} WIB\n` +
    `*Pembayaran Melalui:* ${paymentMethod}\n` +
    `*Total:* Rp ${totalFormatted}\n` +
    `================================\n` +
    `📌 *Catatan:* Tunjukkan nomor transaksi ini kepada staf kami saat tiba di lokasi. Terima kasih! 🌿✨`
  );
}

export function buildCancelBookingWaMessage(bookingData: BookingOrder): string {
  const trxNumber = getBookingTransactionNumber(bookingData);
  const customerName = bookingData.customer || 'Pelanggan Griya Ayu';
  const serviceName = bookingData.items || '-';
  const dateStr = bookingData.datePretty || bookingData.date || '-';
  const timeStr = bookingData.time || '-';
  const reason =
    bookingData.refundRequest?.reason ||
    bookingData.refundRejectedReason ||
    'Dibatalkan oleh pelanggan/admin';

  return (
    `================================\n` +
    `🚫 *PEMBATALAN RESERVASI*\n` +
    `*GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `================================\n` +
    `*Nomor Transaksi:* ${trxNumber}\n` +
    `*Status Pesanan:* ❌ DIBATALKAN\n` +
    `--------------------------------\n` +
    `*Nama Pelanggan:* ${customerName}\n` +
    `*Layanan Terapi:* ${serviceName}\n` +
    `*Tanggal & Jam:* ${dateStr} • ${timeStr} WIB\n` +
    `*Alasan:* ${reason}\n` +
    `================================\n` +
    `📌 *Catatan:* Reservasi Anda telah dibatalkan dan slot jadwal kembali tersedia. Terima kasih! 🌿`
  );
}

export function buildRefundBookingWaMessage(bookingData: BookingOrder): string {
  const trxNumber = getBookingTransactionNumber(bookingData);
  const customerName = bookingData.customer || 'Pelanggan Griya Ayu';
  const serviceName = bookingData.items || '-';
  const dateStr = bookingData.datePretty || bookingData.date || '-';
  const timeStr = bookingData.time || '-';
  const totalFormatted = Number(bookingData.total || 0).toLocaleString('id-ID');
  const isRefundCompleted =
    bookingData.status === 'Refund_Completed' ||
    bookingData.paymentStatus === 'Refund Selesai / Dibatalkan';
  const statusLabel = isRefundCompleted
    ? '✅ REFUND SELESAI DITRANSFER'
    : '⏳ MENUNGGU CEK REFUND ADMIN';

  return (
    `================================\n` +
    `💸 *INFORMASI REFUND*\n` +
    `*GRIYA AYU SPORT MASSAGE & SPA*\n` +
    `================================\n` +
    `*Nomor Transaksi:* ${trxNumber}\n` +
    `*Status Pesanan:* ${statusLabel}\n` +
    `--------------------------------\n` +
    `*Nama Pelanggan:* ${customerName}\n` +
    `*Layanan Terapi:* ${serviceName}\n` +
    `*Tanggal & Jam:* ${dateStr} • ${timeStr} WIB\n` +
    `*Nominal Refund:* Rp ${totalFormatted}\n` +
    `================================\n` +
    `📌 *Catatan:* ${
      isRefundCompleted
        ? 'Pengajuan refund Anda telah disetujui & selesai diproses oleh Admin Griya Ayu.'
        : 'Pengajuan refund Anda sedang diproses oleh Admin Griya Ayu.'
    } Terima kasih! 🌿`
  );
}
