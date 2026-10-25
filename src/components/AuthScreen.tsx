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

  // Fungsi Generate & Kirim Kode OTP 6 Digit via Proxy /api/send-otp -> VPS WhatsApp Gateway
  const handleSendOtpCode = async (rawPhoneInput: string) => {
    const cleanPhone = normalizePhone(rawPhoneInput);
    if (!cleanPhone || cleanPhone.length < 9) {
      onShowToast(
        'Nomor WhatsApp Belum Valid',
        'Mohon masukkan nomor HP / WhatsApp aktif (minimal 9 digit) terlebih dahulu sebelum mengirim kode OTP.'
      );
      return;
    }

    if (isSendingOtp) return;

    // 1. Generate kode OTP acak 6 digit
    const randomSixDigitOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Simpan kode OTP di state untuk validasi input pengguna
    setGeneratedOtp(randomSixDigitOtp);
    setOtpTargetPhone(cleanPhone);
    setIsSendingOtp(true);

    try {
      // 3. Panggil API /api/send-otp dengan nomor tujuan pelanggan & format pesan sesuai spesifikasi
      const result = await sendOtpWhatsApp(cleanPhone, randomSixDigitOtp);

      if (result.ok) {
        setOtpCooldown(45);
        onShowToast(
          'Kode OTP Terkirim! 📲',
          `Kode verifikasi OTP 6 digit telah dikirim ke nomor WhatsApp ${cleanPhone}. Silakan periksa WhatsApp Anda dan masukkan kodenya pada kolom OTP.`
        );
      } else {
        onShowToast(
          'Gagal Mengirim OTP ⚠️',
          result.detail ||
            `Belum berhasil mengirim OTP ke nomor ${cleanPhone}. Pastikan nomor WhatsApp aktif dan coba lagi.`
        );
      }
    } catch {
      onShowToast(
        'Gagal Mengirim OTP ⚠️',
        `Terjadi kendala jaringan saat menghubungi server WhatsApp Gateway untuk nomor ${cleanPhone}.`
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

    // 3. Validasi jika pelanggan login menggunakan Kode OTP WhatsApp (6 Digit)
    if (cleanOtp.length > 0 || generatedOtp.length > 0) {
      if (!generatedOtp || otpTargetPhone !== cleanPhone) {
        onShowToast(
          'Kirim Kode OTP Dahulu',
          `Silakan klik tombol "Kirim Kode OTP" untuk nomor ${cleanPhone} terlebih dahulu.`
        );
        return;
      }

      if (cleanOtp !== generatedOtp) {
        onShowToast(
          'Kode OTP Tidak Sesuai ❌',
          'Kode verifikasi OTP 6 digit yang Anda masukkan tidak sesuai. Silakan cek kembali pesan WhatsApp Anda.'
        );
        return;
      }

      // Jika OTP cocok: apabila pelanggan belum terdaftar, buatkan akun member otomatis (+20 Poin) atau gunakan akun yang ada
      if (!existingUser) {
        const newCustomer: User = {
          name: `Member ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          pass: cleanPass || '123456',
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
        return;
      }

      saveActiveSession(existingUser, false, true);
      setGeneratedOtp('');
      setOtpInput('');
      onLoginSuccess(existingUser, false);
      return;
    }

    // 4. Fallback: Jika pelanggan login menggunakan Kata Sandi tanpa OTP
    if (!cleanPass) {
      onShowToast(
        'Masukkan Kode OTP atau Kata Sandi',
        'Silakan klik "Kirim Kode OTP" untuk masuk dengan kode verifikasi WhatsApp, atau masukkan Kata Sandi akun Anda.'
      );
      return;
    }

    if (!existingUser) {
      setRegPhone(loginPhone);
      setAuthMode('register');
      onShowToast(
        'Nomor Belum Terdaftar',
        `Nomor ${loginPhone} belum terdaftar sebagai member Griya Ayu.\n\nSilakan klik "Kirim Kode OTP" atau lengkapi pendaftaran pada tab "Daftar Baru" (Gratis Bonus +20 Poin!).`
      );
      return;
    }

    if (existingUser.pass !== cleanPass) {
      onShowToast(
        'Kata Sandi Salah',
        'Kata sandi yang Anda masukkan tidak sesuai. Anda juga bisa masuk dengan mudah menggunakan tombol "Kirim Kode OTP" ke WhatsApp.'
      );
      return;
    }

    saveActiveSession(existingUser, false, true);
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

    // Validasi OTP jika kode OTP telah dikirim atau diisi pada pendaftaran
    if (generatedOtp && otpTargetPhone === cleanPhone) {
      if (!cleanOtp) {
        onShowToast(
          'Masukkan Kode OTP',
          `Silakan masukkan 6 digit Kode OTP yang telah dikirim ke WhatsApp ${cleanPhone}.`
        );
        return;
      }
      if (cleanOtp !== generatedOtp) {
        onShowToast(
          'Kode OTP Tidak Sesuai ❌',
          'Kode verifikasi OTP 6 digit yang Anda masukkan salah. Silakan periksa kembali pesan WhatsApp Anda.'
        );
        return;
      }
    } else if (cleanOtp) {
      onShowToast(
        'Kirim Kode OTP Dahulu',
        'Silakan klik tombol "Kirim Kode OTP" terlebih dahulu untuk mendapatkan kode verifikasi WhatsApp.'
      );
      return;
    }

    const finalPass = cleanPass || '123456';
    if (cleanPass && cleanPass.length < 6) {
      onShowToast(
        'Kata Sandi Terlalu Pendek',
        'Kata sandi minimal harus terdiri dari 6 karakter.'
      );
      return;
    }

    if (cleanPass && cleanConfirm && cleanPass !== cleanConfirm) {
      onShowToast(
        'Konfirmasi Sandi Berbeda',
        'Kata sandi dan ulangi kata sandi harus sama persis.'
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
      // Jika sudah terdaftar namun sudah verifikasi OTP dengan benar, langsung loginkan
      if (generatedOtp && otpTargetPhone === cleanPhone && cleanOtp === generatedOtp) {
        saveActiveSession(already, false, true);
        setGeneratedOtp('');
        setOtpInput('');
        onLoginSuccess(already, false);
        return;
      }
      onShowToast(
        'Nomor Sudah Terdaftar',
        `Nomor ${cleanPhone} sudah terdaftar atas nama ${already.name}. Silakan langsung Masuk (Login) memakai Kode OTP atau kata sandi Anda.`
      );
      setAuthMode('login');
      setLoginPhone(cleanPhone);
      return;
    }

    // Pendaftar baru dapat +20 Poin bonus & langsung disimpan ke Cloud Global + sesi 3 hari
    const newCustomer: User = {
      name: cleanName,
      phone: cleanPhone,
      pass: finalPass,
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
      'Anda dapat langsung masuk menggunakan tombol "Kirim Kode OTP" ke WhatsApp tanpa kata sandi, atau hubungi Admin Rismawati melalui WhatsApp.',
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
                Verifikasi & Masuk Pelanggan
              </h2>
              <p className="text-[10px] text-stone-600 leading-snug mt-0.5">
                Masukkan nomor WhatsApp Anda lalu klik <b>Kirim Kode OTP</b> untuk menerima 6 digit kode verifikasi langsung di WhatsApp.
              </p>
            </div>

            {/* Input Nomor Telepon + Tombol Kirim Kode OTP */}
            <div className="space-y-1.5">
              <label
                htmlFor="loginPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block"
              >
                Nomor Telepon / WhatsApp
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

            {/* Input Kode Verifikasi OTP 6 Digit */}
            {!isAdminPhoneInput && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="loginOtpInput"
                    className="text-[10px] font-black text-emerald-950 uppercase flex items-center gap-1"
                  >
                    <i className="fa-solid fa-shield-check text-emerald-700"></i>
                    <span>Kode Verifikasi OTP (6 Digit)</span>
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

            {/* Input Kata Sandi (Wajib untuk Admin / Opsional untuk Pelanggan jika memakai OTP) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="loginPassInput"
                  className="text-[10px] font-black text-stone-700 uppercase"
                >
                  {isAdminPhoneInput ? 'Kata Sandi Admin' : 'Kata Sandi (Opsional jika pakai OTP)'}
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
                      : 'Kosongkan jika masuk dengan Kode OTP...'
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

            {/* Tombol Masuk */}
            <button
              type="submit"
              className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-unlock-keyhole"></i>
              <span>{otpInput.length === 6 ? 'Verifikasi OTP & Masuk' : 'Masuk Sekarang'}</span>
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
