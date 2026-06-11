export interface ExamPortal {
  examId: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  applyUrl: string;
  loginUrl: string;
  registerUrl: string;
  loginHints: {
    username: string[];
    password: string[];
    submitBtn: string[];
  };
  dashboardHints?: string[];
  applyHints?: string[];
  nextBtnHints?: string[];
  autoAdvance?: boolean;
  steps: string[];
}

export const EXAM_PORTALS: ExamPortal[] = [
  {
    examId: 'ssc-cgl',
    name: 'SSC Combined Graduate Level',
    shortName: 'SSC',
    icon: '🏛️',
    color: '#f59e0b',
    applyUrl: 'https://ssc.gov.in/candidate-portal/dashboard',
    loginUrl: 'https://ssc.gov.in/login',
    registerUrl: 'https://ssc.gov.in/register',
    loginHints: {
      username: ['registration id', 'reg id', 'user id', 'userid', 'username', 'roll no'],
      password: ['password', 'passwd', 'pass'],
      submitBtn: ['login', 'sign in', 'submit'],
    },
    dashboardHints: ['candidate dashboard', 'live exam', 'latest notifications', 'apply'],
    applyHints: ['combined graduate level', 'ssc cgl', 'cgl'],
    nextBtnHints: ['save and next', 'next', 'continue', 'proceed'],
    autoAdvance: true,
    steps: ['Register', 'Basic Details', 'Address', 'Education', 'Photo/Sign', 'Preview', 'Pay'],
  },
  {
    examId: 'ssc-chsl',
    name: 'SSC Combined Higher Secondary Level',
    shortName: 'SSC',
    icon: '📝',
    color: '#10b981',
    applyUrl: 'https://ssc.gov.in/candidate-portal/dashboard',
    loginUrl: 'https://ssc.gov.in/login',
    registerUrl: 'https://ssc.gov.in/register',
    loginHints: {
      username: ['registration id', 'user id', 'userid'],
      password: ['password'],
      submitBtn: ['login', 'sign in'],
    },
    dashboardHints: ['candidate dashboard', 'live exam', 'latest notifications', 'apply'],
    applyHints: ['combined higher secondary level', 'ssc chsl', 'chsl'],
    nextBtnHints: ['save and next', 'next', 'continue', 'proceed'],
    autoAdvance: true,
    steps: ['Register', 'Basic Details', 'Address', 'Education', 'Photo/Sign', 'Preview', 'Pay'],
  },
  {
    examId: 'railway-ntpc',
    name: 'RRB NTPC',
    shortName: 'RRB',
    icon: '🚂',
    color: '#3b82f6',
    applyUrl: 'https://rrbapply.gov.in',
    loginUrl: 'https://rrbapply.gov.in/#/auth/candidate-login',
    registerUrl: 'https://rrbapply.gov.in/#/auth/candidate-registration',
    loginHints: {
      username: ['registration no', 'reg no', 'mobile', 'email'],
      password: ['password', 'dob'],
      submitBtn: ['login', 'sign in', 'proceed'],
    },
    steps: ['Register', 'Personal Details', 'Contact', 'Education', 'Community', 'Photo/Sign', 'Preview', 'Pay'],
  },
  {
    examId: 'railway-alp',
    name: 'RRB ALP',
    shortName: 'RRB',
    icon: '🚆',
    color: '#8b5cf6',
    applyUrl: 'https://rrbapply.gov.in',
    loginUrl: 'https://rrbapply.gov.in/#/auth/candidate-login',
    registerUrl: 'https://rrbapply.gov.in/#/auth/candidate-registration',
    loginHints: {
      username: ['registration no', 'mobile', 'email'],
      password: ['password'],
      submitBtn: ['login', 'proceed'],
    },
    steps: ['Register', 'Personal Details', 'Education/ITI', 'Address', 'Photo/Sign', 'Preview', 'Pay'],
  },
  {
    examId: 'upsc-cse',
    name: 'UPSC Civil Services',
    shortName: 'UPSC',
    icon: '🏅',
    color: '#ef4444',
    applyUrl: 'https://upsconline.nic.in',
    loginUrl: 'https://upsconline.nic.in/login',
    registerUrl: 'https://upsconline.nic.in/instruction',
    loginHints: {
      username: ['otr no', 'registration', 'user id', 'userid'],
      password: ['password'],
      submitBtn: ['login', 'submit', 'proceed'],
    },
    steps: ['OTR Register', 'Personal Info', 'Address', 'Education', 'Work Exp', 'Exam Details', 'Photo/Sign', 'Pay'],
  },
  {
    examId: 'ibps-po',
    name: 'IBPS PO',
    shortName: 'IBPS',
    icon: '🏦',
    color: '#0ea5e9',
    applyUrl: 'https://ibpsonline.ibps.in',
    loginUrl: 'https://ibpsonline.ibps.in',
    registerUrl: 'https://ibpsonline.ibps.in',
    loginHints: {
      username: ['registration no', 'reg no', 'roll no'],
      password: ['password', 'dob'],
      submitBtn: ['login', 'sign in'],
    },
    steps: ['Register', 'Basic Details', 'Address', 'Education', 'Photo/Sign', 'Preview', 'Pay'],
  },
  {
    examId: 'ibps-clerk',
    name: 'IBPS Clerk',
    shortName: 'IBPS',
    icon: '🏦',
    color: '#06b6d4',
    applyUrl: 'https://ibpsonline.ibps.in',
    loginUrl: 'https://ibpsonline.ibps.in',
    registerUrl: 'https://ibpsonline.ibps.in',
    loginHints: {
      username: ['registration no', 'roll no'],
      password: ['password', 'dob'],
      submitBtn: ['login', 'sign in'],
    },
    steps: ['Register', 'Basic Details', 'Address', 'Education', 'Photo/Sign', 'Preview', 'Pay'],
  },
];

export function getPortal(examId: string): ExamPortal | undefined {
  return EXAM_PORTALS.find(p => p.examId === examId);
}
