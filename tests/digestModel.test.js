import { describe, it, expect } from 'vitest';
import {
  isDigestAction,
  digestRunKey,
  filterRecipients,
  buildUserDigest,
} from '../lib/digest/digestModel.js';
import {
  DIGEST_SUBJECT,
  buildDigestHtml,
  buildDigestText,
} from '../lib/digest/digestEmail.js';

/**
 * Part B (M7.3, made proportional in A6) pure logic: the live notification
 * rule (open must-hold tracked actions, by the linked objective and any
 * override), grouping with the gate framing, recipients, the run key, and the
 * email builders.
 */

function action(overrides = {}) {
  return {
    id: 'a1',
    project_id: 'p1',
    description: 'Confirm PI insurance for the architect',
    linked_objective_id: 'obj-quality',
    criticality_override: null,
    status: 'to_do',
    stage: 2,
    created_at: '2026-06-01T10:00:00+00:00',
    ...overrides,
  };
}

// Quality is non-negotiable (a linked action is live must-hold), Cost is
// flexible (a linked action is not). name is the display name.
const OBJECTIVES_BY_ID = {
  'obj-quality': { classification: 'non_negotiable', name: 'Quality' },
  'obj-cost': { classification: 'flexible', name: 'Cost' },
};

const PROJECTS = [
  { id: 'p1', name: 'Riverside Mews', user_id: 'u1', current_stage: 2 },
  { id: 'p2', name: 'Acre Lane Yard', user_id: 'u1', current_stage: 2 },
];

describe('the live notification rule (A6)', () => {
  it('admits only open actions that are live must-hold', () => {
    expect(isDigestAction(action(), OBJECTIVES_BY_ID)).toBe(true);
    expect(isDigestAction(action({ status: 'doing' }), OBJECTIVES_BY_ID)).toBe(
      true
    );
    expect(isDigestAction(action({ status: 'done' }), OBJECTIVES_BY_ID)).toBe(
      false
    );
    // Linked to a flexible objective is not must-hold.
    expect(
      isDigestAction(action({ linked_objective_id: 'obj-cost' }), OBJECTIVES_BY_ID)
    ).toBe(false);
    // Unlinked is a governance gap, not must-hold.
    expect(
      isDigestAction(action({ linked_objective_id: null }), OBJECTIVES_BY_ID)
    ).toBe(false);
    // A downward override drops it from the digest.
    expect(
      isDigestAction(action({ criticality_override: 'standard' }), OBJECTIVES_BY_ID)
    ).toBe(false);
  });
});

describe('digest selection, grouping, and the gate framing', () => {
  it('groups live must-hold actions by project and drops quiet projects', () => {
    const actions = [
      action(),
      action({ id: 'a2', project_id: 'p1', status: 'done' }),
      // p2's only action is on a flexible objective, so p2 stays silent.
      action({ id: 'a3', project_id: 'p2', linked_objective_id: 'obj-cost' }),
    ];
    const digest = buildUserDigest(PROJECTS, actions, OBJECTIVES_BY_ID);
    expect(digest.totalCount).toBe(1);
    expect(digest.projects).toHaveLength(1);
    const p = digest.projects[0];
    expect(p.name).toBe('Riverside Mews');
    expect(p.actions[0]).toEqual({
      description: 'Confirm PI insurance for the architect',
      objectiveName: 'Quality',
    });
    // The gate framing (A6).
    expect(p.stage).toBe(2);
    expect(p.stageName).toBe('Consultant Appointment');
    expect(p.gateLabel).toBe('the gate into Stage 3');
    expect(p.gate).toEqual({ open: 1, critical: 1 });
  });

  it('returns an empty digest for a user with nothing must-hold', () => {
    const digest = buildUserDigest(
      PROJECTS,
      [action({ status: 'done' })],
      OBJECTIVES_BY_ID
    );
    expect(digest.totalCount).toBe(0);
    expect(digest.projects).toHaveLength(0);
  });

  it('excludes an unlinked action (a governance gap, not must-hold)', () => {
    const digest = buildUserDigest(
      PROJECTS,
      [action({ linked_objective_id: null })],
      OBJECTIVES_BY_ID
    );
    expect(digest.totalCount).toBe(0);
  });

  it('orders projects by name, and oldest first within a project at one stage', () => {
    const actions = [
      action({
        id: 'newer',
        project_id: 'p1',
        created_at: '2026-06-05T10:00:00+00:00',
      }),
      action({
        id: 'older',
        project_id: 'p1',
        description: 'Appoint the quantity surveyor',
        created_at: '2026-06-01T09:00:00+00:00',
      }),
      action({ id: 'other', project_id: 'p2' }),
    ];
    const digest = buildUserDigest(PROJECTS, actions, OBJECTIVES_BY_ID);
    expect(digest.projects.map((p) => p.name)).toEqual([
      'Acre Lane Yard',
      'Riverside Mews',
    ]);
    expect(digest.projects[1].actions[0].description).toBe(
      'Appoint the quantity surveyor'
    );
  });

  it('leads with the gate-bearing action ahead of an off-stage one, regardless of age', () => {
    const actions = [
      action({
        id: 'off',
        project_id: 'p1',
        description: 'Earlier-stage carryover',
        stage: 1,
        created_at: '2026-05-01T10:00:00+00:00',
      }),
      action({
        id: 'on',
        project_id: 'p1',
        description: 'This stage',
        stage: 2,
        created_at: '2026-06-10T10:00:00+00:00',
      }),
    ];
    const digest = buildUserDigest(PROJECTS, actions, OBJECTIVES_BY_ID);
    expect(digest.projects[0].actions.map((a) => a.description)).toEqual([
      'This stage',
      'Earlier-stage carryover',
    ]);
    // The gate counts only the current-stage open action.
    expect(digest.projects[0].gate).toEqual({ open: 1, critical: 1 });
  });
});

describe('recipients', () => {
  const users = [
    { id: 'u1', email: 'a@example.com', digest_enabled: true },
    { id: 'u2', email: 'b@example.com', digest_enabled: false },
    { id: 'u3', email: 'c@example.com', digest_enabled: true },
  ];

  it('excludes digest_enabled false', () => {
    const ids = filterRecipients(users, new Set()).map((u) => u.id);
    expect(ids).toEqual(['u1', 'u3']);
  });

  it('excludes users already sent this run (double-send prevention)', () => {
    const ids = filterRecipients(users, new Set(['u1'])).map((u) => u.id);
    expect(ids).toEqual(['u3']);
  });
});

describe('the run key', () => {
  it('is the Monday of the UTC week, all week long', () => {
    const monday = Date.parse('2026-06-08T06:00:00Z');
    const thursday = Date.parse('2026-06-11T23:59:00Z');
    const sunday = Date.parse('2026-06-14T23:59:59Z');
    expect(digestRunKey(monday)).toBe('2026-06-08');
    expect(digestRunKey(thursday)).toBe('2026-06-08');
    expect(digestRunKey(sunday)).toBe('2026-06-08');
  });

  it('rolls to a new key the next Monday', () => {
    const nextMonday = Date.parse('2026-06-15T00:00:00Z');
    expect(digestRunKey(nextMonday)).toBe('2026-06-15');
  });
});

describe('the email builders', () => {
  const digest = buildUserDigest(PROJECTS, [action()], OBJECTIVES_BY_ID);
  const unsubscribeUrl = 'https://flitrr.com/api/unsubscribe?token=t';
  const appUrl = 'https://flitrr.com/pulse/app';

  it('has the deterministic subject', () => {
    expect(DIGEST_SUBJECT).toBe('PULSE: your critical actions this week');
  });

  it('renders the project, the gate line, the action, its objective, and the links', () => {
    const html = buildDigestHtml(digest, unsubscribeUrl, appUrl);
    expect(html).toContain('Riverside Mews');
    expect(html).toContain('Consultant Appointment');
    expect(html).toContain('the gate into Stage 3');
    expect(html).toContain('Confirm PI insurance for the architect');
    expect(html).toContain('for Quality');
    expect(html).toContain(unsubscribeUrl);
    expect(html).toContain(appUrl);
  });

  it('escapes user content in the HTML', () => {
    const sketchy = buildUserDigest(
      [{ id: 'p1', name: 'Riverside <Mews>', user_id: 'u1', current_stage: 2 }],
      [action({ description: 'Check & sign the "JCT" contract' })],
      OBJECTIVES_BY_ID
    );
    const html = buildDigestHtml(sketchy, unsubscribeUrl, appUrl);
    expect(html).toContain('Riverside &lt;Mews&gt;');
    expect(html).toContain('Check &amp; sign the &quot;JCT&quot; contract');
    expect(html).not.toContain('Riverside <Mews>');
  });

  it('contains no em or en dashes, per the copy rule', () => {
    const banned = new RegExp('[\\u2013\\u2014]');
    const html = buildDigestHtml(digest, unsubscribeUrl, appUrl);
    const text = buildDigestText(digest, unsubscribeUrl, appUrl);
    expect(html).not.toMatch(banned);
    expect(text).not.toMatch(banned);
  });

  it('mirrors the content in the plain-text part', () => {
    const text = buildDigestText(digest, unsubscribeUrl, appUrl);
    expect(text).toContain('RIVERSIDE MEWS');
    expect(text).toContain('the gate into Stage 3');
    expect(text).toContain(
      '- Confirm PI insurance for the architect (for Quality)'
    );
    expect(text).toContain(`Unsubscribe: ${unsubscribeUrl}`);
  });
});
