'use client';

// ── Premium SVG logo badges — har exam family ka apna emblem ──
// Resolver: examId/name substring se sahi badge milta hai.

type LogoProps = { size?: number };

const ring = (id: string, c1: string, c2: string) => (
  <defs>
    <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={c1} />
      <stop offset="100%" stopColor={c2} />
    </linearGradient>
    <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#0B1B2B" />
      <stop offset="100%" stopColor="#050B14" />
    </linearGradient>
  </defs>
);

function Badge({ id, c1, c2, size, children }: LogoProps & { id: string; c1: string; c2: string; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {ring(id, c1, c2)}
      <circle cx="22" cy="22" r="21" fill={`url(#${id}-bg)`} />
      <circle cx="22" cy="22" r="20.2" stroke={`url(#${id}-ring)`} strokeWidth="1.6" />
      <circle cx="22" cy="22" r="16.5" stroke={`url(#${id}-ring)`} strokeWidth="0.5" opacity="0.4" />
      {children}
    </svg>
  );
}

// 🏛️ SSC — government pillars
export function SSCLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-ssc" c1="#00D4FF" c2="#0E7490" size={size}>
      <path d="M22 9 L33 15 H11 Z" fill="#00D4FF" />
      <rect x="12" y="16.5" width="20" height="1.8" rx="0.9" fill="#67E8F9" />
      {[14, 19, 24, 29].map(x => <rect key={x} x={x} y="19.5" width="2.6" height="10" rx="1" fill="#38BDF8" opacity="0.85" />)}
      <rect x="12" y="30.8" width="20" height="2" rx="1" fill="#67E8F9" />
      <rect x="10.5" y="33.6" width="23" height="2" rx="1" fill="#0E7490" />
    </Badge>
  );
}

// 🚆 Railway — train front
export function RailwayLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-rrb" c1="#22D3EE" c2="#0369A1" size={size}>
      <rect x="13" y="11" width="18" height="18" rx="5" fill="#0C4A6E" stroke="#22D3EE" strokeWidth="1.4" />
      <rect x="16" y="14" width="12" height="6" rx="2" fill="#7DD3FC" opacity="0.9" />
      <circle cx="17.5" cy="25" r="1.8" fill="#22D3EE" />
      <circle cx="26.5" cy="25" r="1.8" fill="#22D3EE" />
      <path d="M15 31 L12.5 35 M29 31 L31.5 35" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="18" y="31" width="8" height="1.6" rx="0.8" fill="#38BDF8" />
      <rect x="16.5" y="34" width="11" height="1.6" rx="0.8" fill="#0E7490" />
    </Badge>
  );
}

// 🏦 Banking — rupee in vault
export function BankLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-bank" c1="#34D399" c2="#0E7490" size={size}>
      <path d="M22 9.5 L32.5 14.5 H11.5 Z" fill="#34D399" />
      <rect x="13" y="16" width="18" height="1.6" rx="0.8" fill="#6EE7B7" />
      <text x="22" y="29.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#34D399" fontFamily="system-ui">₹</text>
      <rect x="13" y="31.5" width="18" height="1.8" rx="0.9" fill="#6EE7B7" />
      <rect x="11" y="34.3" width="22" height="1.8" rx="0.9" fill="#0E7490" />
    </Badge>
  );
}

// 🏅 UPSC — star emblem (Ashoka-inspired wheel)
export function UPSCLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-upsc" c1="#E8C268" c2="#B45309" size={size}>
      <circle cx="22" cy="22" r="9.5" stroke="#E8C268" strokeWidth="1.6" fill="none" />
      <circle cx="22" cy="22" r="2" fill="#F6E2A8" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <line key={i} x1={22 + 2.8 * Math.cos(a)} y1={22 + 2.8 * Math.sin(a)} x2={22 + 9 * Math.cos(a)} y2={22 + 9 * Math.sin(a)} stroke="#E8C268" strokeWidth="1" opacity="0.9" />;
      })}
    </Badge>
  );
}

// 🪖 Defence/Army — shield + star
export function ArmyLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-army" c1="#86EFAC" c2="#166534" size={size}>
      <path d="M22 10 L31 13.5 V22 C31 28.5 27 32.8 22 34.5 C17 32.8 13 28.5 13 22 V13.5 Z" fill="#14532D" stroke="#86EFAC" strokeWidth="1.4" />
      <path d="M22 16 L23.8 20 L28 20.3 L24.8 23 L25.9 27 L22 24.7 L18.1 27 L19.2 23 L16 20.3 L20.2 20 Z" fill="#BBF7D0" />
    </Badge>
  );
}

// ⚓ Navy — anchor
export function NavyLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-navy" c1="#38BDF8" c2="#1E40AF" size={size}>
      <circle cx="22" cy="13.5" r="2.6" stroke="#7DD3FC" strokeWidth="1.6" fill="none" />
      <line x1="22" y1="16.1" x2="22" y2="31" stroke="#7DD3FC" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16.5" y1="20" x2="27.5" y2="20" stroke="#7DD3FC" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.5 26 C14.5 30.5 18 33.4 22 33.4 C26 33.4 29.5 30.5 30.5 26 L27.8 27.6 M13.5 26 L16.2 27.6" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </Badge>
  );
}

// ✈️ Air Force — wings + jet
export function AirForceLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-iaf" c1="#93C5FD" c2="#1D4ED8" size={size}>
      <path d="M22 11 L24.5 21 L33 25.5 L24.8 24.6 L23.5 32 L22 28.8 L20.5 32 L19.2 24.6 L11 25.5 L19.5 21 Z" fill="#93C5FD" />
      <circle cx="22" cy="22.5" r="1.6" fill="#1D4ED8" />
    </Badge>
  );
}

// 🚔 Police — badge star
export function PoliceLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-pol" c1="#FCA5A5" c2="#991B1B" size={size}>
      <path d="M22 10.5 L25 14 L29.5 13 L29.8 17.6 L34 19.5 L31.3 23.2 L33 27.5 L28.5 28.3 L26.8 32.6 L22 30.5 L17.2 32.6 L15.5 28.3 L11 27.5 L12.7 23.2 L10 19.5 L14.2 17.6 L14.5 13 L19 14 Z" fill="#7F1D1D" stroke="#FCA5A5" strokeWidth="1.2" />
      <circle cx="22" cy="21.5" r="5" fill="#FECACA" opacity="0.9" />
      <path d="M22 18.5 L23 20.7 L25.3 20.9 L23.6 22.4 L24.2 24.6 L22 23.4 L19.8 24.6 L20.4 22.4 L18.7 20.9 L21 20.7 Z" fill="#991B1B" />
    </Badge>
  );
}

// 📜 State PSC — scroll/document seal
export function PSCLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-psc" c1="#C4B5FD" c2="#5B21B6" size={size}>
      <rect x="14" y="11" width="16" height="22" rx="2.5" fill="#2E1065" stroke="#C4B5FD" strokeWidth="1.3" />
      {[15.5, 19.5, 23.5].map(y => <rect key={y} x="17" y={y} width="10" height="1.6" rx="0.8" fill="#A78BFA" opacity="0.8" />)}
      <circle cx="26.5" cy="29" r="4.6" fill="#5B21B6" stroke="#C4B5FD" strokeWidth="1.2" />
      <path d="M24.6 29 L26 30.4 L28.6 27.6" stroke="#EDE9FE" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </Badge>
  );
}

// 📚 TET / Teaching — open book + cap
export function TETLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-tet" c1="#FDBA74" c2="#9A3412" size={size}>
      <path d="M22 12 L33 16 L22 20 L11 16 Z" fill="#FDBA74" />
      <path d="M16 18.5 V23 C16 24.8 18.7 26.2 22 26.2 C25.3 26.2 28 24.8 28 23 V18.5" stroke="#FB923C" strokeWidth="1.5" fill="none" />
      <line x1="32" y1="17" x2="32" y2="23" stroke="#FDBA74" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 30 C15 28.4 19 28.4 22 30 C25 28.4 29 28.4 32 30 V33.5 C29 31.9 25 31.9 22 33.5 C19 31.9 15 31.9 12 33.5 Z" fill="#9A3412" stroke="#FDBA74" strokeWidth="0.8" />
    </Badge>
  );
}

// 📮 default — form/document
export function FormLogo({ size = 44 }: LogoProps) {
  return (
    <Badge id="exl-doc" c1="#00D4FF" c2="#0E7490" size={size}>
      <rect x="14" y="10.5" width="16" height="23" rx="3" fill="#082F49" stroke="#38BDF8" strokeWidth="1.3" />
      {[15, 19, 23].map(y => <rect key={y} x="17" y={y} width="10" height="1.7" rx="0.85" fill="#7DD3FC" opacity="0.75" />)}
      <path d="M18 28.5 L20.5 31 L26 25.5" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Badge>
  );
}

// ── Real downloaded logos (public/logos/*.webp) — pehle ye check hote hain ──
function realLogoFor(e: string): string | null {
  if (e.includes('rbi')) return '/logos/rbi.webp';
  if (e.includes('sbi')) return '/logos/sbi.webp';
  if (e.includes('ibps') || e.includes('bank') || e.includes('insurance') || e.includes('lic') || e.includes('nabard')) return '/logos/ibps.webp';
  if (e.includes('dsssb')) return '/logos/dsssb.webp';
  if (e.includes('police') || e.includes('rpf') || e.includes(' si')) return '/logos/police.webp';
  if (e.includes('upsc') || e.includes('ias') || e.includes('ips') || e.includes('ifs') || e.includes('irs') || e.includes('cse') || e.includes('capf')) return '/logos/upsc.webp';
  if (e.includes('rrb') || e.includes('railway') || e.includes('ntpc') || e.includes('alp') || e.includes('group d') || e.includes('group-d')) return '/logos/railway.webp';
  if (e.includes('ssc') || e.includes('cgl') || e.includes('chsl') || e.includes('mts') || e.includes('cpo') || e.includes('steno')) return '/logos/ssc.webp';
  return null;
}

function RealLogo({ src, size }: { src: string; size: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: '#fff',
      border: '1.5px solid rgba(0,212,255,0.35)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 12px rgba(0,0,0,0.45)',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size - 6} height={size - 6} style={{ objectFit: 'contain' }} />
    </span>
  );
}

// ── Resolver: id/name → real logo, warna SVG badge ──
export function ExamLogo({ exam, size = 44 }: { exam: string; size?: number }) {
  const e = exam.toLowerCase();
  const real = realLogoFor(e);
  if (real) return <RealLogo src={real} size={size} />;
  if (e.includes('navy') || e.includes('ina')) return <NavyLogo size={size} />;
  if (e.includes('air') || e.includes('afcat') || e.includes('afa') || e.includes('iaf')) return <AirForceLogo size={size} />;
  if (e.includes('army') || e.includes('agniveer') || e.includes('nda') || e.includes('cds') || e.includes('defence') || e.includes('ima') || e.includes('ota') || e.includes('capf')) return <ArmyLogo size={size} />;
  if (e.includes('police') || e.includes('rpf')) return <PoliceLogo size={size} />;
  if (e.includes('upsc') || e.includes('ias') || e.includes('ips') || e.includes('ifs') || e.includes('irs') || e.includes('cse')) return <UPSCLogo size={size} />;
  if (e.includes('rrb') || e.includes('railway') || e.includes('ntpc') || e.includes('alp') || e.includes('group d') || e.includes('group-d') || e.includes('metro')) return <RailwayLogo size={size} />;
  if (e.includes('bank') || e.includes('sbi') || e.includes('ibps') || e.includes('rbi') || e.includes('lic') || e.includes('insurance') || e.includes('nabard') || e.includes('fci')) return <BankLogo size={size} />;
  if (e.includes('tet') || e.includes('reet') || e.includes('teacher') || e.includes('b.ed') || e.includes('navodaya') || e.includes('vidyalaya')) return <TETLogo size={size} />;
  if (e.includes('psc') || e.includes('ras') || e.includes('bpsc') || e.includes('uppsc') || e.includes('mpsc') || e.includes('rsmssb') || e.includes('bssc') || e.includes('dsssb') || e.includes('highcourt')) return <PSCLogo size={size} />;
  if (e.includes('ssc') || e.includes('cgl') || e.includes('chsl') || e.includes('mts') || e.includes('cpo') || e.includes('steno') || e.includes('gd') || e.includes('je ')) return <SSCLogo size={size} />;
  return <FormLogo size={size} />;
}
