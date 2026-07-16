/**
 * Seed script: a complete "Eko Pods Phase 2 (demo)" project, in the RUN phase,
 * for okeoluwole@gmail.com. Untracked, re-runnable. NOT a code change; it writes
 * DATA to the live flitrr-app database.
 *
 * THE ONE RULE: no derived value is hand-written. Every derived value comes from
 * the real engine or the real lock path, called here exactly as the app calls it:
 *   - risk severity          -> deriveSeverity (via the register/dashboard reads;
 *                               severity is never stored, so nothing to write)
 *   - stored criticality      -> toStoredCriticality (the criticality kernel)
 *   - the Brief content        -> assembleBrief (the real generator); gated by
 *                               checkCompleteness before the lock, as the UI is
 *   - the frozen programme     -> assembleProgramme (the real assembly)
 *   - the baseline lock        -> writeProgrammeBaseline -> lock_programme_baseline
 *                               RPC (v1; its reason is dropped to null by the real
 *                               planBaselineWrite and the DB CHECK, so "Initial
 *                               baseline" is the meaning of v1, never a stored lie)
 *   - milestone actuals        -> markMilestoneMet -> record_milestone_actual RPC
 *   - the promoted action       -> buildTrackedActionFromRisk (the real promote)
 *   - met-points / dashboard    -> buildMetPointsView / deriveDashboard (verify)
 *
 * Only genuine user INPUTS are seeded (project, objectives + classification, the
 * nine wizard steps, risks with raw likelihood/impact, actions, workstreams,
 * gate dates). The Brief locks the real way (assembleBrief snapshot + is_locked
 * row). Gate 1 to 2 passes the real way (the stage-1 gate row write + current_stage
 * bump, exactly GateReview's writes). Everything runs AS the user over a minted
 * session, so RLS is enforced end to end (no service-role bypass on the data).
 *
 * Run:   node scripts/seed-eko-pods-phase2.mjs
 * Undo:  node scripts/teardown-eko-pods-phase2.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..'); // flitrr-landing

const EMAIL = 'okeoluwole@gmail.com';
const SEED_NAME = 'Eko Pods Phase 2 (demo)';

// ---------------------------------------------------------------------------
// Environment (.env.local)
// ---------------------------------------------------------------------------
function loadEnv() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) {
    throw new Error('Missing SUPABASE url / publishable / secret in .env.local');
  }
  return { url, publishable, secret };
}

// ---------------------------------------------------------------------------
// Fixture data (INPUTS only)
// ---------------------------------------------------------------------------
const TODAY = new Date();
const todayIso = TODAY.toISOString().slice(0, 10);
const nowIso = TODAY.toISOString();

const PROJECT = {
  name: SEED_NAME,
  project_type: 'Residential',
  category: 'Off-plan residential development',
  location: 'Lekki, Lagos',
  country: 'nigeria',
  currency: 'NGN',
  size: '180 units, 22,000 sqm GIA, 6 storeys, 3.2 ha',
  size_measures: {
    unit_count: '180',
    gross_internal_area: '22,000 sqm',
    storeys: '6',
    plot_size: '3.2 ha',
  },
  description:
    'Phase 2 of the Eko Pods masterplan, a mid-market off-plan residential scheme in Lekki, Lagos.',
  procurement_route: 'design_build',
  budget: 14_500_000_000,
  projected_gdv: 21_000_000_000,
  projected_roi: 27,
  financial_detail_url: null,
  start_date: '2026-01-19',
  target_completion_date: '2029-03-01',
  funding_structure: 'Development finance drawn against off-plan pre-sales',
  reporting_cadence: 'Weekly',
  digest_recipient: 'Adebayo Okonkwo',
  strategic_rationale:
    'A funding-led, off-plan residential scheme meeting strong Lekki housing demand. Pre-sales fund the build under a REDAN-aligned model, with development finance drawn against pre-sales milestones.',
  exit_strategy:
    'Off-plan and completed unit sales to owner-occupiers and buy-to-let investors, with the funding facility repaid from sales receipts.',
  target_end_user: 'Mid-market owner-occupiers and diaspora buy-to-let investors.',
  completion_handover:
    'Practical completion certified, snagging cleared, and units handed over on completion of sale.',
};

// classification is the developer's INPUT; a defensible Nigeria mix (funding,
// cost, time protected; scope, quality flexible). Non-negotiable objectives carry
// no tolerance by the framework and the wizard convention (null).
const OBJECTIVES = {
  funding: {
    classification: 'non_negotiable',
    rank: 1,
    definition:
      'Development finance and off-plan sales secured to fund the build to completion.',
    tolerance: null,
  },
  cost: {
    classification: 'non_negotiable',
    rank: 2,
    definition: 'Deliver within the NGN 14.5bn budget, including contingency.',
    tolerance: null,
  },
  time: {
    classification: 'non_negotiable',
    rank: 3,
    definition:
      'Practical completion and handover by the funding-condition completion date.',
    tolerance: null,
  },
  scope: {
    classification: 'flexible',
    rank: 4,
    definition:
      '180 homes across the agreed mix and quantum, phase 2 of the Eko Pods masterplan.',
    tolerance:
      'Unit mix may shift by up to 10 percent between typologies to follow sales demand.',
  },
  quality: {
    classification: 'flexible',
    rank: 5,
    definition: 'Built to the agreed Eko Pods specification, defect-free at handover.',
    tolerance:
      'Finishes may substitute to an equivalent or better specification where local supply is constrained.',
  },
};
const RANK_ORDER = ['funding', 'cost', 'time', 'scope', 'quality'];

const SCOPE_SITE = {
  development_summary:
    'Phase 2 of the Eko Pods masterplan: 180 mid-market homes across nine low-rise blocks, sold off-plan to fund the build.',
  mix_quantum: [
    { label: '2-bed apartment', quantum: '96' },
    { label: '3-bed maisonette', quantum: '60' },
    { label: '3-bed terrace', quantum: '24' },
  ],
  spec_standard:
    'Eko Pods specification, EDGE-certified, prepaid metering, borehole and treatment.',
  site_area: '3.2 ha',
  planning_status: 'approved',
  planning_constraints:
    'Lagos State physical planning permit conditions on setback, density and drainage.',
  physical_constraints:
    'High water table on the eastern boundary; single access from the expressway service road.',
};

const BUDGET = {
  budget_breakdown: {
    hard_cost: 10_500_000_000,
    soft_cost: 2_500_000_000,
    contingency: 1_500_000_000,
  },
  funding_structure_type: 'development_finance',
  funding_notes:
    'Senior development finance from Zenith Bank drawn against off-plan pre-sales milestones.',
};

const FUNDING_MILESTONES = [
  {
    label: 'Development finance facility agreed',
    amount: 8_000_000_000,
    status: 'secured',
    target_date: '2026-05-15',
    note: 'Senior debt from Zenith Bank, conditional on the pre-sales threshold.',
  },
  {
    label: 'Off-plan pre-sales 40 percent reached',
    amount: 5_000_000_000,
    status: 'planned',
    target_date: '2027-06-30',
    note: 'Unlocks the main construction drawdown.',
  },
];

const STAKEHOLDERS = [
  {
    _key: 'dev',
    name: 'Adebayo Okonkwo',
    role: 'developer',
    organisation: 'Eko Pods Developments Ltd',
    contact: 'adebayo@ekopods.example',
    authority: true,
  },
  {
    _key: 'fund',
    name: 'Zenith Bank Nigeria',
    role: 'funder',
    organisation: 'Zenith Bank Plc',
    contact: null,
  },
  {
    _key: 'pm',
    name: 'Chinelo Okafor',
    role: 'project_manager',
    organisation: 'Okafor Project Management',
    contact: 'chinelo@okaforpm.example',
  },
];

const WORKSTREAMS = [
  { name: 'Funding and finance', serves: 'funding' },
  { name: 'Cost and commercial management', serves: 'cost' },
  { name: 'Construction delivery', serves: 'time' },
  { name: 'Design and planning', serves: 'scope' },
  { name: 'Sales and marketing', serves: 'funding' },
];

const ASSUMPTIONS = [
  {
    description: 'Off-plan pre-sales reach 40 percent before the main contract award',
    detail: 'Bank drawdown is conditional on this pre-sales threshold.',
    serves: 'funding',
  },
];
const CONSTRAINTS = [
  {
    description: 'Fixed completion date set by the development finance facility',
    detail: null,
    serves: 'time',
  },
];
const DEPENDENCIES = [
  {
    description: 'Grid connection and access road by the Lagos State utility and LASG',
    detail: null,
    serves: 'time',
  },
];

// Risks with RAW likelihood and impact only. deriveSeverity turns these into the
// spread the register and the dashboard read; nothing is stored as "severity".
// reviewed => last_reviewed_at set (engaged); else null (register not-yet-engaged).
// Severity comes from likelihood x impact (deriveSeverity), never stored. The
// spread: one Serious on a protected objective (Funding), Serious unlinked, three
// Worth-watching, two Minor, two Unscored. The minors and unscored sit on FLEXIBLE
// objectives on purpose: a protected objective's risk is watched closely (the
// monitor flags it as critical-and-unmanaged and it headlines Band 3), whereas a
// minor or unscored risk on a flexible objective feeds the register and Band 1's
// not-scored caveat without crowding the "what needs you now" list. That leaves
// Band 3 headed by the two protected risks that genuinely need a response, so the
// three critical actions (including the deduped promoted one) surface beneath them.
const REVIEWED_AT = '2026-07-10T09:00:00Z';
const RISKS = [
  { key: 'funding_sales', serves: 'funding', likelihood: 'high', impact: 'high', status: 'acting', reviewed: true,
    description: 'Off-plan sales run rate below the funding drawdown plan',
    mitigation: 'Weekly sales tracking against the drawdown schedule; phased release of units.' },
  { key: 'cost_inflation', serves: 'cost', likelihood: 'medium', impact: 'medium', status: 'watching', reviewed: true,
    description: 'Construction cost inflation on cement, rebar and imported MEP',
    mitigation: 'Early procurement and fixed-price packages for long-lead items.' },
  { key: 'time_planning', serves: 'time', likelihood: 'medium', impact: 'medium', status: 'watching', reviewed: true,
    description: 'Lagos State planning and permit approvals slower than programmed',
    mitigation: null },
  { key: 'scope_changes', serves: 'scope', likelihood: 'medium', impact: 'medium', status: 'watching', reviewed: false,
    description: 'Client-driven changes to the unit mix and amenities during sales',
    mitigation: null },
  { key: 'scope_layout', serves: 'scope', likelihood: 'low', impact: 'low', status: 'watching', reviewed: false,
    description: 'Minor unit-layout revisions requested during off-plan sales',
    mitigation: null },
  { key: 'quality_finish', serves: 'quality', likelihood: 'low', impact: 'medium', status: 'watching', reviewed: false,
    description: 'Finishing standard below the sales-brochure specification',
    mitigation: null },
  // Two UNSCORED (likelihood/impact null), on flexible objectives, so Band 1's
  // "not yet scored" caveat and the register's not-yet-engaged trigger both render.
  { key: 'scope_community', serves: 'scope', likelihood: null, impact: null, status: 'watching', reviewed: false,
    description: 'Community and host settlement expectations (omonile)',
    mitigation: null },
  { key: 'quality_leadtime', serves: 'quality', likelihood: null, impact: null, status: 'watching', reviewed: false,
    description: 'Imported finishes and MEP lead times not yet quantified',
    mitigation: null },
  // Deliberately UNLINKED, so Band 1's unlinked caveat renders truthfully.
  { key: 'unlinked_title', serves: null, likelihood: 'medium', impact: 'high', status: 'watching', reviewed: true,
    description: 'Title perfection and Governor consent under the Land Use Act',
    mitigation: null },
];

// Standalone actions (a couple of critical ones on protected objectives; a
// flexible one; one already delivered). criticality is derived, not written here.
const STANDALONE_ACTIONS = [
  { serves: 'funding', status: 'to_do',
    description: 'Confirm the bank facility drawdown conditions and off-plan escrow arrangements',
    note: 'The facility drawdown is conditional on the pre-sales threshold and an escrow structure the bank must approve before the first draw.',
    outcome: null },
  { serves: 'time', status: 'to_do',
    description: 'Expedite the Lagos State planning permit submission and pre-application engagement',
    note: 'Permit turnaround drives the design gate; an early pre-application meeting de-risks the approval window.',
    outcome: null },
  { serves: 'scope', status: 'doing',
    description: 'Freeze the unit mix and typology split ahead of consultant scoping',
    note: 'Scoping the consultants against a moving unit mix wastes fee; fix the mix first.',
    outcome: null },
  { serves: 'cost', status: 'done',
    description: 'Appoint the quantity surveyor and cost consultant',
    note: 'Appointed to hold the cost plan from the outset.',
    outcome: 'delivered' },
];

// The programme choices (INPUT): stage 0 not applicable (the developer already
// holds the land under an existing Certificate of Occupancy, Land Use Act), then
// realistic Lagos gate dates. Only stage 2's headline is dated (forward, so the
// Quality milestone is not behind); every other milestone auto-places by offset,
// exactly as the reference RUN fixture does. Reused for the assembly AND stored
// on the gate rows, one source.
const GATES = [
  { stage: 0, target_date: null, target_na: true, milestones: {} },
  { stage: 1, target_date: '2026-06-01', target_na: false, milestones: {} },
  { stage: 2, target_date: '2026-09-07', target_na: false,
    milestones: { lead_consultant: { target_date: '2026-08-24', note: '' } } },
  { stage: 3, target_date: '2027-05-15', target_na: false, milestones: {} },
  { stage: 4, target_date: '2027-08-31', target_na: false, milestones: {} },
  { stage: 5, target_date: '2028-12-15', target_na: false, milestones: {} },
  { stage: 6, target_date: '2029-02-28', target_na: false, milestones: {} },
  { stage: 7, target_date: '2028-11-30', target_na: false, milestones: {} },
];

// Milestone actuals (INPUT): stage 1 delivered. gate_1 is met via the real gate
// pass (below), not here. Historical met dates make the programme genuinely
// part-delivered; finance_committed is late, which is why gate 1 slipped.
const MILESTONE_ACTUALS = [
  { milestone_key: 'feasibility_confirmed', met_date: '2026-03-16' },
  { milestone_key: 'finance_committed', met_date: '2026-05-25' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function must(res, what) {
  if (res && res.error) {
    throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  }
  return res.data;
}
function log(...a) {
  console.log(...a);
}

async function findUserId(admin, email) {
  // Paginate the admin user list to find the account by email.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = (data?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit.id;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { url, publishable, secret } = loadEnv();

  // Load the real engine + model modules through Vite's SSR loader (the repo's
  // ESM .js files run natively under it, exactly as under Next/Vitest).
  const vite = await createServer({
    root: ROOT,
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'error',
  });
  const L = (p) => vite.ssrLoadModule(p);
  const { buildObjectiveIndex, toStoredCriticality } = await L('/lib/engine/criticality.js');
  const { PROGRAMME_TEMPLATE } = await L('/lib/engine/programmeTemplate.js');
  const { assembleProgramme } = await L('/lib/engine/programmeAssembly.js');
  const { assembleBrief } = await L('/app/pulse/app/components/briefModel.js');
  const { checkCompleteness } = await L('/app/pulse/app/components/briefCompleteness.js');
  const { writeProgrammeBaseline, loadCurrentProgrammeBaseline } = await L('/app/pulse/app/components/programmeBaselineStore.js');
  const { markMilestoneMet, loadMetPointsView } = await L('/app/pulse/app/components/programmeActualsStore.js');
  const { buildTrackedActionFromRisk } = await L('/app/pulse/app/actions/actionFeed.js');
  const { deriveDashboard } = await L('/app/pulse/app/dashboard/dashboardModel.js');
  const { derivePhase, deriveLanding, SURFACES } = await L('/app/pulse/app/workspace/phaseModel.js');

  // ----- Admin client (service key): user lookup / create + session minting -----
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = await findUserId(admin, EMAIL);
  if (!userId) {
    log(`User ${EMAIL} not found; creating via the admin API (as the app does).`);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      password: `Eko!${Math.abs(hashString(EMAIL))}aA9`,
    });
    if (cErr) throw new Error(`createUser: ${cErr.message}`);
    userId = created.user.id;
    // The signup trigger creates the personal organisation + membership. Give it
    // a moment, then re-read.
    await new Promise((r) => setTimeout(r, 1500));
  }
  log(`User id: ${userId}`);

  // Resolve the user's personal organisation (created by the signup trigger).
  const { data: memberships, error: mErr } = await admin
    .from('organisation_members')
    .select('organisation_id, role')
    .eq('user_id', userId);
  if (mErr) throw new Error(`membership read: ${mErr.message}`);
  if (!memberships || memberships.length === 0) {
    throw new Error('No organisation membership found for the user.');
  }
  const orgId = memberships[0].organisation_id;
  log(`Organisation id: ${orgId} (role ${memberships[0].role})`);

  // ----- Mint an authenticated session for the user (RLS enforced on all writes) -----
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
  });
  if (lErr) throw new Error(`generateLink: ${lErr.message}`);
  const hashed = link.properties.hashed_token;

  const supabase = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  });
  if (otpErr) throw new Error(`verifyOtp: ${otpErr.message}`);
  const { data: whoami } = await supabase.auth.getUser();
  if (whoami?.user?.id !== userId) {
    throw new Error('Minted session is not the target user.');
  }
  log('Authenticated as the user (RLS enforced).');

  // ----- Idempotency: remove any prior seed project of this exact name -----
  const { data: prior } = await supabase
    .from('projects')
    .select('id')
    .eq('name', SEED_NAME)
    .eq('organisation_id', orgId);
  for (const p of prior ?? []) {
    must(await supabase.from('projects').delete().eq('id', p.id), 'delete prior seed');
    log(`Removed prior seed project ${p.id}`);
  }

  // ----- 1. Create the project (organisation_id set by the BEFORE trigger) -----
  const project = must(
    await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: PROJECT.name,
        project_type: PROJECT.project_type,
        category: PROJECT.category,
        location: PROJECT.location,
        country: PROJECT.country,
        currency: PROJECT.currency,
        size: PROJECT.size,
        size_measures: PROJECT.size_measures,
        description: PROJECT.description,
        procurement_route: PROJECT.procurement_route,
        budget: PROJECT.budget,
        projected_gdv: PROJECT.projected_gdv,
        projected_roi: PROJECT.projected_roi,
        financial_detail_url: PROJECT.financial_detail_url,
        start_date: PROJECT.start_date,
        target_completion_date: PROJECT.target_completion_date,
        funding_structure: PROJECT.funding_structure,
        reporting_cadence: PROJECT.reporting_cadence,
        digest_recipient: PROJECT.digest_recipient,
        strategic_rationale: PROJECT.strategic_rationale,
        exit_strategy: PROJECT.exit_strategy,
        target_end_user: PROJECT.target_end_user,
        completion_handover: PROJECT.completion_handover,
        current_stage: 1,
        status: 'draft',
      })
      .select('id, organisation_id, current_stage, status')
      .single(),
    'insert project'
  );
  const projectId = project.id;
  log(`\nCreated project ${projectId} (org ${project.organisation_id})`);
  if (project.organisation_id !== orgId) {
    throw new Error('Project organisation_id does not match the user org.');
  }

  // ----- 2. Objectives: the trigger seeded five (flexible); set classification -----
  const seededObjs = must(
    await supabase
      .from('project_objectives')
      .select('id, objective_type')
      .eq('project_id', projectId),
    'read seeded objectives'
  );
  const idByType = {};
  for (const o of seededObjs) idByType[o.objective_type] = o.id;
  for (const type of Object.keys(OBJECTIVES)) {
    const cfg = OBJECTIVES[type];
    must(
      await supabase
        .from('project_objectives')
        .update({
          classification: cfg.classification,
          definition: cfg.definition,
          tolerance: cfg.tolerance,
          rank: cfg.rank,
        })
        .eq('project_id', projectId)
        .eq('objective_type', type),
      `update objective ${type}`
    );
  }

  // The in-memory objective rows + index the criticality kernel derives from.
  const objectiveRows = Object.keys(OBJECTIVES).map((type) => ({
    id: idByType[type],
    objective_type: type,
    classification: OBJECTIVES[type].classification,
    definition: OBJECTIVES[type].definition,
    tolerance: OBJECTIVES[type].tolerance,
  }));
  const { byId } = buildObjectiveIndex(objectiveRows);
  const critFor = (serves) => toStoredCriticality(serves ? idByType[serves] : null, byId);

  // ----- 3. Scope and site (update the trigger-seeded row) -----
  must(
    await supabase
      .from('project_scope_site')
      .update({
        development_summary: SCOPE_SITE.development_summary,
        mix_quantum: SCOPE_SITE.mix_quantum,
        spec_standard: SCOPE_SITE.spec_standard,
        site_area: SCOPE_SITE.site_area,
        planning_status: SCOPE_SITE.planning_status,
        planning_constraints: SCOPE_SITE.planning_constraints,
        physical_constraints: SCOPE_SITE.physical_constraints,
      })
      .eq('project_id', projectId),
    'update scope_site'
  );

  // ----- 4. Financial baseline (update the trigger-seeded budget row) -----
  must(
    await supabase
      .from('project_budget')
      .update({
        budget_breakdown: BUDGET.budget_breakdown,
        funding_structure_type: BUDGET.funding_structure_type,
        funding_notes: BUDGET.funding_notes,
      })
      .eq('project_id', projectId),
    'update budget'
  );
  for (const fm of FUNDING_MILESTONES) {
    must(
      await supabase.from('project_funding_milestones').insert({
        project_id: projectId,
        label: fm.label,
        amount: fm.amount,
        status: fm.status,
        target_date: fm.target_date,
        note: fm.note,
      }),
      'insert funding milestone'
    );
  }

  // ----- 5. Organisation and governance (stakeholders + named authority) -----
  const keyToStakeholderId = {};
  for (const s of STAKEHOLDERS) {
    const row = must(
      await supabase
        .from('project_stakeholders')
        .insert({
          project_id: projectId,
          name: s.name,
          role: s.role,
          organisation: s.organisation,
          contact: s.contact,
        })
        .select('id')
        .single(),
      `insert stakeholder ${s.name}`
    );
    keyToStakeholderId[s._key] = row.id;
  }
  const authority = STAKEHOLDERS.find((s) => s.authority);
  must(
    await supabase
      .from('projects')
      .update({ authority_stakeholder_id: keyToStakeholderId[authority._key] })
      .eq('id', projectId),
    'set authority stakeholder'
  );

  // ----- 6. Workstreams (criticality derived) -----
  for (const w of WORKSTREAMS) {
    must(
      await supabase.from('project_workstreams').insert({
        project_id: projectId,
        name: w.name,
        linked_objective_id: idByType[w.serves] ?? null,
        criticality: critFor(w.serves),
      }),
      `insert workstream ${w.name}`
    );
  }

  // ----- 7. RAID (criticality derived) -----
  const insertRaid = async (table, items) => {
    for (const it of items) {
      must(
        await supabase.from(table).insert({
          project_id: projectId,
          description: it.description,
          detail: it.detail,
          linked_objective_id: idByType[it.serves] ?? null,
          criticality: critFor(it.serves),
        }),
        `insert ${table}`
      );
    }
  };
  await insertRaid('project_assumptions', ASSUMPTIONS);
  await insertRaid('project_constraints', CONSTRAINTS);
  await insertRaid('project_dependencies', DEPENDENCIES);

  // ----- 8. Programme choices onto the gate rows (stage 0 N/A) -----
  for (const g of GATES) {
    const mc = Object.keys(g.milestones).length ? g.milestones : null;
    must(
      await supabase
        .from('project_stage_gates')
        .update({ target_date: g.target_date, target_na: g.target_na, milestone_choices: mc })
        .eq('project_id', projectId)
        .eq('stage', g.stage),
      `update gate ${g.stage}`
    );
  }

  // ----- 9. Risks (raw likelihood/impact; criticality derived; severity never stored) -----
  const riskIdByKey = {};
  for (const r of RISKS) {
    const row = must(
      await supabase
        .from('project_risks')
        .insert({
          project_id: projectId,
          description: r.description,
          likelihood: r.likelihood,
          impact: r.impact,
          linked_objective_id: r.serves ? idByType[r.serves] : null,
          criticality: critFor(r.serves),
          status: r.status,
          last_reviewed_at: r.reviewed ? REVIEWED_AT : null,
          mitigation: r.mitigation,
        })
        .select('id, description, linked_objective_id, criticality')
        .single(),
      `insert risk ${r.key}`
    );
    riskIdByKey[r.key] = row;
  }

  // ----- 10. Lock the Brief the real way: assembleBrief (gated by checkCompleteness) -----
  const def = {
    name: PROJECT.name,
    project_type: PROJECT.project_type,
    category: PROJECT.category,
    size: PROJECT.size,
    size_unit_count: PROJECT.size_measures.unit_count,
    size_gross_internal_area: PROJECT.size_measures.gross_internal_area,
    size_storeys: PROJECT.size_measures.storeys,
    size_plot_size: PROJECT.size_measures.plot_size,
    location: PROJECT.location,
    country: PROJECT.country,
    description: PROJECT.description,
    target_completion_date: PROJECT.target_completion_date,
    currency: PROJECT.currency,
    budget: PROJECT.budget,
    projected_gdv: PROJECT.projected_gdv,
    projected_roi: PROJECT.projected_roi,
    financial_detail_url: PROJECT.financial_detail_url,
    start_date: PROJECT.start_date,
  };
  const ctx = {
    strategic_rationale: PROJECT.strategic_rationale,
    exit_strategy: PROJECT.exit_strategy,
    target_end_user: PROJECT.target_end_user,
    completion_handover: PROJECT.completion_handover,
  };
  const scope = {
    development_summary: SCOPE_SITE.development_summary,
    mix: SCOPE_SITE.mix_quantum,
    spec_standard: SCOPE_SITE.spec_standard,
    site_area: SCOPE_SITE.site_area,
    planning_status: SCOPE_SITE.planning_status,
    planning_constraints: SCOPE_SITE.planning_constraints,
    physical_constraints: SCOPE_SITE.physical_constraints,
  };
  const org = {
    authority_key: authority._key,
    reporting_cadence: PROJECT.reporting_cadence,
    digest_recipient: PROJECT.digest_recipient,
  };
  const stakeholdersState = STAKEHOLDERS.map((s) => ({
    name: s.name,
    organisation: s.organisation,
    role: s.role,
    contact: s.contact,
    _key: s._key,
  }));
  const financial = {
    hard_cost: BUDGET.budget_breakdown.hard_cost,
    soft_cost: BUDGET.budget_breakdown.soft_cost,
    contingency: BUDGET.budget_breakdown.contingency,
    funding_structure_type: BUDGET.funding_structure_type,
    funding_notes: BUDGET.funding_notes,
    milestones: FUNDING_MILESTONES,
  };
  const lists = {
    workstreams: WORKSTREAMS.map((w) => ({
      name: w.name,
      lead: null,
      linked_objective_id: idByType[w.serves] ?? null,
    })),
    risks: RISKS.map((r) => ({
      description: r.description,
      linked_objective_id: r.serves ? idByType[r.serves] : null,
      likelihood: r.likelihood,
      impact: r.impact,
      mitigation: r.mitigation,
    })),
    assumptions: ASSUMPTIONS.map((a) => ({
      description: a.description,
      detail: a.detail,
      linked_objective_id: idByType[a.serves] ?? null,
    })),
    constraints: CONSTRAINTS.map((c) => ({
      description: c.description,
      detail: c.detail,
      linked_objective_id: idByType[c.serves] ?? null,
    })),
    dependencies: DEPENDENCIES.map((d) => ({
      description: d.description,
      detail: d.detail,
      linked_objective_id: idByType[d.serves] ?? null,
    })),
  };
  const briefState = {
    def,
    ctx,
    objectives: objectiveRows,
    rankOrder: RANK_ORDER,
    lists,
    scope,
    org,
    stakeholders: stakeholdersState,
    financial,
    gates: GATES,
  };

  const completeness = checkCompleteness(briefState);
  if (!completeness.canLock) {
    const missing = completeness.required.filter((r) => !r.ok).map((r) => r.label);
    throw new Error(`Brief is not lockable through the real gate. Missing: ${missing.join(', ')}`);
  }
  log('Brief completeness gate passed (canLock = true).');

  const content = assembleBrief(briefState);
  const brief = must(
    await supabase
      .from('project_briefs')
      .insert({
        project_id: projectId,
        version: 1,
        content,
        is_locked: true,
        generated_at: nowIso,
      })
      .select('id, version, is_locked')
      .single(),
    'insert locked brief'
  );
  must(
    await supabase.from('projects').update({ status: 'active' }).eq('id', projectId),
    'set project active'
  );
  log(`Brief locked (v${brief.version}, is_locked=${brief.is_locked}).`);

  // ----- 11. Pass Gate 1 to 2 the real way (GateReview's exact writes) -----
  // Preconditions the gate enforces: funding structure present, not over-constrained.
  const fundingPresent = !!(PROJECT.funding_structure && PROJECT.funding_structure.trim());
  const overConstrained = content.objectives.counts.flexible === 0;
  if (!fundingPresent) throw new Error('Gate precondition failed: funding_structure absent.');
  if (overConstrained) throw new Error('Gate precondition: over-constrained (unexpected).');
  must(
    await supabase
      .from('project_stage_gates')
      .update({
        gate_status: 'passed',
        passed_at: nowIso,
        decided_by: userId,
        over_constraint_acknowledged: false,
        objective_lens_confirmed: true,
      })
      .eq('project_id', projectId)
      .eq('stage', 1),
    'gate: pass stage 1'
  );
  must(
    await supabase.from('projects').update({ current_stage: 2 }).eq('id', projectId),
    'gate: advance current_stage'
  );
  log('Gate 1 to 2 passed (current_stage = 2, gate_1 met).');

  // ----- 12. Actions: standalone (criticality derived) + one promoted from a risk -----
  for (const a of STANDALONE_ACTIONS) {
    must(
      await supabase.from('project_actions').insert({
        project_id: projectId,
        description: a.description,
        linked_objective_id: idByType[a.serves] ?? null,
        criticality: critFor(a.serves),
        status: a.status,
        note: a.note,
        outcome: a.outcome,
        source: 'manual',
        stage: 2,
      }),
      `insert action ${a.serves}`
    );
  }
  // The real promote path: build the tracked-action row from the risk, then insert.
  const promotedFrom = riskIdByKey['cost_inflation'];
  const promoted = buildTrackedActionFromRisk(promotedFrom, projectId, 2, byId);
  must(await supabase.from('project_actions').insert(promoted), 'insert promoted action');
  log(`Promoted risk -> action: "${promoted.description}" (${promoted.reason})`);

  // ----- 13. Assemble + lock the Programme baseline (real assembly + lock RPC) -----
  const programme = assembleProgramme(PROJECT.start_date, PROGRAMME_TEMPLATE, GATES, [], objectiveRows);
  const { baseline, error: blErr } = await writeProgrammeBaseline(supabase, {
    projectId,
    programme,
    sourceBriefId: brief.id,
    lockedBy: userId,
    rebaselineReason: 'Initial baseline', // v1 -> dropped to null by the real path + DB CHECK
  });
  if (blErr) throw new Error(`lock baseline: ${blErr.message ?? JSON.stringify(blErr)}`);
  log(`Programme baseline locked (v${baseline.version}, rebaseline_reason=${JSON.stringify(baseline.rebaseline_reason)}).`);

  // ----- 14. Milestone actuals the real way (record_milestone_actual RPC) -----
  for (const a of MILESTONE_ACTUALS) {
    const { error } = await markMilestoneMet(supabase, {
      projectId,
      milestoneKey: a.milestone_key,
      metDate: a.met_date,
      recordedBy: userId,
    });
    if (error) throw new Error(`mark ${a.milestone_key}: ${error.message}`);
  }
  log(`Recorded ${MILESTONE_ACTUALS.length} milestone actuals.`);

  // -------------------------------------------------------------------------
  // VERIFY: run the real dashboard assembly and print the reads
  // -------------------------------------------------------------------------
  log('\n=================== VERIFY (real engine reads) ===================');
  const objectivesRead = must(
    await supabase.from('project_objectives').select('*').eq('project_id', projectId),
    'read objectives'
  );
  const risksRead = must(
    await supabase.from('project_risks').select('*').eq('project_id', projectId),
    'read risks'
  );
  const actionsRead = must(
    await supabase.from('project_actions').select('*').eq('project_id', projectId),
    'read actions'
  );
  const { baseline: currentBaseline } = await loadCurrentProgrammeBaseline(supabase, projectId);
  const { view: metPoints } = await loadMetPointsView(supabase, projectId);
  const proj = must(
    await supabase
      .from('projects')
      .select('current_stage, target_completion_date')
      .eq('id', projectId)
      .single(),
    'read project'
  );

  const briefLocked = brief.is_locked === true;
  const hasBaseline = currentBaseline != null;
  const phase = derivePhase({ briefLocked, hasBaseline });
  const landing = deriveLanding({ phase, viewWorkspace: false });

  const dash = deriveDashboard({
    objectives: objectivesRead,
    risks: risksRead,
    actions: actionsRead,
    programme: currentBaseline?.programme ?? null,
    metPoints,
    todayIso,
    targetCompletionDate: proj.target_completion_date,
    currentStage: proj.current_stage,
  });

  const report = {
    projectId,
    projectName: SEED_NAME,
    organisationId: orgId,
    url: `https://flitrr.com/pulse/app/workspace?project=${projectId}`,
    phase,
    landing,
    landsOnDashboard: landing === SURFACES.DASHBOARD,
    projectState: dash.health.project.state,
    sentenceRule: dash.health.project.sentenceRule,
    unscoredRiskCount: dash.health.unscoredRiskCount,
    unlinkedRiskCount: dash.health.unlinked.risks.length,
    facts: {
      currentStage: dash.facts.currentStage,
      percentComplete: dash.facts.percentComplete,
      forecastCompletion: dash.facts.forecastCompletion,
      targetCompletionDate: dash.facts.targetCompletionDate,
      nextGate: dash.facts.nextGate,
      readiness: dash.facts.readiness,
      hasBaseline: dash.facts.hasBaseline,
    },
    band2: dash.rows.map((r) => ({
      objective: r.type,
      classification: r.classification,
      state: r.state,
      colour: r.colour,
      trigger: r.trigger?.key,
      triggerDetail: r.trigger?.detail,
      dateSignal: r.dateSignal,
    })),
    band3: dash.attention.items.map((it) => ({
      module: it.module,
      kind: it.kind,
      objective: it.objectiveType,
      isProtected: it.isProtected,
      triggerKey: it.trigger?.key ?? null,
      raisedFrom: it.raisedFrom ?? null,
      title: it.title,
    })),
    band3Total: dash.attention.total,
    band3Overflow: dash.attention.overflow,
  };

  log('RAW attention items:', JSON.stringify(dash.attention.items, null, 2));
  log('Flagged gates:', JSON.stringify(dash.health.gates, null, 2));
  log(JSON.stringify(report, null, 2));
  log('\nSEED COMPLETE.');
  log(`Open as ${EMAIL}: ${report.url}`);
  log(`Phase: ${phase} -> lands on ${landing}.`);

  await vite.close();
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

main().catch((e) => {
  console.error('\nSEED FAILED:', e);
  process.exit(1);
});
