/* ─────────────────────────────────────────────────────────
   Content, verbatim from the live site. Nothing invented.
   - Framework 8-6-4:      app/framework/FrameworkMain.js
   - Suite rows:           app/HomeMain.js (suite section)
   - PULSE instrument data: app/HomeMain.js (PulseInstrument)
───────────────────────────────────────────────────────── */

// The 8-6-4 signature.
export const SIGNATURE = [
  { n: '8', label: 'Eight stages', gloss: 'The lifecycle of a development, from securing the land to realising the finished asset.' },
  { n: '6', label: 'Six principles', gloss: 'The rules that govern how a project is run, at every stage.' },
  { n: '4', label: 'Four mandates', gloss: 'What each stage must deliver to be done well.' },
] as const;

// The suite. PULSE Live; STACK / ROUTE In design; and more to follow.
export const SUITE = [
  { name: 'PULSE', status: 'Live', desc: 'Project delivery and programme management.', live: true },
  { name: 'STACK', status: 'In design', desc: 'Feasibility, budgets and funding.', live: false },
  { name: 'ROUTE', status: 'In design', desc: 'Strategy, tenders and appointments.', live: false },
] as const;

// The eight stages (names locked verbatim).
export const STAGES = [
  'Land', 'Objectives', 'Consultants', 'Design',
  'Procurement', 'Construction', 'Completion', 'Sales',
] as const;

// ── The real PULSE instrument (home glance) ──
export const PROJECT = {
  name: 'Holloway Place',
  meta: 'Mixed-use, 42 units · In construction',
  confidence: 82,
  delta: 'holding, down 3 points this week',
};

export const SPARK_PTS = [64, 66, 67, 69, 71, 74, 76, 79, 84, 86, 85, 82];

export type Obj = {
  k: string;
  prot: boolean;
  dev: number;
  status: string;
  needs?: string;
};

export const OBJ: Obj[] = [
  { k: 'Scope', prot: true, dev: 0, status: 'Locked to the brief. No change requests are open against it.' },
  { k: 'Cost', prot: true, dev: 38, status: 'Drifting. Running over the locked baseline, so a decision is due before it compounds.', needs: 'Cost is a protected objective and it is moving. A decision is due.' },
  { k: 'Time', prot: false, dev: 16, status: 'Flexed by design. A flexible objective absorbing reality, still delivering.' },
  { k: 'Quality', prot: true, dev: 3, status: 'Holding to the baseline standard. Monitored, with no action needed.' },
  { k: 'Funding', prot: true, dev: 22, status: 'Exposed. Facility headroom is tightening as cost moves against the baseline.', needs: 'Funding headroom is tightening. Review the facility.' },
];

// Gate timeline: 8 nodes, gates at 2 and 6, now at 6.
export const GATES = { 2: true, 6: true } as Record<number, boolean>;
export const NOW_STAGE = 6;

// ── The locked script copy, by beat ──
export const SCRIPT = {
  hook: [
    'The biggest developers run every scheme with a programme office behind them.',
    'Independent developers carry the same risk — with none of the infrastructure.',
  ],
  framework: {
    lead: 'Flitrr brings that discipline to independent development.',
    built: 'Built on the Flitrr Framework.',
  },
  suite: {
    head: 'One suite.',
    sub: 'PULSE leads it, across the development lifecycle.',
    more: 'And more, across the lifecycle.',
  },
  pulse: {
    kicker: 'PULSE is live now.',
    captions: [
      'Objectives, classified.',
      'Programme confidence.',
      'The one thing that needs you.',
      'Every stage, gated.',
    ],
  },
  cta: {
    l1: 'We’re building PULSE with a small group of developers.',
    l2: 'To shape it around how you actually deliver.',
    action: 'Become a design partner',
    url: 'flitrr.com',
  },
} as const;
