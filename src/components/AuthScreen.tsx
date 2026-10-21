import React, { useState } from 'react';
import { User } from '../types/index.ts';
import { INITIAL_USERS } from '../data/mockData.ts';
import {
  loadCustomersPersistently,
  saveCustomersPersistently,
  safeLoadJson,
  STORAGE_KEYS,
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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizePhone(loginPhone);
    const cleanPass = loginPassword.trim();

    if (!cleanPhone || !cleanPass) {
      onShowToast(
        'Data Belum Lengkap',
        'Mohon masukkan Nomor Telepon/WhatsApp dan Kata Sandi Anda.'
      );
      return;
    }

    // Cek Akun Admin Utama: 085183110392 // RISMAWATI (tersinkron global di Cloud)
    let savedAdmin: User | null =
      adminProfile || safeLoadJson<User | null>(STORAGE_KEYS.ADMIN_PROFILE, null);

    if (cleanPhone === '085183110392' || cleanPhone === '081585921993') {
      const cloudSettings = await fetchSpaSettingsFromCloud();
      if (cloudSettings?.adminProfile) {
        savedAdmin = cloudSettings.adminProfile;
      }
    }

    const expectedAdminPass = savedAdmin?.pass || 'RISMAWATI';

    const isMainAdmin =
      cleanPhone === '085183110392' &&
      (cleanPass.toUpperCase() === expectedAdminPass.toUpperCase() ||
        cleanPass === expectedAdminPass ||
        cleanPass.toUpperCase() === 'RISMAWATI');
    const isSecondaryAdmin =
      cleanPhone === '081585921993' &&
      (cleanPass === 'admin123' ||
        cleanPass.toUpperCase() === expectedAdminPass.toUpperCase() ||
        cleanPass.toUpperCase() === 'RISMAWATI');

    if (isMainAdmin || isSecondaryAdmin) {
      const adminUser: User = savedAdmin || {
        name: 'Rismawati (Admin)',
        phone: cleanPhone,
        pass: cleanPass,
        points: 999,
        role: 'admin',
      };
      onLoginSuccess(adminUser, true);
      return;
    }

    // Jika nomor admin tapi sandi salah
    if (cleanPhone === '085183110392' || cleanPhone === '081585921993') {
      onShowToast(
        'Kata Sandi Admin Salah',
        'Kata sandi untuk akun Admin tidak sesuai. Silakan periksa kembali kata sandi Anda.'
      );
      return;
    }

    // Cek di database pelanggan terdaftar (lokal + cloud global)
    const usersList = getStoredCustomers();
    let existingUser = usersList.find((u) => normalizePhone(u.phone) === cleanPhone);

    // Ambil data terbaru langsung dari Cloud agar pendaftaran/perubahan sandi dari HP lain langsung terbaca
    const cloudUser = await fetchCustomerFromCloud(cleanPhone);
    if (cloudUser) {
      existingUser = cloudUser;
    }

    // WAJIB DAFTAR DULU JIKA BELUM PERNAH DAFTAR
    if (!existingUser) {
      setRegPhone(loginPhone);
      setAuthMode('register');
      onShowToast(
        'Nomor Belum Terdaftar',
        `Nomor ${loginPhone} belum terdaftar sebagai member Griya Ayu.\n\nSilakan lengkapi pendaftaran pada tab "Daftar Baru" menggunakan Nomor Telepon & Kata Sandi Anda (Gratis Bonus +20 Poin!).`
      );
      return;
    }

    if (existingUser.pass !== cleanPass) {
      onShowToast(
        'Kata Sandi Salah',
        'Kata sandi yang Anda masukkan tidak sesuai dengan akun terdaftar. Silakan coba lagi atau klik Lupa Kata Sandi.'
      );
      return;
    }

    onLoginSuccess(existingUser, false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regName.trim();
    const cleanPhone = normalizePhone(regPhone);
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();

    if (!cleanName || !cleanPhone || !cleanPass) {
      onShowToast(
        'Form Belum Lengkap',
        'Mohon isi Nama Lengkap, Nomor Telepon/WhatsApp, dan Kata Sandi.'
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

    if (cleanPass.length < 6) {
      onShowToast(
        'Kata Sandi Terlalu Pendek',
        'Kata sandi minimal harus terdiri dari 6 karakter.'
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

    if (cleanPhone === '085183110392' || cleanPhone === '081585921993') {
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
        `Nomor ${cleanPhone} sudah terdaftar atas nama ${already.name}. Silakan langsung Masuk (Login) memakai kata sandi Anda.`
      );
      setAuthMode('login');
      setLoginPhone(cleanPhone);
      return;
    }

    // Pendaftar baru dapat +20 Poin bonus & langsung disimpan ke Cloud Global
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

    onRegisterSuccess(newCustomer);
  };

  const handleForgotPassword = () => {
    onShowToast(
      'Bantuan Reset Kata Sandi',
      'Untuk bantuan mereset kata sandi akun member Griya Ayu Anda, silakan hubungi Admin Rismawati melalui WhatsApp.',
      'https://wa.me/6285183110392?text=Halo%20Admin%20Griya%20Ayu%2C%20saya%20ingin%20bantuan%20reset%20kata%20sandi%20akun%20member%20saya.'
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-4 py-6 bg-gradient-to-b from-[#0B261C] via-[#123829] to-[#081C15] text-white animate-page-enter">
      {/* Brand Header Griya Ayu - Logo Vektor Bulat Simetris & Badge Emas */}
      <div className="text-center mb-5 flex flex-col items-center">
        <GriyaAyuLogo size="lg" showBadge={true} floating={true} />
        <h1 className="font-brand text-2xl font-extrabold tracking-[0.18em] text-[#D4AF37] mt-3.5">
          GRIYA AYU
        </h1>
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-100 font-bold mt-0.5">
          Sport Massage & Spa
        </p>
        <p className="text-[11px] text-emerald-200/85 italic mt-1">
          "Release Otot, Pulihkan Energi • Melayani dengan Hati"
        </p>
      </div>

      {/* Card Auth Utama */}
      <div className="bg-[#F9F6F0] text-stone-800 rounded-3xl p-4 shadow-2xl border-2 border-[#D4AF37]/70 space-y-3.5">
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
          <form onSubmit={handleLogin} className="space-y-3 animate-page-enter">
            <div className="bg-emerald-950/5 border border-emerald-900/15 px-3 py-2 rounded-xl">
              <h2 className="text-xs font-black text-[#0B261C]">Masuk ke Akun Anda</h2>
              <p className="text-[10px] text-stone-600 leading-snug mt-0.5">
                Pelanggan baru yang belum memiliki akun <b>wajib mendaftar terlebih dahulu</b> pada
                tab <b>Daftar Baru</b>.
              </p>
            </div>

            {/* Input Nomor Telepon */}
            <div>
              <label
                htmlFor="loginPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block mb-1"
              >
                Nomor Telepon / WhatsApp
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-phone text-xs"></i>
                </span>
                <input
                  id="loginPhoneInput"
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="Masukkan nomor HP/WA..."
                  className="w-full pl-8 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
                />
              </div>
            </div>

            {/* Input Kata Sandi */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="loginPassInput"
                  className="text-[10px] font-black text-stone-700 uppercase"
                >
                  Kata Sandi
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
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-8 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
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
              className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black py-3 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-unlock-keyhole"></i> Masuk Sekarang
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

            <div>
              <label
                htmlFor="regPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block mb-1"
              >
                Nomor Telepon / WhatsApp Aktif
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                  <i className="fa-solid fa-phone text-xs"></i>
                </span>
                <input
                  id="regPhoneInput"
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                />
              </div>
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
              className="tactile-btn w-full bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] border border-[#D4AF37] font-black py-3 rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
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
