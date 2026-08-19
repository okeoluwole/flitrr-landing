import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

import {
  emptyProgrammeChoices,
  setMilestoneChoice,
  gateRowPatch,
} from '../app/pulse/app/components/programmeChoices.js';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';

/**
 * Page render smoke coverage (Session L).
 *
 * Renders every page route in the app and asserts only that the render does
 * not throw. Nothing about page content is asserted. This exists because a
 * green pure-logic suite plus a clean production build has never been
 * evidence that a page renders: no other test invokes a page, and a Next
 * build compiles a dynamic route without executing its render, which is how
 * the /pulse/app/actions ReferenceError (missing PageHeader import, repaired
 * in cde2d02) survived a 1,505 test green suite and a human review gate.
 *
 * Mechanism: a server page's default export is called with the searchParams
 * shape it expects, awaited, and the returned element is rendered to static
 * markup, with Next's real router contexts provided so client components in
 * the tree can call useRouter, usePathname, and useSearchParams the way they
 * do during real SSR. A client page ('use client') is rendered as an element
 * directly, since its hooks must run inside a React render. Next's redirect
 * control flow (NEXT_REDIRECT) is a legitimate outcome, not a crash.
 *
 * The one stubbed seam is the Supabase client factory, both faces of it:
 * lib/supabase/server createClient (every server page's data and session
 * read) and lib/supabase/client createClient (the browser client that client
 * components construct). Nothing else is stubbed: the engine register, the
 * store loaders, the sequence read, and every component render against the
 * fixture rows exactly as they do against live rows.
 */

/* ------------------------------------------------------------------ */
/* The stub seam: a fixture-backed Supabase client                     */
/* ------------------------------------------------------------------ */

// The fixture the mocked createClient reads. Set per test, before the route
// module runs.
let FX = null;

function makeFakeSupabase(fx) {
  const from = (table) => {
    let rows = (fx.tables[table] ?? []).slice();
    const api = {
      select: () => api,
      eq: (col, val) => {
        rows = rows.filter((r) => r[col] === val);
        return api;
      },
      is: (col, val) => {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return api;
      },
      in: (col, vals) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return api;
      },
      order: (col, opts = {}) => {
        const asc = opts.ascending !== false;
        rows = rows
          .slice()
          .sort(
            (a, b) =>
              (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1)
          );
        return api;
      },
      limit: (n) => {
        rows = rows.slice(0, n);
        return api;
      },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () =>
        rows.length > 0
          ? { data: rows[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      then: (resolve, reject) =>
        Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    };
    return api;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: fx.user ?? null }, error: null }),
    },
    from,
    rpc: async (name) => {
      const value = fx.rpc?.[name];
      return { data: value === undefined ? null : value, error: null };
    },
  };
}

vi.mock('../lib/supabase/server', () => ({
  createClient: async () => makeFakeSupabase(FX),
}));
vi.mock('../lib/supabase/client', () => ({
  createClient: () => makeFakeSupabase(FX),
}));

/* ------------------------------------------------------------------ */
/* Render harness                                                      */
/* ------------------------------------------------------------------ */

const STUB_ROUTER = {
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
};

function withNextContexts(element, { pathname = '/', search = '' } = {}) {
  return createElement(
    AppRouterContext.Provider,
    { value: STUB_ROUTER },
    createElement(
      PathnameContext.Provider,
      { value: pathname },
      createElement(
        SearchParamsContext.Provider,
        { value: new URLSearchParams(search) },
        element
      )
    )
  );
}

function isNextRedirect(err) {
  return (
    err != null &&
    typeof err.digest === 'string' &&
    err.digest.startsWith('NEXT_REDIRECT')
  );
}

/**
 * Render one route in one state. Returns { redirected } when the page issued
 * Next's redirect control flow, or { html } when it rendered. Throws (failing
 * the test) on any real render error.
 */
async function renderRoute(importer, { searchParams = {}, pathname, search } = {}) {
  const mod = await importer();
  const Page = mod.default;

  // An async default export is a server page: call it for its element. A sync
  // default export (the 'use client' pages plus the static legal pages) must
  // be rendered as an element so any hooks run inside a React render.
  let element;
  if (Page.constructor.name === 'AsyncFunction') {
    try {
      element = await Page({ searchParams });
    } catch (err) {
      if (isNextRedirect(err)) return { redirected: true };
      throw err;
    }
  } else {
    element = createElement(Page, { searchParams });
  }

  try {
    const html = renderToStaticMarkup(
      withNextContexts(element, { pathname, search })
    );
    return { html };
  } catch (err) {
    if (isNextRedirect(err)) return { redirected: true };
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures: one project world built through the real engines          */
/* ------------------------------------------------------------------ */

const USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'dev@flitrr.com' };
const PROJECT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_ID = 'org-1';
const NOW_ISO = '2026-07-01T09:00:00.000Z';

const START = '2026-01-05';
const TARGET = '2028-10-19';

// Dated choices for every gate and all but one headline milestone, the same
// walkthrough world the single-source suite locks (first_exchange stays
// undated on purpose, the Critical undated point).
const GATE_DATES = {
  0: '2026-03-30',
  1: '2026-05-25',
  2: '2026-07-06',
  3: '2027-02-01',
  4: '2027-04-26',
  5: '2028-04-24',
  6: '2028-06-05',
  7: '2028-10-19',
};
const MILESTONE_DATES = {
  heads_of_terms: '2026-02-16',
  finance_committed: '2026-05-11',
  lead_consultant: '2026-06-22',
  planning_validated: '2026-10-12',
  tenders_returned: '2027-03-29',
  superstructure: '2027-10-25',
  finishing: '2028-03-01',
  completion_certificate: '2028-05-22',
};

const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'non_negotiable' },
];

function wizardGates() {
  let stages = emptyProgrammeChoices().stages.map((s) => ({
    ...s,
    target_date: GATE_DATES[s.stage] ?? '',
  }));
  const stageByMilestone = {};
  for (const stage of PROGRAMME_TEMPLATE.stages) {
    for (const m of stageMilestones(stage)) stageByMilestone[m.key] = stage.stage;
  }
  for (const [key, date] of Object.entries(MILESTONE_DATES)) {
    const idx = stages.findIndex((s) => s.stage === stageByMilestone[key]);
    stages[idx] = setMilestoneChoice(stages[idx], key, { target_date: date });
  }
  return stages;
}

const GATES = wizardGates();
const CHOICES = { stages: GATES };

// The assembled v1, then round-tripped through JSON exactly as the database
// stores and returns it (dates become ISO strings), so pages read the same
// shape they read in production.
const V1_STORED = JSON.parse(
  JSON.stringify(assembleProgramme(START, PROGRAMME_TEMPLATE, CHOICES, [], OBJECTIVES))
);

// The locked Brief snapshot, from the same record set through the real model.
const BRIEF_CONTENT = JSON.parse(
  JSON.stringify(
    assembleBrief({
      def: {
        name: 'Smoke Development',
        project_type: 'residential',
        currency: 'GBP',
        start_date: START,
        target_completion_date: TARGET,
      },
      ctx: {},
      objectives: OBJECTIVES,
      lists: {
        milestones: [],
        workstreams: [],
        risks: [],
        assumptions: [],
        constraints: [],
        dependencies: [],
      },
      gates: GATES,
    })
  )
);

const PROFILE = { id: USER.id, full_name: 'Olu Oke', email: USER.email };

function projectRow(overrides = {}) {
  return {
    id: PROJECT_ID,
    name: 'Smoke Development',
    status: 'active',
    current_stage: 1,
    entry_stage: 1,
    country: 'uk',
    start_date: START,
    target_completion_date: TARGET,
    funding_structure: 'Debt and equity',
    project_type: 'residential',
    currency: 'GBP',
    created_by: USER.id,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    archived_at: null,
    archived_by: null,
    ...overrides,
  };
}

function gateRows({ gatePassed = false } = {}) {
  return GATES.map((s) => ({
    id: `gate-${s.stage}`,
    project_id: PROJECT_ID,
    stage: s.stage,
    gate_status: gatePassed && s.stage === 1 ? 'passed' : 'pending',
    passed_at: gatePassed && s.stage === 1 ? NOW_ISO : null,
    decided_by: gatePassed && s.stage === 1 ? USER.id : null,
    over_constraint_acknowledged: false,
    ...gateRowPatch(s),
  }));
}

function baselineRow() {
  return {
    id: 'baseline-1',
    project_id: PROJECT_ID,
    version: 1,
    source_brief_id: 'brief-1',
    locked_by: USER.id,
    locked_at: NOW_ISO,
    programme: V1_STORED,
    rebaseline_reason: null,
    superseded_at: null,
    created_at: NOW_ISO,
  };
}

function moduleRows() {
  const raid = (id, table) => ({
    id,
    project_id: PROJECT_ID,
    description: `A recorded ${table} item for the smoke world.`,
    linked_objective_id: 'o-cost',
    criticality: 'critical',
    updated_at: NOW_ISO,
    created_at: NOW_ISO,
  });
  return {
    project_risks: [
      {
        id: 'risk-1',
        project_id: PROJECT_ID,
        description: 'Planning consent is delayed beyond the window.',
        linked_objective_id: 'o-time',
        criticality: 'critical',
        likelihood: 3,
        impact: 4,
        status: 'open',
        last_reviewed_at: NOW_ISO,
        response_note: 'Reviewed weekly with the planning consultant.',
        source: null,
        source_id: null,
        updated_at: NOW_ISO,
        created_at: NOW_ISO,
      },
      {
        id: 'risk-2',
        project_id: PROJECT_ID,
        description: 'Ground conditions differ from the desk study.',
        linked_objective_id: 'o-scope',
        criticality: 'standard',
        likelihood: 2,
        impact: 2,
        status: 'open',
        last_reviewed_at: null,
        response_note: null,
        source: null,
        source_id: null,
        updated_at: NOW_ISO,
        created_at: NOW_ISO,
      },
    ],
    project_actions: [
      {
        id: 'action-1',
        project_id: PROJECT_ID,
        description: 'Confirm the facility drawdown schedule with the lender.',
        linked_objective_id: 'o-funding',
        criticality: 'critical',
        criticality_override: null,
        override_reason: null,
        stage: 1,
        reason: null,
        outcome: null,
        variance: null,
        status: 'to_do',
        note: null,
        source: null,
        source_id: null,
        created_at: NOW_ISO,
      },
    ],
    project_assumptions: [raid('assumption-1', 'assumption')],
    project_constraints: [raid('constraint-1', 'constraint')],
    project_dependencies: [raid('dependency-1', 'dependency')],
    project_risk_events: [
      {
        id: 'event-1',
        project_id: PROJECT_ID,
        risk_id: 'risk-1',
        event_type: 'impact_changed',
        from_value: '3',
        to_value: '4',
        occurred_at: NOW_ISO,
        actor_id: USER.id,
      },
    ],
    playbook_plays: [
      {
        id: 'play-action-1',
        slug: 'confirm-funding-drawdown',
        type: 'action',
        stage: 1,
        title: 'Confirm the drawdown conditions',
        why: 'Funding certainty is the stage gate question.',
        objective: 'funding',
        always_critical: false,
      },
      {
        id: 'play-risk-1',
        slug: 'planning-window-risk',
        type: 'risk',
        stage: 1,
        title: 'Planning determination overruns',
        why: 'The statutory window is outside your control.',
        objective: 'time',
        always_critical: false,
      },
    ],
    project_playbook_state: [],
    project_triage_decisions: [],
  };
}

/**
 * Build one fixture world. Options pick the state:
 *   signedIn      false renders every authed route's redirect path
 *   admin         false is the member (read-only) viewer
 *   briefLocked   the Brief lock, the first of the two locks
 *   baseline      the operational baseline lock, the second
 *   gatePassed    the Gate 1 to 2 decision recorded as passed
 *   currentStage  projects.current_stage
 *   populated     false empties every module table (the empty state)
 *   actuals       adds a met milestone row to the actuals store
 *   schemes       adds saved STACK schemes to the organisation's store
 *   membership    'active' | 'deactivated' | 'none' (access-deactivated)
 *   products      false empties the launcher's product access
 *   project       false removes the project row (the not-found path)
 *   archived      adds a second, archived project row (the shelf render)
 */
function world(opts = {}) {
  const {
    signedIn = true,
    admin = true,
    briefLocked = false,
    baseline = false,
    gatePassed = false,
    currentStage = 1,
    entryStage = 1,
    populated = true,
    actuals = false,
    schemes = false,
    membership = 'active',
    products = true,
    project = true,
    archived = false,
    startDate = START,
  } = opts;

  const tables = {
    profiles: [PROFILE],
    projects: [
      ...(project
        ? [projectRow({ current_stage: currentStage, entry_stage: entryStage, start_date: startDate })]
        : []),
      ...(archived
        ? [
            projectRow({
              id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              name: 'Shelved Development',
              status: 'archived',
              archived_at: NOW_ISO,
              archived_by: USER.id,
            }),
          ]
        : []),
    ],
    project_briefs: [
      {
        id: 'brief-1',
        project_id: PROJECT_ID,
        version: 1,
        is_locked: briefLocked,
        content: BRIEF_CONTENT,
        generated_at: NOW_ISO,
      },
    ],
    project_objectives: OBJECTIVES.map((o) => ({ ...o, project_id: PROJECT_ID })),
    project_stage_gates: gateRows({ gatePassed }),
    programme_baselines: baseline ? [baselineRow()] : [],
    programme_milestone_actuals: actuals
      ? [
          {
            id: 'actual-1',
            project_id: PROJECT_ID,
            milestone_key: 'heads_of_terms',
            met_date: '2026-02-16',
            recorded_by: USER.id,
            recorded_at: NOW_ISO,
            updated_at: NOW_ISO,
          },
        ]
      : [],
    project_budget: [
      { project_id: PROJECT_ID, funding_structure_type: 'debt_equity' },
    ],
    // The two live products (038), so the launcher renders both cards and
    // its lifecycle sort (STACK before PULSE) is exercised by the render.
    product_access: products
      ? [
          {
            user_id: USER.id,
            granted_at: NOW_ISO,
            granted_by: null,
            products: {
              slug: 'pulse',
              name: 'PULSE',
              description: 'Project delivery and programme management.',
              status: 'live',
            },
          },
          {
            user_id: USER.id,
            granted_at: NOW_ISO,
            granted_by: null,
            products: {
              slug: 'stack',
              name: 'STACK',
              description: 'Feasibility, budgets and funding.',
              status: 'live',
            },
          },
        ]
      : [],
    organisations: [{ id: ORG_ID, name: 'Flitrr Dev', seat_limit: 5 }],
    pending_invitations: [
      { id: 'invite-1', email: 'new@flitrr.com', created_at: NOW_ISO, status: 'pending' },
    ],
    organisation_members:
      membership === 'none'
        ? []
        : [
            {
              user_id: USER.id,
              organisation_id: ORG_ID,
              deactivated_at: membership === 'deactivated' ? NOW_ISO : null,
            },
          ],
    // Saved STACK schemes when the option asks for them. The list surface
    // reads newest first (updated_at DESC), so the two rows exercise the
    // ordering as well as the render. The first is linked to the world's
    // project (the 039 spine attachment: project_id plus the embedded
    // projects(name) the join returns), the second unlinked, so both the
    // linked meta line and the plain one render.
    stack_schemes: schemes
      ? [
          {
            id: 'scheme-1',
            organisation_id: ORG_ID,
            name: 'Eko Pods JV base case',
            engine_version: '1.0.0',
            created_at: NOW_ISO,
            updated_at: NOW_ISO,
            project_id: PROJECT_ID,
            projects: { name: 'Smoke Development' },
          },
          {
            id: 'scheme-2',
            organisation_id: ORG_ID,
            name: 'Eko Pods self funded',
            engine_version: '1.0.0',
            created_at: '2026-06-20T09:00:00.000Z',
            updated_at: '2026-06-20T09:00:00.000Z',
            project_id: null,
            projects: null,
          },
        ]
      : [],
    ...(populated
      ? moduleRows()
      : {
          project_risks: [],
          project_actions: [],
          project_assumptions: [],
          project_constraints: [],
          project_dependencies: [],
          project_risk_events: [],
          playbook_plays: [],
          project_playbook_state: [],
          project_triage_decisions: [],
        }),
  };

  return {
    user: signedIn ? USER : null,
    tables,
    rpc: {
      is_organisation_admin: admin,
      organisation_admin_contact: 'Olu Oke',
      current_user_organisation_id: ORG_ID,
      team_members: [
        {
          user_id: USER.id,
          full_name: 'Olu Oke',
          email: USER.email,
          role: 'admin',
          deactivated_at: null,
        },
        {
          user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          full_name: 'Gbenga Ade',
          email: 'gbenga@flitrr.com',
          role: 'member',
          deactivated_at: null,
        },
      ],
    },
  };
}

// The two-lock, gate-passed Run world the three monitoring modules open in.
const RUN = { briefLocked: true, baseline: true, gatePassed: true, currentStage: 2 };

/* ------------------------------------------------------------------ */
/* The route census                                                    */
/* ------------------------------------------------------------------ */

const withProject = { searchParams: { project: PROJECT_ID } };

/**
 * Every page route in the app, each with the states it can legitimately be
 * in. Excluded from this table, with reasons:
 *   app/api/digest/route.js, app/api/team/invite/route.js,
 *   app/api/team/cancel-invite/route.js, app/api/unsubscribe/route.js,
 *   app/auth/callback/route.js
 *     Route handlers, not pages: they export GET/POST functions, not a
 *     rendered component, so there is no render path to smoke.
 *   app/layout.js, app/pulse/layout.js, app/stack/layout.js
 *     Layouts, not routes: the root layout also loads next/font, which only
 *     resolves inside the Next build, and none of them renders on its own.
 */
const ROUTES = [
  {
    route: '/',
    importer: () => import('../app/page.js'),
    states: [
      { name: 'signed out', fx: () => world({ signedIn: false }) },
      { name: 'signed in', fx: () => world() },
    ],
  },
  {
    route: '/pulse',
    importer: () => import('../app/pulse/page.js'),
    states: [
      { name: 'signed out', fx: () => world({ signedIn: false }) },
      { name: 'signed in', fx: () => world() },
    ],
  },
  {
    route: '/stack',
    importer: () => import('../app/stack/page.js'),
    states: [
      { name: 'signed out', fx: () => world({ signedIn: false }) },
      { name: 'signed in', fx: () => world() },
    ],
  },
  {
    route: '/framework',
    importer: () => import('../app/framework/page.js'),
    states: [
      { name: 'signed out', fx: () => world({ signedIn: false }) },
      { name: 'signed in', fx: () => world() },
    ],
  },
  {
    route: '/privacy',
    importer: () => import('../app/privacy/page.js'),
    states: [{ name: 'static', fx: () => world({ signedIn: false }) }],
  },
  {
    route: '/terms',
    importer: () => import('../app/terms/page.js'),
    states: [{ name: 'static', fx: () => world({ signedIn: false }) }],
  },
  {
    route: '/login',
    importer: () => import('../app/login/page.js'),
    states: [
      { name: 'initial', fx: () => world({ signedIn: false }) },
      {
        name: 'reset success banner',
        fx: () => world({ signedIn: false }),
        search: 'reset=success',
      },
      {
        name: 'callback error banner',
        fx: () => world({ signedIn: false }),
        search: 'error=callback_failed',
      },
    ],
  },
  {
    route: '/forgot-password',
    importer: () => import('../app/forgot-password/page.js'),
    states: [{ name: 'initial', fx: () => world({ signedIn: false }) }],
  },
  {
    route: '/reset-password',
    importer: () => import('../app/reset-password/page.js'),
    states: [{ name: 'initial', fx: () => world({ signedIn: false }) }],
  },
  {
    route: '/access-deactivated',
    importer: () => import('../app/access-deactivated/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'deactivated member', fx: () => world({ membership: 'deactivated' }) },
      { name: 'no membership', fx: () => world({ membership: 'none' }) },
      { name: 'active member (redirects)', redirects: true, fx: () => world() },
    ],
  },
  {
    route: '/dashboard',
    importer: () => import('../app/dashboard/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'products populated', fx: () => world() },
      { name: 'no products (empty)', fx: () => world({ products: false, admin: false }) },
    ],
  },
  {
    route: '/dashboard/team',
    importer: () => import('../app/dashboard/team/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'admin populated', fx: () => world() },
      { name: 'non-admin (redirects)', redirects: true, fx: () => world({ admin: false }) },
    ],
  },
  {
    route: '/pulse/app',
    importer: () => import('../app/pulse/app/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'admin with projects', fx: () => world() },
      { name: 'admin empty list', fx: () => world({ project: false }) },
      { name: 'member with projects', fx: () => world({ admin: false }) },
      { name: 'admin with the archived shelf', fx: () => world({ archived: true }) },
      { name: 'admin, everything archived', fx: () => world({ project: false, archived: true }) },
    ],
  },
  {
    route: '/pulse/app/initiate',
    importer: () => import('../app/pulse/app/initiate/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'fresh wizard, no project param', fx: () => world() },
      { name: 'resume draft', fx: () => world(), ...withProject },
      {
        name: 'locked re-entry',
        fx: () => world(RUN),
        ...withProject,
      },
      {
        name: 'member, locked brief',
        fx: () => world({ ...RUN, admin: false }),
        ...withProject,
      },
      {
        name: 'member, no locked brief (sparse)',
        fx: () => world({ admin: false }),
        ...withProject,
      },
      {
        name: 'missing project (redirects)',
        redirects: true,
        fx: () => world({ project: false }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/workspace',
    importer: () => import('../app/pulse/app/workspace/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      { name: 'define: brief open', fx: () => world(), ...withProject },
      {
        name: 'plan: set-up is the step',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      {
        name: 'plan: gate is the step',
        fx: () => world({ briefLocked: true, baseline: true }),
        ...withProject,
      },
      { name: 'run: bare open (redirects to dashboard)', redirects: true, fx: () => world(RUN), ...withProject },
      {
        name: 'run: view=workspace, populated',
        fx: () => world(RUN),
        searchParams: { project: PROJECT_ID, view: 'workspace' },
      },
      {
        name: 'run: view=workspace, empty modules',
        fx: () => world({ ...RUN, populated: false }),
        searchParams: { project: PROJECT_ID, view: 'workspace' },
      },
      {
        name: 'missing project (redirects)',
        redirects: true,
        fx: () => world({ project: false }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/actions',
    importer: () => import('../app/pulse/app/actions/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      {
        name: 'sequence locked',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      { name: 'open populated', fx: () => world(RUN), ...withProject },
      {
        name: 'open empty',
        fx: () => world({ ...RUN, populated: false }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/risk',
    importer: () => import('../app/pulse/app/risk/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      {
        name: 'sequence locked',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      { name: 'open populated', fx: () => world(RUN), ...withProject },
      {
        name: 'open empty',
        fx: () => world({ ...RUN, populated: false }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/dashboard',
    importer: () => import('../app/pulse/app/dashboard/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      {
        name: 'sequence locked',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      { name: 'open populated', fx: () => world(RUN), ...withProject },
      {
        name: 'open empty rows',
        fx: () => world({ ...RUN, populated: false }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/programme',
    importer: () => import('../app/pulse/app/programme/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      {
        name: 'no baseline (set-up pointer)',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      { name: 'tracking, no actuals', fx: () => world(RUN), ...withProject },
      {
        name: 'tracking, met milestone recorded',
        fx: () => world({ ...RUN, actuals: true }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/programme/setup',
    importer: () => import('../app/pulse/app/programme/setup/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      { name: 'brief not locked (pointer)', fx: () => world(), ...withProject },
      {
        name: 'locked, missing start date (pointer)',
        fx: () => world({ briefLocked: true, startDate: null }),
        ...withProject,
      },
      {
        name: 'fresh set-up',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      {
        name: 'already locked re-entry',
        fx: () => world({ briefLocked: true, baseline: true }),
        ...withProject,
      },
    ],
  },
  {
    route: '/pulse/app/gate',
    importer: () => import('../app/pulse/app/gate/page.js'),
    states: [
      { name: 'signed out (redirects)', redirects: true, fx: () => world({ signedIn: false }) },
      { name: 'no project param (redirects)', redirects: true, fx: () => world() },
      { name: 'brief not locked (pointer)', fx: () => world(), ...withProject },
      {
        name: 'locked, no baseline (pointer)',
        fx: () => world({ briefLocked: true }),
        ...withProject,
      },
      {
        name: 'ready, not yet passed',
        fx: () => world({ briefLocked: true, baseline: true }),
        ...withProject,
      },
      { name: 'already passed', fx: () => world(RUN), ...withProject },
      {
        name: 'mid-project adopter (redirects)',
        redirects: true,
        fx: () => world({ ...RUN, entryStage: 3, currentStage: 3 }),
        ...withProject,
      },
    ],
  },
  {
    // /stack/app has no redirect states: the auth gate is the middleware's
    // PROTECTED_PREFIXES entry, not a page-level check, so the page renders
    // for whoever reaches it and row level security holds the data line.
    route: '/stack/app',
    importer: () => import('../app/stack/app/page.js'),
    states: [
      { name: 'admin, saved schemes', fx: () => world({ schemes: true }) },
      { name: 'admin, empty store', fx: () => world() },
      {
        name: 'member (view only)',
        fx: () => world({ schemes: true, admin: false }),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* The suite                                                           */
/* ------------------------------------------------------------------ */

for (const { route, importer, states } of ROUTES) {
  describe(`page smoke: ${route}`, () => {
    for (const state of states) {
      it(`renders without throwing: ${state.name}`, async () => {
        FX = state.fx();
        const result = await renderRoute(importer, {
          searchParams: state.searchParams ?? {},
          pathname: route,
          search: state.search ?? '',
        });
        // The outcome type only, never the content: a state expected to
        // redirect must actually redirect, and a state expected to render
        // must actually produce markup, so a fixture mistake cannot silently
        // downgrade a deep render into a guard redirect.
        if (state.redirects) {
          expect(result.redirected).toBe(true);
        } else {
          expect(typeof result.html).toBe('string');
        }
      });
    }
  });
}
