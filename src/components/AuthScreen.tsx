import React, { useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { INITIAL_USERS } from '../data/mockData.ts';
import {
  loadCustomersPersistently,
  saveCustomersPersistently,
  saveActiveSession,
  safeLoadJson,
  STORAGE_KEYS,
  sendOtpWhatsApp,
} from '../utils/spaLogic.ts';
import {
  fetchCustomerFromCloud,
  fetchSpaSettingsFromCloud,
  syncCustomerToCloud,
} from '../utils/cloudSync.ts';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface AuthScreenProps {
  customers?: User[];
  adminProfile?: User | null;
  onLoginSuccess: (user: User, isAdmin: boolean) => void;
  onRegisterSuccess: (user: User) => void;
  onShowToast: (title: string, message: string, waUrl?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  customers,
  adminProfile,
  onLoginSuccess,
  onRegisterSuccess,
  onShowToast,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // OTP Verification State (WhatsApp Gateway VPS)
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [otpTargetPhone, setOtpTargetPhone] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  const getStoredCustomers = (): User[] => {
    const localList = loadCustomersPersistently(INITIAL_USERS);
    if (!customers || customers.length === 0) return localList;
    const map = new Map<string, User>();
    localList.forEach((u) => map.set(normalizePhone(u.phone), u));
    customers.forEach((u) => map.set(normalizePhone(u.phone), u));
    return Array.from(map.values());
  };

  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('62')) {
      return '0' + digits.slice(2);
    }
    return digits;
  };

  // Fungsi Generate & Kirim Kode OTP 6 Digit via Serverless Proxy /api/send-otp -> VPS WhatsApp Gateway
  const handleSendOtpCode = async (rawPhoneInput: string) => {
    const nomorWhatsApp = normalizePhone(rawPhoneInput);
    if (!nomorWhatsApp || nomorWhatsApp.length < 9) {
      onShowToast(
        'Nomor WhatsApp Belum Valid',
        'Mohon masukkan nomor HP / WhatsApp aktif (minimal 9 digit) terlebih dahulu sebelum mengirim kode OTP.'
      );
      return;
    }

    if (isSendingOtp) return;

    // 1. Generate kode OTP acak 6 digit
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Simpan kode OTP di state untuk validasi input pengguna
    setGeneratedOtp(otpCode);
    setOtpTargetPhone(nomorWhatsApp);
    setIsSendingOtp(true);

    try {
      // 3. Panggil endpoint proxy Vercel Rewrite (/wa-api/api/send-message)
      const response = await fetch('/wa-api/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: nomorWhatsApp,
          message: `Halo! Kode OTP Griya Ayu Anda adalah: ${otpCode}. Jangan berikan kode ini kepada siapa pun.`,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && (!data || data.status !== false)) {
        setOtpCooldown(45);
        onShowToast(
          'Kode OTP Terkirim! 📲',
          `Kode verifikasi OTP 6 digit telah dikirim ke nomor WhatsApp ${nomorWhatsApp}. Silakan periksa WhatsApp Anda dan masukkan kodenya pada kolom OTP.`
        );
      } else {
        onShowToast(
          'Gagal Mengirim OTP ⚠️',
          data?.error ||
            data?.reason ||
            data?.detail ||
            `Belum berhasil mengirim OTP ke nomor ${nomorWhatsApp}. Pastikan nomor WhatsApp aktif dan coba lagi.`
        );
      }
    } catch (err) {
      onShowToast(
        'Gagal Mengirim OTP ⚠️',
        err instanceof Error
          ? err.message
          : `Terjadi kendala jaringan saat mengirim kode OTP ke nomor ${nomorWhatsApp}.`
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizePhone(loginPhone);
    const cleanPass = loginPassword.trim();
    const cleanOtp = otpInput.trim();

    if (!cleanPhone) {
      onShowToast(
        'Nomor HP Kosong',
        'Mohon masukkan Nomor Telepon / WhatsApp Anda terlebih dahulu.'
      );
      return;
    }

    // 1. Cek Akun Admin Utama: 087765573476 // RISMAWATI (tersinkron global di Cloud)
    let savedAdmin: User | null =
      adminProfile || safeLoadJson<User | null>(STORAGE_KEYS.ADMIN_PROFILE, null);

    if (cleanPhone === '087765573476' || cleanPhone === '081585921993') {
      const cloudSettings = await fetchSpaSettingsFromCloud();
      if (cloudSettings?.adminProfile) {
        savedAdmin = cloudSettings.adminProfile;
      }
    }

    const expectedAdminPass = savedAdmin?.pass || 'RISMAWATI';

    const isMainAdmin =
      cleanPhone === '087765573476' &&
      (cleanPass.toUpperCase() === expectedAdminPass.toUpperCase() ||
        cleanPass === expectedAdminPass ||
        cleanPass.toUpperCase() === 'RISMAWATI' ||
        (generatedOtp && cleanOtp === generatedOtp && otpTargetPhone === cleanPhone));
    const isSecondaryAdmin =
      cleanPhone === '081585921993' &&
      (cleanPass === 'admin123' ||
        cleanPass.toUpperCase() === expectedAdminPass.toUpperCase() ||
        cleanPass.toUpperCase() === 'RISMAWATI' ||
        (generatedOtp && cleanOtp === generatedOtp && otpTargetPhone === cleanPhone));

    if (isMainAdmin || isSecondaryAdmin) {
      const adminUser: User = savedAdmin
        ? {
            ...savedAdmin,
            phone: isMainAdmin ? '087765573476' : cleanPhone,
          }
        : {
            name: 'Rismawati (Admin)',
            phone: cleanPhone,
            pass: cleanPass || expectedAdminPass,
            points: 999,
            role: 'admin',
          };
      saveActiveSession(adminUser, true, true);
      onLoginSuccess(adminUser, true);
      return;
    }

    // Jika nomor admin tapi sandi/OTP salah
    if (cleanPhone === '087765573476' || cleanPhone === '081585921993') {
      onShowToast(
        'Kata Sandi / OTP Admin Salah',
        'Kata sandi atau kode OTP untuk akun Admin tidak sesuai. Silakan periksa kembali.'
      );
      return;
    }

    // 2. Cek di database pelanggan terdaftar (lokal + cloud global)
    const usersList = getStoredCustomers();
    let existingUser = usersList.find((u) => normalizePhone(u.phone) === cleanPhone);

    const cloudUser = await fetchCustomerFromCloud(cleanPhone);
    if (cloudUser) {
      existingUser = cloudUser;
    }

    if (!existingUser) {
      setRegPhone(loginPhone);
      setAuthMode('register');
      onShowToast(
        'Nomor Belum Terdaftar',
        `Nomor ${cleanPhone} belum terdaftar sebagai member Griya Ayu.\n\nSilakan lengkapi pendaftaran pada tab "Daftar Baru" (Gratis Bonus +20 Poin!).`
      );
      return;
    }

    // 3. Alur Login Wajib Kata Sandi + Kode OTP 6 Digit
    if (!cleanPass) {
      onShowToast(
        'Kata Sandi Wajib Diisi 🔒',
        'Mohon masukkan Kata Sandi akun Anda beserta 6 digit Kode OTP dari WhatsApp.'
      );
      return;
    }

    if (!generatedOtp || otpTargetPhone !== cleanPhone) {
      onShowToast(
        'Kirim Kode OTP Dahulu 📲',
        `Silakan klik tombol "Kirim Kode OTP" terlebih dahulu untuk menerima 6 digit kode verifikasi di WhatsApp ${cleanPhone}.`
      );
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
      onShowToast(
        'Kode OTP Wajib Diisi 📲',
        `Mohon masukkan 6 digit Kode OTP yang telah dikirim ke nomor WhatsApp ${cleanPhone}.`
      );
      return;
    }

    if (existingUser.pass !== cleanPass) {
      onShowToast(
        'Kata Sandi Salah ❌',
        'Kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali kata sandi Anda.'
      );
      return;
    }

    if (cleanOtp !== generatedOtp) {
      onShowToast(
        'Kode OTP Tidak Sesuai ❌',
        'Kode verifikasi OTP 6 digit yang Anda masukkan tidak sesuai. Silakan periksa kembali pesan WhatsApp Anda.'
      );
      return;
    }

    // 4. Jika Kata Sandi DAN Kode OTP 6 digit keduanya benar:
    // Simpan sesi di localStorage ('griya_customer_session') selama 3 hari dan arahkan ke dashboard pelanggan
    saveActiveSession(existingUser, false, true);
    setGeneratedOtp('');
    setOtpInput('');
    onLoginSuccess(existingUser, false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regName.trim();
    const cleanPhone = normalizePhone(regPhone);
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();
    const cleanOtp = otpInput.trim();

    if (!cleanName || !cleanPhone) {
      onShowToast(
        'Form Belum Lengkap',
        'Mohon isi Nama Lengkap dan Nomor Telepon/WhatsApp Anda.'
      );
      return;
    }

    if (cleanPhone.length < 9) {
      onShowToast(
        'Nomor Telepon Tidak Valid',
        'Mohon masukkan nomor telepon/WhatsApp aktif yang benar (minimal 9 digit).'
      );
      return;
    }

    if (!cleanPass || cleanPass.length < 6) {
      onShowToast(
        'Kata Sandi Wajib Diisi',
        'Mohon buat kata sandi minimal 6 karakter.'
      );
      return;
    }

    if (cleanPass !== cleanConfirm) {
      onShowToast(
        'Konfirmasi Sandi Berbeda',
        'Kata sandi dan ulangi kata sandi harus sama persis.'
      );
      return;
    }

    if (!generatedOtp || otpTargetPhone !== cleanPhone) {
      onShowToast(
        'Kirim Kode OTP Dahulu 📲',
        `Silakan klik tombol "Kirim Kode OTP" terlebih dahulu untuk memverifikasi nomor WhatsApp ${cleanPhone}.`
      );
      return;
    }

    if (!cleanOtp || cleanOtp !== generatedOtp) {
      onShowToast(
        'Kode OTP Tidak Sesuai ❌',
        'Kode verifikasi OTP 6 digit yang Anda masukkan belum sesuai. Silakan periksa pesan WhatsApp Anda.'
      );
      return;
    }

    if (cleanPhone === '087765573476' || cleanPhone === '081585921993') {
      onShowToast(
        'Nomor Khusus Admin',
        'Nomor ini adalah nomor khusus Admin. Silakan masuk melalui tab Login.'
      );
      setAuthMode('login');
      return;
    }

    const usersList = getStoredCustomers();
    let already = usersList.find((u) => normalizePhone(u.phone) === cleanPhone);
    if (!already) {
      const cloudExisting = await fetchCustomerFromCloud(cleanPhone);
      if (cloudExisting) {
        already = cloudExisting;
      }
    }

    if (already) {
      onShowToast(
        'Nomor Sudah Terdaftar',
        `Nomor ${cleanPhone} sudah terdaftar atas nama ${already.name}. Silakan masuk melalui tab Masuk (Login) dengan Kata Sandi dan Kode OTP Anda.`
      );
      setAuthMode('login');
      setLoginPhone(cleanPhone);
      return;
    }

    // Pendaftar baru dapat +20 Poin bonus & langsung disimpan ke Cloud Global + sesi 3 hari
    const newCustomer: User = {
      name: cleanName,
      phone: cleanPhone,
      pass: cleanPass,
      points: 20,
      role: 'customer',
    };

    const updatedList = [...usersList, newCustomer];
    saveCustomersPersistently(updatedList);
    await syncCustomerToCloud(newCustomer);

    saveActiveSession(newCustomer, false, true);
    setGeneratedOtp('');
    setOtpInput('');
    onRegisterSuccess(newCustomer);
  };

  const handleForgotPassword = () => {
    onShowToast(
      'Bantuan Reset Kata Sandi',
      'Jika Anda lupa kata sandi akun member Griya Ayu, silakan hubungi Admin Rismawati melalui WhatsApp untuk bantuan reset kata sandi.',
      'https://wa.me/6287765573476?text=Halo%20Admin%20Griya%20Ayu%2C%20saya%20ingin%20bantuan%20reset%20kata%20sandi%20akun%20member%20saya.'
    );
  };

  const isAdminPhoneInput =
    normalizePhone(loginPhone) === '087765573476' ||
    normalizePhone(loginPhone) === '081585921993';

  return (
    <div className="flex-1 flex flex-col justify-center px-3.5 py-4 bg-gradient-to-b from-[#0B261C] via-[#123829] to-[#081C15] text-white animate-page-enter">
      {/* Brand Header Griya Ayu */}
      <div className="text-center mb-3.5 flex flex-col items-center">
        <GriyaAyuLogo size="lg" showBadge={true} floating={true} />
        <h1 className="font-brand text-xl font-extrabold tracking-[0.18em] text-[#D4AF37] mt-2.5">
          GRIYA AYU
        </h1>
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-100 font-bold mt-0.5">
          Sport Massage & Spa
        </p>
        <p className="text-[11px] text-emerald-200/90 italic mt-0.5 text-center">
          "Release Otot, Pulihkan Energi, Melayani dengan Sepenuh Hati"
        </p>
      </div>

      {/* Card Auth Utama */}
      <div className="bg-[#F9F6F0] text-stone-800 rounded-3xl p-3.5 shadow-2xl border-2 border-[#D4AF37]/70 space-y-3">
        {/* Tab Switcher: Masuk vs Daftar Baru */}
        <div className="grid grid-cols-2 bg-stone-200/90 p-1 rounded-2xl text-xs font-black">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`tactile-btn py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              authMode === 'login'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow-md'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-right-to-bracket"></i> Masuk (Login)
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('register')}
            className={`tactile-btn py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              authMode === 'register'
                ? 'bg-[#0B261C] text-[#D4AF37] shadow-md'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-user-plus"></i> Daftar Baru
          </button>
        </div>

        {/* Form Masuk (Login) */}
        {authMode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-2.5 animate-page-enter">
            <div className="bg-emerald-950/5 border border-emerald-900/15 px-3 py-2 rounded-xl">
              <h2 className="text-xs font-black text-[#0B261C]">
                Verifikasi Masuk (Wajib Sandi + OTP WhatsApp)
              </h2>
              <p className="text-[10px] text-stone-600 leading-snug mt-0.5">
                Masukkan Nomor WhatsApp, klik <b>Kirim Kode OTP</b>, lalu isi <b>Kata Sandi</b> dan <b>6 digit Kode OTP</b> yang dikirim ke WhatsApp Anda.
              </p>
            </div>

            {/* Input Nomor Telepon + Tombol Kirim Kode OTP */}
            <div className="space-y-1.5">
              <label
                htmlFor="loginPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block"
              >
                Nomor Telepon / WhatsApp <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                    <i className="fa-solid fa-phone text-xs"></i>
                  </span>
                  <input
                    id="loginPhoneInput"
                    type="tel"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-8 pr-2.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
                  />
                </div>
                <button
                  type="button"
                  disabled={isSendingOtp || otpCooldown > 0}
                  onClick={() => handleSendOtpCode(loginPhone)}
                  className={`tactile-btn px-3 py-2.5 rounded-xl text-[11px] font-black whitespace-nowrap flex items-center justify-center gap-1.5 shadow-xs transition shrink-0 ${
                    isSendingOtp || otpCooldown > 0
                      ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
                      : 'bg-[#25D366] hover:bg-[#1ebe5d] text-white'
                  }`}
                >
                  {isSendingOtp ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                      <span>Mengirim...</span>
                    </>
                  ) : otpCooldown > 0 ? (
                    <>
                      <i className="fa-regular fa-clock text-xs"></i>
                      <span>Ulang ({otpCooldown}d)</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-brands fa-whatsapp text-sm"></i>
                      <span>Kirim Kode OTP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Input Kata Sandi (Wajib untuk Pelanggan & Admin) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="loginPassInput"
                  className="text-[10px] font-black text-stone-700 uppercase"
                >
                  {isAdminPhoneInput ? 'Kata Sandi Admin *' : 'Kata Sandi Akun *'}
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] font-extrabold text-emerald-800 hover:underline"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-lock text-xs"></i>
                </span>
                <input
                  id="loginPassInput"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={
                    isAdminPhoneInput
                      ? 'Masukkan kata sandi Admin...'
                      : 'Masukkan kata sandi akun Anda...'
                  }
                  className="w-full pl-8 pr-9 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                >
                  <i
                    className={`fa-regular ${
                      showLoginPassword ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                    } text-xs`}
                  ></i>
                </button>
              </div>
            </div>

            {/* Input Kode Verifikasi OTP 6 Digit (Wajib untuk Pelanggan) */}
            {!isAdminPhoneInput && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="loginOtpInput"
                    className="text-[10px] font-black text-emerald-950 uppercase flex items-center gap-1"
                  >
                    <i className="fa-solid fa-shield-check text-emerald-700"></i>
                    <span>Kode Verifikasi OTP (6 Digit Wajib) *</span>
                  </label>
                  {generatedOtp && otpTargetPhone === normalizePhone(loginPhone) && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ✓ OTP Terkirim ke WA
                    </span>
                  )}
                </div>
                <input
                  id="loginOtpInput"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Ketik 6 digit kode OTP dari WhatsApp..."
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-center font-mono text-sm font-black tracking-[0.25em] text-[#0B261C] focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C]"
                />
              </div>
            )}

            {/* Tombol Masuk */}
            <button
              type="submit"
              className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-unlock-keyhole"></i>
              <span>Verifikasi Sandi + OTP &amp; Masuk</span>
            </button>

            <p className="text-[11px] text-center text-stone-600 font-medium pt-0.5">
              Belum pernah daftar member?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="font-extrabold text-emerald-800 underline"
              >
                Daftar Baru di sini
              </button>
            </p>
          </form>
        ) : (
          /* Form Daftar Akun Baru */
          <form onSubmit={handleRegister} className="space-y-2.5 animate-page-enter">
            {/* Banner Bonus +20 Poin */}
            <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0B261C] text-[#D4AF37] flex items-center justify-center flex-shrink-0 text-xs animate-bounce">
                <i className="fa-solid fa-gift"></i>
              </div>
              <p className="text-[10px] font-bold text-amber-950 leading-tight">
                Daftar member baru sekarang & langsung dapatkan{' '}
                <span className="underline font-black text-emerald-900">Bonus +20 Poin</span>!
              </p>
            </div>

            <div>
              <label
                htmlFor="regNameInput"
                className="text-[10px] font-black text-stone-700 uppercase block mb-1"
              >
                Nama Lengkap Pelanggan
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-user text-xs"></i>
                </span>
                <input
                  id="regNameInput"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Contoh: Siti Aminah"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                />
              </div>
            </div>

            {/* Nomor WhatsApp + Tombol Kirim Kode OTP */}
            <div className="space-y-1.5">
              <label
                htmlFor="regPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block"
              >
                Nomor Telepon / WhatsApp Aktif
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                    <i className="fa-solid fa-phone text-xs"></i>
                  </span>
                  <input
                    id="regPhoneInput"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-8 pr-2.5 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                  />
                </div>
                <button
                  type="button"
                  disabled={isSendingOtp || otpCooldown > 0}
                  onClick={() => handleSendOtpCode(regPhone)}
                  className={`tactile-btn px-3 py-2 rounded-xl text-[11px] font-black whitespace-nowrap flex items-center justify-center gap-1.5 shadow-xs transition shrink-0 ${
                    isSendingOtp || otpCooldown > 0
                      ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
                      : 'bg-[#25D366] hover:bg-[#1ebe5d] text-white'
                  }`}
                >
                  {isSendingOtp ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                      <span>Mengirim...</span>
                    </>
                  ) : otpCooldown > 0 ? (
                    <>
                      <i className="fa-regular fa-clock text-xs"></i>
                      <span>Ulang ({otpCooldown}d)</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-brands fa-whatsapp text-sm"></i>
                      <span>Kirim Kode OTP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Input Kode OTP untuk Daftar Baru */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="regOtpInput"
                  className="text-[10px] font-black text-emerald-950 uppercase flex items-center gap-1"
                >
                  <i className="fa-solid fa-shield-check text-emerald-700"></i>
                  <span>Kode Verifikasi OTP (6 Digit)</span>
                </label>
                {generatedOtp && otpTargetPhone === normalizePhone(regPhone) && (
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ OTP Terkirim ke WA
                  </span>
                )}
              </div>
              <input
                id="regOtpInput"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="Ketik 6 digit kode OTP dari WhatsApp..."
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-center font-mono text-sm font-black tracking-[0.25em] text-[#0B261C] focus:outline-none focus:border-[#0B261C]"
              />
            </div>

            <div>
              <label
                htmlFor="regPassInput"
                className="text-[10px] font-black text-stone-700 uppercase block mb-1"
              >
                Buat Kata Sandi (Min. 6 Karakter)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-key text-xs"></i>
                </span>
                <input
                  id="regPassInput"
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimal 6 karakter..."
                  className="w-full pl-8 pr-9 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label="Lihat sandi"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                >
                  <i
                    className={`fa-regular ${
                      showRegPassword ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                    } text-xs`}
                  ></i>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="regConfirmInput"
                className="text-[10px] font-black text-stone-700 uppercase block mb-1"
              >
                Ulangi Kata Sandi
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-shield-halved text-xs"></i>
                </span>
                <input
                  id="regConfirmInput"
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi..."
                  className="w-full pl-8 pr-9 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  aria-label="Lihat konfirmasi sandi"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                >
                  <i
                    className={`fa-regular ${
                      showRegConfirmPassword ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                    } text-xs`}
                  ></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="tactile-btn w-full bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] border border-[#D4AF37] font-black py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-user-check"></i> Daftar & Klaim +20 Poin
            </button>

            <p className="text-[11px] text-center text-stone-600 font-medium">
              Sudah punya akun member?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="font-extrabold text-emerald-800 underline"
              >
                Masuk di sini
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
