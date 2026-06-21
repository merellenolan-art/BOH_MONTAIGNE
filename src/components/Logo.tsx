import { useId } from "react";

interface IconProps {
  className?: string;
}

/**
 * Gucci-style monogram: two interlocking G's.
 * Light gold on a graphite/black rounded tile. Pure inline SVG.
 */
export function Logo({ className = "h-9 w-9" }: IconProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0dca8" />
          <stop offset="55%" stopColor="#dbc365" />
          <stop offset="100%" stopColor="#bd9229" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="#181c20" />
      {/* Left G — opens to the right, mirrored horizontally to face the right G */}
      <path
        d="M9 20a6.5 6.5 0 1 1 6.5 6.5"
        stroke={`url(#${id})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.5 20h4"
        stroke={`url(#${id})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right G — mirrored, opens to the left, interlocking with the left one */}
      <path
        d="M31 20a6.5 6.5 0 1 0 -6.5 6.5"
        stroke={`url(#${id})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24.5 20h-4"
        stroke={`url(#${id})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Two interlocking vertical bars forming the discreet house mark. */
export function Monogram({ className = "h-6 w-6" }: IconProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93b59c" />
          <stop offset="100%" stopColor="#3a6a48" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id})`} strokeWidth="1.4" strokeLinecap="round">
        <path d="M9 4v16M15 4v16M9 12h6" />
      </g>
    </svg>
  );
}
