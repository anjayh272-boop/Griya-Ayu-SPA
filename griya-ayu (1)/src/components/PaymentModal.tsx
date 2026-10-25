import React, { useState, useEffect } from 'react';
import { BookingOrder, PaymentMethodType } from '../types/index.ts';
import {
  formatRupiah,
  formatCountdown,
  isOrderLockedStatus,
  compressImageFileToDataUrl,
  GRIYA_AYU_QRIS_IMAGE,
  GRIYA_AYU_QRIS_NMID,
  GRIYA_AYU_QRIS_MERCHANT,
  GRIYA_AYU_BANK_ACCOUNTS,
  GRIYA_AYU_ADDRESS,
  QRIS_PAYMENT_CHANNELS,
  BANK_TRANSFER_CHANNELS,
} from '../utils/spaLogic.ts';

interface PaymentModalProps {
  isOpen: boolean;
  order: BookingOrder | null;
  onCloseWithoutPaying: () => void;
  onChangeMethodType: (orderId: number, methodType: PaymentMethodType) => void;
  onPaymentSuccess: (
    orderId: number,
    methodType: PaymentMethodType,
    paymentProofImage?: string,
    paymentChannel?: string
  ) => void;
  onPaymentFailed: (orderId: number, methodType: PaymentMethodType) => void;
  onCopyText: (text: string, label: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  order,
  onCloseWithoutPaying,
  onChangeMethodType,
  onPaymentSuccess,
  onPaymentFailed,
  onCopyText,
}) => {
  const [activeMethodType, setActiveMethodType] = useState<PaymentMethodType>('qris');
  const [selectedChannel, setSelectedChannel] = useState<string>(QRIS_PAYMENT_CHANNELS[0]);
  const [localStatus, setLocalStatus] = useState<'Pending' | 'Locked' | 'Gagal'>('Pending');
  const [remainingMs, setRemainingMs] = useState<number>(20 * 60 * 1000);
  const [proofImage, setProofImage] = useState<string>('');
  const [proofError, setProofError] = useState<string>('');

  useEffect(() => {
    if (!order) return;
    if (order.payMethodType === 'qris') {
      setActiveMethodType('qris');
      setSelectedChannel(order.paymentChannel || QRIS_PAYMENT_CHANNELS[0]);
    } else if (order.payMethodType === 'cash') {
      setActiveMethodType('cash');
      setSelectedChannel('Cash / Bayar di Tempat');
    } else {
      setActiveMethodType('bank_transfer');
      setSelectedChannel(order.paymentChannel || BANK_TRANSFER_CHANNELS[0]);
    }
    setProofImage(order.paymentProofImage || '');
    setProofError('');
    setLocalStatus(
      isOrderLockedStatus(order)
        ? 'Locked'
        : order.paymentStatus === 'Gagal'
        ? 'Gagal'
        : 'Pending'
    );
  }, [order?.id]);

  // Live 20-minute countdown timer
  useEffect(() => {
    if (!isOpen || !order) return;
    const updateTimer = () => {
      const diff = Math.max(0, order.expiresAt - Date.now());
      setRemainingMs(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const isCashMethod = activeMethodType === 'cash';

  const handleSelectMethod = (nextType: PaymentMethodType) => {
    setActiveMethodType(nextType);
    setProofError('');
    setSelectedChannel(
      nextType === 'qris'
        ? QRIS_PAYMENT_CHANNELS[0]
        : nextType === 'bank_transfer'
        ? BANK_TRANSFER_CHANNELS[0]
        : 'Cash / Bayar di Tempat'
    );
    onChangeMethodType(order.id, nextType);
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setProofImage(compressed);
      setProofError('');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProofImage(reader.result);
          setProofError('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPaid = () => {
    if (!isCashMethod) {
      if (remainingMs <= 0) {
        setLocalStatus('Gagal');
        onPaymentFailed(order.id, activeMethodType);
        return;
      }
      if (!proofImage) {
        setProofError(
          'Mohon unggah foto bukti transfer / screenshot QRIS terlebih dahulu sebelum menekan tombol konfirmasi.'
        );
        return;
      }
    }
    setLocalStatus('Locked');
    onPaymentSuccess(
      order.id,
      activeMethodType,
      isCashMethod ? undefined : proofImage,
      isCashMethod ? 'Cash / Bayar di Tempat' : selectedChannel
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3.5 backdrop-blur-sm animate-fade">
      <div className="bg-[#F9F6F0] rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[94vh] overflow-y-auto p-4 shadow-2xl border-t-4 sm:border-2 border-[#D4AF37] space-y-3.5 animate-modal-pop">
        {/* Header Modal */}
        <div className="flex justify-between items-start border-b border-stone-200 pb-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded">
                Sistem Cepat-Cepatan • Kunci Jam
              </span>
              <span className="text-[9px] font-mono font-black bg-[#0B261C] text-[#D4AF37] px-2 py-0.5 rounded">
                #GA-{String(order.id).slice(-6)}
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-[#0B261C] mt-1">
              Pembayaran & Konfirmasi Pesanan Griya Ayu
            </h2>
          </div>
          <button
            type="button"
            onClick={onCloseWithoutPaying}
            aria-label="Tutup Pembayaran Sementara"
            className="tactile-btn w-7 h-7 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center hover:bg-stone-300"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* BANNER TIMER 20 MENIT (HANYA TAMPIL JIKA PILIH QRIS ATAU TRANSFER BANK) */}
        {!isCashMethod && (
          <div className="rounded-2xl overflow-hidden border-2 border-[#D4AF37] shadow-sm animate-fade">
            <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-[#0B261C] px-3 py-2 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-stopwatch text-sm animate-bounce"></i>
                <div>
                  <span className="text-[9px] font-black uppercase block leading-none">
                    Countdown Timer Pembayaran (20 Menit)
                  </span>
                  <span className="text-[10px] font-bold leading-tight">
                    Selesaikan pembayaran & unggah bukti untuk kunci jam {order.time} WIB
                  </span>
                </div>
              </div>
              <div className="bg-[#0B261C] text-[#D4AF37] font-mono font-black text-sm px-2.5 py-1 rounded-xl border border-[#D4AF37] shadow-xs">
                {formatCountdown(remainingMs)}
              </div>
            </div>

            <div className="bg-white px-3 py-2 flex justify-between items-center border-t border-stone-200">
              <span className="text-[10px] font-black text-stone-600 uppercase">
                Status Pesanan:
              </span>
              {localStatus === 'Locked' && (
                <span
                  data-testid="payment-status-badge"
                  className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 px-2.5 py-0.5 rounded-full flex items-center gap-1"
                >
                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                  <span>Menunggu Verifikasi Admin (Jam Terkunci)</span>
                </span>
              )}
              {localStatus === 'Gagal' && (
                <span
                  data-testid="payment-status-badge"
                  className="text-[10px] font-black bg-red-100 text-red-800 border border-red-400 px-2.5 py-0.5 rounded-full flex items-center gap-1"
                >
                  <i className="fa-solid fa-circle-xmark text-red-600"></i>
                  <span>GAGAL (Coba Lagi)</span>
                </span>
              )}
              {localStatus === 'Pending' && (
                <span
                  data-testid="payment-status-badge"
                  className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-400 px-2.5 py-0.5 rounded-full flex items-center gap-1"
                >
                  <i className="fa-solid fa-clock text-amber-600"></i>
                  <span>PENDING (Menunggu Bukti Bayar)</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* NOMINAL TAGIHAN OTOMATIS */}
        <div className="bg-[#0B261C] text-white p-3.5 rounded-2xl border border-[#D4AF37]/60 flex justify-between items-center gold-shimmer-card shadow-md">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded border border-emerald-600 inline-flex items-center gap-1 mb-0.5">
              <i className="fa-solid fa-check text-[8px]"></i> Total Tagihan Resmi
            </span>
            <p className="text-xl font-black text-[#D4AF37] leading-tight">
              {formatRupiah(order.total)}
            </p>
            <p className="text-[10px] text-white/90 mt-0.5">
              {order.datePretty} • Jam <b>{order.time} WIB</b>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCopyText(String(order.total), 'Nominal Pembayaran')}
            className="tactile-btn bg-white/15 hover:bg-white/25 text-[#D4AF37] border border-[#D4AF37]/50 text-[10px] font-black px-3 py-1.5 rounded-xl"
          >
            Salin Nominal
          </button>
        </div>

        {/* PILIH 3 METODE PEMBAYARAN: QRIS, TRANSFER BANK, CASH / DI TEMPAT */}
        <div>
          <label className="text-[11px] font-black text-stone-800 block mb-1.5">
            Pilih Metode Pembayaran:
          </label>
          <div className="grid grid-cols-3 gap-2 text-[11px] font-black">
            {(
              [
                { id: 'qris', label: 'QRIS', sub: 'Griya Ayu', icon: 'fa-solid fa-qrcode' },
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
              ] as Array<{ id: PaymentMethodType; label: string; sub: string; icon: string }>
            ).map((m) => {
              const isActive = activeMethodType === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMethod(m.id)}
                  className={`tactile-btn py-2 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition ${
                    isActive
                      ? 'border-[#D4AF37] bg-[#0B261C] text-[#D4AF37] shadow-xs'
                      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <i className={m.icon}></i>
                  <span className="leading-tight">{m.label}</span>
                  <span
                    className={`text-[9px] font-bold ${
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

        {/* TAMPILAN METODE 1: QRIS RESMI GRIYA AYU */}
        {activeMethodType === 'qris' && (
          <div key="modal-qris" className="space-y-3 animate-fade">
            <div className="max-w-[300px] mx-auto rounded-2xl overflow-hidden shadow-md border-2 border-[#00AED6] bg-[#00AED6] p-2.5 text-center space-y-2">
              <div className="flex justify-between items-center text-white px-1">
                <span className="text-[10px] font-black uppercase">QRIS {GRIYA_AYU_QRIS_MERCHANT}</span>
                <span className="text-[10px] font-black bg-white text-[#0B261C] px-2 py-0.5 rounded-full">
                  {formatRupiah(order.total)}
                </span>
              </div>
              <div className="bg-white rounded-xl overflow-hidden shadow-inner w-full max-w-[260px] mx-auto">
                <img
                  src={GRIYA_AYU_QRIS_IMAGE}
                  alt={`QRIS ${GRIYA_AYU_QRIS_MERCHANT}`}
                  className="w-full h-auto object-contain block mx-auto"
                />
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-stone-200 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Merchant QRIS:</span>
                <span className="font-black text-[#0B261C]">{GRIYA_AYU_QRIS_MERCHANT}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">NMID QRIS:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-stone-800">
                    {GRIYA_AYU_QRIS_NMID} (A01)
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyText(GRIYA_AYU_QRIS_NMID, 'NMID QRIS')}
                    className="text-[10px] font-black bg-stone-100 text-stone-800 px-2 py-0.5 rounded"
                  >
                    Salin
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAMPILAN METODE 2: TRANSFER BANK (BCA / MANDIRI) */}
        {activeMethodType === 'bank_transfer' && (
          <div key="modal-bank" className="space-y-2.5 animate-fade">
            {GRIYA_AYU_BANK_ACCOUNTS.map((acc) => (
              <div
                key={acc.id}
                className="bg-white p-3.5 rounded-2xl border-2 border-stone-200 flex justify-between items-center gap-2 shadow-xs"
              >
                <div>
                  <span className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2 py-0.5 rounded">
                    {acc.bankName}
                  </span>
                  <p className="text-sm font-black text-[#0B261C] font-mono tracking-wider mt-1">
                    {acc.accountNumberFormatted}
                  </p>
                  <p className="text-[11px] text-stone-600 font-bold">a.n. {acc.accountHolder}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCopyText(acc.accountNumber, `No. Rekening ${acc.bankName}`)
                  }
                  className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-[10px] font-black px-3 py-2 rounded-xl flex items-center gap-1"
                >
                  <i className="fa-regular fa-copy"></i> Salin No. Rek
                </button>
              </div>
            ))}
          </div>
        )}

        {/* KOTAK UPLOAD BUKTI TRANSFER / SCREENSHOT QRIS (WAJIB UNTUK QRIS & TRANSFER BANK) */}
        {!isCashMethod && (
          <div className="bg-white p-3.5 rounded-2xl border-2 border-[#D4AF37] space-y-2.5 shadow-xs animate-fade">
            <div className="space-y-1">
              <label
                htmlFor="modalPaymentChannelSelect"
                className="text-[11px] font-black text-[#0B261C] block"
              >
                Pembayaran Melalui Aplikasi / Bank Apa:
              </label>
              <select
                id="modalPaymentChannelSelect"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold p-2 rounded-xl"
              >
                {(activeMethodType === 'qris'
                  ? QRIS_PAYMENT_CHANNELS
                  : BANK_TRANSFER_CHANNELS
                ).map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-black text-[#0B261C] flex items-center gap-1.5">
                <i className="fa-solid fa-file-arrow-up text-amber-600"></i>
                <span>
                  Upload Struk Screenshot Pembayaran <span className="text-red-600">*</span>
                </span>
              </span>
              <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                Wajib Diunggah
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Unggah foto / screenshot bukti pembayaran Anda sebelum menekan tombol kunci jadwal di
              bawah.
            </p>

            <input
              type="file"
              id="paymentModalProofInput"
              accept="image/*"
              onChange={handleUploadProof}
              className="hidden"
            />

            {proofImage ? (
              <div className="space-y-2">
                <div className="relative h-44 w-full rounded-xl overflow-hidden border-2 border-emerald-500 bg-stone-900">
                  <img
                    src={proofImage}
                    alt="Preview Bukti Transfer / QRIS"
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow">
                    ✓ Bukti Pembayaran Siap Dikirim
                  </span>
                </div>
                <label
                  htmlFor="paymentModalProofInput"
                  className="tactile-btn w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2 rounded-xl text-center text-xs block cursor-pointer border border-stone-300"
                >
                  <i className="fa-solid fa-camera-rotate mr-1.5"></i>
                  Ganti Foto Bukti Pembayaran
                </label>
              </div>
            ) : (
              <label
                htmlFor="paymentModalProofInput"
                className="tactile-btn w-full min-h-[84px] border-2 border-dashed border-[#D4AF37] bg-amber-50/60 hover:bg-amber-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <i className="fa-solid fa-cloud-arrow-up text-xl text-[#0B261C]"></i>
                <span className="font-black text-[#0B261C] text-xs">
                  Klik untuk Upload Bukti Transfer / Screenshot QRIS
                </span>
                <span className="text-[10px] text-stone-500">
                  Pilih gambar screenshot dari galeri HP Anda
                </span>
              </label>
            )}

            {proofError && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-red-600 flex-shrink-0"></i>
                <span>{proofError}</span>
              </div>
            )}
          </div>
        )}

        {/* TAMPILAN METODE 3: CASH / BAYAR DI TEMPAT (TANPA TIMER & TANPA FORM UPLOAD BUKTI) */}
        {isCashMethod && (
          <div
            key="modal-cash"
            className="bg-amber-50 p-3.5 rounded-2xl border-2 border-[#D4AF37] space-y-2 text-xs animate-fade"
          >
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-money-bill-wave text-amber-800 text-base"></i>
              <span className="font-black text-[#0B261C]">
                Cash / Bayar Langsung di Lokasi Saat Kedatangan
              </span>
            </div>
            <p className="text-[11px] text-stone-700 leading-relaxed">
              Siapkan pembayaran tunai sebesar <b>{formatRupiah(order.total)}</b> saat tiba di{' '}
              <b>{GRIYA_AYU_ADDRESS}</b> pada jadwal <b>{order.datePretty} • {order.time} WIB</b>.
            </p>
          </div>
        )}

        {/* SATU TOMBOL UTAMA KONFIRMASI DINAMIS SESUAI METODE PEMBAYARAN */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={handleConfirmPaid}
            className={`tactile-btn gold-shimmer-card w-full min-h-[52px] bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#0B261C] font-black py-3.5 px-4 rounded-2xl shadow-lg border border-amber-200 text-xs uppercase tracking-wide flex items-center justify-center gap-2 text-center leading-snug ${
              !isCashMethod && !proofImage ? 'opacity-90' : ''
            }`}
          >
            <i className="fa-solid fa-lock text-sm flex-shrink-0"></i>
            <span>
              {isCashMethod
                ? 'BOOKING & KUNCI JADWAL (BAYAR DI TEMPAT)'
                : 'SAYA SUDAH BAYAR & KIRIM BUKTI (KUNCI JADWAL)'}
            </span>
          </button>

          <p className="text-[11px] text-stone-500 text-center leading-relaxed">
            {isCashMethod
              ? 'Klik tombol di atas untuk mengunci slot jam secara permanen dan menerbitkan Struk Digital. Pembayaran dilakukan di kasir saat kedatangan.'
              : `Unggah gambar bukti pembayaran lalu klik tombol di atas untuk mengunci slot jam ${order.time} WIB secara permanen dan membuka Struk Digital.`}
          </p>
        </div>
      </div>
    </div>
  );
};



