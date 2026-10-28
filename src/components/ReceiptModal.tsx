import React, { useState, useEffect } from 'react';
import { BookingOrder, PaymentMethodType } from '../types/index.ts';
import {
  formatRupiah,
  formatCountdown,
  getPaymentMethodDetails,
  isOrderLockedStatus,
  compressImageFileToDataUrl,
  GRIYA_AYU_QRIS_IMAGE,
  GRIYA_AYU_QRIS_MERCHANT,
  GRIYA_AYU_BANK_ACCOUNTS,
  buildAdminWaConfirmationMessage,
  GRIYA_AYU_ADDRESS,
  GRIYA_AYU_MAPS_URL,
  QRIS_PAYMENT_CHANNELS,
  BANK_TRANSFER_CHANNELS,
} from '../utils/spaLogic.ts';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface ReceiptModalProps {
  order: BookingOrder | null;
  isAdmin?: boolean;
  onClose: () => void;
  onChangeMethodType?: (orderId: number, methodType: PaymentMethodType) => void;
  onPayFromReceipt?: (
    orderId: number,
    methodType: PaymentMethodType,
    paymentProofImage?: string,
    paymentChannel?: string,
    healthNote?: string
  ) => void;
  onFailFromReceipt?: (orderId: number, methodType: PaymentMethodType) => void;
  onCopyText?: (text: string, label: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  isAdmin = false,
  onClose,
  onChangeMethodType,
  onPayFromReceipt,
  onFailFromReceipt,
  onCopyText,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(20 * 60 * 1000);
  const [selectedType, setSelectedType] = useState<PaymentMethodType>('qris');
  const [selectedChannel, setSelectedChannel] = useState<string>(QRIS_PAYMENT_CHANNELS[0]);
  const [receiptProofImage, setReceiptProofImage] = useState<string>('');
  const [receiptProofError, setReceiptProofError] = useState<string>('');
  const [receiptHealthNote, setReceiptHealthNote] = useState<string>('');
  const [zoomProofOpen, setZoomProofOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  useEffect(() => {
    if (order) {
      if (order.payMethodType === 'qris') {
        setSelectedType('qris');
        setSelectedChannel(order.paymentChannel || QRIS_PAYMENT_CHANNELS[0]);
      } else if (order.payMethodType === 'cash') {
        setSelectedType('cash');
        setSelectedChannel('Cash / Bayar di Tempat');
      } else {
        setSelectedType('bank_transfer');
        setSelectedChannel(order.paymentChannel || BANK_TRANSFER_CHANNELS[0]);
      }
      setReceiptProofImage(order.paymentProofImage || '');
      setReceiptHealthNote(order.healthNote || '');
      setReceiptProofError('');
      setZoomProofOpen(false);
      setZoomLevel(1);
    }
  }, [order?.id, order?.payMethodType, order?.paymentProofImage, order?.healthNote]);

  useEffect(() => {
    if (!order) return;
    const tick = () => {
      const diff = Math.max(0, order.expiresAt - Date.now());
      setRemainingMs(diff);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order]);

  if (!order) return null;

  const invoiceCode = `GA-${String(order.id).slice(-6)}`;
  const isLocked = isOrderLockedStatus(order);
  const isFailed = order.paymentStatus === 'Gagal' || order.status === 'Cancelled';
  const isExpired = !isLocked && remainingMs <= 0;
  const methodInfo = getPaymentMethodDetails(selectedType, order.wa);
  const isCashSelected = selectedType === 'cash';

  const handleSwitchMethodInReceipt = (newType: PaymentMethodType) => {
    if (isFailed || isExpired) return;
    setSelectedType(newType);
    setSelectedChannel(
      newType === 'qris'
        ? QRIS_PAYMENT_CHANNELS[0]
        : newType === 'bank_transfer'
        ? BANK_TRANSFER_CHANNELS[0]
        : 'Cash / Bayar di Tempat'
    );
    setReceiptProofError('');
    if (onChangeMethodType) {
      onChangeMethodType(order.id, newType);
    }
  };

  const handleUploadReceiptProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFailed || isExpired) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setReceiptProofImage(compressed);
      setReceiptProofError('');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setReceiptProofImage(reader.result);
          setReceiptProofError('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePayNowInReceipt = () => {
    if (isFailed || isExpired || Date.now() >= order.expiresAt) {
      if (onFailFromReceipt) {
        onFailFromReceipt(order.id, selectedType);
      }
      return;
    }
    if (!isCashSelected) {
      if (!receiptProofImage) {
        setReceiptProofError(
          'Mohon unggah foto bukti transfer / screenshot QRIS terlebih dahulu sebelum mengunci jadwal.'
        );
        return;
      }
    }
    if (onPayFromReceipt) {
      onPayFromReceipt(
        order.id,
        selectedType,
        isCashSelected ? undefined : receiptProofImage,
        isCashSelected ? 'Cash / Bayar di Tempat' : selectedChannel,
        receiptHealthNote.trim() || undefined
      );
    }
  };

  const adminToCustomerConfirmation = buildAdminWaConfirmationMessage(order);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 backdrop-blur-sm animate-fade">
      <div className="bg-[#F9F6F0] rounded-3xl max-w-md w-full max-h-[93vh] overflow-y-auto shadow-2xl border-2 border-[#D4AF37] animate-modal-pop">
        {/* Top Receipt Banner */}
        <div
          className={`px-4 py-3.5 text-center relative border-b-2 border-dashed border-[#D4AF37]/60 text-white ${
            isLocked
              ? 'bg-gradient-to-r from-[#0B261C] via-[#123829] to-[#0B261C]'
              : isFailed || isExpired
              ? 'bg-gradient-to-r from-red-950 via-red-900 to-red-950'
              : 'bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Struk"
            className="tactile-btn absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="mb-2 flex justify-center">
            <GriyaAyuLogo size="md" showBadge={true} floating={false} />
          </div>

          <span
            data-testid="receipt-status-badge"
            className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
              isLocked
                ? 'bg-emerald-800/90 text-amber-300 border-amber-400/30'
                : isFailed || isExpired
                ? 'bg-red-800 text-red-100 border-red-400'
                : 'bg-amber-400 text-[#0B261C] border-amber-200'
            }`}
          >
            {isLocked
              ? `STATUS: ${order.paymentStatus.toUpperCase()} • JAM TERKUNCI`
              : order.paymentStatus === 'Dibatalkan'
              ? 'STATUS PESANAN: DIBATALKAN (SLOT DILEPASKAN)'
              : order.paymentStatus === 'Dibatalkan (Waktu Habis / Kedaluwarsa)' || isExpired
              ? 'DIBATALKAN (WAKTU HABIS / KEDALUWARSA)'
              : isFailed
              ? 'STATUS PEMBAYARAN: GAGAL (BELUM LUNAS)'
              : `STATUS PEMBAYARAN: PENDING (${formatCountdown(remainingMs)})`}
          </span>

          <h3 className="font-brand text-sm font-black tracking-wider text-[#D4AF37] mt-1">
            STRUK DIGITAL GRIYA AYU
          </h3>
          <p className="text-[10px] text-emerald-100/80">
            Sport Massage & Spa • AIFMO-P Certified
          </p>
        </div>

        {/* Body Struk */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Paper Receipt Card */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-inner space-y-2.5 relative">
            <div className="flex justify-between items-center border-b border-dashed border-stone-200 pb-2">
              <div>
                <span className="text-[9px] text-stone-400 font-semibold block">
                  NOMOR TRANSAKSI
                </span>
                <span className="font-mono font-black text-xs text-[#0B261C]">#{invoiceCode}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-stone-400 font-semibold block">
                  STATUS PESANAN
                </span>
                {order.paymentStatus === 'Lunas' ||
                order.paymentStatus === 'Terkonfirmasi (ACC Admin)' ||
                (!methodInfo.isCash && isLocked) ? (
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400 inline-flex items-center gap-1">
                    <i className="fa-solid fa-circle-check text-[9px]"></i> LUNAS
                  </span>
                ) : order.paymentStatus === 'Booking Cash (Bayar di Lokasi)' ? (
                  <span className="text-[10px] font-black text-emerald-900 bg-amber-100 px-2 py-0.5 rounded border border-[#D4AF37] inline-flex items-center gap-1">
                    <i className="fa-solid fa-money-bill-wave text-[9px]"></i> Booking Cash (Bayar di Lokasi)
                  </span>
                ) : isLocked ? (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                    <i className="fa-solid fa-check text-[9px]"></i> {order.paymentStatus}
                  </span>
                ) : order.paymentStatus === 'Dibatalkan' ? (
                  <span className="text-[10px] font-black text-stone-700 bg-stone-200 px-2 py-0.5 rounded border border-stone-400 inline-flex items-center gap-1">
                    <i className="fa-solid fa-ban text-[9px]"></i> DIBATALKAN
                  </span>
                ) : order.paymentStatus === 'Dibatalkan (Waktu Habis / Kedaluwarsa)' || isExpired ? (
                  <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-flex items-center gap-1">
                    <i className="fa-solid fa-hourglass-end text-[9px]"></i> Dibatalkan (Kedaluwarsa)
                  </span>
                ) : isFailed ? (
                  <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-flex items-center gap-1">
                    <i className="fa-solid fa-xmark text-[9px]"></i> GAGAL
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                    ⏳ PENDING ({formatCountdown(remainingMs)})
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-stone-500">Nama Pelanggan:</span>
                <span className="font-extrabold text-stone-900">{order.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">No. WhatsApp:</span>
                <span className="font-bold text-stone-800 font-mono">{order.wa}</span>
              </div>
              <div className="flex justify-between items-start gap-2 pt-1 border-t border-stone-100">
                <span className="text-stone-500 flex-shrink-0">Layanan Terapi:</span>
                <span className="font-extrabold text-[#0B261C] text-right leading-snug">
                  {order.items}
                </span>
              </div>
              {order.healthNote && (
                <div className="bg-amber-50/80 border border-amber-200 px-2.5 py-1.5 rounded-lg text-[10px]">
                  <span className="font-black text-[#0B261C] block">
                    🩺 Catatan Keluhan / Fokus Pijat:
                  </span>
                  <p className="text-stone-800 font-semibold leading-snug mt-0.5">
                    {order.healthNote}
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Tanggal & Jam:</span>
                <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  {order.datePretty} • {order.time} WIB
                </span>
              </div>
              {order.previousSchedule && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400">Jadwal Sebelum Reschedule:</span>
                  <span className="font-bold text-stone-500 line-through">
                    {order.previousSchedule}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-start gap-2">
                <span className="text-stone-500 flex-shrink-0">Pembayaran Melalui:</span>
                <span className="font-extrabold text-[#0B261C] text-right">
                  {order.paymentChannel || order.payMethod || methodInfo.label}
                </span>
              </div>
              <div className="flex justify-between items-center bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                <span className="text-stone-600 font-bold text-[10px]">
                  {methodInfo.isCash
                    ? 'Keterangan:'
                    : methodInfo.isQris
                    ? 'NMID QRIS Tujuan:'
                    : 'Rekening Tujuan:'}
                </span>
                <span className="font-mono font-black text-[11px] text-[#0B261C] text-right">
                  {order.vaNumber || methodInfo.vaNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Status Slot Jam:</span>
                <span
                  className={`font-black text-[10px] px-2 py-0.5 rounded ${
                    isLocked
                      ? 'bg-stone-200 text-stone-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {isLocked
                    ? `🔒 Jam ${order.time} WIB Terkunci Permanen`
                    : `⚡ Belum Terkunci`}
                </span>
              </div>

              {/* Preview Bukti Pembayaran Screenshot jika diunggah (QRIS/TF) - Bisa Di-klik & Di-Zoom */}
              {(order.paymentProofImage || order.refundRequest?.proofImage) && (
                <div className="bg-emerald-50/80 p-3 rounded-xl border-2 border-emerald-300 space-y-2 pt-2">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-[#0B261C] flex items-center gap-1">
                      <i className="fa-solid fa-camera text-emerald-700"></i>
                      <span>Struk Screenshot Pembayaran Online:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(1);
                        setZoomProofOpen(true);
                      }}
                      className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2.5 py-1 rounded-lg border border-[#D4AF37]/50"
                    >
                      🔍 Perbesar & Cek Keaslian
                    </button>
                  </div>

                  <div className="text-[10px] bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 flex justify-between items-center gap-2">
                    <span className="text-stone-500 font-bold">Melalui:</span>
                    <span className="font-black text-emerald-950 text-right">
                      {order.paymentChannel || order.payMethod}
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setZoomLevel(1);
                      setZoomProofOpen(true);
                    }}
                    className="relative h-44 w-full rounded-xl overflow-hidden bg-stone-950 border border-stone-300 cursor-pointer group"
                  >
                    <img
                      src={order.paymentProofImage || order.refundRequest?.proofImage}
                      alt="Struk Screenshot Pembayaran Pelanggan"
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute bottom-2 right-2 bg-black/80 text-[#D4AF37] text-[10px] font-black px-2.5 py-1 rounded-lg border border-[#D4AF37]/40">
                      🔍 Klik Gambar untuk Zoom (Cek Asli/Palsu)
                    </span>
                  </div>
                </div>
              )}

              {/* Alamat Resmi Griya Ayu & Link Google Maps */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl space-y-1 mt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[10px] leading-snug">
                    <span className="font-black text-[#0B261C] flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-red-600"></i>
                      <span>Alamat Lokasi Griya Ayu:</span>
                    </span>
                    <p className="font-extrabold text-stone-900 mt-0.5">{GRIYA_AYU_ADDRESS}</p>
                  </div>
                  <a
                    href={GRIYA_AYU_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tactile-btn flex-shrink-0 bg-[#0B261C] text-[#D4AF37] text-[9px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs border border-[#D4AF37]/60"
                  >
                    <i className="fa-solid fa-map-location-dot"></i>
                    <span>Maps</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Total Box */}
            <div className="bg-[#0B261C] text-white p-3 rounded-xl flex justify-between items-center border border-[#D4AF37]/40">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold block">
                  Total Pembayaran
                </span>
                <span className="text-base font-black text-[#D4AF37]">
                  {formatRupiah(order.total)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded font-bold block">
                  Reward Member
                </span>
                <span className="text-xs font-black text-amber-300">+{order.ptsEarned} Poin</span>
              </div>
            </div>

            {/* JIKA WAKTU 20 MENIT SUDAH BERAKHIR ATAU GAGAL: TIDAK BISA BAYAR LAGI */}
            {!isLocked && !isAdmin && (isFailed || isExpired) && (
              <div className="pt-2 border-t-2 border-dashed border-red-300 space-y-2">
                <div className="bg-red-50 border-2 border-red-300 p-3.5 rounded-2xl text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto text-base">
                    <i className="fa-solid fa-ban"></i>
                  </div>
                  <span className="text-xs font-black text-red-900 block uppercase">
                    ✕ Pembayaran Gagal (Waktu 20 Menit Habis)
                  </span>
                  <p className="text-[11px] text-red-800 leading-relaxed">
                    Batas waktu pembayaran 20 menit untuk pesanan ini telah berakhir. Anda tidak
                    dapat melakukan pembayaran lagi pada pesanan ini. Silakan buat booking jadwal
                    baru.
                  </p>
                </div>
              </div>
            )}

            {/* JIKA PEMBAYARAN MASIH PENDING (< 20 MENIT): PILIH 3 METODE & SELESAIKAN PEMBAYARAN */}
            {!isLocked && !isAdmin && !isFailed && !isExpired && (
              <div className="pt-2 border-t-2 border-dashed border-amber-300 space-y-3">
                {/* Timer 20 Menit Selalu Tampil Selama Pending */}
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black text-amber-950 block">
                      ⏳ Batas Waktu Pembayaran (20 Menit)
                    </span>
                    <span className="text-[9px] text-amber-800">
                      Selesaikan pembayaran sebelum waktu habis untuk kunci jam {order.time} WIB:
                    </span>
                  </div>
                  <span className="font-mono font-black text-xs bg-[#0B261C] text-[#D4AF37] px-2 py-1 rounded-lg">
                    {formatCountdown(remainingMs)}
                  </span>
                </div>

                {/* Pilihan 3 Metode Bayar di Dalam Struk */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black">
                  {(
                    [
                      { id: 'qris', label: 'QRIS' },
                      { id: 'bank_transfer', label: 'Transfer Bank' },
                      { id: 'cash', label: 'Cash / Di Tempat' },
                    ] as Array<{ id: PaymentMethodType; label: string }>
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSwitchMethodInReceipt(m.id)}
                      className={`py-2 px-1.5 rounded-xl border transition ${
                        selectedType === m.id
                          ? 'bg-[#0B261C] text-[#D4AF37] border-[#D4AF37]'
                          : 'bg-stone-50 text-stone-700 border-stone-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {selectedType === 'qris' && (
                  <div className="bg-[#00AED6] p-2.5 rounded-2xl text-center space-y-1.5 border border-cyan-400">
                    <div className="flex justify-between items-center text-white px-1">
                      <span className="text-[10px] font-black">QRIS {GRIYA_AYU_QRIS_MERCHANT}</span>
                      <span className="text-[9px] bg-white text-[#0B261C] font-black px-2 py-0.5 rounded-full">
                        {formatRupiah(order.total)}
                      </span>
                    </div>
                    <div className="bg-white rounded-xl overflow-hidden shadow-inner w-full max-w-[240px] mx-auto">
                      <img
                        src={GRIYA_AYU_QRIS_IMAGE}
                        alt={`QRIS ${GRIYA_AYU_QRIS_MERCHANT}`}
                        className="w-full h-auto object-contain block mx-auto"
                      />
                    </div>
                  </div>
                )}

                {selectedType === 'bank_transfer' && (
                  <div className="space-y-2">
                    {GRIYA_AYU_BANK_ACCOUNTS.map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex justify-between items-center"
                      >
                        <div>
                          <span className="text-[9px] font-black bg-[#0B261C] text-[#D4AF37] px-2 py-0.5 rounded">
                            {acc.bankName}
                          </span>
                          <p className="font-mono text-xs font-black text-[#0B261C] tracking-wider mt-1">
                            {acc.accountNumberFormatted}
                          </p>
                          <p className="text-[10px] text-stone-600 font-bold">
                            a.n. {acc.accountHolder}
                          </p>
                        </div>
                        {onCopyText && (
                          <button
                            type="button"
                            onClick={() =>
                              onCopyText(acc.accountNumber, `No. Rekening ${acc.bankName}`)
                            }
                            className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-[10px] font-black px-2.5 py-1.5 rounded-lg"
                          >
                            <i className="fa-regular fa-copy mr-1"></i>Salin
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Bukti Transfer / Screenshot QRIS di Struk Pending (Hanya untuk QRIS/TF) */}
                {!isCashSelected && (
                  <div className="bg-stone-50 p-3 rounded-xl border border-[#D4AF37] space-y-2">
                    <div>
                      <label
                        htmlFor="receiptChannelSelect"
                        className="text-[10px] font-black text-[#0B261C] block mb-1"
                      >
                        Pembayaran Melalui Aplikasi / Bank Apa:
                      </label>
                      <select
                        id="receiptChannelSelect"
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full bg-white border border-stone-300 text-stone-900 text-[11px] font-bold p-2 rounded-lg"
                      >
                        {(selectedType === 'qris'
                          ? QRIS_PAYMENT_CHANNELS
                          : BANK_TRANSFER_CHANNELS
                        ).map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-[11px] font-black text-[#0B261C] block pt-1">
                      Upload Struk Screenshot Pembayaran <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="file"
                      id="receiptProofInput"
                      accept="image/*"
                      onChange={handleUploadReceiptProof}
                      className="hidden"
                    />
                    {receiptProofImage ? (
                      <div className="space-y-1.5">
                        <div className="h-36 w-full rounded-lg overflow-hidden bg-stone-900 border border-emerald-500">
                          <img
                            src={receiptProofImage}
                            alt="Preview Bukti Bayar"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <label
                          htmlFor="receiptProofInput"
                          className="tactile-btn w-full bg-white text-stone-800 border border-stone-300 font-bold py-1.5 rounded-lg text-center text-[10px] block cursor-pointer"
                        >
                          Ganti Foto Bukti
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="receiptProofInput"
                        className="tactile-btn w-full border-2 border-dashed border-[#D4AF37] bg-amber-50/50 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer text-center"
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-base text-[#0B261C]"></i>
                        <span className="font-black text-[#0B261C] text-[11px]">
                          Upload Struk Screenshot Pembayaran
                        </span>
                      </label>
                    )}

                    {receiptProofError && (
                      <p className="text-[10px] font-bold text-red-600">{receiptProofError}</p>
                    )}
                  </div>
                )}

                {isCashSelected && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-300 text-[11px] text-stone-700 leading-relaxed">
                    <b className="text-[#0B261C] block mb-0.5">
                      💵 Cash / Bayar Langsung Saat Kedatangan
                    </b>
                    Pembayaran sebesar <b>{formatRupiah(order.total)}</b> dilakukan langsung di
                    kasir Griya Ayu saat jadwal <b>{order.time} WIB</b>.
                  </div>
                )}

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={handlePayNowInReceipt}
                    className="tactile-btn gold-shimmer-card w-full min-h-[48px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3 px-4 rounded-2xl text-xs uppercase tracking-wide shadow-md border border-amber-200 flex items-center justify-center gap-2 text-center"
                  >
                    <i className="fa-solid fa-lock"></i>
                    <span>
                      {isCashSelected
                        ? 'BOOKING & KUNCI JADWAL (BAYAR DI TEMPAT)'
                        : 'SAYA SUDAH BAYAR & KIRIM BUKTI (KUNCI JADWAL)'}
                    </span>
                  </button>
                  <p className="text-[10px] text-stone-500 text-center leading-relaxed">
                    {isCashSelected
                      ? 'Klik tombol di atas untuk mengunci slot jam secara permanen dan menerbitkan Struk Digital. Pembayaran dilakukan di kasir saat kedatangan.'
                      : 'Unggah bukti pembayaran untuk menyelesaikan pembayaran dan mengunci jadwal secara permanen.'}
                  </p>
                </div>
              </div>
            )}

            {isLocked && (
              <div className="text-center pt-1">
                <p className="text-[11px] text-emerald-900 font-bold leading-snug bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <i className="fa-solid fa-circle-check mr-1.5 text-emerald-600"></i>
                  Pembayaran <b>BERHASIL</b> & jadwal sesi <b>{order.time} WIB</b> telah dikunci
                  secara permanen (<b>{order.paymentStatus}</b>).
                </p>
              </div>
            )}
          </div>

          {/* Notifikasi Otomatis WhatsApp Pelanggan / ACC Admin */}
          <div className="space-y-2.5">
            {isAdmin ? (
              <a
                href={adminToCustomerConfirmation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tactile-btn gold-shimmer-card flex items-center justify-center gap-2 w-full min-h-[48px] bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black py-3 px-4 rounded-2xl text-xs shadow-lg uppercase tracking-wider"
              >
                <i className="fa-brands fa-whatsapp text-base"></i>
                <span>ACC & Kirim Konfirmasi WA ke Pelanggan</span>
              </a>
            ) : isLocked ? (
              <div className="bg-gradient-to-r from-[#0B261C] via-[#143d2d] to-[#0B261C] border border-[#D4AF37]/80 rounded-2xl p-3.5 text-left shadow-md flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/20 border border-[#25D366]/50 text-[#25D366] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fa-brands fa-whatsapp text-lg"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37] block mb-0.5">
                    Notifikasi Otomatis WhatsApp Resmi
                  </span>
                  <p className="text-xs text-emerald-50 font-medium leading-relaxed">
                    Detail reservasi Anda telah dikirimkan secara otomatis ke nomor WhatsApp terdaftar. Mohon cek pesan masuk dari WhatsApp resmi Griya Ayu.
                  </p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="tactile-btn w-full min-h-[44px] bg-stone-200 hover:bg-stone-300 text-stone-800 font-extrabold py-2.5 rounded-2xl text-xs"
            >
              Tutup Struk
            </button>
          </div>
        </div>
      </div>

      {/* MODAL ZOOM BUKTI SCREENSHOT DI DALAM STRUK */}
      {zoomProofOpen && (order.paymentProofImage || order.refundRequest?.proofImage) && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col p-3 animate-fade"
          onClick={() => setZoomProofOpen(false)}
        >
          <div
            className="max-w-md w-full mx-auto flex flex-col h-full space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0B261C] border border-[#D4AF37] rounded-2xl p-3 text-white flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase text-[#D4AF37] block">
                  Cek Keaslian Struk Screenshot Pembayaran
                </span>
                <p className="text-xs font-black truncate mt-0.5">
                  {order.customer} • {formatRupiah(order.total)}
                </p>
                <p className="text-[11px] text-emerald-200 font-bold truncate">
                  Melalui: {order.paymentChannel || order.payMethod}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomProofOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/15 text-white font-black text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 bg-stone-900 border border-stone-700 p-2 rounded-xl text-xs font-black text-white">
              <span className="text-[10px] text-stone-400 mr-1">Zoom:</span>
              {[1, 1.5, 2, 2.5, 3].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    zoomLevel === z
                      ? 'bg-[#D4AF37] text-[#0B261C]'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border border-stone-700 bg-black flex items-center justify-center p-2">
              <img
                src={order.paymentProofImage || order.refundRequest?.proofImage}
                alt="Zoom Bukti Pembayaran"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                }}
                className="max-w-full h-auto object-contain transition-transform duration-150"
              />
            </div>

            <button
              type="button"
              onClick={() => setZoomProofOpen(false)}
              className="tactile-btn w-full bg-[#D4AF37] text-[#0B261C] font-black py-3 rounded-2xl text-xs"
            >
              Tutup Zoom Screenshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
};



