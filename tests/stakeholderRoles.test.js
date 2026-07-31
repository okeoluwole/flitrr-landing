import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROLE,
  PICKER_ROLES,
  ROLE_GROUPS,
  ROLE_LABELS,
  STAKEHOLDER_ROLES,
  isRetiredRole,
  roleLabel,
  roleOptionsFor,
} from '../app/pulse/app/components/stakeholderRoles.js';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';

/**
 * Note 3: the Parties role list at Step 5 Organisation.
 *
 * Sales Agent added, the single Consultant option broken into disciplines, and
 * the legacy flat value kept readable but retired from the picker.
 */

// The stakeholder_role values as they stood before this change. Every one of
// them must keep working, because Postgres cannot remove an enum value and a
// project set up earlier may hold any of them.
const PRE_EXISTING = [
  'developer',
  'funder',
  'project_manager',
  'consultant',
  'contractor',
  'other',
];

const NEW_DISCIPLINES = [
  ['architect', 'Architect'],
  ['quantity_surveyor', 'Quantity Surveyor'],
  ['structural_engineer', 'Structural Engineer'],
  ['services_mep_engineer', 'Services / MEP Engineer'],
  ['planning_consultant', 'Planning Consultant'],
  ['clerk_of_works', 'Clerk of Works'],
  ['other_consultant', 'Other consultant'],
];

describe('Sales Agent', () => {
  it('is in the list, with its settled label', () => {
    expect(PICKER_ROLES).toContain('sales_agent');
    expect(roleLabel('sales_agent')).toBe('Sales Agent');
  });

  // It leads the sales workstream that funds the build on the Nigeria off-plan
  // model, so it sits with the principals, not among the consultants.
  it('sits with the principals', () => {
    const principals = ROLE_GROUPS.find((g) => g.label === null);
    expect(principals.options.map((o) => o.value)).toContain('sales_agent');
  });
});

describe('the consultant disciplines', () => {
  it.each(NEW_DISCIPLINES)('offers %s as "%s"', (value, label) => {
    expect(PICKER_ROLES).toContain(value);
    expect(roleLabel(value)).toBe(label);
  });

  it('shows Project Manager among them without duplicating the existing value', () => {
    expect(roleLabel('project_manager')).toBe('Project Manager');
    const consultants = ROLE_GROUPS.find((g) => g.label === 'Consultants');
    expect(consultants.options.map((o) => o.value)).toContain('project_manager');
    // One value only: nothing new was minted for a role the type already had.
    expect(PICKER_ROLES.filter((v) => v === 'project_manager')).toHaveLength(1);
  });

  it('groups all eight disciplines together', () => {
    const consultants = ROLE_GROUPS.find((g) => g.label === 'Consultants');
    expect(consultants.options.map((o) => o.value)).toEqual([
      'architect',
      'quantity_surveyor',
      'structural_engineer',
      'services_mep_engineer',
      'planning_consultant',
      'project_manager',
      'clerk_of_works',
      'other_consultant',
    ]);
  });

  it('keeps every value in the snake_case convention of the type', () => {
    for (const value of PICKER_ROLES) {
      expect(value).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});

describe('the legacy consultant value', () => {
  it('is still readable', () => {
    expect(roleLabel('consultant')).toBe('Consultant (unspecified)');
    expect(ROLE_LABELS.consultant).toBe('Consultant (unspecified)');
  });

  it('is retired from the picker', () => {
    expect(isRetiredRole('consultant')).toBe(true);
    expect(PICKER_ROLES).not.toContain('consultant');
    for (const group of ROLE_GROUPS) {
      expect(group.options.map((o) => o.value)).not.toContain('consultant');
    }
  });

  // Opening the step must not silently reassign a row: the party keeps the value
  // it holds, shown for what it is, until someone decides otherwise.
  it('stays selectable on a party that already holds it', () => {
    const groups = roleOptionsFor('consultant');
    const flat = groups.flatMap((g) => g.options.map((o) => o.value));
    expect(flat).toContain('consultant');
    const legacyGroup = groups.find((g) => g.label === 'Needs reassignment');
    expect(legacyGroup.options).toEqual([
      { value: 'consultant', label: 'Consultant (unspecified)' },
    ]);
  });

  it('is absent for every party that does not hold it', () => {
    for (const value of PICKER_ROLES) {
      const flat = roleOptionsFor(value).flatMap((g) =>
        g.options.map((o) => o.value)
      );
      expect(flat).not.toContain('consultant');
    }
  });
});

describe('the mapping keyed on role, regression', () => {
  // Every value that existed before this change still resolves through the
  // mapping. Only the flat consultant's wording moved, and it moved on purpose.
  it('still labels every pre-existing value', () => {
    for (const value of PRE_EXISTING) {
      expect(roleLabel(value)).toBeTruthy();
    }
  });

  it('leaves the untouched pre-existing labels exactly as they were', () => {
    expect(roleLabel('developer')).toBe('Developer');
    expect(roleLabel('funder')).toBe('Funder');
    expect(roleLabel('contractor')).toBe('Contractor');
    expect(roleLabel('other')).toBe('Other');
  });

  // Two pre-existing labels moved, both on purpose: project_manager takes the
  // settled discipline casing, and the flat consultant is renamed so a row
  // holding it reads as awaiting reassignment. The stored values are untouched.
  it('changes only the two labels this note re-settled', () => {
    expect(roleLabel('project_manager')).toBe('Project Manager');
    expect(roleLabel('consultant')).toBe('Consultant (unspecified)');
  });

  it('keeps developer as the default a new party takes', () => {
    expect(DEFAULT_ROLE).toBe('developer');
    expect(DEFAULT_ROLE).toBe(STAKEHOLDER_ROLES.DEVELOPER);
  });

  it('returns null for an unrecognised value rather than a raw enum string', () => {
    expect(roleLabel('quantity_surveyer')).toBe(null);
    expect(roleLabel(null)).toBe(null);
    expect(roleLabel(undefined)).toBe(null);
  });

  it('labels every value it offers', () => {
    for (const value of PICKER_ROLES) {
      expect(typeof roleLabel(value)).toBe('string');
      expect(roleLabel(value).length).toBeGreaterThan(0);
    }
  });
});

describe("the Brief's Parties section", () => {
  const brief = (stakeholders) =>
    assembleBrief({
      def: { name: 'Lekki Court' },
      ctx: {},
      objectives: [],
      rankOrder: [],
      lists: {},
      gates: [],
      scope: null,
      org: {},
      stakeholders,
      financial: null,
    });

  // The evidence the granularity matters: a lender-facing document that calls
  // the architect, the QS, the engineer and the sales agent all "Consultant" is
  // the document the discipline split exists to prevent.
  it('renders the discipline, not "Consultant"', () => {
    const model = brief([
      { _key: 'k1', name: 'Adaeze Nwosu', role: 'architect' },
      { _key: 'k2', name: 'Tom Reilly', role: 'quantity_surveyor' },
      { _key: 'k3', name: 'Femi Bakare', role: 'structural_engineer' },
      { _key: 'k4', name: 'Grace Obi', role: 'sales_agent' },
    ]);

    expect(model.organisation.parties.map((p) => p.role)).toEqual([
      'Architect',
      'Quantity Surveyor',
      'Structural Engineer',
      'Sales Agent',
    ]);
    for (const party of model.organisation.parties) {
      expect(party.role).not.toBe('Consultant');
    }
  });

  it('renders a legacy row as needing reassignment', () => {
    const model = brief([
      { _key: 'k1', name: 'A party from before', role: 'consultant' },
    ]);
    expect(model.organisation.parties[0].role).toBe('Consultant (unspecified)');
  });

  it('renders every pre-existing role unchanged apart from the retired one', () => {
    const model = brief(
      PRE_EXISTING.map((role, i) => ({ _key: `k${i}`, name: `P${i}`, role }))
    );
    expect(model.organisation.parties.map((p) => p.role)).toEqual([
      'Developer',
      'Funder',
      'Project Manager',
      'Consultant (unspecified)',
      'Contractor',
      'Other',
    ]);
  });
});
