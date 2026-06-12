'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilledForm, FilledField } from '@/types';
import { Post } from '@/lib/posts-data';
import { ExamPortal, getPortal } from '@/lib/exam-portals';

export default function ReviewPage() {
  const router = useRouter();
  const [form, setForm]               = useState<FilledForm | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue]     = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [showPrintForm, setShowPrintForm] = useState(false);
  const [portal, setPortal] = useState<ExamPortal | null>(null);
  const [launchingPortal, setLaunchingPortal] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('');
  const [launchStatusTone, setLaunchStatusTone] = useState<'success' | 'warning'>('success');

  useEffect(() => {
    const data = sessionStorage.getItem('filledForm') || localStorage.getItem('filledForm');
    if (!data) { router.push('/'); return; }
    const parsedForm = JSON.parse(data) as FilledForm;
    setForm(parsedForm);
    setPortal(getPortal(parsedForm.examId) || null);
    sessionStorage.setItem('filledForm', data);
    const postData = sessionStorage.getItem('selectedPost') || localStorage.getItem('selectedPost');
    if (postData) setSelectedPost(JSON.parse(postData));
    if (postData) sessionStorage.setItem('selectedPost', postData);
  }, [router]);

  useEffect(() => {
    if (!form) return;

    const profile = sessionStorage.getItem('extractedProfile') || localStorage.getItem('extractedProfile');
    if (!profile) return;

    fetch('/api/browser-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: JSON.parse(profile),
        portal,
        filledForm: { examId: form.examId, examName: form.examName }
      })
    }).catch(() => {});
  }, [form, portal]);

  const handleEdit = (fieldId: string, current: string) => {
    setEditingField(fieldId);
    setEditValue(current);
  };

  const handleSave = (sectionId: string, fieldId: string) => {
    if (!form) return;
    setForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(s =>
          s.id === sectionId
            ? { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, value: editValue, source: 'manual' as const } : f) }
            : s
        )
      };
    });
    setEditingField(null);
  };

  const getFieldKey = (sectionId: string, fieldId: string) => `${sectionId}__${fieldId}`;

  const confidenceBadge = (field: FilledField) => {
    if (!field.value)                   return { color: 'bg-red-900/50 border-red-700 text-red-300',       label: '⚠ Empty'  };
    if (field.source === 'manual')      return { color: 'bg-blue-900/50 border-blue-700 text-blue-300',    label: '✏ Manual' };
    if (field.confidence === 'high')    return { color: 'bg-green-900/50 border-green-700 text-green-300', label: '✓ AI'     };
    if (field.confidence === 'medium')  return { color: 'bg-yellow-900/50 border-yellow-700 text-yellow-300', label: '~ Verify' };
    return { color: 'bg-orange-900/50 border-orange-700 text-orange-300', label: '! Check' };
  };

  const getFieldValue = (fieldId: string) => {
    if (!form) return '';
    for (const section of form.sections) {
      const f = section.fields.find(f => f.id === fieldId);
      if (f) return f.value || '';
    }
    return '';
  };

  const handlePrint = () => {
    setShowPrintForm(true);
    setTimeout(() => window.print(), 300);
  };

  const openPortalFlow = async () => {
    if (!form || !portal) return;

    const profileJson = sessionStorage.getItem('extractedProfile') || localStorage.getItem('extractedProfile');
    if (!profileJson) {
      alert('Profile data nahi mili. Back jaake dobara documents process karo.');
      return;
    }

    const parsedProfile = JSON.parse(profileJson);

    const targetUrl = portal.loginUrl || portal.registerUrl || portal.applyUrl;
    if (!targetUrl) {
      setLaunchStatusTone('warning');
      setLaunchStatus('Official site link nahi mili.');
      return;
    }

    const payload = {
      type: 'GOVFORM_OPEN_PORTAL_FLOW',
      profile: parsedProfile,
      filledForm: { examName: form.examName },
      portal,
      credentials: null,
      autoActive: true,
    };

    setLaunchingPortal(true);
    setLaunchStatus('');

    try {
      const response = await fetch('/api/launch-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          ...payload,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Launch failed');
      }

      if (data.hydrated === false) {
        setLaunchStatusTone('warning');
        setLaunchStatus('Official site khul gayi, lekin helper abhi ready nahi hui. Ek baar dubara button dabao, main isse stable kar raha hoon.');
      } else {
        setLaunchStatusTone('success');
        setLaunchStatus('Official site helper window khul gayi. Register ya Login par jao, Aadhaar aur baaki details apne aap aayengi. OTP, captcha aur final submit aap kar dena.');
      }
    } catch {
      setLaunchStatusTone('warning');
      setLaunchStatus('Helper browser launch nahi hua. Ek baar dubara click karo. Agar phir bhi issue aaye to Chrome band karke dobara try karenge.');
    } finally {
      setLaunchingPortal(false);
    }
  };

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin">⚙️</div>
          <p className="text-gray-400">Form load ho raha hai...</p>
        </div>
      </div>
    );
  }

  const currentSection = form.sections[activeSection];
  const totalFields    = form.sections.flatMap(s => s.fields).length;
  const filledCount    = form.sections.flatMap(s => s.fields).filter(f => f.value).length;

  // Flatten all fields for the government form view
  const allFields      = form.sections.flatMap(s => s.fields.map(f => ({ ...f, sectionTitle: s.title })));

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0015 0%, #0d0d2b 40%, #0a001a 100%)' }}>

      {/* ─── SCREEN UI ─── */}
      <div className="no-print">
        {/* Header */}
        <header className="border-b border-white/8 px-4 sm:px-6 py-4 sticky top-0 z-10" style={{ backdropFilter: 'blur(20px)', background: 'rgba(10,0,21,0.85)' }}>
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1">
              ← Back
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-white truncate">{form.examName}</h1>
              {selectedPost && <p className="text-xs text-violet-400">{selectedPost.name}</p>}
              <p className="text-xs text-gray-400">{filledCount}/{totalFields} fields filled · Review karo</p>
            </div>
            <button onClick={() => setShowPrintForm(p => !p)}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-300 border border-white/10 hover:border-white/30 transition-colors mr-2">
              {showPrintForm ? 'Hide Form' : '📄 Preview Form'}
            </button>
            <button onClick={handlePrint}
              className="text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
              🖨 Print PDF
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { val: `${form.completionPercentage}%`, label: 'Complete',        color: 'text-white' },
              { val: filledCount,                     label: 'Fields Filled',   color: 'text-green-400' },
              { val: totalFields - filledCount,        label: 'Fields Empty',    color: 'text-red-400' },
              { val: form.missingFields.length,        label: 'Required Missing', color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Missing fields alert */}
          {form.missingFields.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-red-400 font-medium text-sm mb-2">⚠️ Yeh required fields missing hain — neeche edit karo:</p>
              <div className="flex flex-wrap gap-2">
                {form.missingFields.map(f => (
                  <span key={f} className="text-xs px-2 py-1 rounded-full bg-red-900/50 border border-red-700 text-red-300">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            {[
              { dot: 'bg-green-500',  label: 'AI filled (confident)' },
              { dot: 'bg-yellow-500', label: 'Verify karo' },
              { dot: 'bg-red-500',    label: 'Empty / Missing' },
              { dot: 'bg-blue-500',   label: 'Manually edited' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${l.dot} inline-block`} />
                <span className="text-gray-400">{l.label}</span>
              </span>
            ))}
          </div>

          {/* Section tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {form.sections.map((section, i) => {
              const empty = section.fields.filter(f => !f.value).length;
              return (
                <button key={section.id} onClick={() => setActiveSection(i)}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeSection === i ? 'linear-gradient(135deg, #7c3aed, #2563eb)' : 'rgba(255,255,255,0.05)',
                    border: activeSection === i ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: activeSection === i ? 'white' : '#9ca3af',
                  }}>
                  {section.title}
                  {empty > 0 && (
                    <span className="ml-1.5 text-xs bg-red-600 text-white rounded-full w-4 h-4 inline-flex items-center justify-center">{empty}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Fields */}
          {currentSection && (
            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="px-5 py-4 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h2 className="font-semibold text-white">{currentSection.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{currentSection.fields.filter(f => f.value).length}/{currentSection.fields.length} fields filled</p>
              </div>
              <div className="divide-y divide-white/5">
                {currentSection.fields.map(field => {
                  const key = getFieldKey(currentSection.id, field.id);
                  const badge = confidenceBadge(field);
                  const isEditing = editingField === key;
                  return (
                    <div key={field.id} className={`px-5 py-4 transition-colors ${!field.value ? 'bg-red-950/10' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium text-gray-400">{field.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
                            {field.note && (
                              <span className="text-xs text-yellow-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>💡 {field.note}</span>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="flex gap-2 mt-2">
                              <input
                                type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSave(currentSection.id, field.id)}
                                autoFocus
                                className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(124,58,237,0.5)' }}
                              />
                              <button onClick={() => handleSave(currentSection.id, field.id)} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>Save</button>
                              <button onClick={() => setEditingField(null)} className="px-3 py-1.5 rounded-lg text-sm text-gray-300" style={{ background: 'rgba(255,255,255,0.08)' }}>Cancel</button>
                            </div>
                          ) : (
                            <p className={`text-sm font-medium mt-0.5 ${field.value ? 'text-white' : 'text-gray-600 italic'}`}>
                              {field.value || '— khali hai, click karke bharo —'}
                            </p>
                          )}
                        </div>
                        {!isEditing && (
                          <button onClick={() => handleEdit(key, field.value)} className="text-gray-500 hover:text-violet-400 transition-colors text-sm flex-shrink-0 p-1">✏️</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between gap-3">
            <button onClick={() => setActiveSection(p => Math.max(0, p - 1))} disabled={activeSection === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>← Previous</button>
            <button onClick={() => setActiveSection(p => Math.min(form.sections.length - 1, p + 1))} disabled={activeSection === form.sections.length - 1}
              className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>Next →</button>
          </div>

          {/* Final CTA */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.1))', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">Form ready hai! 🎉</p>
                <p className="text-sm text-gray-400 mt-0.5">{form.completionPercentage}% complete · Ab button dabao, official site khul jayegi aur details auto-fill hongi</p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <button onClick={() => router.push('/')} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>New Form</button>
                <button onClick={handlePrint} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>🖨 Print</button>
              </div>
            </div>

            {portal ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold flex items-center gap-2">
                        <span style={{ fontSize: '20px' }}>{portal.icon}</span>
                        <span>{portal.name}</span>
                      </p>
                      <p className="text-sm text-gray-400 mt-1">Button dabate hi official site ki helper window khulegi. Register ya Login ke baad details apne aap bharengi.</p>
                    </div>
                  </div>

                  <button
                    onClick={openPortalFlow}
                    disabled={launchingPortal}
                    className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 30px rgba(22,163,74,0.4)', border: '1px solid rgba(34,197,94,0.3)' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                  >
                    <span style={{ fontSize: '22px' }}>🚀</span>
                    <div className="text-left">
                      <div>{launchingPortal ? 'Site khol raha hoon...' : 'Official Site Open Karo'}</div>
                      <div className="text-xs font-normal opacity-80">Click karte hi new helper window khulegi</div>
                    </div>
                    <span className="ml-auto text-xl">→</span>
                  </button>
                </div>

                {launchStatus && (
                  <div
                    className="rounded-xl px-4 py-3 text-sm text-white/90"
                    style={launchStatusTone === 'success'
                      ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.24)' }
                      : { background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.28)' }}
                  >
                    {launchStatus}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3 text-sm text-yellow-200" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.24)' }}>
                Is exam ke liye portal map abhi add nahi hai. Direct site open karke extension se fill karna padega.
              </div>
            )}
          </div>

          {/* ─── PRINT FORM PREVIEW ─── */}
          {showPrintForm && (
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-sm font-bold text-white">📄 Government Form Preview</span>
                <span className="text-xs text-gray-500">Iska print hoga</span>
              </div>
              <div className="p-4">
                <GovtFormPreview form={form} selectedPost={selectedPost} getFieldValue={getFieldValue} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── PRINT-ONLY FORM ─── */}
      <div className="print-only">
        <GovtFormPreview form={form} selectedPost={selectedPost} getFieldValue={getFieldValue} />
      </div>

      <style>{`
        @media screen { .print-only { display: none; } }
        @media print  {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </div>
  );
}

/* ─── Government Form Component ─── */
function GovtFormPreview({ form, selectedPost, getFieldValue }: {
  form: FilledForm;
  selectedPost: Post | null;
  getFieldValue: (id: string) => string;
}) {
  const f = (id: string) => getFieldValue(id) || '_______________';

  return (
    <div style={{
      fontFamily: 'Times New Roman, serif',
      background: 'white',
      color: '#000',
      padding: '20px',
      maxWidth: '210mm',
      margin: '0 auto',
      fontSize: '12px',
      lineHeight: '1.4',
    }}>
      {/* ─── FORM HEADER ─── */}
      <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div style={{ fontSize: '40px', lineHeight: 1 }}>🇮🇳</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Government of India
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px', color: '#444' }}>
              {form.examName}
            </div>
            {selectedPost && (
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>
                Post Applied For: {selectedPost.name}
              </div>
            )}
          </div>
          <div style={{ fontSize: '40px', lineHeight: 1 }}>⚖️</div>
        </div>
        <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', borderTop: '1px solid #000', paddingTop: '6px' }}>
          Application Form
        </div>
      </div>

      {/* Photo + Instructions row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
        <div style={{ flex: 1, fontSize: '10px', color: '#333' }}>
          <strong>INSTRUCTIONS / निर्देश:</strong>
          <ol style={{ margin: '4px 0 0 14px', padding: 0 }}>
            <li>Fill in CAPITAL LETTERS only.</li>
            <li>Do not overwrite or use correction fluid.</li>
            <li>Attach self-attested copies of all documents.</li>
            <li>Affix recent passport-size photograph.</li>
          </ol>
        </div>
        {/* Photo Box */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: '90px', height: '110px', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#555', flexDirection: 'column', gap: '4px', background: '#fafafa' }}>
            <span style={{ fontSize: '22px' }}>📸</span>
            <span>Passport</span>
            <span>Size Photo</span>
            <span>(3.5×4.5 cm)</span>
          </div>
          <div style={{ fontSize: '9px', marginTop: '3px', color: '#333', fontStyle: 'italic' }}>Affix here</div>
        </div>
      </div>

      {/* ─── SECTION 1: PERSONAL DETAILS ─── */}
      <FormSectionHeader title="SECTION 1: PERSONAL DETAILS / व्यक्तिगत विवरण" />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <FormRow label="Full Name (as in Aadhaar)" value={f('full_name').toUpperCase()} cols={3} />
          <FormRow label="Father's Name" value={f('father_name').toUpperCase()} label2="Mother's Name" value2={f('mother_name').toUpperCase()} />
          <FormRow label="Date of Birth" value={f('dob')} label2="Gender" value2={f('gender')} label3="Category" value3={f('category')} cols3 />
          <FormRow label="Nationality" value={f('nationality') || 'INDIAN'} label2="Religion" value2={f('religion')} />
          <FormRow label="Marital Status" value={f('marital_status')} label2="PwD Status" value2="No" />
        </tbody>
      </table>

      {/* ─── SECTION 2: CONTACT DETAILS ─── */}
      <FormSectionHeader title="SECTION 2: CONTACT DETAILS / संपर्क विवरण" />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <FormRow label="Mobile Number" value={f('mobile')} label2="Email Address" value2={f('email')} />
          <FormRow label="Address (Permanent)" value={f('address')} cols={3} />
          <FormRow label="City / Town" value={f('city')} label2="District" value2={f('district')} label3="State" value3={f('state')} cols3 />
          <FormRow label="Pin Code" value={f('pincode')} label2="Country" value2="INDIA" />
        </tbody>
      </table>

      {/* ─── SECTION 3: EDUCATIONAL QUALIFICATIONS ─── */}
      <FormSectionHeader title="SECTION 3: EDUCATIONAL QUALIFICATIONS / शैक्षणिक योग्यता" />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            {['Exam', 'Board / University', 'Year of Passing', 'Max Marks', 'Marks Obtained', '% / CGPA'].map(h => (
              <th key={h} style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold', textAlign: 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { exam: '10th / Matriculation', board: f('board_10'), year: f('passing_year_10'), max: '500', obtained: f('marks_10'), pct: f('percentage_10') },
            { exam: '12th / Intermediate',  board: f('board_12'), year: f('passing_year_12'), max: '500', obtained: f('marks_12'), pct: f('percentage_12') },
            { exam: 'Graduation',           board: f('university'), year: f('passing_year'), max: '—', obtained: '—', pct: f('graduation_percentage') },
            { exam: 'Post-Graduation',      board: '—', year: '—', max: '—', obtained: '—', pct: '—' },
          ].map((row, i) => (
            <tr key={i}>
              {[row.exam, row.board, row.year, row.max, row.obtained, row.pct].map((v, j) => (
                <td key={j} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── SECTION 4: IDENTITY DOCUMENTS ─── */}
      <FormSectionHeader title="SECTION 4: IDENTITY DOCUMENTS / पहचान दस्तावेज" />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <FormRow label="Aadhaar Number" value={f('aadhaar_number')} label2="PAN Number" value2={f('pan_number')} />
          <FormRow label="Caste Certificate No." value={f('caste_certificate_number')} label2="Domicile State" value2={f('domicile_state')} />
        </tbody>
      </table>

      {/* ─── SECTION 5: BANK DETAILS ─── */}
      <FormSectionHeader title="SECTION 5: BANK DETAILS / बैंक विवरण (For Fee Refund)" />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <FormRow label="Bank Name" value={f('bank_name')} label2="Branch Name" value2={f('bank_branch')} />
          <FormRow label="Account Number" value={f('account_number')} label2="IFSC Code" value2={f('ifsc_code')} />
        </tbody>
      </table>

      {/* ─── DECLARATION ─── */}
      <div style={{ border: '1px solid #000', padding: '10px', marginBottom: '16px', fontSize: '10px' }}>
        <strong>DECLARATION / घोषणा:</strong>
        <p style={{ margin: '4px 0 0 0', lineHeight: '1.5' }}>
          I hereby declare that all the information given above is true, correct and complete to the best of my knowledge and belief. I understand that in the event of any information being found false or incorrect, my candidature is liable to be cancelled/rejected.
        </p>
        <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#444' }}>
          मैं एतद्द्वारा घोषणा करता/करती हूँ कि उपर्युक्त सभी जानकारी मेरी सर्वोत्तम जानकारी और विश्वास के अनुसार सत्य, सही और पूर्ण है।
        </p>
      </div>

      {/* ─── SIGNATURE ROW ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px' }}>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', width: '180px', textAlign: 'center', fontSize: '10px' }}>
            Date: {new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '120px', height: '60px', border: '1px solid #000', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#888', background: '#fafafa' }}>
            Signature Here
          </div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '2px', fontSize: '10px', textAlign: 'center', width: '160px' }}>
            Signature of Applicant
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '2px solid #000', marginTop: '16px', paddingTop: '6px', textAlign: 'center', fontSize: '9px', color: '#555' }}>
        Generated by FillKaro — {form.examName} — {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
}

/* ─── Helper components for the form table ─── */
function FormSectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: '#1a1a6e', color: 'white', padding: '5px 10px', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '0', textTransform: 'uppercase' }}>
      {title}
    </div>
  );
}

function FormRow({ label, value, label2, value2, label3, value3, cols, cols3 }: {
  label: string; value: string;
  label2?: string; value2?: string;
  label3?: string; value3?: string;
  cols?: number; cols3?: boolean;
}) {
  const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' };
  const labelStyle: React.CSSProperties = { ...cellStyle, background: '#f5f5f5', fontWeight: 'bold', width: '22%', fontSize: '10px', color: '#222' };
  const valStyle: React.CSSProperties = { ...cellStyle, fontSize: '11px', minHeight: '22px' };

  if (cols === 3) {
    return (
      <tr>
        <td style={labelStyle}>{label}</td>
        <td colSpan={3} style={valStyle}>{value}</td>
      </tr>
    );
  }
  if (cols3 && label3) {
    return (
      <tr>
        <td style={labelStyle}>{label}</td>
        <td style={{ ...valStyle, width: '12%' }}>{value}</td>
        <td style={{ ...labelStyle, width: '20%' }}>{label2}</td>
        <td style={{ ...valStyle, width: '12%' }}>{value2}</td>
        <td style={{ ...labelStyle, width: '18%' }}>{label3}</td>
        <td style={valStyle}>{value3}</td>
      </tr>
    );
  }
  return (
    <tr>
      <td style={labelStyle}>{label}</td>
      <td style={valStyle}>{value}</td>
      {label2 && <td style={{ ...labelStyle, width: '22%' }}>{label2}</td>}
      {value2 !== undefined && <td style={valStyle}>{value2}</td>}
    </tr>
  );
}
