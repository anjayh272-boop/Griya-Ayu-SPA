import React, { useState } from 'react';
import { User, BookingOrder, Language } from '../types/index.ts';
import {
  formatRupiah,
  isVerifiedRevenueOrder,
  GRIYA_AYU_QRIS_MERCHANT,
  GRIYA_AYU_QRIS_NMID,
  GRIYA_AYU_ADDRESS,
  GRIYA_AYU_MAPS_URL,
} from '../utils/spaLogic.ts';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface AccountPanelProps {
  currentUser: User;
  isAdmin: boolean;
  bookings: BookingOrder[];
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onUpdateUser: (updated: User) => void;
  onViewReceipt: (order: BookingOrder) => void;
  onLogout: () => void;
  onShowToast: (title: string, message: string, waUrl?: string) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
];

export const AccountPanel: React.FC<AccountPanelProps> = ({
  currentUser,
  isAdmin,
  bookings,
  language,
  onChangeLanguage,
  onUpdateUser,
  onViewReceipt,
  onLogout,
  onShowToast,
}) => {
  const isEn = language === 'en';

  const [activeSection, setActiveSection] = useState<
    'menu' | 'profile' | 'password' | 'transactions' | 'help' | 'about' | 'language'
  >('menu');

  // State Edit Profil
  const [editName, setEditName] = useState(currentUser.name);
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar || '');

  // State Ganti Kata Sandi (3 Metode)
  const [passMethod, setPassMethod] = useState<'old_pass' | 'otp' | 'admin_help'>('old_pass');
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');

  // Admin: Reset Customer Password State
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState('');
  const [adminResetNewPass, setAdminResetNewPass] = useState('');

  // Handle Photo File Upload (DataURL)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      onShowToast(
        isEn ? 'Name Required' : 'Nama Wajib Diisi',
        isEn ? 'Please enter your full name.' : 'Mohon isi nama lengkap Anda.'
      );
      return;
    }

    const updated: User = {
      ...currentUser,
      name: editName.trim(),
      avatar: editAvatar || undefined,
    };
    onUpdateUser(updated);
    onShowToast(
      isEn ? 'Profile Updated! ✨' : 'Profil Diperbarui! ✨',
      isEn
        ? 'Your profile name and photo have been saved successfully.'
        : 'Perubahan nama dan foto profil Anda telah berhasil disimpan.'
    );
    setActiveSection('menu');
  };

  const handleSavePasswordByOld = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPasswordInput.trim() !== currentUser.pass) {
      onShowToast(
        isEn ? 'Incorrect Old Password' : 'Kata Sandi Lama Salah',
        isEn
          ? 'The old password you entered does not match.'
          : 'Kata sandi lama yang Anda masukkan tidak sesuai.'
      );
      return;
    }
    if (newPasswordInput.trim().length < 6) {
      onShowToast(
        isEn ? 'Password Too Short' : 'Sandi Baru Terlalu Pendek',
        isEn ? 'New password must be at least 6 characters.' : 'Kata sandi baru minimal 6 karakter.'
      );
      return;
    }
    if (newPasswordInput.trim() !== confirmNewPasswordInput.trim()) {
      onShowToast(
        isEn ? 'Password Mismatch' : 'Konfirmasi Sandi Berbeda',
        isEn
          ? 'New password and confirmation do not match.'
          : 'Kata sandi baru dan konfirmasi tidak sama.'
      );
      return;
    }

    const updated: User = {
      ...currentUser,
      pass: newPasswordInput.trim(),
    };
    onUpdateUser(updated);
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    onShowToast(
      isEn ? 'Password Changed! 🔒' : 'Kata Sandi Berhasil Diubah! 🔒',
      isEn
        ? 'Your account password has been updated.'
        : 'Kata sandi akun Anda telah berhasil diperbarui.'
    );
    setActiveSection('menu');
  };

  const handleSendOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpSent(true);
    onShowToast(
      isEn ? 'OTP Code Sent via SMS/WA 📲' : 'Kode OTP Terkirim ke Nomor Anda 📲',
      isEn
        ? `Verification OTP sent to ${currentUser.phone}.\n\nYour OTP Code: ${code}`
        : `Kode OTP verifikasi telah dikirim ke nomor terdaftar ${currentUser.phone}.\n\nKode OTP Anda: ${code}`
    );
  };

  const handleSavePasswordByOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent || otpInput.trim() !== generatedOtp) {
      onShowToast(
        isEn ? 'Invalid OTP Code' : 'Kode OTP Tidak Sesuai',
        isEn
          ? 'Please enter the valid 6-digit OTP code.'
          : 'Kode OTP yang dimasukkan salah. Silakan cek kode OTP Anda.'
      );
      return;
    }
    if (newPasswordInput.trim().length < 6) {
      onShowToast(
        isEn ? 'Password Too Short' : 'Sandi Baru Terlalu Pendek',
        isEn ? 'New password must be at least 6 characters.' : 'Kata sandi baru minimal 6 karakter.'
      );
      return;
    }

    const updated: User = {
      ...currentUser,
      pass: newPasswordInput.trim(),
    };
    onUpdateUser(updated);
    setOtpSent(false);
    setOtpInput('');
    setNewPasswordInput('');
    onShowToast(
      isEn ? 'Password Reset Successful! 🎉' : 'Kata Sandi Berhasil Direset via OTP! 🎉',
      isEn
        ? 'Your new password is now active.'
        : 'Kata sandi baru Anda sudah aktif menggunakan verifikasi OTP.'
    );
    setActiveSection('menu');
  };

  // Admin helper to reset a customer's password
  const handleAdminResetCustomerPass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerPhone || adminResetNewPass.trim().length < 6) {
      onShowToast(
        'Data Belum Lengkap',
        'Pilih pelanggan dan masukkan kata sandi baru minimal 6 karakter.'
      );
      return;
    }
    const savedStr = localStorage.getItem('griya_ayu_customers');
    if (savedStr) {
      const list: User[] = JSON.parse(savedStr);
      const idx = list.findIndex((u) => u.phone === selectedCustomerPhone);
      if (idx !== -1) {
        list[idx].pass = adminResetNewPass.trim();
        localStorage.setItem('griya_ayu_customers', JSON.stringify(list));
        onShowToast(
          'Sandi Pelanggan Direset! ✅',
          `Kata sandi untuk member ${list[idx].name} (${list[idx].phone}) berhasil diubah menjadi: ${adminResetNewPass.trim()}`
        );
        setAdminResetNewPass('');
      }
    }
  };

  const storedCustomers: User[] = React.useMemo(() => {
    const saved = localStorage.getItem('griya_ayu_customers');
    return saved ? JSON.parse(saved) : [];
  }, [activeSection]);

  const userTransactions = isAdmin
    ? bookings
    : bookings.filter(
        (b) =>
          b.customer.toLowerCase() === currentUser.name.toLowerCase() ||
          b.wa.replace(/[^0-9]/g, '') === currentUser.phone.replace(/[^0-9]/g, '')
      );

  const totalAdminRevenue = bookings
    .filter((b) => isVerifiedRevenueOrder(b))
    .reduce((sum, b) => sum + b.total, 0);

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-4 space-y-4 flex-1 animate-page-enter">
      {/* ================================================================= */}
      {/* KARTU IDENTITAS ATAS (BERBEDA ANTARA ADMIN VS PELANGGAN)          */}
      {/* ================================================================= */}
      {isAdmin ? (
        /* KARTU KHUSUS AKUN ADMIN */
        <div className="bg-gradient-to-br from-stone-900 via-[#0B261C] to-stone-950 text-white p-4 rounded-2xl shadow-lg border-2 border-[#D4AF37] space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#D4AF37] shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#D4AF37] text-[#0B261C] flex items-center justify-center text-lg font-black border-2 border-amber-200 shadow-md">
                  <i className="fa-solid fa-user-shield text-xl"></i>
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                aria-label="Ubah Foto Profil Admin"
                className="tactile-btn absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-[#0B261C] border border-[#0B261C] flex items-center justify-center text-[10px] shadow"
              >
                <i className="fa-solid fa-camera"></i>
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black uppercase tracking-widest bg-amber-400 text-[#0B261C] px-2 py-0.5 rounded inline-block">
                {isEn ? 'OFFICIAL ADMIN ACCOUNT' : 'AKUN PENGELOLA / ADMIN RESMI'}
              </span>
              <h2 className="text-sm font-black text-white truncate mt-0.5">{currentUser.name}</h2>
              <p className="text-[10px] text-emerald-300 font-mono">
                <i className="fa-brands fa-whatsapp mr-1"></i>
                {currentUser.phone} • AIFMO-P
              </p>
            </div>
          </div>

          {/* Statistik Eksekutif Admin */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-center">
            <div className="bg-black/30 p-2 rounded-xl border border-white/10">
              <span className="text-[9px] text-stone-300 block">
                {isEn ? 'Verified Revenue' : 'Omzet Valid'}
              </span>
              <span className="text-[11px] font-black text-[#D4AF37]">
                {formatRupiah(totalAdminRevenue)}
              </span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl border border-white/10">
              <span className="text-[9px] text-stone-300 block">
                {isEn ? 'Total Orders' : 'Total Booking'}
              </span>
              <span className="text-[11px] font-black text-emerald-300">
                {bookings.length} Sesi
              </span>
            </div>
            <div className="bg-black/30 p-2 rounded-xl border border-white/10">
              <span className="text-[9px] text-stone-300 block">
                {isEn ? 'Members' : 'Total Member'}
              </span>
              <span className="text-[11px] font-black text-amber-300">
                {storedCustomers.length} Akun
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* KARTU KHUSUS AKUN PELANGGAN (CUSTOMER) */
        <div className="gold-shimmer-card bg-gradient-to-r from-[#0B261C] via-[#133e2e] to-[#0B261C] text-white p-4 rounded-2xl shadow-lg border-2 border-[#D4AF37]/80 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#D4AF37] shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-amber-500 text-[#0B261C] flex items-center justify-center text-base font-black border-2 border-amber-100 shadow-md">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                aria-label="Ubah Foto Profil"
                className="tactile-btn absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#D4AF37] text-[#0B261C] border border-[#0B261C] flex items-center justify-center text-[10px] shadow"
              >
                <i className="fa-solid fa-camera"></i>
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black uppercase tracking-widest bg-[#D4AF37] text-[#0B261C] px-2 py-0.5 rounded inline-flex items-center gap-1">
                <i className="fa-solid fa-crown"></i>{' '}
                {isEn ? 'VIP MEMBER ACCOUNT' : 'AKUN MEMBER PELANGGAN'}
              </span>
              <h2 className="text-sm font-black text-white truncate mt-0.5">{currentUser.name}</h2>
              <p className="text-[10px] text-emerald-200 font-mono">
                <i className="fa-solid fa-phone mr-1 text-[9px]"></i>
                {currentUser.phone}
              </p>
            </div>

            <div className="text-right bg-black/30 px-3 py-2 rounded-xl border border-[#D4AF37]/40">
              <span className="text-[8px] uppercase text-amber-200 font-bold block">
                {isEn ? 'Active Points' : 'Saldo Poin'}
              </span>
              <span className="text-base font-black text-[#D4AF37]">{currentUser.points} Pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Tombol Kembali jika sedang membuka Sub-Menu */}
      {activeSection !== 'menu' && (
        <button
          type="button"
          onClick={() => setActiveSection('menu')}
          className="tactile-btn inline-flex items-center gap-1.5 text-xs font-black text-[#0B261C] bg-stone-200 hover:bg-stone-300 px-3 py-1.5 rounded-xl"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{isEn ? 'Back to Account Menu' : 'Kembali ke Menu Akun'}</span>
        </button>
      )}

      {/* ================================================================= */}
      {/* DAFTAR MENU BAR AKUN UTAMA                                        */}
      {/* ================================================================= */}
      {activeSection === 'menu' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs divide-y divide-stone-100 overflow-hidden animate-page-enter">
          {/* 1. Lihat Profil & Ubah Foto Profil */}
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0B261C] flex items-center justify-center text-sm">
                <i className="fa-solid fa-user-pen"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isEn ? 'View Profile & Change Photo' : 'Lihat Profil & Ubah Foto Profil'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isEn
                    ? 'Update profile photo, avatar & full name'
                    : 'Atur foto profil, avatar & nama akun Anda'}
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-stone-400"></i>
          </button>

          {/* 2. Ganti Kata Sandi */}
          <button
            type="button"
            onClick={() => setActiveSection('password')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-sm">
                <i className="fa-solid fa-key"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isEn ? 'Change Password' : 'Ganti Kata Sandi'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isEn
                    ? 'Via OTP, old password, or request Admin help'
                    : 'Minta OTP nomor lama, sandi lama, atau bantuan Admin'}
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-stone-400"></i>
          </button>

          {/* 3. Riwayat Transaksi */}
          <button
            type="button"
            onClick={() => setActiveSection('transactions')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center text-sm">
                <i className="fa-solid fa-file-invoice-dollar"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isAdmin
                    ? isEn
                      ? 'All Customer Transactions & Revenue'
                      : 'Laporan Riwayat Transaksi Semua Pelanggan'
                    : isEn
                    ? 'Transaction History & Receipts'
                    : 'Riwayat Transaksi & Struk Pembayaran'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isAdmin
                    ? `${bookings.length} transaksi tercatat di sistem`
                    : `${userTransactions.length} riwayat transaksi & struk resmi`}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
              {userTransactions.length}
            </span>
          </button>

          {/* 4. Pusat Bantuan */}
          <button
            type="button"
            onClick={() => setActiveSection('help')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center text-sm">
                <i className="fa-solid fa-headset"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isEn ? 'Help Center & Support' : 'Pusat Bantuan'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isEn
                    ? 'FAQ, booking guide & direct WhatsApp support'
                    : 'Tanya jawab (FAQ), panduan & kontak WA Admin'}
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-stone-400"></i>
          </button>

          {/* 5. Tentang GRIYA AYU */}
          <button
            type="button"
            onClick={() => setActiveSection('about')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#0B261C] flex items-center justify-center text-sm">
                <i className="fa-solid fa-spa"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isEn ? 'About GRIYA AYU' : 'Tentang GRIYA AYU'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isEn
                    ? 'AIFMO-P Certification, Therapist & Service Profile'
                    : 'Sertifikasi AIFMO-P, Profil Therapist & Layanan'}
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-stone-400"></i>
          </button>

          {/* 6. Bahasa (Indonesia / Inggris) */}
          <button
            type="button"
            onClick={() => setActiveSection('language')}
            className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center text-sm">
                <i className="fa-solid fa-globe"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900">
                  {isEn ? 'Language / Bahasa' : 'Bahasa (Indonesia / Inggris)'}
                </h3>
                <p className="text-[10px] text-stone-500">
                  {isEn ? 'Active: English (EN)' : 'Aktif: Bahasa Indonesia (ID)'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-[#0B261C] text-[#D4AF37] px-2.5 py-1 rounded-lg uppercase">
              {language === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
            </span>
          </button>

          {/* 7. Keluar / Ganti Akun */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full p-3.5 flex items-center justify-between hover:bg-red-50 transition text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-sm">
                <i className="fa-solid fa-right-from-bracket"></i>
              </div>
              <div>
                <h3 className="text-xs font-black text-red-700">
                  {isEn ? 'Log Out / Switch Account' : 'Keluar / Ganti Akun'}
                </h3>
                <p className="text-[10px] text-red-500">
                  {isEn
                    ? 'Sign out and login with another account'
                    : 'Keluar dari sesi saat ini untuk ganti akun lain'}
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-red-400"></i>
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 1: LIHAT PROFIL & UBAH FOTO PROFIL                       */}
      {/* ================================================================= */}
      {activeSection === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3.5 animate-page-enter"
        >
          <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
            <i className="fa-solid fa-id-badge text-amber-600"></i>
            <span>{isEn ? 'Edit Profile & Photo' : 'Atur Profil & Ubah Foto Profil'}</span>
          </h3>

          {/* Preview Foto Saat Ini */}
          <div className="flex flex-col items-center gap-2 py-2 bg-stone-50 rounded-2xl border border-stone-200">
            {editAvatar ? (
              <img
                src={editAvatar}
                alt="Preview Profil"
                className="w-20 h-20 rounded-full object-cover border-3 border-[#D4AF37] shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#0B261C] text-[#D4AF37] flex items-center justify-center text-2xl font-black border-2 border-[#D4AF37]">
                {initials}
              </div>
            )}

            <input
              type="file"
              id="profilePhotoUpload"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <label
                htmlFor="profilePhotoUpload"
                className="tactile-btn bg-[#0B261C] text-[#D4AF37] text-[11px] font-black px-3 py-1.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <i className="fa-solid fa-upload"></i>
                <span>{isEn ? 'Upload Photo from Phone' : 'Upload Foto dari HP'}</span>
              </label>
              {editAvatar && (
                <button
                  type="button"
                  onClick={() => setEditAvatar('')}
                  className="tactile-btn bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1.5 rounded-xl"
                >
                  Hapus
                </button>
              )}
            </div>

            {/* Pilihan Cepat Avatar */}
            <div className="pt-1 text-center">
              <span className="text-[10px] text-stone-500 font-semibold block mb-1.5">
                {isEn ? 'Or choose a preset avatar:' : 'Atau pilih cepat avatar karakter:'}
              </span>
              <div className="flex items-center justify-center gap-2">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditAvatar(url)}
                    className={`tactile-btn w-9 h-9 rounded-full overflow-hidden border-2 ${
                      editAvatar === url ? 'border-[#0B261C] scale-110 shadow' : 'border-stone-300'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Input Nama */}
          <div>
            <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
              {isEn ? 'Full Name' : 'Nama Lengkap'}
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900"
            />
          </div>

          {/* Info Nomor Telepon (Readonly) */}
          <div>
            <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
              {isEn ? 'Registered Phone / WhatsApp' : 'Nomor Telepon / WA Terdaftar'}
            </label>
            <input
              type="text"
              value={currentUser.phone}
              disabled
              className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-500 cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow"
          >
            <i className="fa-solid fa-floppy-disk mr-1.5"></i>
            {isEn ? 'Save Profile Changes' : 'Simpan Perubahan Profil'}
          </button>
        </form>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 2: GANTI KATA SANDI (3 METODE LENGKAP)                   */}
      {/* ================================================================= */}
      {activeSection === 'password' && (
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3.5 animate-page-enter">
          <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-amber-600"></i>
            <span>{isEn ? 'Change Account Password' : 'Pengaturan Ganti Kata Sandi'}</span>
          </h3>

          {/* 3 Tab Pilihan Cara Ganti Sandi */}
          <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl text-[10px] font-black">
            <button
              type="button"
              onClick={() => setPassMethod('old_pass')}
              className={`py-2 px-1.5 rounded-lg transition ${
                passMethod === 'old_pass'
                  ? 'bg-[#0B261C] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              Sandi Lama
            </button>
            <button
              type="button"
              onClick={() => setPassMethod('otp')}
              className={`py-2 px-1.5 rounded-lg transition ${
                passMethod === 'otp' ? 'bg-[#0B261C] text-[#D4AF37] shadow-xs' : 'text-stone-600'
              }`}
            >
              Minta OTP
            </button>
            <button
              type="button"
              onClick={() => setPassMethod('admin_help')}
              className={`py-2 px-1.5 rounded-lg transition ${
                passMethod === 'admin_help'
                  ? 'bg-[#0B261C] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600'
              }`}
            >
              {isAdmin ? 'Reset Member' : 'Minta Admin'}
            </button>
          </div>

          {/* METODE 1: MASUKKAN KATA SANDI LAMA */}
          {passMethod === 'old_pass' && (
            <form onSubmit={handleSavePasswordByOld} className="space-y-2.5">
              <p className="text-[11px] text-stone-500">
                Masukkan kata sandi lama Anda untuk mengganti ke kata sandi baru:
              </p>
              <div>
                <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                  Kata Sandi Lama
                </label>
                <input
                  type="password"
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  placeholder="Ketik kata sandi lama..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                  Kata Sandi Baru (Min. 6 Karakter)
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Ketik kata sandi baru..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  placeholder="Ulangi kata sandi baru..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                />
              </div>
              <button
                type="submit"
                className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs uppercase"
              >
                Simpan Kata Sandi Baru
              </button>
            </form>
          )}

          {/* METODE 2: MINTA OTP DARI NOMOR SEBELUMNYA */}
          {passMethod === 'otp' && (
            <form onSubmit={handleSavePasswordByOtp} className="space-y-2.5">
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-950">
                Kode OTP akan dikirimkan ke nomor terdaftar Anda: <b>{currentUser.phone}</b>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                className="tactile-btn w-full bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>
                  {otpSent ? 'Kirim Ulang Kode OTP' : 'Minta Kode OTP ke Nomor Terdaftar'}
                </span>
              </button>

              {otpSent && (
                <div className="space-y-2.5 pt-1 animate-page-enter">
                  <div className="bg-emerald-50 border border-emerald-300 p-2 rounded-xl text-center">
                    <span className="text-[10px] text-emerald-800 font-bold block">
                      Simulasi SMS/WA OTP Masuk:
                    </span>
                    <span className="font-mono text-sm font-black text-[#0B261C] tracking-widest">
                      {generatedOtp}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                      Masukkan 6 Digit Kode OTP
                    </label>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Contoh: 123456"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                      Buat Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs uppercase"
                  >
                    Verifikasi OTP & Simpan Sandi
                  </button>
                </div>
              )}
            </form>
          )}

          {/* METODE 3: MINTA BANTUAN ADMIN (ATAU PANEL RESET MEMBER UNTUK ADMIN) */}
          {passMethod === 'admin_help' && (
            <div className="space-y-3">
              {!isAdmin ? (
                <div className="space-y-2.5">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-[11px] text-stone-600 leading-relaxed">
                    Lupa kata sandi lama atau nomor sudah tidak aktif? Anda dapat meminta bantuan{' '}
                    <b>Admin Rismawati (0851-8311-0392)</b> untuk mengganti kata sandi akun Anda.
                  </div>
                  <a
                    href={`https://wa.me/6285183110392?text=${encodeURIComponent(
                      `Halo Admin Griya Ayu (Rismawati), saya ingin meminta bantuan untuk mengganti kata sandi akun member saya:\n\n• Nama: ${currentUser.name}\n• Nomor Terdaftar: ${currentUser.phone}\n\nTerima kasih!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tactile-btn flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl text-xs shadow"
                  >
                    <i className="fa-brands fa-whatsapp text-base"></i>
                    <span>Chat Admin untuk Ganti Kata Sandi</span>
                  </a>
                </div>
              ) : (
                /* Khusus Admin: Form Bantu Ganti Kata Sandi Member Pelanggan */
                <form onSubmit={handleAdminResetCustomerPass} className="space-y-2.5">
                  <p className="text-[11px] text-stone-600">
                    <b>Fitur Khusus Admin:</b> Pilih member pelanggan yang meminta bantuan ganti
                    kata sandi:
                  </p>
                  <div>
                    <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                      Pilih Member Pelanggan
                    </label>
                    <select
                      value={selectedCustomerPhone}
                      onChange={(e) => setSelectedCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold bg-white"
                    >
                      <option value="">-- Pilih Pelanggan --</option>
                      {storedCustomers.map((c) => (
                        <option key={c.phone} value={c.phone}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-stone-700 uppercase block mb-1">
                      Setel Kata Sandi Baru Pelanggan
                    </label>
                    <input
                      type="text"
                      value={adminResetNewPass}
                      onChange={(e) => setAdminResetNewPass(e.target.value)}
                      placeholder="Masukkan sandi baru minimal 6 karakter..."
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="tactile-btn w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs uppercase"
                  >
                    Simpan Sandi Baru Pelanggan
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 3: RIWAYAT TRANSAKSI                                     */}
      {/* ================================================================= */}
      {activeSection === 'transactions' && (
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3 animate-page-enter">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
              <i className="fa-solid fa-receipt text-amber-600"></i>
              <span>
                {isAdmin
                  ? 'Semua Riwayat Transaksi Pelanggan'
                  : 'Riwayat Transaksi & Struk Saya'}
              </span>
            </h3>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
              {userTransactions.length} Data
            </span>
          </div>

          {userTransactions.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-4">
              Belum ada riwayat transaksi tercatat.
            </p>
          ) : (
            <div className="space-y-2.5">
              {userTransactions.map((t) => {
                const isPaid = t.paymentStatus === 'Berhasil';
                const isFailed = t.paymentStatus === 'Gagal';
                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] font-black text-[#0B261C]">
                        #GA-{String(t.id).slice(-6)}
                      </span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : isFailed
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {isPaid ? '✓ BERHASIL' : isFailed ? '✕ GAGAL' : '⏳ PENDING (20m)'}
                      </span>
                    </div>
                    {isAdmin && (
                      <p className="text-[11px] font-black text-emerald-900">
                        👤 {t.customer} ({t.wa})
                      </p>
                    )}
                    <p className="text-xs font-extrabold text-stone-900">{t.items}</p>
                    <p className="text-[10px] text-stone-500 font-semibold">
                      Metode: {t.payMethod}
                    </p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-stone-200/80">
                      <span className="text-stone-600">
                        {t.datePretty} • <b>{t.time} WIB</b>
                      </span>
                      <span className="font-black text-[#0B261C]">{formatRupiah(t.total)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewReceipt(t)}
                      className="tactile-btn w-full mt-1 bg-[#0B261C] text-[#D4AF37] font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-receipt"></i>{' '}
                      {isPaid ? 'Lihat Struk Resmi' : 'Lihat Struk Pending & Bayar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 4: PUSAT BANTUAN                                         */}
      {/* ================================================================= */}
      {activeSection === 'help' && (
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3 animate-page-enter">
          <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
            <i className="fa-solid fa-circle-question text-amber-600"></i>
            <span>{isEn ? 'Help Center & FAQ' : 'Pusat Bantuan Griya Ayu'}</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <p className="font-black text-[#0B261C]">
                1. Bagaimana cara mengunci jadwal booking?
              </p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Pilih 1–3 layanan atau paket bundling, tentukan tanggal & jam kosong, lalu lakukan
                pembayaran QRIS/Transfer dan unggah bukti bayar. Jam otomatis terkunci (abu-abu).
              </p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <p className="font-black text-[#0B261C]">
                2. Kapan poin member saya bertambah?
              </p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Pendaftar baru langsung mendapat +20 Poin. Poin dari setiap sesi terapi otomatis
                masuk ke saldo setelah Admin menandai sesi terapi Anda telah Selesai.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <p className="font-black text-[#0B261C]">
                3. Bagaimana jika ingin ubah jadwal (Reschedule)?
              </p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Konfirmasikan perubahan jadwal maksimal 3 jam sebelum sesi dimulai dengan mengirim
                struk booking Anda ke WhatsApp Admin Rismawati.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <p className="font-black text-[#0B261C]">
                4. Di mana alamat lokasi Griya Ayu Sport Massage & Spa?
              </p>
              <p className="text-[11px] font-extrabold text-stone-800">{GRIYA_AYU_ADDRESS}</p>
              <a
                href={GRIYA_AYU_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 underline"
              >
                <i className="fa-solid fa-map-location-dot"></i>
                <span>{GRIYA_AYU_MAPS_URL}</span>
              </a>
            </div>
          </div>

          <a
            href="https://wa.me/6285183110392?text=Halo%20Admin%20Griya%20Ayu%20(Rismawati)%2C%20saya%20membutuhkan%20bantuan%20terkait%20aplikasi%20booking."
            target="_blank"
            rel="noopener noreferrer"
            className="tactile-btn flex items-center justify-center gap-2 w-full bg-emerald-700 text-white font-black py-3 rounded-xl text-xs shadow"
          >
            <i className="fa-brands fa-whatsapp text-base"></i>
            <span>Hubungi CS / Admin via WhatsApp</span>
          </a>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 5: TENTANG GRIYA AYU                                     */}
      {/* ================================================================= */}
      {activeSection === 'about' && (
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3 animate-page-enter">
          <div className="text-center p-5 rounded-2xl bg-gradient-to-b from-[#0B261C] to-[#144533] text-white border border-[#D4AF37] flex flex-col items-center">
            <GriyaAyuLogo size="lg" showBadge={true} floating={true} />
            <h3 className="font-brand text-base font-black tracking-wider text-[#D4AF37] mt-3.5">
              GRIYA AYU
            </h3>
            <p className="text-[10px] text-amber-200 font-bold uppercase tracking-widest mt-0.5">
              SPORT MASSAGE & SPA
            </p>
            <p className="text-[11px] text-emerald-100 italic mt-1">
              "Release Otot, Pulihkan Energi • Melayani dengan Hati"
            </p>
          </div>

          <div className="space-y-2.5 text-[11px] text-stone-600 leading-relaxed">
            <p>
              <b>Griya Ayu Sport Massage & Spa</b> menghadirkan layanan pemulihan kebugaran tubuh,
              penanganan cedera olahraga (Upper & Lower Injury), Bekam Sunnah 9 Titik Nabawi, serta
              Totok Wajah & Release Leher dengan standar kompetensi resmi <b>AIFMO-P</b>.
            </p>

            {/* Kartu Alamat & Google Maps Resmi Griya Ayu */}
            <div className="bg-emerald-50/90 p-3.5 rounded-xl border-2 border-[#D4AF37] space-y-2 shadow-xs">
              <div className="flex items-center gap-1.5 text-[#0B261C] font-black text-xs">
                <i className="fa-solid fa-location-dot text-red-600 text-sm"></i>
                <span>Alamat & Lokasi Tempat Griya Ayu:</span>
              </div>
              <p className="font-black text-xs text-stone-900 bg-white px-3 py-2 rounded-lg border border-emerald-200">
                {GRIYA_AYU_ADDRESS}
              </p>
              <p className="text-[10px] font-mono font-bold text-emerald-900 break-all">
                <i className="fa-solid fa-link mr-1"></i>
                {GRIYA_AYU_MAPS_URL}
              </p>
              <a
                href={GRIYA_AYU_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="tactile-btn gold-shimmer-card flex items-center justify-center gap-2 w-full bg-[#0B261C] text-[#D4AF37] font-black py-2.5 rounded-xl text-xs shadow border border-[#D4AF37]"
              >
                <i className="fa-solid fa-map-location-dot text-sm"></i>
                <span>Buka Lokasi di Google Maps</span>
              </a>
            </div>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
              <p className="font-black text-[#0B261C]">📌 Informasi Pengelola & Kontak:</p>
              <p>
                • Terapis Bersertifikat: <b>Ibu Kartini (AIFMO-P)</b>
              </p>
              <p>
                • Admin & Reservasi: <b>Rismawati (0851-8311-0392)</b>
              </p>
              <p>
                • Alamat: <b>{GRIYA_AYU_ADDRESS}</b>
              </p>
              <p>
                • Google Maps: <b>{GRIYA_AYU_MAPS_URL}</b>
              </p>
              <p>
                • Jam Operasional: <b>09:00 – 19:00 WIB</b>
              </p>
              <p>
                • Merchant QRIS Resmi:{' '}
                <b>
                  {GRIYA_AYU_QRIS_MERCHANT} (NMID: {GRIYA_AYU_QRIS_NMID})
                </b>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-VIEW 6: PILIHAN BAHASA (INDONESIA / INGGRIS)                  */}
      {/* ================================================================= */}
      {activeSection === 'language' && (
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3 animate-page-enter">
          <h3 className="text-xs font-black text-[#0B261C] uppercase flex items-center gap-1.5">
            <i className="fa-solid fa-language text-amber-600"></i>
            <span>{isEn ? 'Select Application Language' : 'Pilih Bahasa Aplikasi'}</span>
          </h3>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                onChangeLanguage('id');
                onShowToast('Bahasa Diubah 🇮🇩', 'Bahasa aplikasi diatur ke Bahasa Indonesia.');
              }}
              className={`tactile-btn p-3.5 rounded-xl border-2 flex items-center justify-between ${
                language === 'id'
                  ? 'border-[#0B261C] bg-emerald-50/80 font-black'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🇮🇩</span>
                <div className="text-left">
                  <p className="text-xs font-black text-stone-900">Bahasa Indonesia</p>
                  <p className="text-[10px] text-stone-500">Bahasa utama resmi Griya Ayu</p>
                </div>
              </div>
              {language === 'id' && (
                <i className="fa-solid fa-circle-check text-emerald-700 text-base"></i>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeLanguage('en');
                onShowToast('Language Updated 🇬🇧', 'Application language set to English.');
              }}
              className={`tactile-btn p-3.5 rounded-xl border-2 flex items-center justify-between ${
                language === 'en'
                  ? 'border-[#0B261C] bg-emerald-50/80 font-black'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🇬🇧</span>
                <div className="text-left">
                  <p className="text-xs font-black text-stone-900">English (EN)</p>
                  <p className="text-[10px] text-stone-500">International English interface</p>
                </div>
              </div>
              {language === 'en' && (
                <i className="fa-solid fa-circle-check text-emerald-700 text-base"></i>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
