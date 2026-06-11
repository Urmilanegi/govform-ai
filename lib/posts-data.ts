export interface Post {
  id: string;
  name: string;
  payScale: string;
  qualification: string;
  ageLimit: string;
  requiredDocs: string[];
  optionalDocs: string[];
}

export interface ExamWithPosts {
  id: string;
  name: string;
  shortName: string;
  organization: string;
  color: string;
  icon: string;
  posts: Post[];
}

export const EXAMS_WITH_POSTS: ExamWithPosts[] = [
  // ── SSC ──────────────────────────────────────────────────────────
  {
    id: 'ssc-cgl',
    name: 'SSC Combined Graduate Level',
    shortName: 'SSC CGL',
    organization: 'Staff Selection Commission',
    color: '#f59e0b',
    icon: '🏛️',
    posts: [
      { id: 'inspector-it', name: 'Inspector (Income Tax)', payScale: 'Pay Level 7 (₹44,900–₹1,42,400)', qualification: 'Graduation (Any Stream)', ageLimit: '18–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan', 'domicile'] },
      { id: 'inspector-cgst', name: 'Inspector (CGST & Central Excise)', payScale: 'Pay Level 7 (₹44,900–₹1,42,400)', qualification: 'Graduation (Any Stream)', ageLimit: '18–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan'] },
      { id: 'aso', name: 'Assistant Section Officer (ASO)', payScale: 'Pay Level 7 (₹44,900–₹1,42,400)', qualification: 'Graduation (Any Stream)', ageLimit: '20–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'tax-assistant', name: 'Tax Assistant', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: 'Graduation (Any Stream)', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan'] },
      { id: 'jso', name: 'Junior Statistical Officer (JSO)', payScale: 'Pay Level 6 (₹35,400–₹1,12,400)', qualification: 'Graduation with Statistics/Maths', ageLimit: '18–32 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'auditor', name: 'Auditor (CAG / Other Offices)', payScale: 'Pay Level 5 (₹29,200–₹92,300)', qualification: 'Graduation (Any Stream)', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'accountant', name: 'Accountant / Junior Accountant', payScale: 'Pay Level 5 (₹29,200–₹92,300)', qualification: 'Graduation with Commerce', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'ssc-chsl',
    name: 'SSC Combined Higher Secondary Level',
    shortName: 'SSC CHSL',
    organization: 'Staff Selection Commission',
    color: '#10b981',
    icon: '📝',
    posts: [
      { id: 'ldc', name: 'Lower Division Clerk (LDC)', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '12th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'jsa', name: 'Junior Secretariat Assistant (JSA)', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '12th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'postal-assistant', name: 'Postal Assistant / Sorting Assistant', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: '12th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'deo', name: 'Data Entry Operator (DEO)', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: '12th Pass (Science + Maths)', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'ssc-mts',
    name: 'SSC Multi Tasking Staff',
    shortName: 'SSC MTS',
    organization: 'Staff Selection Commission',
    color: '#f97316',
    icon: '🧹',
    posts: [
      { id: 'mts', name: 'Multi Tasking Staff (MTS)', payScale: 'Pay Level 1 (₹18,000–₹56,900)', qualification: '10th Pass (Matric)', ageLimit: '18–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'havaldar', name: 'Havaldar (CBIC & CBN)', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '10th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'ssc-gd',
    name: 'SSC General Duty Constable (CAPF)',
    shortName: 'SSC GD',
    organization: 'Staff Selection Commission',
    color: '#84cc16',
    icon: '👮',
    posts: [
      { id: 'constable-bsf', name: 'Constable — BSF (Border Security Force)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '10th Pass', ageLimit: '18–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'constable-crpf', name: 'Constable — CRPF', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '10th Pass', ageLimit: '18–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'constable-cisf', name: 'Constable — CISF (Industrial Security)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '10th Pass', ageLimit: '18–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'constable-ssb', name: 'Constable — SSB (Sashastra Seema Bal)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '10th Pass', ageLimit: '18–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'constable-itbp', name: 'Constable — ITBP (Indo-Tibet Border)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '10th Pass', ageLimit: '18–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── RAILWAY ──────────────────────────────────────────────────────
  {
    id: 'railway-ntpc',
    name: 'RRB Non-Technical Popular Categories',
    shortName: 'RRB NTPC',
    organization: 'Railway Recruitment Board',
    color: '#3b82f6',
    icon: '🚂',
    posts: [
      { id: 'station-master', name: 'Station Master', payScale: 'Pay Level 6 (₹35,400–₹1,12,400)', qualification: 'Graduation (Any Stream)', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'goods-guard', name: 'Goods Guard', payScale: 'Pay Level 5 (₹29,200–₹92,300)', qualification: 'Graduation (Any Stream)', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'junior-clerk', name: 'Junior Clerk cum Typist', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '12th Pass', ageLimit: '18–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'tc', name: 'Ticket Collector (TC)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '12th Pass', ageLimit: '18–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'commercial-clerk', name: 'Senior Commercial cum Ticket Clerk', payScale: 'Pay Level 5 (₹29,200–₹92,300)', qualification: 'Graduation (Any Stream)', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  {
    id: 'railway-alp',
    name: 'RRB Assistant Loco Pilot & Technician',
    shortName: 'RRB ALP',
    organization: 'Railway Recruitment Board',
    color: '#8b5cf6',
    icon: '🚆',
    posts: [
      { id: 'alp', name: 'Assistant Loco Pilot (ALP)', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '10th + ITI / Diploma', ageLimit: '18–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'technician', name: 'Technician (Various Trades)', payScale: 'Pay Level 2 (₹19,900–₹63,200)', qualification: '10th + ITI (Relevant Trade)', ageLimit: '18–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'railway-group-d',
    name: 'RRB Group D (Level 1 Posts)',
    shortName: 'RRB Group D',
    organization: 'Railway Recruitment Board',
    color: '#64748b',
    icon: '🔧',
    posts: [
      { id: 'track-maintainer', name: 'Track Maintainer Grade IV', payScale: 'Pay Level 1 (₹18,000–₹56,900)', qualification: '10th Pass + ITI', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'helper-electrical', name: 'Helper (Electrical / Signal / Engineering)', payScale: 'Pay Level 1 (₹18,000–₹56,900)', qualification: '10th Pass + ITI', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'porter', name: 'Porter / Pointsman', payScale: 'Pay Level 1 (₹18,000–₹56,900)', qualification: '10th Pass', ageLimit: '18–33 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  // ── UPSC ──────────────────────────────────────────────────────────
  {
    id: 'upsc-cse',
    name: 'UPSC Civil Services Examination',
    shortName: 'UPSC CSE',
    organization: 'Union Public Service Commission',
    color: '#ef4444',
    icon: '🏅',
    posts: [
      { id: 'ias', name: 'IAS (Indian Administrative Service)', payScale: 'Pay Level 10+ (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '21–32 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile', 'pan'] },
      { id: 'ips', name: 'IPS (Indian Police Service)', payScale: 'Pay Level 10+ (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '21–32 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'ifs', name: 'IFS (Indian Foreign Service)', payScale: 'Pay Level 10+ (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '21–32 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'irs', name: 'IRS (Indian Revenue Service)', payScale: 'Pay Level 10+ (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '21–32 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  {
    id: 'upsc-nda',
    name: 'UPSC NDA / NA Examination',
    shortName: 'NDA',
    organization: 'Union Public Service Commission',
    color: '#dc2626',
    icon: '🪖',
    posts: [
      { id: 'army-nda', name: 'Army (NDA)', payScale: 'Pay Level 10 (₹56,100+) after training', qualification: '12th Pass (PCM for Navy/Air Force)', ageLimit: '16.5–19.5 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'navy-nda', name: 'Navy (NDA)', payScale: 'Pay Level 10 (₹56,100+)', qualification: '12th Pass with PCM', ageLimit: '16.5–19.5 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'airforce-nda', name: 'Air Force (NDA)', payScale: 'Pay Level 10 (₹56,100+)', qualification: '12th Pass with PCM', ageLimit: '16.5–19.5 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'upsc-cds',
    name: 'UPSC Combined Defence Services',
    shortName: 'CDS',
    organization: 'Union Public Service Commission',
    color: '#b91c1c',
    icon: '⚔️',
    posts: [
      { id: 'ima', name: 'IMA — Indian Military Academy (Army)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '19–24 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'ina', name: 'INA — Indian Naval Academy', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (Engineering)', ageLimit: '19–22 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'afa', name: 'AFA — Air Force Academy', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (PCM) or BE/BTech', ageLimit: '19–23 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'ota', name: 'OTA — Officers Training Academy', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '19–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  // ── BANKING ──────────────────────────────────────────────────────
  {
    id: 'ibps-po',
    name: 'IBPS Probationary Officer',
    shortName: 'IBPS PO',
    organization: 'Institute of Banking Personnel Selection',
    color: '#06b6d4',
    icon: '🏦',
    posts: [
      { id: 'po-public-bank', name: 'Probationary Officer — Public Sector Banks', payScale: '₹36,000–₹63,840 (with DA)', qualification: 'Graduation (Any Stream) min 60%', ageLimit: '20–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan', 'domicile'] },
    ],
  },
  {
    id: 'ibps-clerk',
    name: 'IBPS Clerk',
    shortName: 'IBPS Clerk',
    organization: 'Institute of Banking Personnel Selection',
    color: '#14b8a6',
    icon: '🏧',
    posts: [
      { id: 'clerk-public-bank', name: 'Clerk — Public Sector Banks', payScale: '₹17,900–₹47,920 (with DA)', qualification: 'Graduation (Any Stream)', ageLimit: '20–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan', 'domicile'] },
    ],
  },
  {
    id: 'sbi-po',
    name: 'SBI Probationary Officer',
    shortName: 'SBI PO',
    organization: 'State Bank of India',
    color: '#1d4ed8',
    icon: '🏛️',
    posts: [
      { id: 'sbi-po-post', name: 'Probationary Officer — SBI', payScale: '₹41,960–₹63,840 (with DA)', qualification: 'Graduation (Any Stream)', ageLimit: '21–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan', 'domicile'] },
    ],
  },
  {
    id: 'sbi-clerk',
    name: 'SBI Junior Associates (Clerk)',
    shortName: 'SBI Clerk',
    organization: 'State Bank of India',
    color: '#2563eb',
    icon: '💰',
    posts: [
      { id: 'sbi-clerk-post', name: 'Junior Associate (Clerk) — SBI', payScale: '₹17,900–₹47,920 (with DA)', qualification: 'Graduation (Any Stream)', ageLimit: '20–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan', 'domicile'] },
    ],
  },
  {
    id: 'lic-aao',
    name: 'LIC Assistant Administrative Officer',
    shortName: 'LIC AAO',
    organization: 'Life Insurance Corporation of India',
    color: '#0891b2',
    icon: '🛡️',
    posts: [
      { id: 'aao-generalist', name: 'AAO — Generalist', payScale: '₹53,600–₹94,940', qualification: 'Graduation (Any Stream) min 60%', ageLimit: '21–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan'] },
      { id: 'aao-it', name: 'AAO — IT (Information Technology)', payScale: '₹53,600–₹94,940', qualification: 'BE/BTech Computer Science', ageLimit: '21–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan'] },
      { id: 'aao-ca', name: 'AAO — Chartered Accountant', payScale: '₹53,600–₹94,940', qualification: 'CA (Chartered Accountant)', ageLimit: '21–30 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'pan'] },
    ],
  },
  // ── ARMY / DEFENCE ───────────────────────────────────────────────
  {
    id: 'army-agniveer',
    name: 'Indian Army Agniveer',
    shortName: 'Army Agniveer',
    organization: 'Indian Army',
    color: '#16a34a',
    icon: '🪖',
    posts: [
      { id: 'agniveer-gd', name: 'Agniveer General Duty (GD)', payScale: '₹30,000/month + allowances', qualification: '10th Pass (45% marks)', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'agniveer-clerk', name: 'Agniveer Clerk / SKT', payScale: '₹30,000/month + allowances', qualification: '12th Pass (60% in each subject)', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'agniveer-tradesman', name: 'Agniveer Tradesman', payScale: '₹30,000/month + allowances', qualification: '10th Pass', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'agniveer-technical', name: 'Agniveer Technical', payScale: '₹30,000/month + allowances', qualification: '12th Pass (PCM 50%)', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'navy-agniveer',
    name: 'Indian Navy Agniveer',
    shortName: 'Navy Agniveer',
    organization: 'Indian Navy',
    color: '#0369a1',
    icon: '⚓',
    posts: [
      { id: 'agniveer-mr', name: 'Agniveer MR (Matric Recruit)', payScale: '₹30,000/month', qualification: '10th Pass', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'agniveer-ssr', name: 'Agniveer SSR (Senior Secondary Recruit)', payScale: '₹30,000/month', qualification: '12th Pass (PCM)', ageLimit: '17.5–21 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'afcat',
    name: 'Air Force Common Admission Test',
    shortName: 'AFCAT',
    organization: 'Indian Air Force',
    color: '#7c3aed',
    icon: '✈️',
    posts: [
      { id: 'flying-branch', name: 'Flying Branch (Pilot)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (PCM 60%)', ageLimit: '20–24 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'ground-duty-technical', name: 'Ground Duty (Technical)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'BE/BTech (Relevant Branch)', ageLimit: '20–26 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'ground-duty-non-technical', name: 'Ground Duty (Non-Technical)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'Graduation (Any Stream 60%)', ageLimit: '20–26 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── STATE PSC ────────────────────────────────────────────────────
  {
    id: 'bpsc',
    name: 'Bihar Public Service Commission',
    shortName: 'BPSC',
    organization: 'Bihar Public Service Commission',
    color: '#b45309',
    icon: '📜',
    posts: [
      { id: 'bpsc-sdo', name: 'SDO / BDO / DDSCO (Combined)', payScale: 'Pay Level 9 (₹53,100–₹1,67,800)', qualification: 'Graduation (Any Stream)', ageLimit: '20–37 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'bpsc-assistant', name: 'Assistant (State Secretariat)', payScale: 'Pay Level 6 (₹35,400–₹1,12,400)', qualification: 'Graduation (Any Stream)', ageLimit: '20–37 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'uppsc',
    name: 'UP Public Service Commission (PCS)',
    shortName: 'UPPSC',
    organization: 'Uttar Pradesh PSC',
    color: '#92400e',
    icon: '📜',
    posts: [
      { id: 'pcs-sdo', name: 'Deputy Collector / SDM / BDO', payScale: 'Pay Level 9 (₹53,100–₹1,67,800)', qualification: 'Graduation (Any Stream)', ageLimit: '21–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'pcs-naib-tehsildar', name: 'Naib Tehsildar', payScale: 'Pay Level 6 (₹35,400–₹1,12,400)', qualification: 'Graduation (Any Stream)', ageLimit: '21–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── RPSC (Rajasthan Public Service Commission) ───────────────────
  {
    id: 'rpsc',
    name: 'RPSC — RAS & State Services',
    shortName: 'RPSC RAS',
    organization: 'Rajasthan PSC',
    color: '#c2410c',
    icon: '📜',
    posts: [
      { id: 'ras', name: 'RAS / RTS Officer', payScale: 'Pay Level 9 (₹53,100–₹1,67,800)', qualification: 'Graduation (Any Stream)', ageLimit: '21–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rpsc-acf', name: 'ACF (Assistant Conservator of Forest)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'B.Sc (Botany/Zoology/Forestry/Agriculture)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rpsc-fro', name: 'FRO (Forest Range Officer)', payScale: 'Pay Level 10 (₹56,100+)', qualification: 'B.Sc (Science/Agriculture/Forestry)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rpsc-junior-accountant', name: 'Junior Accountant / TRA', payScale: 'Pay Level 5 (₹29,200+)', qualification: 'Graduation + Computer Certificate', ageLimit: '21–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile', 'computer_certificate'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── RPSC Teacher Exams ───────────────────────────────────────────
  {
    id: 'rpsc-teacher',
    name: 'RPSC Teacher Recruitment',
    shortName: 'RPSC Teacher',
    organization: 'Rajasthan PSC',
    color: '#b45309',
    icon: '🧑‍🏫',
    posts: [
      { id: 'rpsc-1st-grade', name: '1st Grade Teacher (School Lecturer)', payScale: 'Pay Level 11 (₹67,700+)', qualification: 'Post Graduation + B.Ed (Subject Specific)', ageLimit: '21–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'pg_certificate', 'bed_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rpsc-2nd-grade', name: '2nd Grade Teacher', payScale: 'Pay Level 7 (₹44,300+)', qualification: 'Graduation + B.Ed', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'bed_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── REET (Board of Secondary Education Rajasthan) ────────────────
  {
    id: 'reet',
    name: 'REET — Rajasthan Teacher Eligibility Test',
    shortName: 'REET',
    organization: 'BSER Rajasthan',
    color: '#15803d',
    icon: '📚',
    posts: [
      { id: 'reet-level1', name: 'REET Level 1 (Class 1–5)', payScale: 'Pay Level 6 (₹35,400+)', qualification: '12th Pass + 2yr D.El.Ed', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'deled_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'reet-level2', name: 'REET Level 2 (Class 6–8)', payScale: 'Pay Level 7 (₹44,300+)', qualification: 'Graduation + B.Ed', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'bed_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  // ── RSMSSB (Rajasthan Staff Selection Board) ─────────────────────
  {
    id: 'rsmssb',
    name: 'RSMSSB — Staff Selection',
    shortName: 'RSMSSB',
    organization: 'RSMSSB Rajasthan',
    color: '#1d4ed8',
    icon: '📋',
    posts: [
      { id: 'rsmssb-ldc', name: 'LDC / Junior Assistant (Clerk)', payScale: 'Pay Level 4 (₹25,500+)', qualification: '12th Pass + Computer Certificate (RS-CIT/O Level)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'computer_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rsmssb-patwari', name: 'Patwari (Revenue Inspector)', payScale: 'Pay Level 5 (₹29,200+)', qualification: 'Graduation + Computer Certificate', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'computer_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rsmssb-gram-sevak', name: 'Gram Sevak / VLW', payScale: 'Pay Level 4 (₹25,500+)', qualification: 'Graduation (Any Stream)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rsmssb-lab-assistant', name: 'Lab Assistant (Prayogshala Sahayak)', payScale: 'Pay Level 4 (₹25,500+)', qualification: '12th Pass with Science', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rsmssb-livestock', name: 'Livestock Assistant', payScale: 'Pay Level 4 (₹25,500+)', qualification: '12th (PCB/Agriculture) + Livestock Diploma', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'livestock_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'rsmssb-jen', name: 'Junior Engineer (JEN)', payScale: 'Pay Level 6 (₹35,400+)', qualification: 'B.E/B.Tech OR Diploma (Civil/Mech/Electrical/Agriculture)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── Rajasthan Police ─────────────────────────────────────────────
  {
    id: 'rajasthan-police',
    name: 'Rajasthan Police',
    shortName: 'Raj Police',
    organization: 'Rajasthan Police',
    color: '#1e3a8a',
    icon: '👮',
    posts: [
      { id: 'raj-constable', name: 'Constable (GD)', payScale: 'Pay Level 4 (₹25,500+)', qualification: '12th Pass + CET Score', ageLimit: '18–24 years (Gen)', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile', 'cet_scorecard'], optionalDocs: ['caste_certificate'] },
      { id: 'raj-si', name: 'Sub-Inspector (SI)', payScale: 'Pay Level 7 (₹44,300+)', qualification: 'Graduation (Any Stream)', ageLimit: '20–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── Rajasthan High Court ─────────────────────────────────────────
  {
    id: 'rajasthan-highcourt',
    name: 'Rajasthan High Court',
    shortName: 'HC Rajasthan',
    organization: 'Rajasthan High Court',
    color: '#7e22ce',
    icon: '⚖️',
    posts: [
      { id: 'hc-ldc', name: 'LDC (Lower Division Clerk)', payScale: 'Pay Level 4 (₹25,500+)', qualification: '12th + Computer Certificate (RS-CIT/O Level)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'computer_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'hc-steno', name: 'Stenographer', payScale: 'Pay Level 5 (₹29,200+)', qualification: '12th + Stenography + Computer', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'steno_certificate', 'computer_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'mpsc',
    name: 'Maharashtra Public Service Commission',
    shortName: 'MPSC',
    organization: 'Maharashtra PSC',
    color: '#ea580c',
    icon: '📜',
    posts: [
      { id: 'mpsc-rajyaseva', name: 'Rajyaseva (State Service)', payScale: 'Pay Level 9 (₹53,100+)', qualification: 'Graduation (Any Stream)', ageLimit: '19–38 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'mpsc-psi', name: 'PSI (Police Sub-Inspector)', payScale: 'Pay Level 6 (₹35,400+)', qualification: 'Graduation (Any Stream)', ageLimit: '19–31 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── POLICE ───────────────────────────────────────────────────────
  {
    id: 'up-police',
    name: 'UP Police Constable / SI',
    shortName: 'UP Police',
    organization: 'Uttar Pradesh Police Recruitment Board',
    color: '#1e40af',
    icon: '🚔',
    posts: [
      { id: 'up-constable', name: 'Constable (Sipahi)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '12th Pass', ageLimit: '18–22 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'up-si', name: 'Sub-Inspector (Daroga)', payScale: 'Pay Level 6 (₹35,400–₹1,12,400)', qualification: 'Graduation (Any Stream)', ageLimit: '21–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'bihar-police',
    name: 'Bihar Police Constable / SI',
    shortName: 'Bihar Police',
    organization: 'Bihar Police (CSBC / BPSSC)',
    color: '#1d4ed8',
    icon: '🚔',
    posts: [
      { id: 'bihar-constable', name: 'Constable (District Police)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '12th Pass', ageLimit: '18–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'bihar-si', name: 'Sub-Inspector (SI)', payScale: 'Pay Level 6 (₹35,400+)', qualification: 'Graduation (Any Stream)', ageLimit: '20–28 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'delhi-police',
    name: 'Delhi Police Constable / Head Constable',
    shortName: 'Delhi Police',
    organization: 'Delhi Police',
    color: '#1e3a8a',
    icon: '🚔',
    posts: [
      { id: 'dp-constable', name: 'Constable (Executive)', payScale: 'Pay Level 3 (₹21,700–₹69,100)', qualification: '12th Pass', ageLimit: '18–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'dp-head-constable', name: 'Head Constable (AWO/TPO)', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: '12th Pass', ageLimit: '18–25 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  // ── POST OFFICE & OTHERS ─────────────────────────────────────────
  {
    id: 'post-office-gds',
    name: 'India Post GDS (Gramin Dak Sevak)',
    shortName: 'Post Office GDS',
    organization: 'India Post',
    color: '#d97706',
    icon: '📮',
    posts: [
      { id: 'bpm', name: 'Branch Postmaster (BPM)', payScale: 'TRCA ₹12,000–₹29,380/month', qualification: '10th Pass (Local Language compulsory)', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'abpm', name: 'Assistant Branch Postmaster (ABPM)', payScale: 'TRCA ₹10,000–₹24,470/month', qualification: '10th Pass', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
      { id: 'dak-sevak', name: 'Dak Sevak (DS)', payScale: 'TRCA ₹10,000–₹24,470/month', qualification: '10th Pass', ageLimit: '18–40 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo', 'domicile'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'esic',
    name: 'ESIC — Employees State Insurance Corporation',
    shortName: 'ESIC',
    organization: 'ESIC',
    color: '#0f766e',
    icon: '🏥',
    posts: [
      { id: 'udc', name: 'Upper Division Clerk (UDC)', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: 'Graduation (Any Stream)', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'mts-esic', name: 'Multi Tasking Staff (MTS)', payScale: 'Pay Level 1 (₹18,000–₹56,900)', qualification: '10th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'photo'], optionalDocs: ['caste_certificate'] },
      { id: 'stenographer', name: 'Stenographer Grade-II', payScale: 'Pay Level 4 (₹25,500–₹81,100)', qualification: '12th Pass', ageLimit: '18–27 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate'] },
    ],
  },
  {
    id: 'teacher-ctet',
    name: 'CTET / TET — Teacher Eligibility',
    shortName: 'CTET / TET',
    organization: 'CBSE / State Education Boards',
    color: '#0d9488',
    icon: '📚',
    posts: [
      { id: 'primary-teacher', name: 'Primary Teacher (Class 1–5)', payScale: 'Pay Level 6 (₹35,400+) after selection', qualification: '12th + 2-yr D.El.Ed OR Graduation + B.Ed', ageLimit: '18–35 years (state wise)', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'upper-primary-teacher', name: 'Upper Primary Teacher (Class 6–8)', payScale: 'Pay Level 7 (₹44,900+)', qualification: 'Graduation + B.Ed', ageLimit: '18–35 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
  // ── UPTET / UPESSC ───────────────────────────────────────────────
  {
    id: 'uptet',
    name: 'UPTET — Uttar Pradesh Teacher Eligibility Test',
    shortName: 'UPTET',
    organization: 'UPESSC (Uttar Pradesh Education Service Selection Commission)',
    color: '#2563eb',
    icon: '🎓',
    posts: [
      { id: 'uptet-paper1', name: 'Paper 1 — Primary Level (Class 1–5)', payScale: 'Pay Level 6 (₹35,400+) after govt. appointment', qualification: '12th Pass + 2-yr D.El.Ed (or equivalent)', ageLimit: '18–35 years', requiredDocs: ['aadhaar', 'marksheet_10', 'marksheet_12', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
      { id: 'uptet-paper2', name: 'Paper 2 — Upper Primary Level (Class 6–8)', payScale: 'Pay Level 7 (₹44,900+) after govt. appointment', qualification: 'Graduation + B.Ed (or equivalent)', ageLimit: '18–35 years', requiredDocs: ['aadhaar', 'marksheet_10', 'graduation_certificate', 'photo'], optionalDocs: ['caste_certificate', 'domicile'] },
    ],
  },
];

export const DOC_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar Card',
  marksheet_10: '10th Marksheet',
  marksheet_12: '12th Marksheet',
  graduation_certificate: 'Graduation Certificate/Degree',
  caste_certificate: 'Caste Certificate',
  pan: 'PAN Card',
  domicile: 'Domicile Certificate',
  photo: 'Passport Size Photo',
  signature: 'Signature',
  other: 'Other Document',
};
