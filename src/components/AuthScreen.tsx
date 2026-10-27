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
  updateCustomerPasswordInCloud,
} from '../utils/cloudSync.ts';
import { GriyaAyuLogo } from './GriyaAyuLogo.tsx';

interface AuthScreenProps {
  customers?: User[];
  adminProfile?: User | null;
  onLoginSuccess: (user: User, isAdmin: boolean) => void;
  onRegisterSuccess: (user: User) => void;
  onUpdateCustomerAccount?: (updatedCustomer: User) => void;
  onShowToast: (title: string, message: string, waUrl?: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  customers,
  adminProfile,
  onLoginSuccess,
  onRegisterSuccess,
  onUpdateCustomerAccount,
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

  // State Peringatan Nomor Sudah Terdaftar saat Daftar Baru
  const [alreadyRegisteredPhone, setAlreadyRegisteredPhone] = useState<string>('');
  const [alreadyRegisteredName, setAlreadyRegisteredName] = useState<string>('');
  const [showAlreadyRegisteredModal, setShowAlreadyRegisteredModal] = useState<boolean>(false);

  // Forgot Password (3-Step Reset Kata Sandi via OTP WhatsApp) State
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotPhone, setForgotPhone] = useState<string>('');
  const [forgotTargetUser, setForgotTargetUser] = useState<User | null>(null);
  const [forgotGeneratedOtp, setForgotGeneratedOtp] = useState<string>('');
  const [forgotOtpExpiresAt, setForgotOtpExpiresAt] = useState<number>(0);
  const [forgotOtpInput, setForgotOtpInput] = useState<string>('');
  const [forgotResendCooldown, setForgotResendCooldown] = useState<number>(0);
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState<boolean>(false);
  const [isSavingNewPass, setIsSavingNewPass] = useState<boolean>(false);
  const [forgotNewPass, setForgotNewPass] = useState<string>('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState<string>('');
  const [showForgotNewPass, setShowForgotNewPass] = useState<boolean>(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState<boolean>(false);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string>('');

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (forgotResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setForgotResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [forgotResendCooldown]);

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

  // Fungsi Validasi Awal & Kirim Kode OTP 6 Digit saat Daftar Baru via Proxy /wa-api/api/send-message
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
    setIsSendingOtp(true);
    setAlreadyRegisteredPhone('');
    setAlreadyRegisteredName('');
    setShowAlreadyRegisteredModal(false);

    try {
      // 1. VALIDASI AWAL: Cek terlebih dahulu ke database/state & cloud apakah nomor tersebut sudah terdaftar
      const isMainOrSecondaryAdmin =
        nomorWhatsApp === '087765573476' || nomorWhatsApp === '081585921993';

      const usersList = getStoredCustomers();
      let existingMember = usersList.find(
        (u) => normalizePhone(u.phone) === nomorWhatsApp
      );

      if (!existingMember && !isMainOrSecondaryAdmin) {
        const cloudMember = await fetchCustomerFromCloud(nomorWhatsApp);
        if (cloudMember) {
          existingMember = cloudMember;
        }
      }

      // JIKA NOMOR SUDAH TERDAFTAR: JANGAN panggil API WA Gateway & JANGAN kirim kode OTP apa pun
      if (existingMember || isMainOrSecondaryAdmin) {
        setGeneratedOtp('');
        setOtpTargetPhone('');
        setOtpInput('');
        setAlreadyRegisteredPhone(nomorWhatsApp);
        setAlreadyRegisteredName(
          existingMember?.name || (isMainOrSecondaryAdmin ? 'Admin Griya Ayu' : 'Member Griya Ayu')
        );
        setShowAlreadyRegisteredModal(true);
        return;
      }

      // 2. JIKA NOMOR BELUM TERDAFTAR: Lanjutkan generate kode OTP acak 6 digit
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

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
        // Buka/aktifkan kolom input OTP dan kolom pengisian data diri berikutnya
        setGeneratedOtp(otpCode);
        setOtpTargetPhone(nomorWhatsApp);
        setOtpCooldown(45);
        onShowToast(
          'Kode OTP Terkirim! 📲',
          'Kode OTP berhasil dikirim ke WhatsApp Anda.'
        );
      } else {
        setGeneratedOtp('');
        setOtpTargetPhone('');
        onShowToast(
          'Gagal Mengirim OTP ⚠️',
          data?.error ||
            data?.reason ||
            data?.detail ||
            `Belum berhasil mengirim OTP ke nomor ${nomorWhatsApp}. Pastikan nomor WhatsApp aktif dan coba lagi.`
        );
      }
    } catch (err) {
      setGeneratedOtp('');
      setOtpTargetPhone('');
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

  const handleShortcutToLogin = (phoneToFill?: string) => {
    const targetPhone = phoneToFill || alreadyRegisteredPhone || regPhone;
    const normalized = normalizePhone(targetPhone);
    setShowAlreadyRegisteredModal(false);
    setAlreadyRegisteredPhone('');
    setGeneratedOtp('');
    setOtpTargetPhone('');
    setOtpInput('');
    setLoginPhone(normalized);
    setLoginPassword('');
    setAuthMode('login');
  };

  const handleShortcutToForgotPassword = (phoneToFill?: string) => {
    const targetPhone = phoneToFill || alreadyRegisteredPhone || regPhone;
    const normalized = normalizePhone(targetPhone);
    setShowAlreadyRegisteredModal(false);
    setAlreadyRegisteredPhone('');
    setGeneratedOtp('');
    setOtpTargetPhone('');
    setOtpInput('');
    setLoginPhone(normalized);
    setAuthMode('login');
    handleOpenForgotPasswordModal(normalized);
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

    // 3. Alur Login Standar (Nomor WA + Kata Sandi Akun, dengan dukungan OTP opsional/kondisional)
    if (!cleanPass) {
      onShowToast(
        'Kata Sandi Wajib Diisi 🔒',
        'Mohon masukkan Kata Sandi akun Anda untuk masuk.'
      );
      return;
    }

    if (existingUser.pass !== cleanPass) {
      onShowToast(
        'Kata Sandi Salah ❌',
        'Kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali atau klik "Lupa Kata Sandi?".'
      );
      return;
    }

    // Jika user mengaktifkan/meminta verifikasi OTP tambahan, validasi kode OTP yang diinput
    if (generatedOtp && otpTargetPhone === cleanPhone && cleanOtp) {
      if (cleanOtp !== generatedOtp) {
        onShowToast(
          'Kode OTP Tidak Sesuai ❌',
          'Kode verifikasi OTP 6 digit yang Anda masukkan tidak sesuai. Silakan periksa kembali pesan WhatsApp Anda.'
        );
        return;
      }
    }

    // 4. Simpan sesi di localStorage ('griya_customer_session') selama 3 hari dan arahkan ke dashboard pelanggan
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

    if (!cleanPhone || cleanPhone.length < 9) {
      onShowToast(
        'Nomor Telepon Tidak Valid',
        'Mohon masukkan nomor telepon/WhatsApp aktif yang benar (minimal 9 digit).'
      );
      return;
    }

    // Cek terlebih dahulu ke database jika pengguna menekan submit langsung
    const usersList = getStoredCustomers();
    let already = usersList.find((u) => normalizePhone(u.phone) === cleanPhone);
    if (!already && cleanPhone !== '087765573476' && cleanPhone !== '081585921993') {
      const cloudExisting = await fetchCustomerFromCloud(cleanPhone);
      if (cloudExisting) {
        already = cloudExisting;
      }
    }

    if (already || cleanPhone === '087765573476' || cleanPhone === '081585921993') {
      setGeneratedOtp('');
      setOtpTargetPhone('');
      setOtpInput('');
      setAlreadyRegisteredPhone(cleanPhone);
      setAlreadyRegisteredName(already?.name || 'Admin Griya Ayu');
      setShowAlreadyRegisteredModal(true);
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

    if (!cleanName) {
      onShowToast(
        'Nama Lengkap Wajib Diisi',
        'Mohon isi Nama Lengkap Anda terlebih dahulu.'
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

  const handleOpenForgotPasswordModal = (prefillPhone?: string) => {
    const initialPhone =
      typeof prefillPhone === 'string' && prefillPhone
        ? normalizePhone(prefillPhone)
        : loginPhone
        ? normalizePhone(loginPhone)
        : '';
    setForgotPhone(initialPhone);
    setForgotStep(1);
    setForgotTargetUser(null);
    setForgotGeneratedOtp('');
    setForgotOtpExpiresAt(0);
    setForgotOtpInput('');
    setForgotNewPass('');
    setForgotConfirmPass('');
    setShowForgotNewPass(false);
    setShowForgotConfirmPass(false);
    setForgotErrorMsg('');
    setShowForgotModal(true);
  };

  const handleCloseForgotPasswordModal = () => {
    setShowForgotModal(false);
    setForgotErrorMsg('');
  };

  // Step 1 & Resend Step 2: Validasi nomor WA member & kirim 6-digit OTP Reset Sandi (masa berlaku 5 menit, cooldown 60 detik)
  const handleSendForgotOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotErrorMsg('');

    const cleanPhone = normalizePhone(forgotPhone);
    if (!cleanPhone || cleanPhone.length < 9) {
      setForgotErrorMsg('Mohon masukkan nomor WhatsApp terdaftar yang valid (minimal 9 digit).');
      return;
    }

    if (isSendingForgotOtp) return;
    setIsSendingForgotOtp(true);

    try {
      // Validasi apakah nomor terdaftar di database member (lokal + cloud)
      const usersList = getStoredCustomers();
      let matchedMember = usersList.find(
        (u) => normalizePhone(u.phone) === cleanPhone && u.role !== 'admin'
      );

      const cloudUser = await fetchCustomerFromCloud(cleanPhone);
      if (cloudUser && cloudUser.role !== 'admin') {
        matchedMember = cloudUser;
      }

      if (!matchedMember) {
        setForgotErrorMsg('Nomor WhatsApp belum terdaftar sebagai member.');
        setIsSendingForgotOtp(false);
        return;
      }

      // Generate 6-digit kode OTP acak & simpan dengan masa berlaku 5 menit
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;

      setForgotTargetUser(matchedMember);
      setForgotPhone(cleanPhone);
      setForgotGeneratedOtp(otpCode);
      setForgotOtpExpiresAt(expiresAt);
      setForgotOtpInput('');

      const response = await fetch('/wa-api/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: `Kode OTP untuk reset kata sandi akun Griya Ayu Anda adalah: *${otpCode}*. Berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.`,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && (!data || data.status !== false)) {
        setForgotResendCooldown(60);
        setForgotStep(2);
        onShowToast(
          'Kode OTP Reset Sandi Terkirim! 📲',
          `Kode verifikasi 6 digit telah dikirim ke WhatsApp ${cleanPhone}. Berlaku selama 5 menit.`
        );
      } else {
        setForgotErrorMsg(
          data?.error ||
            data?.reason ||
            data?.detail ||
            `Gagal mengirim kode OTP ke nomor ${cleanPhone}. Pastikan nomor WhatsApp aktif dan coba lagi.`
        );
      }
    } catch (err) {
      setForgotErrorMsg(
        err instanceof Error
          ? err.message
          : `Terjadi kendala jaringan saat mengirim kode OTP ke nomor ${cleanPhone}.`
      );
    } finally {
      setIsSendingForgotOtp(false);
    }
  };

  // Step 2: Verifikasi 6-digit Kode OTP & cek masa berlaku 5 menit
  const handleVerifyForgotOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg('');

    const cleanOtp = forgotOtpInput.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotErrorMsg('Mohon masukkan 6 digit kode OTP terlebih dahulu.');
      return;
    }

    if (
      !forgotGeneratedOtp ||
      cleanOtp !== forgotGeneratedOtp ||
      Date.now() > forgotOtpExpiresAt
    ) {
      setForgotErrorMsg('Kode OTP salah atau telah kedaluwarsa');
      return;
    }

    setForgotStep(3);
  };

  // Step 3: Simpan Kata Sandi Baru ke database member
  const handleSaveForgotNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg('');

    const cleanNewPass = forgotNewPass.trim();
    const cleanConfirmPass = forgotConfirmPass.trim();

    if (!cleanNewPass || cleanNewPass.length < 6) {
      setForgotErrorMsg('Kata sandi baru minimal harus terdiri dari 6 karakter.');
      return;
    }

    if (cleanNewPass !== cleanConfirmPass) {
      setForgotErrorMsg('Konfirmasi kata sandi baru tidak cocok. Silakan periksa kembali.');
      return;
    }

    if (!forgotTargetUser) {
      setForgotErrorMsg('Data member tidak ditemukan. Silakan ulangi dari Langkah 1.');
      setForgotStep(1);
      return;
    }

    // Pastikan OTP masih valid saat eksekusi
    if (!forgotGeneratedOtp || Date.now() > forgotOtpExpiresAt) {
      setForgotErrorMsg('Kode OTP salah atau telah kedaluwarsa');
      setForgotStep(2);
      return;
    }

    setIsSavingNewPass(true);
    try {
      const cleanPhone = normalizePhone(forgotTargetUser.phone);
      const updatedCustomer = await updateCustomerPasswordInCloud(
        forgotTargetUser,
        cleanNewPass
      );

      // Update daftar member lokal tanpa mengubah ID, nomor WA, poin, maupun riwayat
      const usersList = getStoredCustomers();
      const updatedList: User[] = usersList.map(
        (u): User =>
          normalizePhone(u.phone) === cleanPhone
            ? {
                ...u,
                pass: cleanNewPass,
                points: u.points,
                role: u.role === 'admin' ? 'admin' : u.role || 'customer',
                status: u.status || 'active',
              }
            : u
      );
      saveCustomersPersistently(updatedList);

      if (onUpdateCustomerAccount) {
        onUpdateCustomerAccount(updatedCustomer);
      }

      // Isi otomatis nomor WA di form login, kosongkan field sandi lama, tutup modal
      setAuthMode('login');
      setLoginPhone(cleanPhone);
      setLoginPassword('');
      setShowForgotModal(false);
      setForgotGeneratedOtp('');
      setForgotOtpInput('');

      onShowToast(
        'Kata Sandi Berhasil Diperbarui! ✅',
        'Kata sandi berhasil diperbarui! Silakan login kembali dengan sandi baru Anda.'
      );
    } finally {
      setIsSavingNewPass(false);
    }
  };

  const isAdminPhoneInput =
    normalizePhone(loginPhone) === '087765573476' ||
    normalizePhone(loginPhone) === '081585921993';

  const isRegOtpSentForCurrentPhone = Boolean(
    generatedOtp &&
      otpTargetPhone &&
      otpTargetPhone === normalizePhone(regPhone) &&
      !alreadyRegisteredPhone
  );

  return (
    <div className="flex-1 flex flex-col justify-center px-4 py-5 bg-gradient-to-b from-[#0B261C] via-[#123829] to-[#081C15] text-white animate-page-enter">
      {/* Brand Header Griya Ayu */}
      <div className="text-center mb-4 flex flex-col items-center">
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
      <div className="bg-[#F9F6F0] text-stone-800 rounded-3xl p-5 shadow-2xl border-2 border-[#D4AF37]/70 space-y-4">
        {/* Tab Switcher: Masuk vs Daftar Baru */}
        <div className="grid grid-cols-2 bg-stone-200/90 p-1 rounded-2xl text-xs font-black">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`tactile-btn py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
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
            className={`tactile-btn py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
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
          <form onSubmit={handleLogin} className="space-y-4 animate-page-enter">
            {/* Sub-judul Singkat & Ramah */}
            <div className="text-center pb-0.5">
              <p className="text-xs font-semibold text-stone-600">
                Silakan masuk ke akun member Anda
              </p>
            </div>

            {/* Field 1: Nomor Telepon / WhatsApp */}
            <div className="space-y-1.5">
              <label
                htmlFor="loginPhoneInput"
                className="text-xs font-extrabold text-stone-700 uppercase tracking-wide block"
              >
                Nomor Telepon / WhatsApp <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-800 pointer-events-none">
                  <i className="fa-solid fa-phone text-xs"></i>
                </span>
                <input
                  id="loginPhoneInput"
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
                />
              </div>
            </div>

            {/* Field 2: Kata Sandi Akun + Link Tunggal "Lupa Kata Sandi?" di Kanan Atas */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="loginPassInput"
                  className="text-xs font-extrabold text-stone-700 uppercase tracking-wide"
                >
                  {isAdminPhoneInput ? 'Kata Sandi Admin *' : 'Kata Sandi Akun *'}
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenForgotPasswordModal()}
                  className="text-xs font-extrabold text-emerald-800 hover:text-[#0B261C] hover:underline flex items-center gap-1 transition cursor-pointer"
                >
                  <i className="fa-solid fa-key text-[10px] text-[#D4AF37]"></i>
                  <span>Lupa Kata Sandi?</span>
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-800 pointer-events-none">
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
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <i
                    className={`fa-regular ${
                      showLoginPassword ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                    } text-xs`}
                  ></i>
                </button>
              </div>
            </div>

            {/* Tombol Utama Masuk Sekarang */}
            <div className="pt-1">
              <button
                type="submit"
                className="tactile-btn gold-shimmer-card w-full bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-[#0B261C] font-black py-3 rounded-lg shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Masuk Sekarang</span>
              </button>
            </div>

            <p className="text-[11px] text-center text-stone-600 font-medium pt-0.5">
              Belum pernah daftar member?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="font-extrabold text-emerald-800 hover:text-[#0B261C] underline cursor-pointer"
              >
                Daftar Baru di sini
              </button>
            </p>
          </form>
        ) : (
          /* Form Daftar Akun Baru */
          <form onSubmit={handleRegister} className="space-y-3.5 animate-page-enter">
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

            {/* LANGKAH 1: Nomor WhatsApp + Tombol Kirim Kode OTP (Dicek terlebih dahulu ke database) */}
            <div className="space-y-1.5">
              <label
                htmlFor="regPhoneInput"
                className="text-[10px] font-black text-stone-700 uppercase block"
              >
                1. Nomor Telepon / WhatsApp Aktif <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800 pointer-events-none">
                  <i className="fa-solid fa-phone text-xs"></i>
                </span>
                <input
                  id="regPhoneInput"
                  type="tel"
                  value={regPhone}
                  onChange={(e) => {
                    setRegPhone(e.target.value);
                    if (alreadyRegisteredPhone) {
                      setAlreadyRegisteredPhone('');
                      setAlreadyRegisteredName('');
                    }
                  }}
                  placeholder="Contoh: 081234567890"
                  className="w-full pl-8 pr-32 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                />
                <button
                  type="button"
                  disabled={isSendingOtp || otpCooldown > 0}
                  onClick={() => handleSendOtpCode(regPhone)}
                  className={`absolute right-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap flex items-center justify-center gap-1 transition ${
                    isSendingOtp || otpCooldown > 0
                      ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                      : 'bg-[#25D366] hover:bg-[#1ebe5d] text-white cursor-pointer shadow-xs'
                  }`}
                >
                  {isSendingOtp ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-[10px]"></i>
                      <span>Cek & Kirim...</span>
                    </>
                  ) : otpCooldown > 0 ? (
                    <span>Ulang ({otpCooldown}d)</span>
                  ) : (
                    <>
                      <i className="fa-brands fa-whatsapp text-xs"></i>
                      <span>Kirim Kode OTP</span>
                    </>
                  )}
                </button>
              </div>
              {!isRegOtpSentForCurrentPhone && !alreadyRegisteredPhone && (
                <p className="text-[10px] text-stone-500 font-semibold">
                  Masukkan nomor WhatsApp lalu klik <b>Kirim Kode OTP</b> untuk membuka pengisian data diri.
                </p>
              )}
            </div>

            {/* Alert Peringatan Inline jika Nomor Sudah Terdaftar */}
            {alreadyRegisteredPhone && (
              <div
                role="alert"
                className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-3.5 space-y-2.5 shadow-md animate-page-enter"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-[#0B261C] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-sm"></i>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-stone-900 leading-snug">
                      Nomor WhatsApp <span className="underline text-[#0B261C]">{alreadyRegisteredPhone}</span> sudah terdaftar sebagai member Griya Ayu. Silakan masuk ke akun Anda.
                    </p>
                    {alreadyRegisteredName && (
                      <p className="text-[10px] font-bold text-stone-600">
                        Terdaftar atas nama: <span className="text-emerald-900 font-black">{alreadyRegisteredName}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShortcutToLogin(alreadyRegisteredPhone)}
                    className="tactile-btn py-2 px-3 rounded-xl bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] border border-[#D4AF37] font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-right-to-bracket"></i>
                    <span>Masuk Sekarang (Login)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShortcutToForgotPassword(alreadyRegisteredPhone)}
                    className="tactile-btn py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-emerald-900 border border-emerald-800/40 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-key text-[#D4AF37]"></i>
                    <span>Lupa Kata Sandi?</span>
                  </button>
                </div>
              </div>
            )}

            {/* Kolom OTP & Data Diri: Hanya Aktif / Terbuka jika Nomor WA Belum Terdaftar & OTP Sudah Dikirim */}
            {!alreadyRegisteredPhone && (
              <div
                className={`space-y-3.5 transition-opacity ${
                  isRegOtpSentForCurrentPhone ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {/* Input Kode OTP untuk Daftar Baru */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="regOtpInput"
                      className="text-[10px] font-black text-emerald-950 uppercase flex items-center gap-1"
                    >
                      <i className="fa-solid fa-shield-check text-emerald-700"></i>
                      <span>2. Kode Verifikasi OTP (6 Digit)</span>
                    </label>
                    {isRegOtpSentForCurrentPhone ? (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Kode OTP berhasil dikirim ke WhatsApp Anda
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-stone-500">
                        Menunggu Kirim OTP
                      </span>
                    )}
                  </div>
                  <input
                    id="regOtpInput"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={!isRegOtpSentForCurrentPhone}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder={
                      isRegOtpSentForCurrentPhone
                        ? 'Ketik 6 digit kode OTP dari WhatsApp...'
                        : 'Klik "Kirim Kode OTP" terlebih dahulu...'
                    }
                    className={`w-full px-3 py-2 border rounded-xl text-center font-mono text-sm font-black tracking-[0.25em] focus:outline-none ${
                      isRegOtpSentForCurrentPhone
                        ? 'bg-white border-emerald-300 text-[#0B261C] focus:border-[#0B261C]'
                        : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="regNameInput"
                    className="text-[10px] font-black text-stone-700 uppercase block mb-1"
                  >
                    3. Nama Lengkap Pelanggan
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                      <i className="fa-solid fa-user text-xs"></i>
                    </span>
                    <input
                      id="regNameInput"
                      type="text"
                      disabled={!isRegOtpSentForCurrentPhone}
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={
                        isRegOtpSentForCurrentPhone
                          ? 'Contoh: Siti Aminah'
                          : 'Aktif setelah OTP dikirim ke WhatsApp...'
                      }
                      className={`w-full pl-8 pr-3 py-2.5 border rounded-xl text-xs font-bold focus:outline-none ${
                        isRegOtpSentForCurrentPhone
                          ? 'bg-white border-stone-300 text-stone-900 focus:border-[#0B261C]'
                          : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="regPassInput"
                    className="text-[10px] font-black text-stone-700 uppercase block mb-1"
                  >
                    4. Buat Kata Sandi (Min. 6 Karakter)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                      <i className="fa-solid fa-key text-xs"></i>
                    </span>
                    <input
                      id="regPassInput"
                      type={showRegPassword ? 'text' : 'password'}
                      disabled={!isRegOtpSentForCurrentPhone}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter..."
                      className={`w-full pl-8 pr-9 py-2.5 border rounded-xl text-xs font-bold focus:outline-none ${
                        isRegOtpSentForCurrentPhone
                          ? 'bg-white border-stone-300 text-stone-900 focus:border-[#0B261C]'
                          : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={!isRegOtpSentForCurrentPhone}
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
                    5. Ulangi Kata Sandi
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-800">
                      <i className="fa-solid fa-shield-halved text-xs"></i>
                    </span>
                    <input
                      id="regConfirmInput"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      disabled={!isRegOtpSentForCurrentPhone}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi..."
                      className={`w-full pl-8 pr-9 py-2.5 border rounded-xl text-xs font-bold focus:outline-none ${
                        isRegOtpSentForCurrentPhone
                          ? 'bg-white border-stone-300 text-stone-900 focus:border-[#0B261C]'
                          : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={!isRegOtpSentForCurrentPhone}
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
                  disabled={!isRegOtpSentForCurrentPhone}
                  className={`tactile-btn w-full font-black py-3 rounded-lg shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                    isRegOtpSentForCurrentPhone
                      ? 'bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] border border-[#D4AF37] cursor-pointer'
                      : 'bg-stone-300 text-stone-500 border border-stone-300 cursor-not-allowed'
                  }`}
                >
                  <i className="fa-solid fa-user-check"></i> Daftar & Klaim +20 Poin
                </button>
              </div>
            )}

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

      {/* ===================================================================== */}
      {/* MODAL PERINGATAN: NOMOR WHATSAPP SUDAH TERDAFTAR SEBAGAI MEMBER       */}
      {/* ===================================================================== */}
      {showAlreadyRegisteredModal && alreadyRegisteredPhone && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="alreadyRegisteredModalTitle"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-page-enter"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#F9F6F0] text-stone-800 border-2 border-[#D4AF37] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#0B261C] via-[#123d2d] to-[#0B261C] text-white p-4 border-b border-[#D4AF37]/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center shrink-0 text-[#D4AF37]">
                  <i className="fa-solid fa-user-shield text-sm"></i>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-200 block">
                    Peringatan Pendaftaran
                  </span>
                  <h3
                    id="alreadyRegisteredModalTitle"
                    className="text-sm font-black text-[#D4AF37] leading-tight"
                  >
                    Nomor Sudah Terdaftar
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAlreadyRegisteredModal(false)}
                aria-label="Tutup peringatan"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-1.5 text-stone-800">
                <p className="font-bold leading-relaxed text-stone-900">
                  Nomor WhatsApp <span className="font-black underline text-[#0B261C]">{alreadyRegisteredPhone}</span> sudah terdaftar sebagai member Griya Ayu. Silakan masuk ke akun Anda.
                </p>
                {alreadyRegisteredName && (
                  <p className="text-[11px] font-semibold text-stone-600">
                    Nama Member: <span className="font-black text-emerald-900">{alreadyRegisteredName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleShortcutToLogin(alreadyRegisteredPhone)}
                  className="tactile-btn gold-shimmer-card w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md border border-amber-300 cursor-pointer"
                >
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Masuk Sekarang (Login)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShortcutToForgotPassword(alreadyRegisteredPhone)}
                  className="tactile-btn w-full py-2.5 px-4 rounded-xl bg-[#0B261C] hover:bg-emerald-950 text-[#D4AF37] border border-[#D4AF37] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-key"></i>
                  <span>Lupa Kata Sandi?</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL KHUSUS ATUR ULANG KATA SANDI (POP-UP TERPISAH VIA OTP WA)       */}
      {/* ===================================================================== */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgotPasswordModalTitle"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-page-enter"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#F9F6F0] text-stone-800 border-2 border-[#D4AF37] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header Modal Hijau Tua & Aksen Emas */}
            <div className="bg-gradient-to-r from-[#0B261C] via-[#123d2d] to-[#0B261C] text-white p-4 border-b border-[#D4AF37]/60">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center shrink-0 text-[#D4AF37]">
                    <i className="fa-solid fa-key text-sm"></i>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200 block">
                      Pemulihan Akun Member
                    </span>
                    <h3
                      id="forgotPasswordModalTitle"
                      className="text-sm font-black text-[#D4AF37] leading-tight"
                    >
                      Atur Ulang Kata Sandi
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForgotPasswordModal}
                  aria-label="Tutup modal atur ulang kata sandi"
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-black shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Indikator 3 Langkah */}
              <div className="grid grid-cols-3 gap-1.5 mt-3.5 pt-3 border-t border-white/10 text-[10px] font-extrabold">
                <div
                  className={`px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border ${
                    forgotStep === 1
                      ? 'bg-[#D4AF37] text-[#0B261C] border-[#D4AF37]'
                      : forgotStep > 1
                      ? 'bg-emerald-800/70 text-[#D4AF37] border-[#D4AF37]/50'
                      : 'bg-white/5 text-stone-300 border-white/10'
                  }`}
                >
                  <span>1. Nomor WA</span>
                </div>
                <div
                  className={`px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border ${
                    forgotStep === 2
                      ? 'bg-[#D4AF37] text-[#0B261C] border-[#D4AF37]'
                      : forgotStep > 2
                      ? 'bg-emerald-800/70 text-[#D4AF37] border-[#D4AF37]/50'
                      : 'bg-white/5 text-stone-300 border-white/10'
                  }`}
                >
                  <span>2. Kode OTP</span>
                </div>
                <div
                  className={`px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border ${
                    forgotStep === 3
                      ? 'bg-[#D4AF37] text-[#0B261C] border-[#D4AF37]'
                      : 'bg-white/5 text-stone-300 border-white/10'
                  }`}
                >
                  <span>3. Sandi Baru</span>
                </div>
              </div>
            </div>

            {/* Body Modal Sesuai Tahapan */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {forgotErrorMsg && (
                <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation text-red-600 mt-0.5 shrink-0"></i>
                  <span>{forgotErrorMsg}</span>
                </div>
              )}

              {/* STEP 1: INPUT NOMOR WHATSAPP */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendForgotOtp} className="space-y-4">
                  <div className="bg-emerald-950/5 border border-emerald-900/15 p-3 rounded-2xl text-[11px] text-stone-700 leading-relaxed">
                    Masukkan <b>Nomor WhatsApp</b> terdaftar Anda untuk menerima 6 digit kode OTP pemulihan kata sandi.
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="forgotPhoneInput"
                      className="text-[10px] font-black text-stone-700 uppercase block"
                    >
                      Nomor WhatsApp Terdaftar <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-800 pointer-events-none">
                        <i className="fa-brands fa-whatsapp text-sm"></i>
                      </span>
                      <input
                        id="forgotPhoneInput"
                        type="tel"
                        value={forgotPhone}
                        onChange={(e) => {
                          setForgotPhone(e.target.value);
                          setForgotErrorMsg('');
                        }}
                        placeholder="Contoh: 081234567890"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C] focus:ring-1 focus:ring-[#0B261C]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSendingForgotOtp}
                      className={`tactile-btn gold-shimmer-card w-full py-2.5 px-4 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md border border-amber-300 ${
                        isSendingForgotOtp
                          ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] cursor-pointer'
                      }`}
                    >
                      {isSendingForgotOtp ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          <span>Mengirim OTP...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-brands fa-whatsapp text-sm"></i>
                          <span>Kirim OTP</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseForgotPasswordModal}
                      className="tactile-btn w-full py-2 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer"
                    >
                      Kembali ke Login
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: VERIFIKASI KODE OTP */}
              {forgotStep === 2 && (
                <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-emerald-950 leading-relaxed">
                      Kode verifikasi telah dikirim ke nomor{' '}
                      <span className="font-black text-[#0B261C] underline">{forgotPhone}</span>
                    </p>
                    <p className="text-[10px] text-emerald-800 font-semibold">
                      ⏳ Kode berlaku selama 5 menit sejak dikirim.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="forgotOtpField"
                      className="text-[10px] font-black text-stone-700 uppercase block"
                    >
                      Masukkan 6 Digit Kode OTP <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="forgotOtpField"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={forgotOtpInput}
                      onChange={(e) => {
                        setForgotOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        setForgotErrorMsg('');
                      }}
                      placeholder="••••••"
                      className="w-full px-3 py-2.5 bg-white border-2 border-emerald-400 rounded-xl text-center font-mono text-base font-black tracking-[0.35em] text-[#0B261C] focus:outline-none focus:border-[#0B261C]"
                    />
                  </div>

                  {/* Hitung Mundur 60 Detik & Tombol Kirim Ulang OTP */}
                  <div className="flex items-center justify-between bg-stone-100 px-3 py-2 rounded-xl border border-stone-200">
                    <span className="text-[11px] text-stone-600 font-semibold">
                      Belum menerima kode WA?
                    </span>
                    <button
                      type="button"
                      disabled={forgotResendCooldown > 0 || isSendingForgotOtp}
                      onClick={() => handleSendForgotOtp()}
                      className={`text-[11px] font-black px-2.5 py-1 rounded-lg transition ${
                        forgotResendCooldown > 0 || isSendingForgotOtp
                          ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                          : 'bg-[#0B261C] text-[#D4AF37] hover:bg-emerald-950 cursor-pointer'
                      }`}
                    >
                      {isSendingForgotOtp
                        ? 'Mengirim...'
                        : forgotResendCooldown > 0
                        ? `Kirim Ulang OTP (${forgotResendCooldown}d)`
                        : 'Kirim Ulang OTP'}
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      className="tactile-btn gold-shimmer-card w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md border border-amber-300 cursor-pointer"
                    >
                      <i className="fa-solid fa-shield-check"></i>
                      <span>Verifikasi OTP</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep(1);
                          setForgotErrorMsg('');
                        }}
                        className="tactile-btn py-2 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-[11px] cursor-pointer"
                      >
                        ← Ubah Nomor WA
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseForgotPasswordModal}
                        className="tactile-btn py-2 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-[11px] cursor-pointer"
                      >
                        Kembali ke Login
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* STEP 3: MASUKKAN KATA SANDI BARU */}
              {forgotStep === 3 && (
                <form onSubmit={handleSaveForgotNewPassword} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0B261C] text-[#D4AF37] flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-user-check text-xs"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-[#0B261C] truncate">
                        {forgotTargetUser?.name || 'Member Griya Ayu'} ({forgotPhone})
                      </p>
                      <p className="text-[10px] text-emerald-800 font-semibold">
                        OTP Terverifikasi • Silakan masukkan kata sandi baru
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="forgotNewPassInput"
                      className="text-[10px] font-black text-stone-700 uppercase block"
                    >
                      Kata Sandi Baru (Min. 6 Karakter) <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-800 pointer-events-none">
                        <i className="fa-solid fa-lock text-xs"></i>
                      </span>
                      <input
                        id="forgotNewPassInput"
                        type={showForgotNewPass ? 'text' : 'password'}
                        value={forgotNewPass}
                        onChange={(e) => {
                          setForgotNewPass(e.target.value);
                          setForgotErrorMsg('');
                        }}
                        placeholder="Masukkan kata sandi baru..."
                        className="w-full pl-9 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                        aria-label={showForgotNewPass ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                      >
                        <i
                          className={`fa-regular ${
                            showForgotNewPass ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                          } text-xs`}
                        ></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="forgotConfirmPassInput"
                      className="text-[10px] font-black text-stone-700 uppercase block"
                    >
                      Konfirmasi Kata Sandi Baru <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-800 pointer-events-none">
                        <i className="fa-solid fa-shield-halved text-xs"></i>
                      </span>
                      <input
                        id="forgotConfirmPassInput"
                        type={showForgotConfirmPass ? 'text' : 'password'}
                        value={forgotConfirmPass}
                        onChange={(e) => {
                          setForgotConfirmPass(e.target.value);
                          setForgotErrorMsg('');
                        }}
                        placeholder="Ketik ulang kata sandi baru..."
                        className="w-full pl-9 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#0B261C]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                        aria-label={
                          showForgotConfirmPass
                            ? 'Sembunyikan konfirmasi sandi'
                            : 'Tampilkan konfirmasi sandi'
                        }
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                      >
                        <i
                          className={`fa-regular ${
                            showForgotConfirmPass ? 'fa-eye-slash text-emerald-800' : 'fa-eye'
                          } text-xs`}
                        ></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSavingNewPass}
                      className="tactile-btn gold-shimmer-card w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#D4AF37] via-amber-400 to-amber-500 text-[#0B261C] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md border border-amber-300 cursor-pointer"
                    >
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>
                        {isSavingNewPass ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseForgotPasswordModal}
                      className="tactile-btn w-full py-2 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs cursor-pointer"
                    >
                      Kembali ke Login
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
