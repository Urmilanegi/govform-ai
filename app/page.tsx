'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EXAMS_WITH_POSTS, Post } from '@/lib/posts-data';
import { NOTIFICATIONS, CATEGORY_META } from '@/lib/notifications-data';
import { Reveal, ScrollProgress, Parallax, Counter, Tilt, Wave } from '@/app/components/Animate';
import { FillKaroIcon, FillKaroWordmark } from '@/app/components/Logo';
import { ExamLogo } from '@/app/components/ExamLogos';

const DOC_LABELS: Record<string, { label: string; icon: string }> = {
  aadhaar:                { label: 'Aadhaar Card',           icon: '🪪' },
  marksheet_10:           { label: '10th Marksheet',         icon: '📄' },
  marksheet_12:           { label: '12th Marksheet',         icon: '📄' },
  graduation_certificate: { label: 'Graduation Certificate', icon: '🎓' },
  caste_certificate:      { label: 'Caste Certificate',      icon: '📋' },
  pan:                    { label: 'PAN Card',                icon: '💳' },
  domicile:               { label: 'Domicile Certificate',   icon: '🏠' },
  photo:                  { label: 'Passport Photo',         icon: '📸' },
  other:                  { label: 'Other Document',         icon: '📎' },
};

const ALL_DOC_TYPES = Object.keys(DOC_LABELS).filter(k => k !== 'other');

const EXAM_CATEGORIES = [
  {
    id: 'SSC', icon: '🏛️', label: 'SSC',
    exams: [
      { name: 'SSC CGL', posts: '17,727' },
      { name: 'SSC CHSL', posts: '3,712' },
      { name: 'SSC MTS', posts: '10,583' },
      { name: 'SSC GD', posts: '26,146' },
      { name: 'SSC CPO', posts: '4,187' },
      { name: 'SSC JE', posts: '968' },
    ],
  },
  {
    id: 'Railway', icon: '🚂', label: 'Railway',
    exams: [
      { name: 'RRB NTPC', posts: '11,558' },
      { name: 'RRB ALP', posts: '18,799' },
      { name: 'RRB Group D', posts: '32,438' },
      { name: 'RRB JE', posts: '7,951' },
      { name: 'RRB RPF', posts: '4,660' },
    ],
  },
  {
    id: 'Banking', icon: '🏦', label: 'Banking',
    exams: [
      { name: 'SBI PO', posts: '2,000' },
      { name: 'SBI Clerk', posts: '13,735' },
      { name: 'IBPS PO', posts: '4,455' },
      { name: 'IBPS Clerk', posts: '6,128' },
      { name: 'RBI Grade B', posts: '294' },
    ],
  },
  {
    id: 'UPSC', icon: '🏅', label: 'UPSC',
    exams: [
      { name: 'UPSC IAS', posts: '1,016' },
      { name: 'UPSC NDA', posts: '400' },
      { name: 'UPSC CDS', posts: '459' },
      { name: 'UPSC CAPF', posts: '506' },
    ],
  },
  {
    id: 'Army', icon: '🪖', label: 'Defence',
    exams: [
      { name: 'Army Agniveer', posts: '25,000+' },
      { name: 'Navy Agniveer', posts: '2,800' },
      { name: 'Air Force AFCAT', posts: '304' },
    ],
  },
  {
    id: 'Police', icon: '🚔', label: 'Police',
    exams: [
      { name: 'UP Police', posts: '60,244' },
      { name: 'Bihar Police', posts: '21,391' },
      { name: 'Delhi Police', posts: '7,547' },
    ],
  },
  {
    id: 'StatePSC', icon: '📜', label: 'State PSC',
    exams: [
      { name: 'BPSC', posts: '1,024' },
      { name: 'UPPSC', posts: '535' },
      { name: 'RPSC RAS', posts: '988' },
      { name: 'UPTET', posts: 'Eligible' },
    ],
  },
  {
    id: 'Others', icon: '📮', label: 'Others',
    exams: [
      { name: 'Post Office GDS', posts: '44,228' },
      { name: 'CTET', posts: 'Eligible' },
      { name: 'FCI', posts: '5,043' },
    ],
  },
];

interface UploadedDoc { type: string; label: string; file: File; }

type FindExam = { name: string; status: string; icon: string };
const FIND_TABS: { id: string; label: string; exams: FindExam[] }[] = [
  {
    id: 'upcoming', label: 'Upcoming',
    exams: [
      { name: 'DSSSB TGT Science', status: 'To be Announced', icon: '🧪' },
      { name: 'UP Home Guards 2025', status: 'To be Announced', icon: '🛡️' },
      { name: 'BSSC Inter Level 2025', status: 'To be Announced', icon: '📋' },
      { name: 'RRB NTPC 10+2 Level 2025', status: 'To be Announced', icon: '🚆' },
      { name: 'Navodaya Vidyalaya Class 11th', status: '07 Feb 2026', icon: '🏫' },
      { name: 'RRB NTPC Graduate Level 2025', status: 'To be Announced', icon: '🚆' },
      { name: 'Rajasthan Police SI', status: 'To be Announced', icon: '🚔' },
      { name: 'BSSC Bihar CGL 2025', status: 'To be Announced', icon: '📜' },
      { name: 'Airforce AFCAT 01/2026', status: '31 Jan 2026', icon: '✈️' },
    ],
  },
  {
    id: 'ssc', label: 'SSC',
    exams: [
      { name: 'SSC CGL 2026', status: 'Live Now', icon: '🏛️' },
      { name: 'SSC CHSL 2026', status: 'To be Announced', icon: '📝' },
      { name: 'SSC MTS 2026', status: 'To be Announced', icon: '✏️' },
      { name: 'SSC GD Constable', status: 'To be Announced', icon: '🪖' },
      { name: 'SSC CPO SI Tier-I', status: '09–12 Dec 2025', icon: '🚓' },
      { name: 'SSC JE 2026', status: 'To be Announced', icon: '🔧' },
    ],
  },
  {
    id: 'railways', label: 'Railways',
    exams: [
      { name: 'RRB NTPC Graduate', status: 'To be Announced', icon: '🚆' },
      { name: 'RRB ALP 2025', status: 'To be Announced', icon: '🚄' },
      { name: 'RRB Group D', status: 'To be Announced', icon: '🛤️' },
      { name: 'RRB JE 2025', status: 'To be Announced', icon: '🔧' },
      { name: 'RRB RPF Constable', status: 'To be Announced', icon: '🚔' },
    ],
  },
  {
    id: 'banking', label: 'Banking & Insurance',
    exams: [
      { name: 'SBI PO 2026', status: 'To be Announced', icon: '🏦' },
      { name: 'SBI Clerk 2026', status: 'To be Announced', icon: '💰' },
      { name: 'IBPS PO 2026', status: 'To be Announced', icon: '🏦' },
      { name: 'IBPS Clerk 2026', status: 'To be Announced', icon: '🧾' },
      { name: 'RBI Grade B', status: 'To be Announced', icon: '🏛️' },
      { name: 'LIC AAO', status: 'To be Announced', icon: '🛡️' },
    ],
  },
  {
    id: 'tet', label: 'TET',
    exams: [
      { name: 'CTET Paper 1', status: '08 Feb 2026', icon: '📚' },
      { name: 'CTET Paper II', status: '08 Feb 2026', icon: '📖' },
      { name: 'UPTET 2026', status: 'To be Announced', icon: '🎓' },
      { name: 'REET 2026', status: 'To be Announced', icon: '📓' },
    ],
  },
  {
    id: 'defence', label: 'Defence',
    exams: [
      { name: 'Army Agniveer', status: 'To be Announced', icon: '🪖' },
      { name: 'Navy Agniveer', status: 'To be Announced', icon: '⚓' },
      { name: 'Airforce AFCAT 01/2026', status: '31 Jan 2026', icon: '✈️' },
      { name: 'UPSC CDS', status: 'To be Announced', icon: '🎖️' },
      { name: 'UPSC NDA', status: 'To be Announced', icon: '🪂' },
    ],
  },
  {
    id: 'upsc', label: 'UPSC',
    exams: [
      { name: 'UPSC IAS 2026', status: 'To be Announced', icon: '🏅' },
      { name: 'UPSC CAPF', status: 'To be Announced', icon: '🛡️' },
      { name: 'UPSC NDA', status: 'To be Announced', icon: '🪂' },
      { name: 'UPSC CDS', status: 'To be Announced', icon: '🎖️' },
    ],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [detectedExam, setDetectedExam] = useState<{ id: string; name: string } | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docError, setDocError] = useState(false);
  const [filledForms, setFilledForms] = useState<{ exam: string; date: string }[]>([]);

  // Load filled-forms history when drawer opens
  useEffect(() => {
    if (!drawerOpen) return;
    try { setFilledForms(JSON.parse(localStorage.getItem('fillkaro_filled') || '[]')); } catch { setFilledForms([]); }
  }, [drawerOpen]);
  const [chatInput, setChatInput] = useState('');
  const [examError, setExamError] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>('SSC');
  const [findTab, setFindTab] = useState('upcoming');
  const [findSearch, setFindSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocType, setActiveDocType] = useState('');
  const [folderGranted, setFolderGranted] = useState(false);
  const [autoFinding, setAutoFinding] = useState<string | null>(null);
  const dirHandleRef = useRef<any>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const DOC_PATTERNS: Record<string, RegExp> = {
    aadhaar: /aadh?ar|uid/i,
    marksheet_10: /10th|tenth|matric|sslc|xth|class.?10/i,
    marksheet_12: /12th|twelfth|inter|xii|class.?12/i,
    graduation_certificate: /degree|graduat|btech|bsc|bca|ba[_\s]|bcom/i,
    caste_certificate: /caste|cast|obc|sc[_\s]|scheduled/i,
    domicile: /domicile|niwas|residence/i,
    pan: /\bpan\b/i,
    photo: /photo|passport|pic|selfie/i,
    sign: /sign/i,
  };

  const grantFolderAccess = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
      dirHandleRef.current = handle;
      setFolderGranted(true);
    } catch {}
  };

  const handleDocClick = async (docType: string) => {
    if (dirHandleRef.current) {
      setAutoFinding(docType);
      try {
        const pattern = DOC_PATTERNS[docType];
        const matches: File[] = [];
        for await (const [name, handle] of dirHandleRef.current.entries()) {
          if (handle.kind !== 'file') continue;
          const ext = name.split('.').pop()?.toLowerCase() || '';
          if (!['jpg','jpeg','png','pdf','webp'].includes(ext)) continue;
          if (pattern && pattern.test(name)) matches.push(await handle.getFile());
        }
        if (matches.length > 0) {
          const best = matches.sort((a, b) => a.name.length - b.name.length)[0];
          setUploadedDocs(prev => [...prev.filter(d => d.type !== docType), { type: docType, label: DOC_LABELS[docType]?.label || docType, file: best }]);
          setAutoFinding(null);
          return;
        }
      } catch {}
      setAutoFinding(null);
    }
    setActiveDocType(docType);
    fileInputRef.current?.click();
  };

  const detectExam = async (text: string) => {
    if (!text.trim() || isDetecting) return;
    setChatInput('');
    setExamError('');
    setIsDetecting(true);
    try {
      const res = await fetch('/api/detect-exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const data = await res.json();
      if (data.detected && data.examId) {
        setDetectedExam({ id: data.examId, name: data.examName });
        setStep(2);
      } else {
        setExamError('Exam nahi mila. SSC CGL, Railway NTPC ya UPSC try karo.');
      }
    } catch {
      setExamError('Network error. Dobara try karo.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleFileSelect = useCallback((files: FileList | null, docType: string) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedDocs(prev => [...prev.filter(d => d.type !== docType), { type: docType, label: DOC_LABELS[docType]?.label || docType, file }]);
  }, []);

  // Browser mein hi photo chhoti karo — phone se 8MB photo seedha 300KB ho jaati hai,
  // upload 10x fast aur server (512MB RAM) pe load nahi padta.
  // HEIC bhi browser mein hi JPEG banta hai (heic2any) — server pe heavy WASM nahi chalana padta.
  const compressImage = async (file: File): Promise<File> => {
    const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (!isHeic && (!file.type.startsWith('image/') || file.size < 600 * 1024)) return file;
    if (isHeic) {
      try {
        // Safari HEIC natively decode karta hai — pehle woh try hoga (neeche createImageBitmap).
        // Chrome/Android ke liye heic2any (browser WASM) — memory user ke device pe use hoti hai.
        const heic2any = (await import('heic2any')).default;
        const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.82 })) as Blob;
        file = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
      } catch { /* Safari pe createImageBitmap chal jayega, warna original server pe */ }
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
    } catch {
      return file; // HEIC on Chrome etc. — server handle karega
    }
  };

  // HTML error page (deploy restart / 502) ko friendly message banao
  const safeJson = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch {
      throw new Error(`Server thodi der ke liye busy tha (${res.status}). 30 second baad dobara try karo.`);
    }
  };

  const handleSubmit = async () => {
    if (!detectedExam) return;
    setIsProcessing(true);
    try {
      sessionStorage.removeItem('filledForm');
      sessionStorage.removeItem('extractedProfile');
      sessionStorage.removeItem('selectedPost');
      localStorage.removeItem('filledForm');
      localStorage.removeItem('extractedProfile');
      localStorage.removeItem('selectedPost');

      setProcessingStep('📦 Photos compress ho rahi hain...');
      const formData = new FormData();
      for (const doc of uploadedDocs) formData.append(`doc_${doc.type}`, await compressImage(doc.file));

      setProcessingStep('📄 Documents padh raha hoon...');
      const parseRes = await fetch('/api/parse-documents', { method: 'POST', body: formData });
      const parseData = await safeJson(parseRes);
      if (!parseData.success) throw new Error(parseData.error || parseData.details || 'Parse failed');

      setProcessingStep('✍️ Form fill kar raha hoon...');
      const fillRes = await fetch('/api/fill-form', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: detectedExam.id, profile: parseData.extractedData, postId: selectedPost?.id })
      });
      const fillData = await safeJson(fillRes);
      if (!fillData.success) throw new Error(fillData.error || 'Fill failed');

      setProcessingStep('✅ Ho gaya!');
      sessionStorage.setItem('filledForm', JSON.stringify(fillData.filledForm));
      sessionStorage.setItem('extractedProfile', JSON.stringify(parseData.extractedData));
      sessionStorage.setItem('selectedPost', JSON.stringify(selectedPost));
      localStorage.setItem('filledForm', JSON.stringify(fillData.filledForm));
      localStorage.setItem('extractedProfile', JSON.stringify(parseData.extractedData));
      localStorage.setItem('selectedPost', JSON.stringify(selectedPost));

      const ep = parseData.extractedData || {};
      const sscProfile = {
        mother: ep.motherName || ep.mother_name || '',
        mobile: ep.mobile || ep.phone || ep.mobileNumber || '',
        email: ep.email || '',
        aadhaar: (ep.aadhaarNumber || ep.aadhaar || '').replace(/\s/g, ''),
        visibleMark: ep.visibleMark || 'Mole on right hand',
        name: ep.fullName || ep.name || '',
        fatherName: ep.fatherName || ep.father_name || '',
        dob: ep.dateOfBirth || ep.dob || '',
        gender: ep.gender || '',
        category: ep.category || '',
        address: ep.permanentAddress || ep.address || '',
        state: ep.state || '',
        district: ep.district || '',
        pin: ep.pinCode || ep.pin || '',
      };
      let existing: Record<string, string> = {};
      try { existing = JSON.parse(localStorage.getItem('govform_profile') || '{}'); } catch {}
      localStorage.setItem('govform_profile', JSON.stringify({ ...existing, ...sscProfile }));
      router.push('/review');
    } catch (err) {
      alert('Error: ' + String(err));
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const requiredDocSet = new Set(selectedPost?.requiredDocs || []);
  const missingReqDocs = [...requiredDocSet].filter(d => !uploadedDocs.find(u => u.type === d));
  const displayDocTypes = selectedPost
    ? [...selectedPost.requiredDocs, ...selectedPost.optionalDocs, 'other']
    : ALL_DOC_TYPES.concat(['other']);
  const examPosts = detectedExam ? EXAMS_WITH_POSTS.find(e => e.id === detectedExam.id)?.posts || [] : [];

  const scrollToFlow = () => flowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (isProcessing) {
    return (
      <div className="processing-screen">
        {/* Chat bubble dots — robot orb ki jagah */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00D4FF,#0891B2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🤖</div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px 18px 18px 4px', padding: '14px 20px', display: 'flex', gap: 7, alignItems: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#00D4FF', animation: 'botDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text1)', marginBottom: 8, letterSpacing: '-0.5px' }}>AI Kaam Kar Raha Hai</h2>
          <p style={{ fontSize: 15, color: 'var(--emerald)', fontWeight: 700, marginBottom: 4 }}>{processingStep}</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>30–60 seconds lagenge...</p>
        </div>
        <div className="progress-dots">
          <span /><span /><span /><span />
        </div>
        <style>{`@keyframes botDot { 0%,80%,100%{opacity:0.25;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.15)} }`}</style>
      </div>
    );
  }

  const stepDone = (n: number) => step > n;
  const stepActive = (n: number) => step === n;

  return (
    <>
      <ScrollProgress />

      {/* ═══ NAVBAR ═══ */}
      <nav className="gf-nav">
        <div className="gf-logo" style={{ gap: 10 }}>
          <FillKaroIcon size={34} />
          <FillKaroWordmark size={20} />
        </div>
        <div className="gf-nav-links">
          <a className="gf-nav-link" href="#find">Find Exam</a>
          <span className="gf-nav-link" onClick={scrollToFlow}>Form Bharo</span>
          <a className="gf-nav-link" href="#alerts">Job Alerts</a>
          <a className="gf-nav-link" href="#how">Kaise Kaam Karta Hai</a>
          <button className="gf-burger" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ═══ SIDE DRAWER ═══ */}
      {drawerOpen && (
        <>
          <div className="gf-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <aside className="gf-drawer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FillKaroIcon size={28} />
                <FillKaroWordmark size={16} />
              </div>
              <button onClick={() => setDrawerOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(110,200,255,0.18)', color: 'var(--text2)', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>

            {/* My Exams */}
            <div className="gf-drawer-section">
              <div className="gf-drawer-title">📂 My Exams
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', WebkitTextFillColor: '#00D4FF' }}>
                  {filledForms.length} filled
                </span>
              </div>
              {filledForms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px 8px' }}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Abhi koi form fill nahi hua</p>
                  <a href="/ssc" className="gf-drawer-item" style={{ justifyContent: 'center', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF', fontWeight: 700 }}>
                    🚀 Pehla form bharo →
                  </a>
                </div>
              ) : (
                filledForms.slice().reverse().map((f, i) => (
                  <div key={i} className="gf-drawer-item">
                    <ExamLogo exam={f.exam} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{f.exam}</p>
                      <p style={{ fontSize: 10, color: 'var(--text3)' }}>{f.date}</p>
                    </div>
                    <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Filled</span>
                  </div>
                ))
              )}
            </div>

            {/* Admit Card */}
            <div className="gf-drawer-section">
              <div className="gf-drawer-title">🎫 Admit Card</div>
              <a className="gf-drawer-item" href="https://ssc.gov.in/login" target="_blank" rel="noreferrer"><ExamLogo exam="ssc" size={26} /> SSC Admit Card</a>
              <a className="gf-drawer-item" href="https://www.rrbapply.gov.in/#/auth/landing" target="_blank" rel="noreferrer"><ExamLogo exam="rrb" size={26} /> Railway (RRB) Admit Card</a>
              <a className="gf-drawer-item" href="https://upsconline.nic.in/eadmitcard/admitcard.php" target="_blank" rel="noreferrer"><ExamLogo exam="upsc" size={26} /> UPSC e-Admit Card</a>
              <a className="gf-drawer-item" href="https://www.ibps.in" target="_blank" rel="noreferrer"><ExamLogo exam="ibps" size={26} /> IBPS Admit Card</a>
            </div>

            {/* Latest Results */}
            <div className="gf-drawer-section">
              <div className="gf-drawer-title">🏆 Latest Result</div>
              <a className="gf-drawer-item" href="https://ssc.gov.in/portal/results" target="_blank" rel="noreferrer"><ExamLogo exam="ssc" size={26} /> SSC Results</a>
              <a className="gf-drawer-item" href="https://www.rrbcdg.gov.in" target="_blank" rel="noreferrer"><ExamLogo exam="rrb" size={26} /> Railway Results</a>
              <a className="gf-drawer-item" href="https://upsc.gov.in/examinations/final-results" target="_blank" rel="noreferrer"><ExamLogo exam="upsc" size={26} /> UPSC Final Results</a>
              <a className="gf-drawer-item" href="https://www.ibps.in/crp-po-mt" target="_blank" rel="noreferrer"><ExamLogo exam="bank" size={26} /> Banking Results</a>
            </div>
          </aside>
        </>
      )}

      {/* ═══ HERO ═══ */}
      <section className="gf-hero">
        <Parallax speed={0.18}><div className="gf-orb gf-orb-1" /></Parallax>
        <Parallax speed={0.3}><div className="gf-orb gf-orb-2" /></Parallax>
        <Parallax speed={0.12}><div className="gf-orb gf-orb-3" /></Parallax>

        <div className="gf-hero-eyebrow gf-rise gf-float">
          <span className="live-dot green" />
          Claude AI · 98% Accuracy · 50,000+ Forms
        </div>
        <h1 className="gf-rise gf-rise-1">
          Sarkari Form,<br />
          <span className="emerald">AI Bharega</span> — <span className="gold">5 Minute</span> Mein.
        </h1>
        <p className="gf-hero-sub gf-rise gf-rise-2">
          Documents upload karo, baaki sab AI sambhal lega — SSC, Railway, Banking,
          UPSC. Captcha se signature tak, ek bhi field tumhe nahi bharna.
        </p>
        <div className="gf-hero-actions gf-rise gf-rise-3">
          <a className="gf-btn-hero" href="/ssc">
            ⚡ SSC CGL Form Bharo — LIVE
          </a>
          <button className="gf-btn-outline" onClick={scrollToFlow}>
            Dusre Exams Dekho ↓
          </button>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <Reveal variant="reveal-zoom" as="div" className="gf-stats">
        <div className="gf-stat">
          <div className="gf-stat-num"><Counter to={50} suffix="K+" /></div>
          <div className="gf-stat-label">Forms Filled</div>
        </div>
        <div className="gf-stat">
          <div className="gf-stat-num"><Counter to={98} suffix="%" /></div>
          <div className="gf-stat-label">Accuracy</div>
        </div>
        <div className="gf-stat">
          <div className="gf-stat-num"><Counter to={5} suffix=" Min" /></div>
          <div className="gf-stat-label">Avg Time</div>
        </div>
        <div className="gf-stat">
          <div className="gf-stat-num"><Counter to={50} prefix="₹" /></div>
          <div className="gf-stat-label">Per Form</div>
        </div>
      </Reveal>

      {/* ═══ MARQUEE ═══ */}
      <div className="gf-marquee">
        <div className="gf-marquee-track">
          {[...Array(2)].flatMap((_, k) => (
            ['SSC CGL', 'Railway NTPC', 'IBPS PO', 'UPSC IAS', 'SBI Clerk', 'Army Agniveer', 'UP Police', 'CTET', 'RPSC RAS']
              .map((t, i) => <span key={`${k}-${i}`} className="gf-marquee-item">{t}</span>)
          ))}
        </div>
      </div>

      <Wave />

      {/* ═══ FIND MY EXAM ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section" id="find">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 className="gf-section-title">Find <span className="accent">My Exam</span></h2>
          <p className="gf-section-sub" style={{ marginTop: 8 }}>Apna exam dhundo — ek click me AI form bhar dega</p>
        </div>

        <div className="gf-find-search">
          <input
            value={findSearch}
            onChange={e => setFindSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && findSearch.trim() && detectExam(findSearch)}
            placeholder="🔍  Search Exams — SSC CGL, Railway NTPC, IBPS PO..."
          />
          <button onClick={() => findSearch.trim() && detectExam(findSearch)}>Search</button>
        </div>

        <div className="gf-find-tabs hide-scroll">
          {FIND_TABS.map(t => (
            <button key={t.id} className={`gf-find-tab ${findTab === t.id ? 'on' : ''}`} onClick={() => setFindTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="gf-find-grid reveal-stagger in" key={findTab}>
          {(FIND_TABS.find(t => t.id === findTab)?.exams || []).map((ex, i) => {
            const isLive = /live/i.test(ex.status);
            const hasDate = /\d/.test(ex.status);
            return (
              <div key={i} className="gf-exam-card" onClick={() => detectExam(ex.name)}>
                <div className="gf-exam-logo3d"><ExamLogo exam={ex.name} size={40} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="gf-exam-card-name">{ex.name}</div>
                  <div className="gf-exam-card-status" style={{ color: isLive ? 'var(--emerald)' : hasDate ? 'var(--champagne)' : 'var(--text3)' }}>
                    {isLive && <span className="live-dot green" style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                    {ex.status}
                  </div>
                </div>
                <div className="gf-exam-card-arrow">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      <Wave flip />

      {/* ═══ JOB ALERTS ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section" id="alerts">
        <div className="gf-section-head">
          <div>
            <h2 className="gf-section-title">Latest <span className="accent">Job Alerts</span></h2>
            <p className="gf-section-sub">Naye notifications — deadline se pehle apply karo</p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,91,91,0.3)', background: 'rgba(255,91,91,0.07)' }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FF7B7B' }}>LIVE</span>
          </div>
        </div>
        <div className="gf-alert-rail hide-scroll reveal-stagger in">
          {NOTIFICATIONS.map(n => {
            const meta = CATEGORY_META[n.category];
            const daysLeft = n.lastDate !== '—' ? Math.ceil((new Date(n.lastDate).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={n.id} className="gf-alert-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{n.shortOrg}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text1)', lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.2px' }}>{n.examName}</p>
                <p style={{ fontSize: 12, color: 'var(--text2)' }}>{n.posts.toLocaleString('en-IN')} Posts · {n.salary}</p>
                {daysLeft !== null && (
                  <p style={{ fontSize: 12, fontWeight: 800, marginTop: 8, color: daysLeft <= 5 ? '#FF7B7B' : daysLeft <= 15 ? 'var(--champagne)' : 'var(--emerald)' }}>
                    {daysLeft > 0 ? `⏰ ${daysLeft} din bache` : '❌ Closed'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>

      <Wave flip />

      {/* ═══ FORM FILL FLOW ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section">
        <div ref={flowRef} />
        <div className="gf-section-head">
          <div>
            <h2 className="gf-section-title">Form <span className="accent">Fill Karo</span></h2>
            <p className="gf-section-sub">4 simple steps — exam chuno, post chuno, docs do, AI bharega</p>
          </div>
        </div>

        <div className={`gf-panel ${stepActive(4) ? 'gf-panel-glow' : ''}`}>
          <div className="gf-steps-track">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`gf-step-seg ${stepDone(n) ? 'done' : stepActive(n) ? 'active' : ''}`} />
            ))}
          </div>

          {/* STEP 1: EXAM */}
          <div className="gf-step-block">
            <div className="gf-step-head">
              <div className={`gf-step-badge ${stepActive(1) ? 'active' : stepDone(1) ? 'done' : 'pending'}`}>
                {stepDone(1) ? '✓' : '1'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Exam Chuno</div>
                {stepDone(1) && detectedExam
                  ? <div style={{ fontSize: 12, color: 'var(--emerald)', marginTop: 2, fontWeight: 600 }}>✓ {detectedExam.name}</div>
                  : <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>SSC, Railway, UPSC, Banking, Defence...</div>}
              </div>
              {stepDone(1) && (
                <button onClick={() => { setStep(1); setDetectedExam(null); setSelectedPost(null); }}
                  style={{ fontSize: 12, color: 'var(--champagne)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  Change
                </button>
              )}
            </div>

            {stepActive(1) && (
              <div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 24px 16px' }} className="hide-scroll">
                  {EXAM_CATEGORIES.map(cat => (
                    <div key={cat.id}
                      className={`gf-chip ${openCategory === cat.id ? 'on' : ''}`}
                      onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}>
                      {cat.icon} {cat.label}
                    </div>
                  ))}
                </div>

                {EXAM_CATEGORIES.filter(c => c.id === openCategory).map(cat => (
                  <div key={cat.id}>
                    {cat.exams.map(exam => (
                      <div key={exam.name} className="gf-row" onClick={() => detectExam(exam.name)}>
                        <ExamLogo exam={exam.name} size={36} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{exam.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{exam.posts} Posts</div>
                        </div>
                        {isDetecting
                          ? <div style={{ width: 16, height: 16, border: '2px solid var(--emerald)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>}
                      </div>
                    ))}
                  </div>
                ))}

                <div style={{ padding: '16px 24px 22px', display: 'flex', gap: 10, borderTop: '1px solid var(--border)' }}>
                  <input
                    className="gf-input"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && detectExam(chatInput)}
                    placeholder="Ya type karo: Railway Group D..."
                    disabled={isDetecting}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => detectExam(chatInput)} disabled={isDetecting || !chatInput.trim()}
                    style={{ padding: '0 20px', background: 'linear-gradient(135deg, #00D4FF, #0891B2)', borderRadius: 14, color: '#02101A', fontWeight: 900, fontSize: 18, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: (!chatInput.trim() || isDetecting) ? 0.4 : 1 }}>
                    →
                  </button>
                </div>

                {examError && (
                  <div style={{ margin: '0 24px 20px', padding: '12px 16px', background: 'rgba(255,107,107,0.07)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 12, fontSize: 13, color: '#FF9B9B' }}>
                    ⚠️ {examError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: POST */}
          {step >= 2 && (
            <div className="gf-step-block">
              <div className="gf-step-head">
                <div className={`gf-step-badge ${stepActive(2) ? 'active' : stepDone(2) ? 'done' : 'pending'}`}>
                  {stepDone(2) ? '✓' : '2'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Post Chuno</div>
                  {stepDone(2) && selectedPost
                    ? <div style={{ fontSize: 12, color: 'var(--emerald)', marginTop: 2, fontWeight: 600 }}>✓ {selectedPost.name}</div>
                    : <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{detectedExam?.name} ke available posts</div>}
                </div>
                {stepDone(2) && (
                  <button onClick={() => { setStep(2); setSelectedPost(null); }}
                    style={{ fontSize: 12, color: 'var(--champagne)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    Change
                  </button>
                )}
              </div>
              {stepActive(2) && (
                <div>
                  {examPosts.map(post => (
                    <div key={post.id} className="gf-row" onClick={() => { setSelectedPost(post); setStep(3); }}>
                      <div className="gf-row-icon">💼</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{post.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>💰 {post.payScale} · 🎓 {post.qualification}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DOCUMENTS */}
          {step >= 3 && (
            <div className="gf-step-block">
              <div className="gf-step-head">
                <div className={`gf-step-badge ${stepActive(3) ? 'active' : stepDone(3) ? 'done' : 'pending'}`}>
                  {stepDone(3) ? '✓' : '3'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Documents Upload</div>
                  {mounted && uploadedDocs.length > 0
                    ? <div style={{ fontSize: 12, color: 'var(--emerald)', marginTop: 2, fontWeight: 600 }}>✓ {uploadedDocs.length} documents ready</div>
                    : <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Aadhaar, Marksheet, Photo...</div>}
                </div>
              </div>

              {stepActive(3) && (
                <div>
                  <div style={{ margin: '0 24px 14px', padding: 18, background: folderGranted ? 'rgba(0,212,255,0.06)' : 'rgba(232,194,104,0.05)', border: `1px solid ${folderGranted ? 'rgba(0,212,255,0.25)' : 'rgba(232,194,104,0.2)'}`, borderRadius: 14 }}>
                    {!folderGranted ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⚡ Smart Upload Mode</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Ek baar folder do — phir click karo, AI khud dhundh lega!</div>
                        <button onClick={grantFolderAccess} className="gf-btn gf-btn-gold" style={{ padding: 13 }}>
                          📁 Folder Access Do (ek baar)
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>✅</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--emerald)' }}>Smart Mode ON</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Click karo — auto-upload ho jayega!</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {displayDocTypes.map(docId => {
                    const info = DOC_LABELS[docId] || { label: docId, icon: '📎' };
                    const uploaded = uploadedDocs.find(u => u.type === docId);
                    const isReq = requiredDocSet.has(docId);
                    return (
                      <div key={docId} className="gf-row"
                        onClick={() => !uploaded && handleDocClick(docId)}
                        onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files, docId); }}
                        onDragOver={e => e.preventDefault()}>
                        <div className={`gf-row-icon ${uploaded ? 'done' : isReq ? 'req' : ''}`}>
                          {autoFinding === docId ? '🔍' : info.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{info.label}</span>
                            {isReq && !uploaded && (
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(232,194,104,0.1)', color: 'var(--champagne)', border: '1px solid rgba(232,194,104,0.25)', fontWeight: 800 }}>ज़रूरी</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, marginTop: 2, color: uploaded ? 'var(--emerald)' : autoFinding === docId ? 'var(--champagne)' : 'var(--text3)' }}>
                            {uploaded ? `✓ ${uploaded.file.name}` : autoFinding === docId ? 'Dhundh raha hoon...' : 'Click ya drag-drop karo'}
                          </div>
                        </div>
                        {uploaded
                          ? <button onClick={e => { e.stopPropagation(); setUploadedDocs(p => p.filter(u => u.type !== docId)); }}
                              style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', color: '#FF8B8B', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                          : autoFinding === docId
                            ? <div style={{ width: 18, height: 18, border: '2px solid var(--champagne)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text3)' }}>+</div>}
                      </div>
                    );
                  })}

                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept="image/*,.pdf"
                    onChange={e => { handleFileSelect(e.target.files, activeDocType); e.target.value = ''; }} />

                  <div style={{ padding: '18px 24px 22px' }}>
                    {/* HARD GATE — required docs ke bina aage nahi */}
                    {docError && missingReqDocs.length > 0 && (
                      <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,107,107,0.08)', border: '1.5px solid rgba(255,107,107,0.4)' }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#FF8B8B', marginBottom: 8 }}>⚠️ Ye documents zaroori hain — bina inke aage nahi badh sakte:</p>
                        {missingReqDocs.map(d => (
                          <p key={d} style={{ fontSize: 12, color: '#FCA5A5', padding: '3px 0' }}>
                            {(DOC_LABELS[d] || { icon: '📎', label: d }).icon} {(DOC_LABELS[d] || { label: d }).label} <span style={{ fontWeight: 800 }}>← upload karo</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (missingReqDocs.length > 0) { setDocError(true); return; }
                        setDocError(false);
                        setStep(4);
                      }}
                      className="gf-btn"
                      style={missingReqDocs.length > 0 ? { opacity: 0.55, filter: 'grayscale(0.4)' } : {}}>
                      {mounted && missingReqDocs.length === 0
                        ? `✓ Sab Required Docs Ready — Aage Badho`
                        : `🔒 ${missingReqDocs.length} Required Document baaki — Pehle Upload Karo`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUBMIT */}
          {step >= 4 && (
            <div className="gf-step-block">
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, letterSpacing: '-0.3px' }}>✅ Sab Ready Hai!</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { label: 'EXAM', value: detectedExam?.name || '' },
                    { label: 'POST', value: selectedPost?.name || 'General' },
                    { label: 'DOCS', value: mounted ? (uploadedDocs.length > 0 ? `${uploadedDocs.length} uploaded` : 'Demo data') : '...' },
                  ].map((s, i) => (
                    <div key={i} style={{ flex: 1, minWidth: 120, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--emerald)', fontWeight: 800, marginBottom: 5, letterSpacing: 1.5 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 700, wordBreak: 'break-word' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <button onClick={handleSubmit} className="gf-btn" style={{ fontSize: 16, padding: 19 }}>
                  🤖 AI Se Form Fill Karo — FREE
                </button>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>🔒 Data 24hr mein delete · No account needed</p>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <Wave />

      {/* ═══ HOW IT WORKS ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section" id="how">
        <div className="gf-section-head">
          <div>
            <h2 className="gf-section-title">Kaise <span className="accent">Kaam Karta Hai?</span></h2>
            <p className="gf-section-sub">4 steps — bas itna hi</p>
          </div>
        </div>
        <div className="gf-bento reveal-stagger in">
          {[
            { num: '01', icon: '🎯', title: 'Exam Chuno', desc: 'SSC, Railway, UPSC, Banking — koi bhi sarkari exam select karo.' },
            { num: '02', icon: '💼', title: 'Post Chuno', desc: 'Inspector, Clerk, Officer — apni manpasand post pick karo.' },
            { num: '03', icon: '📤', title: 'Docs Upload', desc: 'Aadhaar, marksheet, photo — AI khud data extract kar lega.' },
            { num: '04', icon: '⚡', title: 'AI Form Bharega', desc: 'Captcha, dropdowns, photo, signature — sab automatic. Tum bas dekho.' },
          ].map((item, i) => (
            <Tilt key={i} max={9} className="gf-bento-card">
              <div className="gf-bento-num">{item.num}</div>
              <span className="gf-bento-icon">{item.icon}</span>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.3px' }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{item.desc}</div>
            </Tilt>
          ))}
        </div>
      </Reveal>

      <Wave flip />

      {/* ═══ WHY FILLKARO ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section" id="why">
        <div className="gf-why-wrap">
          {/* Left — text */}
          <div className="gf-why-left">
            <div className="gf-why-left-logo">
              <FillKaroIcon size={36} />
            </div>
            <h2>Why <span className="accent">FillKaro?</span></h2>
            <p>
              1.8 lakh+ students ke sath aur India ke <strong style={{ color: 'var(--text1)' }}>sabse accurate form-filler</strong> hone ke saath, tum hum par bharosa kar sakte ho — har sarkari exam mein.
            </p>
            <a href="/ssc" className="gf-btn" style={{ display: 'inline-flex', maxWidth: 260 }}>
              Abhi Free Try Karo →
            </a>
          </div>

          {/* Right — 2×2 card grid */}
          <div className="gf-why-grid reveal-stagger in">
            {[
              { icon: '🤖', title: 'AI Auto-Fill', desc: 'Captcha, dropdowns, photo, signature — AI sab khud bharega. Tum bas dekho.', bg: 'rgba(0,212,255,0.08)', ic: 'linear-gradient(135deg,#00D4FF,#0891B2)' },
              { icon: '⚡', title: '5 Minute Mein', desc: 'Ghanton ka kaam minute me. Time bachao, tension bilkul chhodo.', bg: 'rgba(232,194,104,0.07)', ic: 'linear-gradient(135deg,#E8C268,#C9A14E)' },
              { icon: '🎯', title: '98% Accuracy', desc: 'Claude AI document se exact data nikaalta hai — galti ki gunjaish nahi.', bg: 'rgba(124,245,200,0.07)', ic: 'linear-gradient(135deg,#67E8F9,#00D4FF)' },
              { icon: '🔒', title: '100% Secure', desc: 'Data 24hr me delete. No account, no spam — sirf form, bas.', bg: 'rgba(100,120,255,0.07)', ic: 'linear-gradient(135deg,#818cf8,#6366f1)' },
            ].map((c, i) => (
              <Tilt key={i} max={6} className="gf-why-card" style={{ background: c.bg }}>
                <div className="gf-why-icon" style={{ background: c.ic }}>{c.icon}</div>
                <div className="gf-why-title">{c.title}</div>
                <div className="gf-why-desc">{c.desc}</div>
              </Tilt>
            ))}
          </div>
        </div>
      </Reveal>

      <Wave />

      {/* ═══ RESULTS ═══ */}
      <Reveal as="section" variant="reveal" className="gf-section" id="results">
        <div style={{ marginBottom: 28 }}>
          <h2 className="gf-section-title">Bas Hamari Baat Mat Maano — <span className="accent">Numbers Dekho</span></h2>
          <p className="gf-section-sub" style={{ marginTop: 8 }}>Lakhs students ne apna dream form bharne me bharosa kiya</p>
        </div>
        <div className="gf-results">
          <div className="gf-results-hero">
            <div style={{ fontSize: 'clamp(40px,6vw,60px)', fontWeight: 900, letterSpacing: '-2px' }} className="text-gradient-gold">
              <Counter to={53567} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', marginTop: 6, letterSpacing: 1 }}>Total Forms Filled 🏆</div>
          </div>
          <div className="gf-results-grid">
            {[
              { icon: '🎓', bg: 'rgba(124,245,200,0.1)', n: 19054, label: 'SSC Forms' },
              { icon: '🏦', bg: 'rgba(91,124,255,0.1)', n: 18921, label: 'Banking Forms' },
              { icon: '🚆', bg: 'rgba(232,194,104,0.1)', n: 7087, label: 'Railway Forms' },
              { icon: '🏛️', bg: 'rgba(0,212,255,0.1)', n: 8505, label: 'Other Govt Forms' },
            ].map((r, i) => (
              <div key={i} className="gf-result-cell">
                <div className="gf-result-icon" style={{ background: r.bg }}>{r.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }} className="text-gradient">
                  <Counter to={r.n} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 5, fontWeight: 600 }}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ═══ CTA BAND ═══ */}
      <Reveal variant="reveal-zoom" className="gf-section">
        <div style={{ textAlign: 'center', padding: 'clamp(36px,6vw,64px) 28px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(232,194,104,0.06))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 12 }}>
            Aaj hi <span className="text-gradient">apna form</span> bhardo
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 26, maxWidth: 480, margin: '0 auto 26px' }}>SSC CGL 2026 abhi LIVE hai — AI ke saath 5 minute me complete karo.</p>
          <a href="/ssc" className="gf-btn-hero" style={{ display: 'inline-flex' }}>⚡ Abhi Form Bharo — LIVE</a>
        </div>
      </Reveal>

      {/* ═══ BIG FOOTER ═══ */}
      <footer className="gf-bigfooter">
        <div className="gf-foot-grid">
          <div className="gf-foot-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FillKaroIcon size={38} />
              <FillKaroWordmark size={22} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 18, maxWidth: 280 }}>
              India ka pehla AI form-filler. Sarkari exam forms 5 minute me — captcha, photo, signature sab automatic.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <a className="gf-store-btn" href="/ssc">🍎 App Store</a>
              <a className="gf-store-btn" href="/ssc">▶ Google Play</a>
            </div>
          </div>

          <div className="gf-foot-col">
            <h4>Exams</h4>
            {['SSC CGL', 'Railway NTPC', 'IBPS PO', 'UPSC IAS', 'Army Agniveer', 'CTET'].map((x, i) => (
              <a key={i} className="gf-foot-link" onClick={() => detectExam(x)}>{x}</a>
            ))}
          </div>

          <div className="gf-foot-col">
            <h4>Product</h4>
            <a className="gf-foot-link" href="/ssc">SSC Form — LIVE</a>
            <a className="gf-foot-link" href="#find">Find My Exam</a>
            <a className="gf-foot-link" href="#how">Kaise Kaam Karta Hai</a>
            <a className="gf-foot-link" href="#alerts">Job Alerts</a>
            <a className="gf-foot-link" href="#results">Results</a>
            <a className="gf-foot-link" href="#why">Why FillKaro</a>
          </div>

          <div className="gf-foot-col">
            <h4>Company</h4>
            <a className="gf-foot-link" href="#why">About Us</a>
            <a className="gf-foot-link" href="#">Contact</a>
            <a className="gf-foot-link" href="#">Privacy Policy</a>
            <a className="gf-foot-link" href="#">Terms</a>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {['𝕏', 'f', 'in', '▶'].map((s, i) => <a key={i} className="gf-social" href="#">{s}</a>)}
            </div>
          </div>
        </div>

        <div className="gf-foot-bottom">
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>© 2025 FillKaro · Made in India 🇮🇳 · Powered by Claude</span>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['🔒 Secure', '⚡ Claude AI', '🎯 98% Accurate'].map((t, i) => (
              <span key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>{t}</span>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
