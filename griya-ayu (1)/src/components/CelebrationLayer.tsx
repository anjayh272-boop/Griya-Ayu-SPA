import React from 'react';

interface CelebrationLayerProps {
  pointsText: string | null;
  confettiActive: boolean;
}

export const CelebrationLayer: React.FC<CelebrationLayerProps> = ({ pointsText, confettiActive }) => {
  const colors = ['#D4AF37', '#10B981', '#F59E0B', '#0B261C', '#FEF08A', '#34D399'];

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {pointsText && (
        <div
          key={Date.now()}
          className="floating-points-badge bg-gradient-to-r from-[#0B261C] via-[#144533] to-[#081C15] text-[#D4AF37] border-2 border-[#D4AF37] px-6 py-3 rounded-full shadow-2xl font-black text-base flex items-center gap-2.5 backdrop-blur-md"
        >
          <i className="fa-solid fa-crown text-amber-400 text-lg animate-bounce"></i>
          <span className="tracking-wide">{pointsText}</span>
        </div>
      )}

      {confettiActive &&
        Array.from({ length: 28 }).map((_, i) => {
          const size = Math.floor(Math.random() * 8) + 6;
          const left = `${Math.random() * 100}%`;
          const bg = colors[i % colors.length];
          const duration = `${1.6 + Math.random() * 1.2}s`;
          const delay = `${Math.random() * 0.25}s`;

          return (
            <div
              key={i}
              className="confetti-piece rounded-sm"
              style={{
                width: `${size}px`,
                height: `${size * 1.4}px`,
                left,
                backgroundColor: bg,
                animationDuration: duration,
                animationDelay: delay,
              }}
            />
          );
        })}
    </div>
  );
};
