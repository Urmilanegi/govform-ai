'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

/* ── Scroll-reveal: adds .in when element enters viewport ── */
export function Reveal({
  children,
  variant = 'reveal',
  className = '',
  as: Tag = 'div',
  style,
  id,
  once = true,
}: {
  children: ReactNode;
  variant?: 'reveal' | 'reveal-left' | 'reveal-right' | 'reveal-zoom' | 'reveal-stagger';
  className?: string;
  as?: any;
  style?: React.CSSProperties;
  id?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            el.classList.add('in');
            if (once) { setSeen(true); io.unobserve(el); }
          } else if (!once) {
            el.classList.remove('in');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, seen]);

  return (
    <Tag ref={ref} id={id} className={`${variant} ${className}`} style={style}>
      {children}
    </Tag>
  );
}

/* ── Thin top scroll-progress bar ── */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      if (ref.current) ref.current.style.setProperty('--sp', `${pct}%`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div ref={ref} className="gf-scrollbar" />;
}

/* ── Parallax wrapper: shifts child as you scroll ── */
export function Parallax({ speed = 0.25, children, className = '', style }: {
  speed?: number; children: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [speed]);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

/* ── Count-up number when scrolled into view ── */
export function Counter({ to, suffix = '', prefix = '', duration = 1600, className, style }: {
  to: number; suffix?: string; prefix?: string; duration?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(to * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref} className={className} style={style}>{prefix}{val.toLocaleString('en-IN')}{suffix}</span>;
}

/* ── 3D tilt on mouse move ── */
export function Tilt({ children, max = 10, className = '', style }: {
  children: ReactNode; max?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${(px * max).toFixed(2)}deg) rotateX(${(-py * max).toFixed(2)}deg) translateY(-4px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={className}
      style={{ transition: 'transform 0.2s ease', ...style }}>
      {children}
    </div>
  );
}

/* ── Wave SVG divider ── */
export function Wave({ flip = false }: { flip?: boolean }) {
  return (
    <svg className="gf-wave gf-wave-anim" viewBox="0 0 2880 100" preserveAspectRatio="none"
      style={flip ? { transform: 'rotate(180deg)' } : undefined} aria-hidden="true">
      <path d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,40 C1680,70 1920,0 2160,40 C2400,80 2640,10 2880,40 L2880,100 L0,100 Z" />
    </svg>
  );
}
