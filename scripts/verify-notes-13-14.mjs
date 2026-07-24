/**
 * Notes 13 and 14, live verification against the real database.
 *
 * The three things unit tests cannot prove, because they need a real project,
 * real row level security, and the real store:
 *   1. the amend and verify-later round trip WRITES real records;
 *   2. the verify-later deferral RAISES a real Action Log item;
 *   3. the module gating flips exactly once the operational baseline is locked
 *      and the gate is confirmed.
 *
 * It runs the SAME code the app runs: the reality-check engine, the reconcile
 * model, the reconcile decision store, the assembly engine, the lock-time
 * reconciliation, the baseline store, and the sequence model. Nothing is
 * re-implemented here; this script only supplies the inputs and asserts the
 * outputs. That is the point: a hand-written imitation of the write path would
 * prove nothing about the write path.
 *
 * AUTH. It mints an authenticated session for the real user through the admin
 * API and then does every write through the PUBLISHABLE client, so row level
 * security is enforced on all of it exactly as it is for a signed-in developer.
 * This is the pattern seed-eko-pods-phase2.mjs already established. The admin
 * key is used only to look the user up and mint the session; no write below
 * bypasses a policy.
 *
 * THE FIXTURE. It creates one clearly-named project, walks it through the whole
 * sequence, and leaves it in place for the browser walkthrough. It touches no
 * other project. Undo it with:
 *
 *   node scripts/verify-notes-13-14.mjs --teardown
 *
 * Run:   node scripts/verify-notes-13-14.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EMAIL = 'okeoluwole@gmail.com';
const FIXTURE_NAME = 'Notes 13 and 14 verification';
const TEARDOWN = process.argv.includes('--teardown');

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

function must(res, what) {
  if (res && res.error) {
    throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  }
  return res.data;
}

const log = (...a) => console.log(...a);

// The assertion tally. Every claim this script makes is recorded, so the run
// ends with a count rather than a wall of prose.
let passed = 0;
const failures = [];
function check(claim, condition, detail) {
  if (condition) {
    passed += 1;
    log(`  ok   ${claim}`);
  } else {
    failures.push(claim);
    log(`  FAIL ${claim}${detail ? `  (${detail})` : ''}`);
  }
}
function section(title) {
  log(`\n${title}`);
  log('-'.repeat(title.length));
}

// ---------------------------------------------------------------------------
// The fixture. A Lagos off-plan scheme, the shape of the project the 23 Jul
// end-to-end test used, with a start date far enough out that the reality check
// has something to say about the gate dates below.
// ---------------------------------------------------------------------------

const START = '2026-09-07'; // a Monday
const iso = (d) => d.toISOString().slice(0, 10);
const weeksFromStart = (n) =>
  iso(new Date(Date.parse(START) + n * 7 * 24 * 60 * 60 * 1000));

const PROJECT = {
  name: FIXTURE_NAME,
  project_type: 'Residential',
  category: 'Off-plan residential development',
  location: 'Ikoyi, Lagos',
  country: 'nigeria',
  currency: 'NGN',
  size: '12 units, 2,400 sqm GIA, 4 storeys',
  size_measures: {
    unit_count: '12',
    gross_internal_area: '2,400 sqm',
    storeys: '4',
    plot_size: '0.4 ha',
  },
  description:
    'A twelve unit off-plan residential scheme, created to verify the Note 13 sequence and the Note 14 decision grammar against the live database.',
  procurement_route: 'design_build',
  budget: 900000000,
  projected_gdv: 1350000000,
  projected_roi: 22,
  start_date: START,
  target_completion_date: weeksFromStart(181),
  funding_structure: 'Equity plus off-plan sales receipts',
  strategic_rationale:
    'Verification fixture for the Notes 13 and 14 walkthrough. Safe to delete.',
  current_stage: 1,
  status: 'draft',
};

// The classification set. Cost and Quality are non-negotiable, the rest
// flexible: a real, not over-constrained set, so the criticality that cascades
// onto the raised verification action is a genuine derivation.
const OBJECTIVES = {
  scope: { classification: 'flexible', rank: 3 },
  cost: { classification: 'non_negotiable', rank: 1 },
  time: { classification: 'flexible', rank: 4 },
  quality: { classification: 'non_negotiable', rank: 2 },
  funding: { classification: 'flexible', rank: 5 },
};

// The gate dates, chosen so the reality check produces BOTH card treatments,
// because Note 14 changed both:
//   - stage 0 (Land and Site Acquisition) at 31 weeks sits just outside the
//     template's 10 to 30 week band and is not location-sensitive, so it is a
//     recommendation card (propose): accept, keep, or amend;
//   - stages 3 to 6 are location-sensitive on a Nigeria scheme, so PULSE
//     refuses to put a number on them and they come through as VERIFY LOCALLY
//     cards (flag_verify), the card Note 14 turns on.
// A force needs a confirmed local floor, which the app never passes today, so
// none is expected here.
const GATES = [
  { stage: 0, target_date: weeksFromStart(31), target_na: false },
  { stage: 1, target_date: weeksFromStart(41), target_na: false },
  { stage: 2, target_date: weeksFromStart(53), target_na: false },
  { stage: 3, target_date: weeksFromStart(109), target_na: false },
  { stage: 4, target_date: weeksFromStart(123), target_na: false },
  { stage: 5, target_date: weeksFromStart(171), target_na: false },
  { stage: 6, target_date: weeksFromStart(181), target_na: false },
  { stage: 7, target_date: weeksFromStart(181), target_na: false },
];

// ---------------------------------------------------------------------------

async function main() {
  const { url, publishable, secret } = loadEnv();

  // Vite is here only to load the app's ESM modules (the package is CommonJS by
  // default, so a bare import() of them fails). configFile false and dependency
  // discovery off keep it to that job: without them it crawls the whole Next
  // app to pre-bundle dependencies it will never serve, which on a
  // OneDrive-synced checkout takes minutes of pure file I/O.
  const vite = await createServer({
    root: ROOT,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: 'error',
  });
  const L = (p) => vite.ssrLoadModule(p);

  // Every module below is the app's own. Nothing is re-implemented.
  const { PROGRAMME_TEMPLATE } = await L('/lib/engine/programmeTemplate.js');
  const { deriveRealityCheck } = await L('/lib/engine/programmeRealityCheck.js');
  const { deriveStageStates } = await L('/lib/engine/stageStates.js');
  const { assembleProgramme } = await L('/lib/engine/programmeAssembly.js');
  const { buildObjectiveIndex } = await L('/lib/engine/criticality.js');
  const {
    reconcileBaseline,
    referenceFromBriefProgramme,
    referenceFromChoices,
  } = await L('/lib/engine/programmeReconciliation.js');
  const { assembleBrief } = await L('/app/pulse/app/components/briefModel.js');
  const { loadProgrammeChoices } = await L('/app/pulse/app/components/programmeChoices.js');
  const { writeProgrammeBaseline, loadCurrentProgrammeBaseline } = await L(
    '/app/pulse/app/components/programmeBaselineStore.js'
  );
  const {
    RECONCILE_DECISIONS,
    flaggedItems,
    buildResolutions,
    canProceed,
    toDateInputValue,
  } = await L('/app/pulse/app/programme/setup/reconcileModel.js');
  const { recordReconcileDecisions, loadReconcileDecisions } = await L(
    '/app/pulse/app/programme/setup/reconcileDecisionStore.js'
  );
  const { finaliseProgrammeForLock } = await L(
    '/app/pulse/app/programme/setup/reviewLockModel.js'
  );
  const {
    SEQUENCE_STEPS,
    deriveGateConfirmed,
    deriveSequenceStep,
    deriveModuleStates,
    moduleLockedLine,
  } = await L('/app/pulse/app/workspace/sequenceModel.js');

  const { ACCEPTED, KEPT, AMENDED, VERIFIED, DEFERRED } = RECONCILE_DECISIONS;

  // ----- Session: admin lookup, then every write through the RLS client -----
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users, error: uErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (uErr) throw new Error(`listUsers: ${uErr.message}`);
  const user = (users?.users ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === EMAIL
  );
  if (!user) throw new Error(`User ${EMAIL} not found.`);
  const userId = user.id;

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
  });
  if (lErr) throw new Error(`generateLink: ${lErr.message}`);

  const supabase = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (otpErr) throw new Error(`verifyOtp: ${otpErr.message}`);
  log(`Signed in as ${EMAIL} (${userId}). Row level security is enforced on every write below.`);

  // ----- Teardown, and the clean slate for a re-run -----
  const { data: prior } = await supabase
    .from('projects')
    .select('id')
    .eq('name', FIXTURE_NAME);
  for (const p of prior ?? []) {
    must(await supabase.from('projects').delete().eq('id', p.id), 'delete prior fixture');
    log(`Removed prior fixture project ${p.id}`);
  }
  if (TEARDOWN) {
    log('Teardown complete.');
    await vite.close();
    return;
  }

  // ===========================================================================
  section('Setting up the fixture');
  // ===========================================================================

  const project = must(
    await supabase.from('projects').insert({ user_id: userId, ...PROJECT }).select('*').single(),
    'insert project'
  );
  const projectId = project.id;
  log(`  Created project ${projectId}`);

  // The signup trigger seeds five flexible objectives; classify and rank them.
  const seeded = must(
    await supabase
      .from('project_objectives')
      .select('id, objective_type')
      .eq('project_id', projectId),
    'read seeded objectives'
  );
  const idByType = {};
  for (const o of seeded) idByType[o.objective_type] = o.id;
  for (const [type, cfg] of Object.entries(OBJECTIVES)) {
    must(
      await supabase
        .from('project_objectives')
        .update({
          classification: cfg.classification,
          definition: `${type} definition for the verification fixture`,
          rank: cfg.rank,
        })
        .eq('project_id', projectId)
        .eq('objective_type', type),
      `classify ${type}`
    );
  }

  // The programme choices onto the seeded gate rows.
  for (const g of GATES) {
    must(
      await supabase
        .from('project_stage_gates')
        .update({ target_date: g.target_date, target_na: g.target_na })
        .eq('project_id', projectId)
        .eq('stage', g.stage),
      `set gate ${g.stage}`
    );
  }

  const objectiveRows = must(
    await supabase
      .from('project_objectives')
      .select('id, objective_type, classification, definition, rank, tolerance')
      .eq('project_id', projectId),
    'read objectives'
  );
  const { byId } = buildObjectiveIndex(objectiveRows);

  // Lock the Brief with the real generator, over the same rows the store holds,
  // so the lock-time reconciliation has a genuine reference to compare against.
  const gateRows = must(
    await supabase
      .from('project_stage_gates')
      .select('stage, target_date, target_na, milestone_choices')
      .eq('project_id', projectId)
      .order('stage'),
    'read gates'
  );
  const briefContent = assembleBrief({
    def: project,
    ctx: project,
    objectives: objectiveRows,
    rankOrder: Object.entries(OBJECTIVES)
      .sort((a, b) => a[1].rank - b[1].rank)
      .map(([t]) => t),
    lists: { risks: [], assumptions: [], constraints: [], dependencies: [], workstreams: [] },
    scope: {},
    org: {},
    stakeholders: [],
    financial: {},
    gates: gateRows.map((g) => ({
      stage: g.stage,
      target_date: g.target_date,
      target_na: g.target_na,
      milestones: g.milestone_choices ?? {},
    })),
  });
  const brief = must(
    await supabase
      .from('project_briefs')
      .insert({
        project_id: projectId,
        version: 1,
        content: briefContent,
        is_locked: true,
        generated_at: new Date().toISOString(),
      })
      .select('id, version, is_locked, content')
      .single(),
    'lock brief'
  );
  must(
    await supabase.from('projects').update({ status: 'active' }).eq('id', projectId),
    'activate project'
  );
  log(`  Brief locked as v${brief.version}`);

  // ===========================================================================
  section('1. Note 13: the modules are locked before the operational baseline');
  // ===========================================================================

  async function readSequenceNow() {
    const [{ data: b }, { baseline }, { data: gates }] = await Promise.all([
      supabase
        .from('project_briefs')
        .select('is_locked')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadCurrentProgrammeBaseline(supabase, projectId),
      supabase
        .from('project_stage_gates')
        .select('stage')
        .eq('project_id', projectId)
        .eq('gate_status', 'passed'),
    ]);
    const { data: proj } = await supabase
      .from('projects')
      .select('current_stage')
      .eq('id', projectId)
      .single();
    const gateConfirmed = deriveGateConfirmed({
      currentStage: proj.current_stage,
      passedGateStages: (gates ?? []).map((g) => g.stage),
    });
    const step = deriveSequenceStep({
      briefLocked: b?.is_locked === true,
      baselineLocked: baseline != null,
      gateConfirmed,
    });
    return { step, states: deriveModuleStates(step), line: moduleLockedLine(step) };
  }

  const atPlan = await readSequenceNow();
  check(
    'with the Brief locked and no baseline, the next step is Programme set-up',
    atPlan.step === SEQUENCE_STEPS.PROGRAMME_SETUP,
    atPlan.step
  );
  check(
    'all three monitoring modules read locked',
    atPlan.states.actionLog === 'locked' &&
      atPlan.states.risk === 'locked' &&
      atPlan.states.dashboard === 'locked',
    JSON.stringify(atPlan.states)
  );
  check(
    'the locked line names Programme set-up',
    atPlan.line === 'Opens after Programme set-up locks the operational baseline.',
    atPlan.line
  );

  // The symptom the test caught: no queue can exist before the baseline does.
  const { count: actionsBefore } = await supabase
    .from('project_actions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  check(
    'there is no action queue to show before set-up has run',
    actionsBefore === 0,
    `${actionsBefore} actions`
  );

  // ===========================================================================
  section('2. Note 14: the decision grammar over the real reality check');
  // ===========================================================================

  const { data: budget } = await supabase
    .from('project_budget')
    .select('funding_structure_type')
    .eq('project_id', projectId)
    .maybeSingle();
  const stageStates = deriveStageStates(PROGRAMME_TEMPLATE, {
    country: project.country,
    fundingStructureType: budget?.funding_structure_type,
  });
  const { choices } = await loadProgrammeChoices(supabase, projectId);
  const realityCheck = deriveRealityCheck(project.start_date, PROGRAMME_TEMPLATE, choices, {
    stageStates,
  });
  const flagged = flaggedItems(realityCheck);
  log(`  Flagged: ${flagged.map((f) => `${f.key} (${f.tier})`).join(', ') || 'none'}`);
  check('the reality check flags at least one date to decide', flagged.length > 0);

  const verifyItem = flagged.find((f) => f.tier === 'flag_verify');
  const proposeItem = flagged.find((f) => f.tier === 'propose');
  check('a VERIFY LOCALLY card is present, the card Note 14 turns on', verifyItem != null);
  check('a recommendation card is present', proposeItem != null);
  if (!verifyItem || !proposeItem) {
    throw new Error('The fixture did not produce both card types; adjust the gate dates.');
  }

  // The decisions: amend the recommendation card, defer the verify card, and
  // answer anything else so the flow can proceed. This is exactly what a
  // developer would click.
  const AMENDED_DATE = weeksFromStart(27);
  const decisions = {};
  for (const item of flagged) {
    if (item.key === proposeItem.key) {
      decisions[item.key] = {
        decision: AMENDED,
        note: 'The contractor confirmed a shorter mobilisation.',
        amendedDate: AMENDED_DATE,
      };
    } else if (item.key === verifyItem.key) {
      decisions[item.key] = { decision: DEFERRED, note: '', amendedDate: '' };
    } else if (item.tier === 'flag_verify') {
      decisions[item.key] = { decision: VERIFIED, note: 'Checked locally.', amendedDate: '' };
    } else {
      decisions[item.key] = { decision: ACCEPTED, note: '', amendedDate: '' };
    }
  }
  check('the flow may proceed once every flagged date is answered', canProceed(realityCheck, decisions));

  const resolutions = buildResolutions(realityCheck, decisions);

  // THE REAL WRITE. The same call the Assemble programme button makes.
  const written = await recordReconcileDecisions(supabase, {
    projectId,
    sourceBriefId: brief.id,
    decidedBy: userId,
    resolutions,
    objectiveIdFor: (r) => {
      for (const stage of PROGRAMME_TEMPLATE.stages) {
        for (const activity of stage.activities ?? []) {
          for (const m of activity.milestones ?? []) {
            if (m.key === r.key) return idByType[m.serves] ?? null;
          }
        }
      }
      return null;
    },
    objectivesById: byId,
  });
  check('the decision write returned no error', written.error == null, written.error?.message);
  check(
    `every decision was recorded (${resolutions.length})`,
    written.decisions.length === resolutions.length,
    `${written.decisions.length} written`
  );

  const { decisions: storedRows } = await loadReconcileDecisions(supabase, projectId);
  const amendRow = (storedRows ?? []).find((r) => r.point_key === proposeItem.key);
  const deferRow = (storedRows ?? []).find((r) => r.point_key === verifyItem.key);

  check('the amend was recorded as an amend', amendRow?.decision === 'amended', amendRow?.decision);
  check(
    'the amend set the operational date the developer chose',
    amendRow?.agreed_date === AMENDED_DATE,
    amendRow?.agreed_date
  );
  check(
    'the amend kept the Brief date alongside it, so the variance is legible',
    amendRow?.brief_date === toDateInputValue(proposeItem.developerDate),
    amendRow?.brief_date
  );
  check('the amend carries its reason', (amendRow?.note ?? '').length > 0);
  check(
    'every decision is stamped with who decided',
    (storedRows ?? []).every((r) => r.decided_by === userId)
  );
  check(
    'every decision is stamped with when',
    (storedRows ?? []).every((r) => r.decided_at != null)
  );
  check(
    'every decision is stamped against the locked Brief version, the approvals trail',
    (storedRows ?? []).every((r) => r.source_brief_id === brief.id)
  );

  // ===========================================================================
  section('3. Note 14: the deferral raises a real Action Log item');
  // ===========================================================================

  check('the deferral was recorded as a deferral', deferRow?.decision === 'deferred', deferRow?.decision);
  check('the deferral carries the id of the action it raised', deferRow?.action_id != null);
  check(
    'the deferral did not move the date: set-up proceeds on the developer own date',
    deferRow?.agreed_date === toDateInputValue(verifyItem.developerDate),
    deferRow?.agreed_date
  );

  const { data: raised } = await supabase
    .from('project_actions')
    .select('id, description, reason, source, stage, status, criticality, linked_objective_id')
    .eq('project_id', projectId);
  check('exactly one verification action was raised', (raised ?? []).length === 1, `${(raised ?? []).length}`);
  const action = (raised ?? [])[0];
  if (action) {
    check('it is the action the decision points at', action.id === deferRow?.action_id);
    check('it names the point to verify', /Verify locally/.test(action.description ?? ''), action.description);
    check('it carries the citable reason it was raised', (action.reason ?? '').length > 0, action.reason);
    check('it is sourced to the programme', action.source === 'programme', action.source);
    check('it bears on the point stage', action.stage === verifyItem.stage, String(action.stage));
    check('it is open, not pre-closed', action.status !== 'done', action.status);
    log(`  Raised: "${action.description}"`);
    log(`  Reason: ${action.reason}`);
  }

  // ===========================================================================
  section('4. Note 14: the amend is a variance the lock-time check reads as explained');
  // ===========================================================================

  const assembled = assembleProgramme(
    project.start_date,
    PROGRAMME_TEMPLATE,
    choices,
    resolutions,
    objectiveRows,
    { stageStates }
  );
  const reference =
    referenceFromBriefProgramme(brief.content?.programme) ?? referenceFromChoices(choices);
  const withRecord = reconcileBaseline({
    assembled,
    reference,
    resolutions,
    targetCompletionDate: project.target_completion_date,
  });
  check(
    'the amended date is on the assembled baseline',
    (assembled.stages ?? []).some(
      (s) => toDateInputValue(s.gate?.baselineDate) === AMENDED_DATE
    )
  );
  check(
    'the reconciliation passes with the decision recorded',
    withRecord.ok === true,
    withRecord.differences.map((d) => `${d.kind}:${d.key}`).join(', ')
  );
  check(
    'the reference came from the locked Brief, not the fallback',
    withRecord.source === 'brief',
    withRecord.source
  );

  // The control: the identical baseline with the record stripped must fail.
  const withoutRecord = reconcileBaseline({
    assembled,
    reference,
    resolutions: [],
    targetCompletionDate: project.target_completion_date,
  });
  check(
    'the SAME baseline without its decision is a blocking mismatch',
    withoutRecord.ok === false &&
      withoutRecord.differences.some((d) => d.key === proposeItem.key),
    `ok=${withoutRecord.ok}`
  );

  // ===========================================================================
  section('5. The lock, and the sequence advancing');
  // ===========================================================================

  const finalised = finaliseProgrammeForLock(assembled, withRecord, false, resolutions);
  const lockResult = await writeProgrammeBaseline(supabase, {
    projectId,
    programme: finalised,
    sourceBriefId: brief.id,
    lockedBy: userId,
  });
  check('v1 locked', lockResult.error == null && lockResult.baseline != null, lockResult.error?.message);
  check('it is version 1', lockResult.baseline?.version === 1);
  check(
    'v1 carries the decision set, so the baseline holds its own approvals trail',
    (lockResult.baseline?.programme?.reconciliation?.decisions ?? []).length === resolutions.length,
    `${(lockResult.baseline?.programme?.reconciliation?.decisions ?? []).length}`
  );

  const atGate = await readSequenceNow();
  check(
    'with the baseline locked but the gate unconfirmed, the next step is the gate',
    atGate.step === SEQUENCE_STEPS.GATE,
    atGate.step
  );
  check(
    'the modules are STILL locked: the baseline alone does not open them',
    atGate.states.risk === 'locked' && atGate.states.dashboard === 'locked' && atGate.states.actionLog === 'locked'
  );
  check(
    'and the locked line now names the gate',
    atGate.line === 'Opens once you confirm the gate into the next stage.',
    atGate.line
  );

  // Confirm the gate the way the gate screen does.
  must(
    await supabase
      .from('project_stage_gates')
      .update({
        gate_status: 'passed',
        passed_at: new Date().toISOString(),
        decided_by: userId,
        objective_lens_confirmed: true,
        over_constraint_acknowledged: false,
      })
      .eq('project_id', projectId)
      .eq('stage', 1),
    'pass gate 1'
  );
  must(
    await supabase.from('projects').update({ current_stage: 2 }).eq('id', projectId),
    'advance current_stage'
  );

  const atRun = await readSequenceNow();
  check('with the gate confirmed, the sequence reaches the modules', atRun.step === SEQUENCE_STEPS.MODULES, atRun.step);
  check(
    'all three modules open together',
    atRun.states.actionLog === 'open' && atRun.states.risk === 'open' && atRun.states.dashboard === 'open',
    JSON.stringify(atRun.states)
  );

  const { data: nowVisible } = await supabase
    .from('project_actions')
    .select('id, description')
    .eq('project_id', projectId);
  check(
    'and the verification action is waiting in the now-open Action Log',
    (nowVisible ?? []).length === 1 && (nowVisible ?? [])[0].id === deferRow?.action_id
  );

  // ===========================================================================
  section('Result');
  // ===========================================================================
  log(`  ${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    for (const f of failures) log(`  FAILED: ${f}`);
  }
  log(`\n  Fixture project: ${projectId}`);
  log(`  Workspace:  /pulse/app/workspace?project=${projectId}`);
  log(`  Action Log: /pulse/app/actions?project=${projectId}`);
  log(`  Remove it:  node scripts/verify-notes-13-14.mjs --teardown`);

  await vite.close();
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exitCode = 1;
});
