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
 * Part B (M7.3) pure logic: the locked notification rule (open critical
 * tracked actions only), grouping, recipients (digest_enabled false
 * excluded, double-send prevention via the run key), and the email
 * builders.
 */

function action(overrides = {}) {
  return {
    id: 'a1',
    project_id: 'p1',
    description: 'Confirm PI insurance for the architect',
    linked_objective_id: 'obj-quality',
    criticality: 'critical',
    status: 'to_do',
    created_at: '2026-06-01T10:00:00+00:00',
    ...overrides,
  };
}

const PROJECTS = [
  { id: 'p1', name: 'Riverside Mews', user_id: 'u1' },
  { id: 'p2', name: 'Acre Lane Yard', user_id: 'u1' },
];

const NAMES = { 'obj-quality': 'Quality', 'obj-cost': 'Cost' };

describe('the locked notification rule', () => {
  it('admits only open critical tracked actions', () => {
    expect(isDigestAction(action())).toBe(true);
    expect(isDigestAction(action({ status: 'doing' }))).toBe(true);
    expect(isDigestAction(action({ status: 'done' }))).toBe(false);
    expect(isDigestAction(action({ criticality: 'standard' }))).toBe(false);
  });
});

describe('digest selection and grouping', () => {
  it('groups open critical actions by project and drops quiet projects', () => {
    const actions = [
      action(),
      action({ id: 'a2', project_id: 'p1', status: 'done' }),
      action({ id: 'a3', project_id: 'p2', criticality: 'standard' }),
    ];
    const digest = buildUserDigest(PROJECTS, actions, NAMES);
    expect(digest.totalCount).toBe(1);
    expect(digest.projects).toHaveLength(1);
    expect(digest.projects[0].name).toBe('Riverside Mews');
    expect(digest.projects[0].actions[0]).toEqual({
      description: 'Confirm PI insurance for the architect',
      objectiveName: 'Quality',
    });
  });

  it('returns an empty digest for a user with nothing to say', () => {
    const digest = buildUserDigest(
      PROJECTS,
      [action({ status: 'done' })],
      NAMES
    );
    expect(digest.totalCount).toBe(0);
    expect(digest.projects).toHaveLength(0);
  });

  it('orders projects by name and actions oldest first', () => {
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
    const digest = buildUserDigest(PROJECTS, actions, NAMES);
    expect(digest.projects.map((p) => p.name)).toEqual([
      'Acre Lane Yard',
      'Riverside Mews',
    ]);
    expect(digest.projects[1].actions[0].description).toBe(
      'Appoint the quantity surveyor'
    );
  });

  it('carries a null objective name for an unlinked action', () => {
    const digest = buildUserDigest(
      PROJECTS,
      [action({ linked_objective_id: null })],
      NAMES
    );
    expect(digest.projects[0].actions[0].objectiveName).toBeNull();
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
  const digest = buildUserDigest(PROJECTS, [action()], NAMES);
  const unsubscribeUrl = 'https://flitrr.com/api/unsubscribe?token=t';
  const appUrl = 'https://flitrr.com/pulse/app';

  it('has the deterministic subject', () => {
    expect(DIGEST_SUBJECT).toBe('PULSE: your critical actions this week');
  });

  it('renders the project, the action, its objective, and the links', () => {
    const html = buildDigestHtml(digest, unsubscribeUrl, appUrl);
    expect(html).toContain('Riverside Mews');
    expect(html).toContain('Confirm PI insurance for the architect');
    expect(html).toContain('for Quality');
    expect(html).toContain(unsubscribeUrl);
    expect(html).toContain(appUrl);
  });

  it('escapes user content in the HTML', () => {
    const sketchy = buildUserDigest(
      [{ id: 'p1', name: 'Riverside <Mews>', user_id: 'u1' }],
      [action({ description: 'Check & sign the "JCT" contract' })],
      NAMES
    );
    const html = buildDigestHtml(sketchy, unsubscribeUrl, appUrl);
    expect(html).toContain('Riverside &lt;Mews&gt;');
    expect(html).toContain('Check &amp; sign the &quot;JCT&quot; contract');
    expect(html).not.toContain('Riverside <Mews>');
  });

  it('contains no em or en dashes, per the copy rule', () => {
    // The two banned characters by code point (en dash, em dash), so this
    // file stays clean under its own rule.
    const banned = new RegExp('[\\u2013\\u2014]');
    const html = buildDigestHtml(digest, unsubscribeUrl, appUrl);
    const text = buildDigestText(digest, unsubscribeUrl, appUrl);
    expect(html).not.toMatch(banned);
    expect(text).not.toMatch(banned);
  });

  it('mirrors the content in the plain-text part', () => {
    const text = buildDigestText(digest, unsubscribeUrl, appUrl);
    expect(text).toContain('RIVERSIDE MEWS');
    expect(text).toContain(
      '- Confirm PI insurance for the architect (for Quality)'
    );
    expect(text).toContain(`Unsubscribe: ${unsubscribeUrl}`);
  });
});
