import { cn } from '@/lib/cn';

/** Neon yellow & amber glowing emblem (a stylised "O" with an industrial load bar). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('shrink-0 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]', className)}
    >
      <defs>
        <linearGradient id="mantovani-neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#070b12" />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill="none"
        stroke="url(#mantovani-neon-grad)"
        strokeWidth="1.5"
        strokeOpacity="0.85"
      />
      <circle cx="16" cy="13.5" r="6.5" fill="none" stroke="url(#mantovani-neon-grad)" strokeWidth="3.2" />
      <rect x="7" y="23" width="18" height="3.2" rx="1.6" fill="#ffd700" />
    </svg>
  );
}
