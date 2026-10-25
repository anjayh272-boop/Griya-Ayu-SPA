import React from 'react';

interface ToastModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  waUrl?: string | null;
  onClose: () => void;
}

export const ToastModal: React.FC<ToastModalProps> = ({ isOpen, title, message, waUrl, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade">
      <div className="bg-[#F9F6F0] border-2 border-[#D4AF37] rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center space-y-3.5 animate-modal-pop">
        <div className="w-14 h-14 rounded-full bg-[#0B261C] text-[#D4AF37] flex items-center justify-center mx-auto text-2xl shadow-lg border border-[#D4AF37]/50 animate-float-logo">
          <i className="fa-solid fa-check"></i>
        </div>

        <h3 className="font-extrabold text-base text-[#0B261C] tracking-wide">{title}</h3>
        <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line text-left bg-white/70 p-3 rounded-xl border border-stone-200">
          {message}
        </p>

        {waUrl && (
          <div className="pt-1">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-btn flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition"
            >
              <i className="fa-brands fa-whatsapp text-base"></i> Hubungi WA Admin Griya Ayu
            </a>
          </div>
        )}

        <button
          onClick={onClose}
          className="tactile-btn w-full bg-[#D4AF37] hover:bg-amber-500 text-[#0B261C] font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow"
        >
          Mengerti & Tutup
        </button>
      </div>
    </div>
  );
};
