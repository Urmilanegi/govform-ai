import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXAM_MAP = [
  // SSC
  { id: 'ssc-cgl',        name: 'SSC CGL',        keywords: ['ssc cgl', 'combined graduate', 'inspector income', 'tax assistant', 'auditor ssc', 'ssc graduate', 'aso ssc'] },
  { id: 'ssc-chsl',       name: 'SSC CHSL',        keywords: ['chsl', '10+2', 'ldc', 'lower division', 'postal assistant', 'data entry', 'deo ssc', 'ssc 12th'] },
  { id: 'ssc-mts',        name: 'SSC MTS',         keywords: ['mts', 'multi tasking', 'havaldar', 'ssc 10th', 'ssc matric'] },
  { id: 'ssc-gd',         name: 'SSC GD',          keywords: ['ssc gd', 'general duty', 'constable capf', 'bsf constable', 'crpf constable', 'cisf constable', 'ssb constable', 'itbp constable', 'paramilitary'] },
  // Railway
  { id: 'railway-ntpc',   name: 'RRB NTPC',        keywords: ['railway ntpc', 'rrb ntpc', 'ntpc', 'station master', 'goods guard', 'junior clerk railway', 'ticket collector', 'tc railway'] },
  { id: 'railway-alp',    name: 'RRB ALP',         keywords: ['loco pilot', 'alp', 'assistant loco', 'technician railway', 'rrb alp'] },
  { id: 'railway-group-d',name: 'RRB Group D',     keywords: ['group d', 'rrb d', 'track maintainer', 'railway helper', 'porter railway', 'pointsman', 'railway 10th'] },
  // UPSC
  { id: 'upsc-cse',       name: 'UPSC CSE',        keywords: ['ias', 'ips', 'upsc', 'civil services', 'ifs upsc', 'irs upsc', 'collector', 'dm', 'sdo upsc', 'upsc cse'] },
  { id: 'upsc-nda',       name: 'NDA',             keywords: ['nda', 'national defence academy', 'army 12th', 'navy 12th', 'airforce 12th', 'sainik school'] },
  { id: 'upsc-cds',       name: 'CDS',             keywords: ['cds', 'combined defence', 'ima', 'ina', 'afa', 'ota', 'army officer', 'navy officer'] },
  // Banking
  { id: 'ibps-po',        name: 'IBPS PO',         keywords: ['ibps po', 'bank po', 'probationary officer', 'bank officer ibps'] },
  { id: 'ibps-clerk',     name: 'IBPS Clerk',      keywords: ['ibps clerk', 'bank clerk ibps', 'clerical ibps'] },
  { id: 'sbi-po',         name: 'SBI PO',          keywords: ['sbi po', 'state bank po', 'sbi probationary', 'sbi officer'] },
  { id: 'sbi-clerk',      name: 'SBI Clerk',       keywords: ['sbi clerk', 'state bank clerk', 'sbi junior associate', 'sbi clerical'] },
  { id: 'lic-aao',        name: 'LIC AAO',         keywords: ['lic aao', 'lic officer', 'insurance officer', 'lic assistant administrative'] },
  // Defence
  { id: 'army-agniveer',  name: 'Army Agniveer',   keywords: ['agniveer army', 'army agniveer', 'agniveer gd', 'agniveer clerk', 'agniveer technical', 'agniveer tradesman', 'army bharti'] },
  { id: 'navy-agniveer',  name: 'Navy Agniveer',   keywords: ['agniveer navy', 'navy agniveer', 'ssr navy', 'mr navy', 'navy bharti'] },
  { id: 'afcat',          name: 'AFCAT',           keywords: ['afcat', 'air force', 'flying branch', 'iaf', 'airforce officer', 'afcat pilot'] },
  // State PSC
  { id: 'bpsc',           name: 'BPSC',            keywords: ['bpsc', 'bihar psc', 'bihar sdo', 'bihar bdo', 'bihar public service'] },
  { id: 'uppsc',          name: 'UPPSC',           keywords: ['uppsc', 'up pcs', 'up public service', 'up sdo', 'up deputy collector', 'naib tehsildar'] },
  { id: 'rpsc',           name: 'RPSC RAS',        keywords: ['rpsc', 'ras', 'rajasthan psc', 'rajasthan public service', 'ras rts'] },
  { id: 'mpsc',           name: 'MPSC',            keywords: ['mpsc', 'maharashtra psc', 'rajyaseva', 'psi maharashtra'] },
  // Police
  { id: 'up-police',      name: 'UP Police',       keywords: ['up police', 'up constable', 'up sipahi', 'up daroga', 'up si police'] },
  { id: 'bihar-police',   name: 'Bihar Police',    keywords: ['bihar police', 'bihar constable', 'csbc', 'bpssc', 'bihar sipahi'] },
  { id: 'delhi-police',   name: 'Delhi Police',    keywords: ['delhi police', 'dp constable', 'delhi constable', 'head constable delhi'] },
  // Others
  { id: 'post-office-gds',name: 'Post Office GDS', keywords: ['gds', 'gramin dak sevak', 'post office', 'bpm post', 'dak sevak', 'india post'] },
  { id: 'esic',           name: 'ESIC',            keywords: ['esic', 'esi', 'employee state insurance', 'esic udc', 'esic mts'] },
  { id: 'teacher-ctet',   name: 'CTET / TET',      keywords: ['ctet', 'tet', 'teacher eligibility', 'primary teacher', 'upper primary teacher', 'bed teacher', 'shikshak'] },
];

function keywordDetect(message: string) {
  const lower = message.toLowerCase();
  for (const exam of EXAM_MAP) {
    if (exam.keywords.some(k => lower.includes(k))) return exam;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Always try keyword matching first (fast + no API key needed)
    const match = keywordDetect(message);
    if (match) {
      return NextResponse.json({
        detected: true,
        examId: match.id,
        examName: match.name,
        confirmMessage: `${match.name} ke liye form fill karte hain! ✅`,
      });
    }

    // If no API key, return not detected
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
      return NextResponse.json({
        detected: false,
        examId: null,
        examName: null,
        askMessage: 'Kaunsa exam? Jaise: SSC CGL, Railway NTPC, SBI PO, UP Police, NDA...',
      });
    }

    // AI fallback
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: `Identify Indian government exam from user message. Available exam IDs: ${EXAM_MAP.map(e => e.id).join(', ')}. Respond JSON only: {"detected":true/false,"examId":"id or null","examName":"name or null"}`,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response');
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      detected: false,
      examId: null,
      examName: null,
      askMessage: 'Kaunsi government job? Jaise: SSC CGL, Railway, Bank, UPSC, Army...',
    });
  }
}
