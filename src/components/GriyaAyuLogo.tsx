import React, { useId } from 'react';

interface GriyaAyuLogoProps {
  /**
   * 'lg' -> w-28 h-28 (AuthScreen & halaman Tentang Griya Ayu) lengkap dengan badge -mt-3 "AIFMO-P CERTIFIED"
   * 'md' -> w-16 h-16 (Header Struk Digital)
   * 'sm' -> w-11 h-11 (Header kiri atas CustomerDashboard & AdminDashboard)
   */
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  floating?: boolean;
  className?: string;
}

export const GriyaAyuLogo: React.FC<GriyaAyuLogoProps> = ({
  size = 'lg',
  showBadge,
  floating = true,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const lotusGradId = `ga-lotus-grad-${uid}`;
  const lotusInnerGradId = `ga-lotus-inner-${uid}`;
  const ringGradId = `ga-ring-grad-${uid}`;

  // Default showBadge = true untuk lg & md, false untuk sm (karena di sebelah sm sudah ada badge AIFMO-P)
  const shouldShowBadge = showBadge !== undefined ? showBadge : size !== 'sm';

  const circleSizeClass =
    size === 'lg'
      ? 'w-28 h-28 border-2'
      : size === 'md'
      ? 'w-16 h-16 border-2'
      : 'w-11 h-11 border-[1.5px]';

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none ${
        floating ? 'animate-float-logo' : ''
      } ${className}`}
    >
      {/* Lingkaran Bulat Sempurna dengan Latar Hijau Gelap (#071A12), Border Emas & Pendaran Cahaya Emas */}
      <div
        className={`relative ${circleSizeClass} rounded-full bg-[#071A12] border-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.35)] flex flex-col items-center justify-center overflow-hidden flex-shrink-0`}
      >
        {/* Ring Emas Tipis Dalam */}
        <div className="absolute inset-1 rounded-full border border-[#D4AF37]/35 pointer-events-none" />

        {/* Inline SVG: Golden Lotus + Inisial GA + Teks Sport Massage */}
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full block"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Logo Griya Ayu Sport Massage & Spa"
        >
          <defs>
            <linearGradient id={lotusGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF5C0" />
              <stop offset="40%" stopColor="#F3E5AB" />
              <stop offset="78%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#9E7614" />
            </linearGradient>

            <linearGradient id={lotusInnerGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8EBA8" />
              <stop offset="55%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#8B6508" />
            </linearGradient>

            <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C59B27" />
              <stop offset="50%" stopColor="#FFF3B0" />
              <stop offset="100%" stopColor="#C59B27" />
            </linearGradient>
          </defs>

          {/* === KELOPAK BUNGA TERATAI EMAS SIMETRIS (GOLDEN LOTUS) === */}
          <g transform="translate(0, -2)">
            {/* Kelopak Bawah Samping Kiri & Kanan (Outer Sweeping Petals) */}
            <path
              d="M60 74 C40 74, 20 65, 14 50 C26 51, 41 57, 54 67 Z"
              fill={`url(#${lotusInnerGradId})`}
              stroke="#071A12"
              strokeWidth="0.9"
            />
            <path
              d="M60 74 C80 74, 100 65, 106 50 C94 51, 79 57, 66 67 Z"
              fill={`url(#${lotusInnerGradId})`}
              stroke="#071A12"
              strokeWidth="0.9"
            />

            {/* Kelopak Lapis Ke-3 Kiri & Kanan */}
            <path
              d="M60 72 C38 67, 23 50, 24 31 C36 36, 48 48, 56 64 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="1"
            />
            <path
              d="M60 72 C82 67, 97 50, 96 31 C84 36, 72 48, 64 64 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="1"
            />

            {/* Kelopak Lapis Ke-2 Kiri & Kanan */}
            <path
              d="M60 70 C43 60, 35 40, 41 20 C49 29, 55 43, 59 61 Z"
              fill={`url(#${lotusInnerGradId})`}
              stroke="#071A12"
              strokeWidth="1"
            />
            <path
              d="M60 70 C77 60, 85 40, 79 20 C71 29, 65 43, 61 61 Z"
              fill={`url(#${lotusInnerGradId})`}
              stroke="#071A12"
              strokeWidth="1"
            />

            {/* Kelopak Utama Tengah (Center Crown Petal) */}
            <path
              d="M60 13 C69 27, 72 46, 60 68 C48 46, 51 27, 60 13 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="1.1"
            />

            {/* Kelopak Dasar Bawah Kiri, Kanan & Tengah */}
            <path
              d="M58 74 C46 79, 34 79, 27 73 C36 69, 47 69, 58 74 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="0.8"
            />
            <path
              d="M62 74 C74 79, 86 79, 93 73 C84 69, 73 69, 62 74 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="0.8"
            />
            <path
              d="M60 69 C66 74, 66 81, 60 86 C54 81, 54 74, 60 69 Z"
              fill={`url(#${lotusGradId})`}
              stroke="#071A12"
              strokeWidth="0.9"
            />
          </g>

          {/* === INISIAL "GA" SERIF MEWAH DI TENGAH KELOPAK TERATAI === */}
          <text
            x="60"
            y="62"
            textAnchor="middle"
            fill={`url(#${ringGradId})`}
            stroke="#071A12"
            strokeWidth="3.2"
            paintOrder="stroke fill"
            style={{
              fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
              fontWeight: 900,
              fontSize: '30px',
              letterSpacing: '1px',
            }}
          >
            GA
          </text>

          {/* === TEKS KECIL "SPORT MASSAGE" DI BAWAH TERATAI === */}
          {size !== 'sm' && (
            <text
              x="60"
              y="95"
              textAnchor="middle"
              fill="#F3E5AB"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: '7.2px',
                letterSpacing: '1.7px',
              }}
            >
              SPORT MASSAGE
            </text>
          )}
        </svg>
      </div>

      {/* Badge Pil Emas Solid Menempel di Bawah Lingkaran (-mt-3) */}
      {shouldShowBadge && (
        <div
          className={`relative z-10 ${
            size === 'lg'
              ? '-mt-3 px-3.5 py-1 text-[9px] tracking-widest'
              : '-mt-2.5 px-2.5 py-0.5 text-[7.5px] tracking-wider'
          } rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#071A12] font-black uppercase shadow-md border border-amber-100/80 whitespace-nowrap`}
        >
          AIFMO-P CERTIFIED
        </div>
      )}
    </div>
  );
};
