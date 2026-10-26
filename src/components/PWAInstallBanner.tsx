import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2, MoreVertical, Bell } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallBannerProps {
  showNotifPrompt?: boolean;
  onEnableNotifications?: () => void;
  onDismissNotifPrompt?: () => void;
}

// Store globally in case the event fires before component mounts
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  showNotifPrompt = false,
  onEnableNotifications,
  onDismissNotifPrompt,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [activeSlide, setActiveSlide] = useState<'install' | 'notif'>('install');

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetected = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDetected);

    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canShowInstall = !isInstalled && !isDismissed;
  const canShowNotif = Boolean(showNotifPrompt);

  useEffect(() => {
    if (canShowInstall && canShowNotif) {
      const interval = window.setInterval(() => {
        setActiveSlide((prev) => (prev === 'install' ? 'notif' : 'install'));
      }, 5000);
      return () => window.clearInterval(interval);
    } else if (canShowInstall) {
      setActiveSlide('install');
    } else if (canShowNotif) {
      setActiveSlide('notif');
    }
  }, [canShowInstall, canShowNotif]);

  if (!canShowInstall && !canShowNotif) return null;

  const currentMode: 'install' | 'notif' =
    canShowInstall && canShowNotif
      ? activeSlide
      : canShowInstall
      ? 'install'
      : 'notif';

  const handleInstallClick = async () => {
    const promptToUse = deferredPrompt || globalDeferredPrompt;
    if (promptToUse) {
      try {
        await promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
      } catch {
        setShowGuideModal(true);
      }
    } else {
      // Fallback guide when browser hasn't fired beforeinstallprompt (e.g., iOS Safari or preview iframe)
      setShowGuideModal(true);
    }
  };

  const handleCloseBanner = () => {
    setIsDismissed(true);
    if (onDismissNotifPrompt) {
      onDismissNotifPrompt();
    }
  };

  return (
    <>
      <div className="mx-3 mt-1.5 mb-0.5 rounded-xl bg-gradient-to-r from-[#0B261C] via-[#124231] to-[#0B261C] border border-[#D4AF37]/45 px-2.5 py-1.5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          {currentMode === 'install' ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
                <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-[#D4AF37] truncate leading-tight">
                  Pasang Aplikasi Griya Ayu
                </p>
                <p className="text-[10px] text-[#F5F5F0]/80 truncate leading-tight">
                  Akses booking &amp; poin lebih cepat di HP
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
                <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-[#D4AF37] truncate leading-tight">
                  Notifikasi Booking HP
                </p>
                <p className="text-[10px] text-[#F5F5F0]/80 truncate leading-tight">
                  Aktifkan info status jadwal &amp; promo di HP
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {canShowInstall && canShowNotif && (
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev === 'install' ? 'notif' : 'install'))}
                title="Ganti info banner"
                className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/15 text-[9px] font-extrabold text-amber-200 border border-white/15 tabular-nums"
              >
                {currentMode === 'install' ? '1/2' : '2/2'}
              </button>
            )}

            {currentMode === 'install' ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="py-1 px-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#b5952f] text-[#0B261C] font-black text-[11px] shadow-xs hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3 h-3 shrink-0 stroke-[2.5]" />
                <span>Instal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnableNotifications}
                className="py-1 px-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#b5952f] text-[#0B261C] font-black text-[11px] shadow-xs hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Aktifkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseBanner}
              aria-label="Tutup banner"
              className="p-1 rounded-lg text-[#F5F5F0]/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showGuideModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0B261C] border-2 border-[#D4AF37] p-5 text-[#F5F5F0] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#D4AF37]">
                    Pasang Aplikasi Griya Ayu
                  </h3>
                  <p className="text-xs text-[#F5F5F0]/75">
                    Instal ke layar utama HP tanpa penuh memori
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl bg-white/10 text-[#F5F5F0]/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs bg-black/30 p-4 rounded-2xl border border-[#D4AF37]/30">
                <p className="font-bold text-[#D4AF37] text-sm">
                  Cara Pasang di iPhone / iPad (Safari):
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Ketuk tombol <strong className="text-[#D4AF37]">Bagikan (Share)</strong>{' '}
                    <Share className="w-3.5 h-3.5 inline text-[#D4AF37]" /> di bagian bawah browser Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Gulir ke bawah lalu pilih{' '}
                    <strong className="text-[#D4AF37]">"Tambah ke Layar Utama" (Add to Home Screen)</strong>{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline text-[#D4AF37]" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <p className="leading-relaxed">
                    Ketuk <strong className="text-[#D4AF37]">Tambah (Add)</strong> di pojok kanan atas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs bg-black/30 p-4 rounded-2xl border border-[#D4AF37]/30">
                <p className="font-bold text-[#D4AF37] text-sm">
                  Cara Pasang di HP Android (Chrome):
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <p className="leading-relaxed">
                    Buka halaman ini langsung di browser <strong className="text-[#D4AF37]">Google Chrome</strong> HP Anda.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <p className="leading-relaxed">
                    Ketuk ikon menu titik tiga <MoreVertical className="w-3.5 h-3.5 inline text-[#D4AF37]" /> di pojok kanan atas browser.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B261C] font-extrabold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <p className="leading-relaxed">
                    Pilih <strong className="text-[#D4AF37]">"Instal aplikasi"</strong> atau{' '}
                    <strong className="text-[#D4AF37]">"Tambahkan ke Layar utama"</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-3 rounded-xl bg-[#D4AF37] text-[#0B261C] font-extrabold text-sm flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mengerti</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
