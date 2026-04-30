'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { EXAMS_WITH_POSTS, DOC_LABELS, ExamWithPosts, Post } from '@/lib/posts-data';
import CenterSelector from '@/app/components/CenterSelector';
import { UPSC_CENTERS } from '@/lib/upsc-centers';
type Center = typeof UPSC_CENTERS[0];

// ── Types ──────────────────────────────────────────────────────────
type ChatRole = 'bot' | 'user';
interface ChatMsg {
  id: number;
  role: ChatRole;
  text?: string;
  jsx?: React.ReactNode;
}
interface LogEntry {
  type: string;
  message: string;
  captchaText?: string;
  otpFile?: string;
  screenshot?: string;
  pdfBase64?: string;
  regNo?: string;
  regId?: string;
  ssoId?: string;
}

// Exam → API route mapping
const EXAM_API: Record<string, string> = {
  'ssc-cgl':    'ssc-fill',
  'ssc-chsl':   'ssc-fill',
  'ssc-mts':    'ssc-fill',
  'ssc-gd':     'ssc-fill',
  'ssc-cpo':    'ssc-fill',
  'ssc-steno':  'ssc-fill',
  'rrb-ntpc':    'rrb-fill',
  'rrb-alp':     'rrb-fill',
  'rrb-group-d': 'rrb-fill',
  'railway-ntpc':'rrb-fill',
  'railway-alp': 'rrb-fill',
  'railway-gd':  'rrb-fill',
  'railway-je':  'rrb-fill',
  'upsc-cse':   'upsc-fill',
  'upsc-nda':   'upsc-fill',
  'upsc-cds':   'upsc-fill',
  'upsc-capf':  'upsc-fill',
  'nda':        'upsc-fill',
  'cds':        'upsc-fill',
  'afcat':      'upsc-fill',
  'rpsc-ras':          'rpsc-fill',
  'rpsc':              'rpsc-fill',
  'rpsc-teacher':      'rpsc-fill',
  'reet':              'rpsc-fill',
  'rsmssb':            'rpsc-fill',
  'rajasthan-police':  'rpsc-fill',
  'rajasthan-highcourt':'rpsc-fill',
  'bpsc':              'rpsc-fill',
  'uppsc':             'rpsc-fill',
  'mpsc':              'rpsc-fill',
  'up-police':         'rpsc-fill',
  'bihar-police':      'rpsc-fill',
  'delhi-police':      'rpsc-fill',
  'army-agniveer':     'rpsc-fill',
  'navy-agniveer':     'rpsc-fill',
  'uptet':        'uptet-fill',
};

function getApiRoute(examId: string): string {
  if (EXAM_API[examId]) return EXAM_API[examId];
  if (examId.startsWith('uptet') || examId.includes('upessc')) return 'uptet-fill';
  if (examId.startsWith('rrb') || examId.startsWith('railway')) return 'rrb-fill';
  if (examId.includes('upsc') || examId.includes('nda') || examId.includes('cds') || examId.includes('afcat')) return 'upsc-fill';
  if (examId.includes('rpsc') || examId.includes('psc') || examId.includes('police') || examId.includes('army') || examId.includes('navy')) return 'rpsc-fill';
  return 'ssc-fill'; // default
}

function isRajasthanExam(examId: string): boolean {
  return getApiRoute(examId) === 'rpsc-fill';
}

function getPdfRoute(examId: string): string {
  const api = getApiRoute(examId);
  if (api === 'uptet-fill') return '/api/uptet-pdf';
  if (api === 'rrb-fill') return '/api/rrb-pdf';
  if (api === 'upsc-fill') return '/api/upsc-pdf';
  if (api === 'rpsc-fill') return '/api/rpsc-pdf';
  return '/api/ssc-official-pdf';
}

const STORAGE_KEY = 'govform_profile'; // universal — sabhi exams ke liye

// ── Robot animation component ──────────────────────────────────────
function Robot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative" style={{ width: 72, height: 80 }}>
        {/* Head */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-10 rounded-xl border-2 border-violet-400 flex items-center justify-center gap-2"
          style={{ background: 'rgba(124,58,237,0.15)', animation: 'robotBob 1.2s ease-in-out infinite' }}>
          <div className="w-2 h-2 rounded-full bg-violet-400" style={{ animation: 'eyeBlink 2.5s ease-in-out infinite' }} />
          <div className="w-2 h-2 rounded-full bg-violet-400" style={{ animation: 'eyeBlink 2.5s ease-in-out infinite 0.1s' }} />
        </div>
        {/* Antenna */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-violet-400" />
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-300" style={{ animation: 'antennaPulse 1s ease-in-out infinite' }} />
        {/* Body */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-8 rounded-lg border-2 border-violet-400/60 flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.1)' }}>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                style={{ animation: `dotPulse 1s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
      <p className="text-violet-300 text-sm font-semibold text-center">{label}</p>
      <style>{`
        @keyframes robotBob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-4px)} }
        @keyframes eyeBlink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
        @keyframes antennaPulse { 0%,100%{opacity:1;transform:translateX(-50%) scale(1)} 50%{opacity:0.4;transform:translateX(-50%) scale(1.4)} }
        @keyframes dotPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function SSCPage() {
  const [msgs, setMsgs]             = useState<ChatMsg[]>([]);
  const [step, setStep]             = useState(0);
  const [exam, setExam]             = useState<ExamWithPosts | null>(null);
  const [post, setPost]             = useState<Post | null>(null);
  const [mother, setMother]         = useState('');
  const [mobile, setMobile]         = useState('');
  const [email, setEmail]           = useState('');
  const [aadhaar, setAadhaar]       = useState('');
  const [visibleMark, setVisibleMark] = useState('Mole on right hand');
  const [photoPath, setPhotoPath]   = useState('');
  const [signPath, setSignPath]     = useState('');
  const [photoName, setPhotoName]   = useState('');
  const [signName, setSignName]     = useState('');
  const [uploading, setUploading]   = useState<'photo'|'sign'|'aadhaar'|null>(null);
  const [aadhaarParsing, setAadhaarParsing] = useState(false);
  const [parsedProfile, setParsedProfile]   = useState<Record<string,string> | null>(null);
  const [running, setRunning]       = useState(false);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaCountdown, setCaptchaCountdown] = useState(0);
  const [captchaCancelled, setCaptchaCancelled] = useState(false);
  const captchaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOtp, setShowOtp]       = useState(false);
  const [otpInput, setOtpInput]     = useState('');
  const [otpLabel, setOtpLabel]     = useState('');
  const [done, setDone]             = useState(false);
  const [finalScreen, setFinalScreen] = useState<string|null>(null); // timestamp string for cache-busting
  const [screenshotB64, setScreenshotB64] = useState<string>(''); // base64 PNG from SSE stream
  const [activeExamId, setActiveExamId] = useState('');
  const [saved, setSaved]           = useState(false);
  const [detailsInput, setDetailsInput] = useState({ mother: '', mobile: '', email: '', aadhaar: '', mark: 'Mole on right hand' });
  const [selectedCenters, setSelectedCenters] = useState<Center[]>([]);
  const [ssoId, setSsoId]     = useState('');
  const [ssoPass, setSsoPass] = useState('');
  const [ssoInput, setSsoInput] = useState({ id: '', pass: '' });
  const [qualification, setQualification] = useState({
    degree: '',        // BA / BSc / BTech / BCom
    stream: '',        // Physics, Commerce, CS
    college: '',       // College naam
    university: '',    // University naam
    passingYear: '',   // 2022
    percentage: '',    // 72.5
    rollNo: '',        // optional
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  let msgId = useRef(0);

  // Auto-refresh screenshot every 2s whenever OTP/captcha box is visible
  useEffect(() => {
    if (!showOtp && !showCaptcha) return;
    const interval = setInterval(() => {
      setFinalScreen(String(Date.now()));
    }, 2000);
    return () => clearInterval(interval);
  }, [showOtp, showCaptcha]);

  const addMsg = useCallback((role: ChatRole, text: string, jsx?: React.ReactNode) => {
    msgId.current++;
    setMsgs(prev => [...prev, { id: msgId.current, role, text, jsx }]);
  }, []);

  // Load saved details
  useEffect(() => {
    try {
      const DEFAULT_MOBILE = '8003993930';
      const DEFAULT_SSO_ID = 'SUMITKUMARMEENA9983';
      let raw = localStorage.getItem(STORAGE_KEY);
      // First-time: seed default mobile
      if (!raw) {
        const seed = { mobile: DEFAULT_MOBILE, ssoId: DEFAULT_SSO_ID };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        raw = JSON.stringify(seed);
      }
      const p = JSON.parse(raw);
      // Always ensure mobile + ssoId are set
      let changed = false;
      if (!p.mobile) { p.mobile = DEFAULT_MOBILE; changed = true; }
      if (!p.ssoId)  { p.ssoId  = DEFAULT_SSO_ID;  changed = true; }
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      if (p.mother)      setMother(p.mother);
      if (p.mobile)      setMobile(p.mobile);
      if (p.email)       setEmail(p.email);
      if (p.aadhaar)     setAadhaar(p.aadhaar);
      if (p.visibleMark) setVisibleMark(p.visibleMark);
      if (p.ssoId)       setSsoId(p.ssoId);
      if (p.ssoPass)     setSsoPass(p.ssoPass);
      if (p.photoPath)   { setPhotoPath(p.photoPath); setPhotoName(p.photoName || 'photo (saved)'); }
      if (p.signPath)    { setSignPath(p.signPath);   setSignName(p.signName || 'sign (saved)'); }
      setSaved(!!(p.mother && p.mobile && p.email));
      setDetailsInput({ mother: p.mother||'', mobile: p.mobile||DEFAULT_MOBILE, email: p.email||'', aadhaar: p.aadhaar||'', mark: p.visibleMark||'Mole on right hand' });
      // ── Auto-load qualification from parsed documents ──
      if (p.qualDegree || p.qualCollege || p.qualYear) {
        setQualification({
          degree:      p.qualDegree     || '',
          stream:      p.qualStream     || '',
          college:     p.qualCollege    || '',
          university:  p.qualUniversity || '',
          passingYear: p.qualYear       || '',
          percentage:  p.qualPercent    || '',
          rollNo:      p.qualRollNo     || '',
        });
      }
    } catch {}
  }, []);

  const saveProfile = (vals: typeof detailsInput, photo: string, photoN: string, sign: string, signN: string) => {
    try {
      let existing: Record<string, string> = {};
      try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...existing,
        mother: vals.mother, mobile: vals.mobile, email: vals.email,
        aadhaar: vals.aadhaar, visibleMark: vals.mark, photoPath: photo,
        photoName: photoN, signPath: sign, signName: signN,
      }));
      setSaved(true);
    } catch {}
  };

  // Auto scroll
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [msgs, showCaptcha, logs]);

  // Step 0 → greeting
  useEffect(() => {
    setTimeout(() => {
      const hasSaved = !!localStorage.getItem(STORAGE_KEY);
      addMsg('bot', 'Namaste! 👋 Main tumhara Government Form Auto-Fill Assistant hoon.');
      if (hasSaved) {
        setTimeout(() => addMsg('bot', '💾 Tumhari details already saved hain! Bas exam choose karo — baaki sab automatic.'), 600);
      } else {
        setTimeout(() => addMsg('bot', '📋 Pehle home page pe apne documents upload karo — AI sab details khud padh lega. Phir yahan aao.'), 600);
      }
      setTimeout(() => addMsg('bot', 'Kaunsa exam ka form bharna hai?'), 1100);
      setStep(1);
    }, 400);
  }, []);

  // ── File upload ────────────────────────────────────────────────
  const uploadFile = async (file: File, field: 'photo' | 'sign') => {
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append(field, file);
      const res  = await fetch('/api/upload-files', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        // Update state
        const newPhoto = field === 'photo' ? data.photo : photoPath;
        const newPhotoN = field === 'photo' ? file.name : photoName;
        const newSign  = field === 'sign'  ? data.sign  : signPath;
        const newSignN = field === 'sign'  ? file.name  : signName;
        if (field === 'photo') { setPhotoPath(newPhoto); setPhotoName(newPhotoN); }
        else                   { setSignPath(newSign);   setSignName(newSignN); }

        // Save photo/sign to universal profile
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const existing = raw ? JSON.parse(raw) : {};
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...existing,
            photoPath: newPhoto, photoName: newPhotoN,
            signPath:  newSign,  signName:  newSignN,
          }));
        } catch {}
      }
    } catch {}
    setUploading(null);
  };

  // ── Aadhaar / document parse ───────────────────────────────────
  const parseAadhaar = async (file: File) => {
    setAadhaarParsing(true);
    addMsg('bot', '🔍 Aadhaar scan ho raha hai... AI padh raha hai details...');
    try {
      const fd = new FormData();
      fd.append('aadhaar', file);
      const res  = await fetch('/api/parse-documents', { method: 'POST', body: fd });
      const data = await res.json();
      const p    = data.profile || data;

      // Map parsed fields → state
      const m   = p.motherName  || p.mother_name  || '';
      const mob = p.mobile      || p.phone        || p.mobileNumber || '';
      const em  = p.email       || '';
      const adh = (p.aadhaarNumber || p.aadhaar || '').replace(/\s/g, '');
      const mk  = p.visibleMark || 'Mole on right hand';

      setParsedProfile(p);
      setMother(m); setMobile(mob); setEmail(em); setAadhaar(adh); setVisibleMark(mk);
      setDetailsInput({ mother: m, mobile: mob, email: em, aadhaar: adh, mark: mk });

      addMsg('bot', `✅ Aadhaar se yeh details mili:\n👤 Naam: ${p.fullName || p.name || '—'}\n👩 Mother: ${m || '—'}\n📱 Mobile: ${mob || '—'}\n🏷️ Category: ${p.category || '—'}\n🏠 Address: ${p.address || '—'}`);
      setTimeout(() => {
        if (!mob || !em) {
          addMsg('bot', `⚠️ Kuch fields nahi mili — neeche check karo aur missing fields bharo.`);
        } else {
          addMsg('bot', `🎉 Sab details auto-fill ho gayi! Confirm karo aur start karo.`);
        }
        setStep(4);
      }, 600);
    } catch {
      addMsg('bot', '❌ Aadhaar read nahi hua. Manually details bharo.');
      setStep(4);
    }
    setAadhaarParsing(false);
  };

  // ── Generic exam fill trigger ──────────────────────────────────
  const startFill = (examId: string, m: string, mob: string, em: string, adh: string, mk: string, ph: string, sg: string, centers?: Center[]) => {
    setRunning(true);
    setLogs([]);
    setShowCaptcha(false);
    setShowOtp(false);
    setDone(false);
    setFinalScreen(null);
    setActiveExamId(examId);

    const apiRoute = getApiRoute(examId);

    // Load full profile for extra fields (name, dob, father, etc.)
    let fullProfile: Record<string,string> = {};
    try { fullProfile = JSON.parse(localStorage.getItem('govform_profile') || '{}'); } catch {}

    const params = new URLSearchParams({
      mobile:   mob || fullProfile.mobile   || '',
      email:    em  || fullProfile.email    || '',
      mother:   m   || fullProfile.mother   || '',
      aadhaar:  adh || fullProfile.aadhaar  || '',
      mark:     mk  || fullProfile.visibleMark || '',
      photo:    ph  || fullProfile.photoPath || '',
      sign:     sg  || fullProfile.signPath  || '',
      examName: examId,
      name:     fullProfile.name       || '',
      father:   fullProfile.fatherName || '',
      dob:      fullProfile.dob        || '',
      gender:   fullProfile.gender     || '',
      category: fullProfile.category   || '',
      address:  fullProfile.address    || '',
      state:    fullProfile.state      || '',
      district: fullProfile.district   || '',
      pin:      fullProfile.pin        || '',
      ...(centers && centers.length > 0 ? {
        center1: centers[0]?.city || '',
        center2: centers[1]?.city || '',
        center3: centers[2]?.city || '',
        center4: centers[3]?.city || '',
      } : {}),
      qualDegree:      qualification.degree      || '',
      qualStream:      qualification.stream      || '',
      qualCollege:     qualification.college     || '',
      qualUniversity:  qualification.university  || '',
      qualYear:        qualification.passingYear || '',
      qualPercent:     qualification.percentage  || '',
      qualRollNo:      qualification.rollNo      || '',
      ssoId:           ssoId   || '',
      ssoPass:         ssoPass || '',
    });
    const es = new EventSource(`/api/${apiRoute}?${params}`);

    es.onmessage = (e) => {
      try {
        const data: LogEntry = JSON.parse(e.data);
        setLogs(prev => [...prev, data]);

        if (data.type === 'captcha') {
          const text = data.captchaText || '';
          setCaptchaText(text);
          setCaptchaInput(text);
          setCaptchaCancelled(false);
          setShowCaptcha(true);
          setShowOtp(false);

          // Auto-submit countdown — 3s
          if (text) {
            setCaptchaCountdown(3);
            let count = 3;
            const tick = setInterval(() => {
              count--;
              setCaptchaCountdown(count);
              if (count <= 0) {
                clearInterval(tick);
                setCaptchaCancelled(prev => {
                  if (!prev) {
                    // Auto submit
                    const route = getApiRoute(activeExamId || 'ssc-cgl');
                    fetch(`/api/${route}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ solution: text, captcha: text }),
                    });
                    setShowCaptcha(false);
                    setCaptchaInput('');
                    setLogs(p => [...p, { type: 'progress', message: `🤖 CAPTCHA auto-submit: "${text}"` }]);
                  }
                  return prev;
                });
              }
            }, 1000);
            captchaTimerRef.current = tick as unknown as ReturnType<typeof setTimeout>;
          }
        }
        if (data.type === 'otp') {
          setOtpLabel(data.message || 'OTP type karo:');
          setShowOtp(true);
          setShowCaptcha(false);
        }
        if (data.type === 'payment') {
          setLogs(prev => [...prev, {
            ...data,
            type: 'payment',
            message: data.message || '💳 Payment karo',
          }]);
        }
        if (data.type === 'payment_done') {
          setLogs(prev => [...prev, { type: 'progress', message: '✅ Payment confirm ho gayi!' }]);
        }
        if (data.type === 'screenshot') {
          // Use base64 from SSE — /tmp is not shared across Vercel lambda instances
          if (data.screenshot) setScreenshotB64(data.screenshot);
          setFinalScreen(String(Date.now()));
        }
        if (data.type === 'creds') {
          setLogs(prev => [...prev, { type: 'progress', message: `💾 ${data.message}` }]);
        }
        if (data.type === 'done') {
          setFinalScreen(String(Date.now()));
          setDone(true);
          setRunning(false);
          es.close();
        }
        if (data.type === 'error' || data.type === 'closed') {
          setRunning(false);
          es.close();
        }
      } catch {}
    };
    es.onerror = () => { setRunning(false); es.close(); };
  };

  const submitCaptcha = async (val?: string) => {
    const code = (val ?? captchaInput).trim();
    if (!code) return;
    // Clear auto-timer
    if (captchaTimerRef.current) clearInterval(captchaTimerRef.current);
    setCaptchaCountdown(0);
    const apiRoute = getApiRoute(activeExamId);
    await fetch(`/api/${apiRoute}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solution: code, captcha: code }),
    });
    setShowCaptcha(false);
    setCaptchaInput('');
    setLogs(prev => [...prev, { type: 'progress', message: `✅ CAPTCHA submit: "${code}"` }]);
  };

  const cancelAutoSubmit = () => {
    if (captchaTimerRef.current) clearInterval(captchaTimerRef.current);
    setCaptchaCountdown(0);
    setCaptchaCancelled(true);
  };

  const submitOtp = async () => {
    const normalizedOtp = otpInput.trim().replace(/\s+/g, '');
    if (!normalizedOtp) return;
    const apiRoute = getApiRoute(activeExamId);
    await fetch(`/api/${apiRoute}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: normalizedOtp }),
    });
    setShowOtp(false);
    setLogs(prev => [...prev, { type: 'progress', message: `✅ OTP submit kiya: ${normalizedOtp}` }]);
    setOtpInput('');
  };

  // ── Flow handlers ──────────────────────────────────────────────
  const handleExamSelect = (ex: ExamWithPosts) => {
    setExam(ex);
    addMsg('user', ex.shortName);
    setTimeout(() => {
      addMsg('bot', `${ex.icon} **${ex.name}** — accha choice hai!`);
      setTimeout(() => addMsg('bot', `${ex.shortName} mein yeh posts available hain. Kaunsi post ke liye apply karna hai?`), 600);
      setStep(2);
    }, 300);
  };

  const handlePostSelect = (p: Post) => {
    setPost(p);
    addMsg('user', p.name);
    setTimeout(() => {
      addMsg('bot', `**${p.name}** ke liye requirements:`);
      setTimeout(() => {
        addMsg('bot', `📋 **Pay Scale:** ${p.payScale}\n🎓 **Qualification:** ${p.qualification}\n🎂 **Age Limit:** ${p.ageLimit}`);
        setTimeout(() => {
          const reqDocs = p.requiredDocs.map(d => `📄 ${DOC_LABELS[d] || d}`).join('\n');
          const optDocs = p.optionalDocs.length ? '\n\nOptional:\n' + p.optionalDocs.map(d => `📎 ${DOC_LABELS[d] || d} (agar ho)`).join('\n') : '';
          addMsg('bot', `**Required Documents:**\n${reqDocs}${optDocs}`);
          setTimeout(() => {
            // UPSC exams need center selection
            const isUpsc = exam?.id?.includes('upsc') || exam?.id?.includes('cse') || exam?.id?.includes('nda') || exam?.id?.includes('cds');
            if (isUpsc) {
              addMsg('bot', `📍 UPSC exam ke liye **Exam Center** choose karo — apni city type karo, preference order set karo.`);
              setStep(25); // center selection step
              return;
            }
            // Rajasthan exams need SSO ID
            const eId = exam?.id || post?.id || '';
            if (isRajasthanExam(eId)) {
              addMsg('bot', `🔐 Rajasthan SSO ID se login hoga.\n\nAgar pehle se SSO ID hai toh enter karo — form automatically login ho jaayega.\nNahi hai toh blank chhod do, main khud register kar dunga.`);
              setStep(27); // SSO step
              return;
            }
            if (!mother || !mobile || !email) {
              addMsg('bot', `⚠️ Tumhari details nahi mili. Pehle home page pe documents upload karo — AI sab padh lega!`);
              setTimeout(() => addMsg('bot', `👉 localhost:3005 pe jao → documents upload karo → wapas aao`), 500);
              setStep(3);
            } else if (photoPath && signPath) {
              addMsg('bot', `✅ Sab ready hai! Photo, Signature aur details — sab saved hain. Start karein?`);
              setStep(5);
            } else {
              addMsg('bot', `✅ Details saved hain! Bas Photo aur Signature upload karo — phir form fill hoga automatic.`);
              setStep(3);
            }
          }, 800);
        }, 600);
      }, 500);
    }, 300);
  };

  const handleQualificationDone = () => {
    const { degree, college, university, passingYear, percentage } = qualification;
    if (!degree || !college || !passingYear || !percentage) return;
    addMsg('user', `${degree} — ${college} (${passingYear}) — ${percentage}%`);
    setTimeout(() => {
      addMsg('bot', `✅ Qualification saved!\n🎓 ${degree} from ${university || college}\n📅 Year: ${passingYear} | 📊 ${percentage}%`);
      setTimeout(() => {
        if (!mother || !mobile || !email) {
          addMsg('bot', `⚠️ Personal details nahi mili. Documents upload karo.`);
          setStep(3);
        } else if (photoPath && signPath) {
          addMsg('bot', `✅ Sab ready hai! Form fill shuru karein?`);
          setStep(5);
        } else {
          addMsg('bot', `✅ Qualification saved! Ab Photo aur Signature upload karo.`);
          setStep(3);
        }
      }, 600);
    }, 300);
  };

  const handleDocsUploaded = () => {
    addMsg('user', `Photo: ${photoName || '✅'} | Sign: ${signName || '✅'}`);
    setTimeout(() => {
      addMsg('bot', `✅ Photo aur Signature ready! Ab form fill shuru karein?`);
      setStep(5);
    }, 400);
  };

  const handleCentersDone = () => {
    if (selectedCenters.length === 0) return;
    const centerNames = selectedCenters.map((c, i) => `${i + 1}. ${c.city}`).join(', ');
    addMsg('user', `Centers: ${centerNames}`);
    setTimeout(() => {
      addMsg('bot', `✅ Centers set:\n${selectedCenters.map((c, i) => `${i + 1}. **${c.city}**, ${c.state}`).join('\n')}`);
      setTimeout(() => {
        addMsg('bot', `🎓 Ab apni **Educational Qualification** bharo — UPSC form mein zaruri hai.`);
        setStep(26); // qualification step
      }, 600);
    }, 300);
  };

  const handleSsoDone = (skip = false) => {
    const id   = ssoInput.id.trim();
    const pass = ssoInput.pass.trim();
    if (!skip && id) {
      setSsoId(id);
      setSsoPass(pass);
      // Save to localStorage permanently
      try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ssoId: id, ssoPass: pass }));
      } catch {}
      addMsg('user', `SSO ID: ${id}`);
    } else {
      setSsoId('');
      setSsoPass('');
      addMsg('user', 'SSO nahi hai — naya register karunga');
    }
    setTimeout(() => {
      if (!skip && id) {
        addMsg('bot', `✅ SSO ID saved! Login ke baad form auto-fill hoga.`);
      } else {
        addMsg('bot', `👍 Theek hai! Tumhara mobile number se naya SSO account banaunga.`);
      }
      setTimeout(() => {
        if (!mother || !mobile || !email) {
          addMsg('bot', `⚠️ Pehle personal details chahiye. Documents upload karo ya manually bharo.`);
          setStep(3);
        } else if (photoPath && signPath) {
          addMsg('bot', `✅ Sab ready hai! Form fill shuru karein?`);
          setStep(5);
        } else {
          addMsg('bot', `✅ Details saved! Ab Photo aur Signature upload karo.`);
          setStep(3);
        }
      }, 600);
    }, 300);
  };

  const handleDetailsSubmit = () => {
    const { mother: m, mobile: mob, email: em, aadhaar: adh, mark: mk } = detailsInput;
    if (!m || !mob || !em) { return; }
    setMother(m); setMobile(mob); setEmail(em); setAadhaar(adh); setVisibleMark(mk);
    saveProfile(detailsInput, photoPath, photoName, signPath, signName);
    addMsg('user', `Mother: ${m} | Mobile: ${mob} | Email: ${em}`);
    setTimeout(() => {
      addMsg('bot', `✅ Details save ho gayi! Sab ready hai.`);
      setTimeout(() => addMsg('bot', `Kya main ab form fill karna shuru karoon? SSC site kholunga, CAPTCHA aayega toh tumhe type karna hoga — baaki sab automatic!`), 600);
      setStep(5);
    }, 300);
  };

  const handleStart = () => {
    addMsg('user', 'Haan, start karo!');
    setTimeout(() => {
      const portalName = exam?.name || 'portal';
      addMsg('bot', `🤖 Theek hai! Browser kholke ${portalName} site pe ja raha hoon...`);
      setStep(6);
      startFill(exam?.id || 'ssc-cgl', mother, mobile, email, aadhaar, visibleMark, photoPath, signPath, selectedCenters);
    }, 300);
  };

  const handleSavedStart = () => {
    addMsg('user', 'Haan, saved details se start karo!');
    setTimeout(() => {
      const portalName = exam?.name || 'portal';
      addMsg('bot', `🤖 Theek hai! Saved details se ${portalName} form fill kar raha hoon...`);
      setStep(6);
      startFill(exam?.id || 'ssc-cgl', mother, mobile, email, aadhaar, visibleMark, photoPath, signPath, selectedCenters);
    }, 300);
  };

  // ── Render ─────────────────────────────────────────────────────
  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: 'white',
    padding: '10px 14px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  };

  const chipStyle = (active = false): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
    color: 'white',
    transition: 'all 0.15s',
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #07000f 0%, #0b0b22 60%, #0a0018 100%)' }}>

      {/* Header */}
      <div className="border-b px-4 py-0 flex items-center gap-3 sticky top-0 z-20"
        style={{ background: 'rgba(7,0,15,0.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)', minHeight: 56 }}>
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', boxShadow: '0 0 12px rgba(124,58,237,0.4)' }}>🤖</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm leading-tight">GovForm AI</h1>
          <p className="text-gray-500 leading-tight" style={{ fontSize: 10 }}>Auto-Fill Assistant</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {saved && (
            <span className="flex items-center gap-1 text-green-400 px-2 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(0,200,130,0.1)', border: '1px solid rgba(0,200,130,0.2)' }}>
              ✓ Saved
            </span>
          )}
          {running && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(59,111,255,0.12)', border: '1px solid rgba(59,111,255,0.25)', color: '#7aabff' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
              Live
            </span>
          )}
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-xs px-2 py-1.5">← Back</a>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">

        {/* Messages */}
        {msgs.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'bot' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🤖</div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'rounded-tr-sm text-white'
                : 'rounded-tl-sm text-gray-100'
            }`} style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                : 'rgba(255,255,255,0.07)',
              border: msg.role === 'bot' ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              {msg.text?.replace(/\*\*(.*?)\*\*/g, '$1') ?? ''}
              {msg.jsx}
            </div>
          </div>
        ))}

        {/* ── Step 1: Exam selection chips ── */}
        {step === 1 && (
          <div className="flex gap-2 flex-wrap pl-11">
            {EXAMS_WITH_POSTS.map(ex => (
              <button key={ex.id} onClick={() => handleExamSelect(ex)} style={chipStyle()}>
                {ex.icon} {ex.shortName}
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Post selection chips ── */}
        {step === 2 && exam && (
          <div className="pl-11 space-y-2">
            {exam.posts.map(p => (
              <button key={p.id} onClick={() => handlePostSelect(p)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3 hover:border-violet-500/60 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-white font-medium">{p.name}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">{p.payScale.split('(')[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 27: Rajasthan SSO Login ── */}
        {step === 27 && (
          <div className="pl-11 space-y-3">
            <div className="p-4 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔐</span>
                <p className="text-sm text-white font-semibold">Rajasthan SSO Login</p>
              </div>

              {/* Info banner */}
              <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <p className="text-violet-300 font-medium mb-0.5">SSO ID kya hota hai?</p>
                <p className="text-gray-400">Rajasthan ke sabhi govt exams (RPSC, RSMSSB, REET, Police) ek hi SSO ID se bhar sakte hain. Agar nahi hai toh blank chhodo — main register kar dunga.</p>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">SSO ID (agar pehle se hai)</label>
                <input
                  value={ssoInput.id}
                  onChange={e => setSsoInput(s => ({ ...s, id: e.target.value }))}
                  placeholder="jaise: sumit.mina or 9876543210"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Password {ssoInput.id ? '*' : '(optional)'}</label>
                <input
                  type="password"
                  value={ssoInput.pass}
                  onChange={e => setSsoInput(s => ({ ...s, pass: e.target.value }))}
                  placeholder="SSO password"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSsoDone(false)}
                  disabled={!!ssoInput.id && !ssoInput.pass}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white' }}
                >
                  {ssoInput.id ? '✅ Login karke start karo' : '📋 Mujhe naya register karo'}
                </button>
                {ssoInput.id && (
                  <button
                    onClick={() => handleSsoDone(true)}
                    className="px-4 py-3 rounded-xl text-sm text-gray-400 transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 25: UPSC Center Selection ── */}
        {step === 25 && (
          <div className="pl-11 space-y-3">
            <div className="p-4 rounded-2xl space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📍</span>
                <p className="text-sm text-white font-semibold">Exam Center Preference</p>
              </div>
              <CenterSelector
                selected={selectedCenters}
                onChange={setSelectedCenters}
              />
              <button
                onClick={handleCentersDone}
                disabled={selectedCenters.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                style={{ background: selectedCenters.length > 0 ? 'linear-gradient(135deg, #7c3aed, #2563eb)' : 'rgba(255,255,255,0.1)', color: 'white' }}
              >
                {selectedCenters.length === 0 ? 'Kam se kam 1 center choose karo' : `✅ ${selectedCenters.length} Center${selectedCenters.length > 1 ? 's' : ''} Confirm karo`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 26: Qualification Form ── */}
        {step === 26 && (
          <div className="pl-11 space-y-3">
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎓</span>
                <p className="text-sm text-white font-semibold">Educational Qualification</p>
                {qualification.college && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                    ✨ Document se auto-fill
                  </span>
                )}
              </div>

              {/* Degree dropdown */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Degree *</label>
                <select
                  value={qualification.degree}
                  onChange={e => setQualification(q => ({ ...q, degree: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                >
                  <option value="">-- Select Degree --</option>
                  {['BA','BSc','BCom','BTech','BE','BCA','BBA','MA','MSc','MCom','MTech','MBA','LLB','MBBS','BEd','Other'].map(d => (
                    <option key={d} value={d} style={{ background: '#1a0a2e' }}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Stream */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Stream / Subject</label>
                <input
                  value={qualification.stream}
                  onChange={e => setQualification(q => ({ ...q, stream: e.target.value }))}
                  placeholder="e.g. Science, Commerce, Computer Science"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              {/* College */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">College Name *</label>
                <input
                  value={qualification.college}
                  onChange={e => setQualification(q => ({ ...q, college: e.target.value }))}
                  placeholder="e.g. Govt. College Jaipur"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              {/* University */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">University Name</label>
                <input
                  value={qualification.university}
                  onChange={e => setQualification(q => ({ ...q, university: e.target.value }))}
                  placeholder="e.g. University of Rajasthan"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              {/* Year + Percentage row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Passing Year *</label>
                  <input
                    value={qualification.passingYear}
                    onChange={e => setQualification(q => ({ ...q, passingYear: e.target.value }))}
                    placeholder="2022"
                    maxLength={4}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Percentage / CGPA *</label>
                  <input
                    value={qualification.percentage}
                    onChange={e => setQualification(q => ({ ...q, percentage: e.target.value }))}
                    placeholder="72.5"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                  />
                </div>
              </div>

              {/* Roll No (optional) */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Roll No. (optional)</label>
                <input
                  value={qualification.rollNo}
                  onChange={e => setQualification(q => ({ ...q, rollNo: e.target.value }))}
                  placeholder="Degree roll number"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                />
              </div>

              <button
                onClick={handleQualificationDone}
                disabled={!qualification.degree || !qualification.college || !qualification.passingYear || !qualification.percentage}
                className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40 transition-all mt-1"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white' }}
              >
                ✅ Qualification Confirm karo
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Photo + Sign upload ── */}
        {step === 3 && (
          <div className="pl-11 space-y-3">
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>

              {/* No profile saved — redirect hint */}
              {(!mother || !mobile || !email) && (
                <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(124,58,237,0.1)', border: '2px dashed rgba(124,58,237,0.5)' }}>
                  <span className="text-2xl">🪪</span>
                  <div className="flex-1">
                    <p className="text-sm text-white font-semibold">Pehle Documents Upload karo</p>
                    <p className="text-xs text-violet-300">Home page pe jao → Aadhaar upload karo → AI sab padh lega</p>
                  </div>
                  <span className="text-violet-300 text-xs">→</span>
                </a>
              )}

              {/* Photo + Sign */}
              {([
                { label: '📷 Passport Photo', field: 'photo' as const, path: photoPath, name: photoName, hint: 'White background, formal, 10–50KB' },
                { label: '✍️ Signature',      field: 'sign'  as const, path: signPath,  name: signName,  hint: 'Black ink on white paper, 10–30KB' },
              ]).map(f => (
                <div key={f.field}>
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
                    style={{ background: f.path ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: f.path ? '1px solid rgba(34,197,94,0.4)' : '1px dashed rgba(255,255,255,0.2)' }}>
                    <span className="text-xl">{uploading === f.field ? '⏳' : f.path ? '✅' : '📁'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{f.label}</p>
                      <p className="text-xs text-gray-400">{f.path ? f.name : f.hint}</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" disabled={!!uploading}
                      onChange={e => { const file = e.target.files?.[0]; if (file) uploadFile(file, f.field); }} />
                  </label>
                </div>
              ))}

              <button onClick={handleDocsUploaded}
                disabled={!photoPath || !signPath}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: (photoPath && signPath) ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'rgba(255,255,255,0.1)', color: 'white' }}>
                {photoPath && signPath ? '✅ Aage badhein' : 'Photo aur Signature upload karo'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm / edit details ── */}
        {step === 4 && (
          <div className="pl-11">
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>

              {parsedProfile && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span>✅</span>
                  <span className="text-green-400">Aadhaar se auto-fill hua — check karo aur confirm karo</span>
                </div>
              )}

              {[
                { key: 'mother', label: "👩 Mother's Name", placeholder: 'Jaise: Sunita Devi' },
                { key: 'mobile', label: '📱 Mobile Number', placeholder: '10 digit number' },
                { key: 'email',  label: '📧 Email ID',      placeholder: 'example@gmail.com' },
                { key: 'aadhaar',label: '🪪 Aadhaar Number',placeholder: '12 digit' },
                { key: 'mark',   label: '🔍 Visible Mark',  placeholder: 'Jaise: Mole on right hand' },
              ].map(f => {
                const val = (detailsInput as Record<string,string>)[f.key];
                const missing = !val;
                return (
                  <div key={f.key}>
                    <label className="text-xs mb-1 flex items-center gap-1" style={{ color: missing ? '#f87171' : '#9ca3af' }}>
                      {f.label} {missing && <span className="text-red-400 font-bold">← bharna zaroori hai</span>}
                    </label>
                    <input
                      value={val}
                      onChange={e => setDetailsInput(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ ...inputStyle, border: missing ? '1px solid rgba(248,113,113,0.6)' : '1px solid rgba(255,255,255,0.15)' }}
                    />
                  </div>
                );
              })}

              <button onClick={handleDetailsSubmit}
                disabled={!detailsInput.mother || !detailsInput.mobile || !detailsInput.email}
                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white' }}>
                ✅ Confirm & Aage badhein
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Confirm start ── */}
        {step === 5 && (
          <div className="pl-11 flex gap-2 flex-wrap">
            {saved && photoPath && signPath && mother && mobile && email ? (
              <>
                <button onClick={handleSavedStart} style={{ ...chipStyle(), background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none' }}>
                  🚀 Haan, start karo!
                </button>
                <button onClick={() => setStep(3)} style={chipStyle()}>
                  📁 Naye documents upload karo
                </button>
                <button onClick={() => setStep(4)} style={chipStyle()}>
                  ✏️ Details change karo
                </button>
              </>
            ) : (
              <button onClick={handleStart} style={{ ...chipStyle(), background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none' }}>
                🚀 Haan, form fill karo!
              </button>
            )}
          </div>
        )}

        {/* ── Step 6: Running — Robot + live logs ── */}
        {step === 6 && (
          <div className="pl-11 space-y-3">
            {running && !showCaptcha && (
              <Robot label={
                logs.length === 0 ? 'Browser kholke SSC site ja raha hoon...' :
                logs.length < 3  ? 'Login kar raha hoon...' :
                'Form fill ho raha hai...'
              } />
            )}

            {/* Live log stream */}
            {logs.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                <div className="px-4 py-2.5 border-b flex items-center gap-2.5" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                  {running
                    ? <><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs text-green-400 font-semibold">Live Progress</span></>
                    : <><div className="w-2 h-2 rounded-full bg-gray-500" /><span className="text-xs text-gray-400 font-semibold">Completed</span></>
                  }
                  <span className="ml-auto text-xs text-gray-600">{logs.length} steps</span>
                </div>
                <div className="p-3 space-y-1.5 font-mono text-xs max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {logs.slice(-20).map((l, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="mt-0.5 flex-shrink-0" style={{
                        color: l.type === 'error' ? '#f87171'
                          : l.type === 'done' ? '#4ade80'
                          : l.type === 'captcha' ? '#fbbf24'
                          : l.type === 'payment' ? '#34d399'
                          : l.type === 'progress' ? '#94a3b8'
                          : '#6b7280'
                      }}>
                        {l.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mid-flow portal screenshot */}
            {(screenshotB64 || finalScreen) && (running || showOtp) && !showCaptcha && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(0,0,0,0.6)', boxShadow: '0 0 30px rgba(99,102,241,0.1)' }}>
                <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <p className="text-xs text-indigo-300 font-medium">Browser — Live View</p>
                </div>
                <img src={screenshotB64 ? `data:image/png;base64,${screenshotB64}` : `/api/screenshot?t=${finalScreen}`} alt="portal screenshot" className="w-full" style={{ display: 'block' }} />
              </div>
            )}

            {/* Payment QR Card */}
            {logs.filter(l => l.type === 'payment').slice(-1).map((l, i) => (
              <div key={i} className="rounded-2xl border-2 p-5 space-y-4" style={{ borderColor: '#34d399', background: 'rgba(0,0,0,0.85)', boxShadow: '0 0 30px rgba(52,211,153,0.2)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <p className="text-green-400 font-bold text-sm">Fee Payment</p>
                    {(l as LogEntry & { feeAmount?: string }).feeAmount && (
                      <p className="text-xs text-gray-400">Amount: <span className="text-white font-bold">₹{(l as LogEntry & { feeAmount?: string }).feeAmount}</span></p>
                    )}
                  </div>
                  <span className="ml-auto text-xs px-2 py-1 rounded-full animate-pulse" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    Pending
                  </span>
                </div>

                {/* QR or Payment Screenshot */}
                {(l as LogEntry & { qrBase64?: string }).qrBase64 ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs text-gray-400">UPI QR Code — phone se scan karo:</p>
                    <div className="p-3 rounded-xl bg-white inline-block">
                      <img
                        src={`data:image/png;base64,${(l as LogEntry & { qrBase64?: string }).qrBase64}`}
                        alt="UPI QR Code"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  </div>
                ) : (l as LogEntry & { screenshot?: string }).screenshot ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Payment page — QR scan karo ya Net Banking/Card choose karo:</p>
                    <div className="rounded-xl overflow-hidden border border-green-500/30">
                      <img
                        src={`data:image/png;base64,${(l as LogEntry & { screenshot?: string }).screenshot}`}
                        alt="Payment Page"
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : null}

                <p className="text-xs text-center" style={{ color: '#6b7280' }}>
                  Payment karne ke baad automatically detect ho jaayegi — kuch wait karo
                </p>
              </div>
            ))}

            {/* OTP / input box */}
            {showOtp && (() => {
              const isAadhaar  = /aadhaar/i.test(otpLabel);
              const isDone     = /done|manually|browser mein/i.test(otpLabel);
              const isYesNo    = /yes.*no|haan.*nahi|login karoon|already hai|account.*hai/i.test(otpLabel);
              const isRegId    = /registration id|reg id|reg no|otr id/i.test(otpLabel);
              const isPassword = /password type karo/i.test(otpLabel);
              const isOtp      = /\botp\b/i.test(otpLabel) && !isYesNo;
              const isText     = isDone || isYesNo || isRegId || isPassword || (!isOtp && !isAadhaar);

              const isCaptchaInput = /captcha/i.test(otpLabel);

              return (
                <div className="rounded-2xl border-2 border-blue-400 p-5 space-y-4" style={{ background: 'rgba(0,0,0,0.8)', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}>
                  <p className="text-blue-400 font-bold text-sm">{otpLabel}</p>
                  {/* Show captcha screenshot directly inside the input box for easy reference */}
                  {isCaptchaInput && (
                    <div className="rounded-xl overflow-hidden border border-yellow-400/50">
                      <div className="flex items-center justify-between px-2 py-1 bg-yellow-400/10">
                        <p className="text-xs text-yellow-300">📷 Portal screenshot — CAPTCHA yahan dekho:</p>
                        <button
                          onClick={() => setFinalScreen(String(Date.now()))}
                          className="text-xs text-yellow-200 hover:text-white px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,200,0,0.15)', border: '1px solid rgba(255,200,0,0.3)' }}
                        >🔄 Refresh</button>
                      </div>
                      {screenshotB64
                        ? <img src={`data:image/png;base64,${screenshotB64}`} alt="captcha" className="w-full" style={{ display: 'block' }} />
                        : finalScreen
                          ? <img src={`/api/screenshot?t=${finalScreen}`} alt="captcha" className="w-full" style={{ display: 'block' }} />
                          : <p className="text-xs text-gray-400 text-center py-4">Loading screenshot...</p>
                      }
                    </div>
                  )}
                  {isDone  && <p className="text-xs text-amber-400">👆 Browser mein manually karo — phir neeche "done" type karo</p>}
                  {isYesNo && <p className="text-xs text-green-400">👇 "yes" ya "no" type karo</p>}
                  <input
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitOtp(); }}
                    placeholder={
                      isYesNo   ? '"yes" ya "no" type karo' :
                      isAadhaar ? '12-digit Aadhaar number' :
                      isDone    ? 'Type "done" jab ho jaye' :
                      isRegId   ? 'Registration ID yahan type karo' :
                      isPassword? 'Password yahan type karo' :
                      isOtp     ? '6-digit OTP' :
                                  'Yahan type karo'
                    }
                    autoFocus
                    maxLength={isAadhaar ? 12 : isOtp ? 8 : 100}
                    style={{ ...inputStyle, fontSize: isText ? 16 : 24, letterSpacing: isText ? 'normal' : '0.4em', textAlign: 'center', border: '2px solid rgba(59,130,246,0.9)' }}
                  />
                  <button onClick={submitOtp}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white' }}>
                    {isDone    ? '✅ Done — Aage badhao' :
                     isYesNo   ? '✅ Submit' :
                     isAadhaar ? 'Submit Aadhaar' :
                     isOtp     ? 'Submit OTP' :
                                 'Submit'}
                  </button>
                </div>
              );
            })()}

            {/* CAPTCHA box */}
            {showCaptcha && (
              <div className="rounded-2xl border-2 border-amber-400 p-5 space-y-4" style={{ background: 'rgba(0,0,0,0.85)', boxShadow: '0 0 30px rgba(251,191,36,0.4)' }}>

                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-amber-400 font-bold text-sm">🔐 CAPTCHA</p>
                  {captchaCountdown > 0 && !captchaCancelled && (
                    <span className="text-xs px-2 py-1 rounded-full font-mono font-bold"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.4)' }}>
                      Auto-submit in {captchaCountdown}s...
                    </span>
                  )}
                </div>

                {/* CAPTCHA display */}
                <div className="rounded-xl flex flex-col items-center justify-center py-5 gap-2"
                  style={{ background: 'rgba(251,191,36,0.06)', border: '2px dashed rgba(251,191,36,0.4)' }}>
                  <span style={{ fontSize: 52, fontFamily: 'monospace', letterSpacing: '0.6em', color: '#fde68a', fontWeight: 900, paddingLeft: '0.6em', textShadow: '0 0 20px rgba(251,191,36,0.7)' }}>
                    {captchaText || '...'}
                  </span>
                  {captchaCountdown > 0 && !captchaCancelled && (
                    <p className="text-xs text-amber-300/60">🤖 Auto padh liya — khud submit kar raha hoon</p>
                  )}
                </div>

                {/* Auto-submit status */}
                {captchaCountdown > 0 && !captchaCancelled ? (
                  <div className="flex gap-2">
                    <button onClick={() => submitCaptcha(captchaText)}
                      className="flex-1 py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>
                      ⚡ Abhi submit karo
                    </button>
                    <button onClick={cancelAutoSubmit}
                      className="px-4 py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                      ✏️ Khud type karo
                    </button>
                  </div>
                ) : (
                  /* Manual input — shown after cancel or if captchaText was empty */
                  <>
                    <input
                      value={captchaInput}
                      onChange={e => setCaptchaInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitCaptcha(); }}
                      placeholder="Yahan type karo → Enter"
                      autoFocus
                      spellCheck={false}
                      style={{ ...inputStyle, fontSize: 24, letterSpacing: '0.4em', textAlign: 'center', border: '2px solid rgba(251,191,36,0.9)' }}
                    />
                    <button onClick={() => submitCaptcha()}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>
                      Submit CAPTCHA
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Done */}
            {done && (
              <div className="rounded-2xl border border-green-500/40 p-5 space-y-4" style={{ background: 'rgba(34,197,94,0.06)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <p className="text-green-400 font-black text-lg">Form Fill Ho Gaya!</p>
                    <p className="text-gray-400 text-sm">PDF ready hai — download karo</p>
                  </div>
                </div>
                {(screenshotB64 || finalScreen) && (
                  <img src={screenshotB64 ? `data:image/png;base64,${screenshotB64}` : `/api/screenshot?t=${finalScreen}`} alt="final" className="w-full rounded-xl border border-white/10" />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <a href={getPdfRoute(activeExamId)} download="Official_Form.pdf"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                    🏛️ Official Printout
                  </a>
                  <a href="/api/ssc-pdf" download="Summary.pdf"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                    📄 Summary PDF
                  </a>
                </div>
                <button onClick={() => { setStep(1); setExam(null); setPost(null); setRunning(false); setDone(false); setLogs([]); setMsgs([]); setTimeout(() => { addMsg('bot', 'Namaste! 👋 Kaunsa exam ka form bharna hai?'); setStep(1); }, 300); }}
                  className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Naya form fill karo
                </button>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
