'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'govform_profile';
const SCREENSHOT  = '/tmp/govform_screen.png';

interface Service { id: string; name: string; }
interface LogEntry {
  type: string; message: string;
  captchaText?: string; services?: Service[];
  screenshot?: string; pdfBase64?: string;
}

// ── Typing animation ───────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-4 py-3 rounded-2xl rounded-tl-sm" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-violet-400"
          style={{ animation: 'dotBounce 0.8s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
      ))}
      <style>{`@keyframes dotBounce { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
    </div>
  );
}

export default function SSOPage() {
  // ── State ────────────────────────────────────────────────────────
  const [step, setStep]           = useState<'login' | 'running' | 'services' | 'done'>('login');
  const [ssoId, setSsoId]         = useState('');
  const [ssoPass, setSsoPass]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showOtp, setShowOtp]     = useState(false);
  const [otpInput, setOtpInput]   = useState('');
  const [otpLabel, setOtpLabel]   = useState('');
  const [screenTs, setScreenTs]   = useState<string | null>(null);
  const [typing, setTyping]       = useState(false);
  const [bankInput, setBankInput] = useState({ account: '', ifsc: '', name: '' });
  const [askBank, setAskBank]     = useState(false);
  const [bankStep, setBankStep]   = useState<'account' | 'ifsc' | 'done' | null>(null);
  const [bankInlineInput, setBankInlineInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  // Auto-load profile
  const [profile, setProfile] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      setProfile(p);
      if (p.ssoId)   setSsoId(p.ssoId);
      if (p.ssoPass) setSsoPass(p.ssoPass);
    } catch {}
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [logs, showCaptcha, showOtp, step, typing, askBank]);

  // Screenshot auto-refresh while active
  useEffect(() => {
    if (step !== 'running' && step !== 'services') return;
    const iv = setInterval(() => setScreenTs(String(Date.now())), 2500);
    return () => clearInterval(iv);
  }, [step]);

  // ── Start SSO login ───────────────────────────────────────────────
  const startLogin = () => {
    if (!ssoId.trim() || !ssoPass.trim()) return;
    setStep('running');
    setLogs([]);
    setServices([]);
    setShowCaptcha(false);
    setShowOtp(false);
    setScreenTs(null);
    setTyping(true);

    // Save SSO credentials for next time
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ssoId: ssoId.trim(), ssoPass: ssoPass.trim() }));
    } catch {}

    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const params = new URLSearchParams({
      ssoId:         ssoId.trim(),
      ssoPass:       ssoPass.trim(),
      name:          p.name         || '',
      father:        p.fatherName   || '',
      mother:        p.mother       || '',
      mobile:        p.mobile       || '',
      email:         p.email        || '',
      dob:           p.dob          || '',
      gender:        p.gender       || '',
      aadhaar:       p.aadhaar      || '',
      category:      p.category     || '',
      address:       p.address      || '',
      district:      p.district     || '',
      pin:           p.pin          || '',
      photo:         p.photoPath    || '',
      sign:          p.signPath     || '',
      qualDegree:    p.qualDegree   || '',
      qualCollege:   p.qualCollege  || '',
      qualUniversity: p.qualUniversity || '',
      qualYear:      p.qualYear     || '',
      qualPercent:   p.qualPercent  || '',
    });

    const es = new EventSource(`/api/sso-login?${params}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data: LogEntry = JSON.parse(e.data);
        setTyping(false);

        if (data.type === 'captcha') {
          setCaptchaText(data.captchaText || '');
          setCaptchaInput(data.captchaText || '');
          setShowCaptcha(true);
          setShowOtp(false);
          setScreenTs(String(Date.now()));
        } else if (data.type === 'otp') {
          // Reuse OTP input for bank details prompt if needed
          if (data.message?.includes('Account') || data.message?.includes('IFSC') || data.message?.includes('Bank')) {
            setAskBank(true);
            setBankStep(data.message.includes('IFSC') ? 'ifsc' : 'account');
            setOtpLabel(data.message);
          } else {
            setOtpLabel(data.message || 'OTP type karo:');
            setShowOtp(true);
            setShowCaptcha(false);
          }
        } else if (data.type === 'services') {
          setServices(data.services || []);
          setLogs(prev => [...prev, data]);
          setStep('services');
        } else if (data.type === 'screenshot') {
          setScreenTs(String(Date.now()));
        } else if (data.type === 'done') {
          setStep('done');
          setScreenTs(String(Date.now()));
          es.close();
        } else if (data.type === 'error' || data.type === 'closed') {
          setStep('done');
          setLogs(prev => [...prev, data]);
          es.close();
        } else {
          setLogs(prev => [...prev, data]);
        }
        if (!['captcha', 'otp', 'screenshot'].includes(data.type)) {
          setTyping(false);
        }
      } catch {}
    };
    es.onerror = () => { setStep('done'); es.close(); };
  };

  // ── Submit captcha ────────────────────────────────────────────────
  const submitCaptcha = async () => {
    const val = captchaInput.trim();
    if (!val) return;
    await fetch('/api/sso-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solution: val, captcha: val }),
    });
    setShowCaptcha(false);
    setLogs(prev => [...prev, { type: 'progress', message: `✅ Captcha: "${val}"` }]);
    setCaptchaInput('');
  };

  // ── Submit OTP ────────────────────────────────────────────────────
  const submitOtp = async () => {
    const val = otpInput.trim().replace(/\s+/g, '');
    if (!val) return;
    await fetch('/api/sso-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: val }),
    });
    setShowOtp(false);
    setLogs(prev => [...prev, { type: 'progress', message: `✅ OTP submit: ${val}` }]);
    setOtpInput('');
  };

  // ── Submit bank inline input ──────────────────────────────────────
  const submitBankInline = async () => {
    const val = bankInlineInput.trim();
    if (!val) return;
    await fetch('/api/sso-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: val }),  // script reads from OTP_FILE
    });
    setLogs(prev => [...prev, { type: 'progress', message: `✅ ${bankStep === 'ifsc' ? 'IFSC' : 'Account'}: ${val}` }]);
    setBankInlineInput('');
    setBankStep(null);
    setAskBank(false);
  };

  // ── Send service command ──────────────────────────────────────────
  const selectService = useCallback(async (svc: Service) => {
    setLogs(prev => [...prev, { type: 'log', message: `👉 Tumne choose kiya: ${svc.name}` }]);
    setStep('running');
    setTyping(true);
    await fetch('/api/sso-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: svc.id }),
    });
  }, []);

  // ── Styles ────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: 'white',
    padding: '12px 16px',
    fontSize: 15,
    width: '100%',
    outline: 'none',
  };

  const logIcon: Record<string, string> = {
    progress: '⚙️', error: '❌', start: '🚀',
    done: '✅', log: '📋', creds: '💾', closed: '🔌',
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #050010 0%, #0b0b25 100%)' }}>

      {/* Header */}
      <div className="border-b border-white/10 px-5 py-3.5 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: 'rgba(5,0,16,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>🔐</div>
        <div>
          <h1 className="text-white font-bold text-sm">Rajasthan SSO</h1>
          <p className="text-xs text-gray-400">Single Sign-On — sabhi Raj govt services ek jagah</p>
        </div>
        <a href="/" className="ml-auto text-xs text-gray-400 hover:text-white">← Back</a>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">

        {/* ── LOGIN FORM ────────────────────────────────────────── */}
        {step === 'login' && (
          <div className="space-y-4">
            {/* Hero card */}
            <div className="p-5 rounded-2xl text-center space-y-2"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(219,39,119,0.1))', border: '1px solid rgba(124,58,237,0.3)' }}>
              <div className="text-4xl">🔐</div>
              <h2 className="text-white font-bold text-lg">Rajasthan SSO Login</h2>
              <p className="text-gray-400 text-sm">
                Ek baar login karo — RPSC, RSMSSB, Scholarship, Police, REET<br/>
                sab kuch ek hi jagah se auto-fill hoga.
              </p>
            </div>

            {/* What SSO covers */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: '🎓', label: 'Scholarship' },
                { icon: '📋', label: 'RPSC Forms' },
                { icon: '📝', label: 'RSMSSB' },
                { icon: '🏫', label: 'REET' },
                { icon: '👮', label: 'Police Bharti' },
                { icon: '🏥', label: 'E-Mitra' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1 py-3 rounded-xl text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-xs text-gray-300">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Login form */}
            <div className="p-5 rounded-2xl space-y-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-sm text-white font-semibold">SSO Credentials</p>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">SSO ID / Username</label>
                <input
                  value={ssoId}
                  onChange={e => setSsoId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startLogin()}
                  placeholder="jaise: sumit.kumar / 9876543210"
                  autoComplete="username"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={ssoPass}
                    onChange={e => setSsoPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && startLogin()}
                    placeholder="SSO password"
                    autoComplete="current-password"
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <button onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                onClick={startLogin}
                disabled={!ssoId.trim() || !ssoPass.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: 'white' }}>
                🔐 SSO Login karo — Captcha AI bhrega
              </button>

              <p className="text-center text-xs text-gray-500">
                SSO ID nahi hai?{' '}
                <a href="https://sso.rajasthan.gov.in/register" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">
                  Register karo
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ── RUNNING / LOGS ────────────────────────────────────────── */}
        {(step === 'running' || step === 'services' || step === 'done') && (
          <div className="space-y-3">

            {/* Log stream */}
            <div className="p-4 rounded-2xl space-y-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs text-gray-500 font-medium mb-2">📡 Live Progress</p>
              {logs.filter(l => !['services', 'screenshot'].includes(l.type)).map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span>{logIcon[log.type] || '•'}</span>
                  <span className={log.type === 'error' ? 'text-red-400' : 'text-gray-300'}>{log.message}</span>
                </div>
              ))}
              {typing && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                        style={{ animation: 'dotBounce 0.8s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />
                    ))}
                  </div>
                  <span>Kaam ho raha hai...</span>
                </div>
              )}
            </div>

            {/* Live screenshot */}
            {screenTs && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs text-gray-500 px-3 pt-2">🖥️ Browser Live</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/screenshot?t=${screenTs}`} alt="browser" className="w-full" />
              </div>
            )}

            {/* Captcha input */}
            {showCaptcha && (
              <div className="p-4 rounded-2xl space-y-3"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                <p className="text-sm text-yellow-300 font-semibold">🔢 Captcha Verify</p>
                {captchaText && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-yellow-300 text-lg font-bold">{captchaText}</span>
                    <span className="text-xs text-gray-500 ml-auto">Auto-detected</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitCaptcha()}
                    placeholder="Captcha type karo"
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                    autoFocus
                  />
                  <button onClick={submitCaptcha}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white' }}>
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* OTP input */}
            {showOtp && (
              <div className="p-4 rounded-2xl space-y-3"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <p className="text-sm text-green-300 font-semibold">📱 {otpLabel}</p>
                <div className="flex gap-2">
                  <input
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitOtp()}
                    placeholder="6-digit OTP"
                    maxLength={6}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none text-center tracking-widest"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: 18 }}
                    autoFocus
                  />
                  <button onClick={submitOtp}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #059669)', color: 'white' }}>
                    Verify
                  </button>
                </div>
              </div>
            )}

            {/* Bank details inline prompt */}
            {askBank && bankStep && (
              <div className="p-4 rounded-2xl space-y-3"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <p className="text-sm text-blue-300 font-semibold">🏦 {otpLabel}</p>
                <div className="flex gap-2">
                  <input
                    value={bankInlineInput}
                    onChange={e => setBankInlineInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitBankInline()}
                    placeholder={bankStep === 'ifsc' ? 'e.g. SBIN0001234' : 'Account number'}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                    autoFocus
                  />
                  <button onClick={submitBankInline}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: 'white' }}>
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SERVICE CHIPS (after login) ──────────────────────────── */}
        {step === 'services' && services.length > 0 && (
          <div className="space-y-3">
            {/* Bot message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>🤖</div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-100"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ✅ SSO Login ho gaya! Ab batao — <strong>kya karna hai?</strong>
              </div>
            </div>

            {/* Service cards */}
            <div className="pl-11 grid grid-cols-2 gap-2">
              {services.map(svc => (
                <button key={svc.id} onClick={() => selectService(svc)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="text-xl">{svc.name.split(' ')[0]}</span>
                  <span className="text-sm text-white font-medium leading-snug">{svc.name.slice(svc.name.indexOf(' ') + 1)}</span>
                </button>
              ))}
            </div>

            {/* Free-text hint */}
            <div className="pl-11">
              <p className="text-xs text-gray-500">Ya neeche type karo — scholarship, rpsc, rsmssb, police...</p>
              <FreeTextCommand onSubmit={selectService} />
            </div>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="p-5 rounded-2xl text-center space-y-3"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <div className="text-4xl">✅</div>
            <p className="text-white font-bold">Kaam ho gaya!</p>
            <p className="text-gray-400 text-sm">Screenshot dekho ya naya kaam shuru karo.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setStep('services'); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}>
                ↩ Services pe wapas jao
              </button>
              <button onClick={() => { setStep('login'); setSsoId(''); setSsoPass(''); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}>
                🔄 Phir se login karo
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes dotBounce { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-4px);opacity:1} }
      `}</style>
    </div>
  );
}

// ── Free-text command input ────────────────────────────────────────
function FreeTextCommand({ onSubmit }: { onSubmit: (svc: { id: string; name: string }) => void }) {
  const [val, setVal] = useState('');

  const handleSubmit = () => {
    const v = val.trim().toLowerCase();
    if (!v) return;
    // Map common words to service IDs
    const map: Record<string, string> = {
      scholarship: 'scholarship', छात्रवृत्ति: 'scholarship',
      rpsc: 'rpsc', ras: 'rpsc',
      rsmssb: 'rsmssb', patwari: 'rsmssb',
      reet: 'reet', teacher: 'reet',
      police: 'police', constable: 'police',
      emitra: 'emitra', 'e-mitra': 'emitra',
      pehchan: 'pehchan', domicile: 'pehchan',
    };
    let id = 'custom';
    for (const [kw, sid] of Object.entries(map)) {
      if (v.includes(kw)) { id = sid; break; }
    }
    onSubmit({ id, name: val.trim() });
    setVal('');
  };

  return (
    <div className="flex gap-2 mt-2">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="jaise: scholarship, rpsc, rsmssb..."
        className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
      />
      <button onClick={handleSubmit}
        disabled={!val.trim()}
        className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white' }}>
        →
      </button>
    </div>
  );
}
