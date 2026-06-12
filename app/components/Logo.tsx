'use client';

export function FillKaroIcon({ size = 36 }: { size?: number }) {
  const id = `fk-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#155E75" />
        </linearGradient>
        <linearGradient id={`${id}-bolt`} x1="24" y1="6" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8C268" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* Rounded square bg */}
      <rect width="44" height="44" rx="11" fill={`url(#${id}-bg)`} />
      {/* Subtle inner highlight */}
      <rect x="1" y="1" width="42" height="20" rx="10" fill="white" fillOpacity="0.07" />
      {/* Form lines (left side) */}
      <rect x="8"  y="13" width="15" height="2.8" rx="1.4" fill="white" fillOpacity="0.55" />
      <rect x="8"  y="19" width="11" height="2.8" rx="1.4" fill="white" fillOpacity="0.40" />
      <rect x="8"  y="25" width="13" height="2.8" rx="1.4" fill="white" fillOpacity="0.30" />
      <rect x="8"  y="31" width="9"  height="2.8" rx="1.4" fill="white" fillOpacity="0.20" />
      {/* Lightning bolt */}
      <path d="M29 7 L22 23 H29 L24 37 L40 19 H32 Z" fill={`url(#${id}-bolt)`} />
    </svg>
  );
}

export function FillKaroWordmark({ size = 22 }: { size?: number }) {
  return (
    <span style={{
      fontSize: size,
      fontWeight: 900,
      letterSpacing: '-0.5px',
      lineHeight: 1,
    }}>
      <span style={{ color: '#F4F7F5' }}>Fill</span>
      <span style={{
        background: 'linear-gradient(135deg, #00D4FF, #67E8F9)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>Karo</span>
    </span>
  );
}

export function FillKaroLogo({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <FillKaroIcon size={size} />
      <FillKaroWordmark size={Math.round(size * 0.6)} />
    </div>
  );
}
