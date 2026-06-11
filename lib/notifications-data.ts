export interface JobNotification {
  id: string;
  organization: string;
  shortOrg: string;
  examName: string;
  posts: number;
  lastDate: string;
  salary: string;
  category: 'new' | 'closing' | 'result' | 'admit';
  examId?: string;
}

export const NOTIFICATIONS: JobNotification[] = [
  {
    id: 'n1',
    organization: 'Staff Selection Commission',
    shortOrg: 'SSC',
    examName: 'SSC CGL 2025',
    posts: 17727,
    lastDate: '2025-04-15',
    salary: '₹25,500 – ₹1,51,100',
    category: 'new',
    examId: 'ssc-cgl',
  },
  {
    id: 'n2',
    organization: 'Railway Recruitment Board',
    shortOrg: 'RRB',
    examName: 'RRB NTPC 2025',
    posts: 11558,
    lastDate: '2025-04-20',
    salary: '₹19,900 – ₹92,300',
    category: 'new',
    examId: 'rrb-ntpc',
  },
  {
    id: 'n3',
    organization: 'Institute of Banking Personnel Selection',
    shortOrg: 'IBPS',
    examName: 'IBPS PO 2025',
    posts: 4455,
    lastDate: '2025-04-10',
    salary: '₹41,960 – ₹51,490',
    category: 'closing',
    examId: 'ibps-po',
  },
  {
    id: 'n4',
    organization: 'Union Public Service Commission',
    shortOrg: 'UPSC',
    examName: 'UPSC CSE 2025',
    posts: 1056,
    lastDate: '2025-04-28',
    salary: '₹56,100 – ₹2,50,000',
    category: 'new',
    examId: 'upsc-cse',
  },
  {
    id: 'n5',
    organization: 'Staff Selection Commission',
    shortOrg: 'SSC',
    examName: 'SSC CHSL 2025',
    posts: 3712,
    lastDate: '2025-04-05',
    salary: '₹18,000 – ₹56,900',
    category: 'closing',
    examId: 'ssc-chsl',
  },
  {
    id: 'n6',
    organization: 'Railway Recruitment Board',
    shortOrg: 'RRB',
    examName: 'RRB ALP 2025',
    posts: 9144,
    lastDate: '2025-05-05',
    salary: '₹19,900 – ₹49,400',
    category: 'new',
    examId: 'rrb-alp',
  },
  {
    id: 'n7',
    organization: 'Institute of Banking Personnel Selection',
    shortOrg: 'IBPS',
    examName: 'IBPS Clerk 2025',
    posts: 6128,
    lastDate: '2025-04-18',
    salary: '₹11,765 – ₹31,540',
    category: 'new',
    examId: 'ibps-clerk',
  },
  {
    id: 'n8',
    organization: 'Staff Selection Commission',
    shortOrg: 'SSC',
    examName: 'SSC CGL 2024 — Result Out!',
    posts: 17727,
    lastDate: '—',
    salary: '₹25,500 – ₹1,51,100',
    category: 'result',
    examId: 'ssc-cgl',
  },
  {
    id: 'n9',
    organization: 'Railway Recruitment Board',
    shortOrg: 'RRB',
    examName: 'RRB NTPC Admit Card 2025',
    posts: 11558,
    lastDate: '—',
    salary: '₹19,900 – ₹92,300',
    category: 'admit',
    examId: 'rrb-ntpc',
  },
  {
    id: 'n10',
    organization: 'State Bank of India',
    shortOrg: 'SBI',
    examName: 'SBI PO 2025',
    posts: 600,
    lastDate: '2025-04-25',
    salary: '₹41,960 – ₹63,840',
    category: 'new',
  },
];

export const CATEGORY_META = {
  new:     { label: 'New',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)'   },
  closing: { label: 'Closing', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)'  },
  result:  { label: 'Result',  color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.3)'  },
  admit:   { label: 'Admit',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)' },
};
