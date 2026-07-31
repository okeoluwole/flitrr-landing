/**
 * The party role domain (Note 3): the stakeholder_role values, their labels,
 * and which of them the picker still offers.
 *
 * Two problems the end-to-end test surfaced. Sales Agent was missing, and on
 * the Nigeria off-plan model the sales agent leads the sales workstream that
 * funds the build, so it is not an optional extra. And one flat Consultant
 * option collapsed the disciplines the Brief's Parties section relies on: the
 * architect, the quantity surveyor, the engineer and even the sales agent all
 * rendered as "Consultant", which is not a document a lender should be sent.
 *
 * So the single Consultant option is broken into disciplines. project_manager
 * already existed as a top-level value and is not duplicated; it is simply
 * shown among the disciplines it belongs with.
 *
 * The legacy `consultant` value stays. Postgres cannot remove an enum value, and
 * a project set up before this change may hold rows carrying it, so it keeps
 * working: it reads back, it renders, and it is never rewritten. It is retired
 * from the picker so no new party can take it, and it renders as
 * "Consultant (unspecified)" so an existing row reads as needing reassignment
 * rather than as a live choice.
 *
 * This module is the single source for the role vocabulary. The picker
 * (StepOrganisation) and the Brief's Parties section (briefModel) both read it,
 * so a role added here appears in both without either drifting.
 */

// The stakeholder_role enum values, in the order the picker offers them.
// Matches the live type after migration 035; adding a value here without adding
// it to the type would be rejected by the database on save.
export const STAKEHOLDER_ROLES = {
  DEVELOPER: 'developer',
  FUNDER: 'funder',
  SALES_AGENT: 'sales_agent',
  CONTRACTOR: 'contractor',
  ARCHITECT: 'architect',
  QUANTITY_SURVEYOR: 'quantity_surveyor',
  STRUCTURAL_ENGINEER: 'structural_engineer',
  SERVICES_MEP_ENGINEER: 'services_mep_engineer',
  PLANNING_CONSULTANT: 'planning_consultant',
  PROJECT_MANAGER: 'project_manager',
  CLERK_OF_WORKS: 'clerk_of_works',
  OTHER_CONSULTANT: 'other_consultant',
  OTHER: 'other',
  // Retired. Kept readable, never offered.
  LEGACY_CONSULTANT: 'consultant',
};

// The default role a freshly added party takes: developer, the one party every
// project has. Unchanged.
export const DEFAULT_ROLE = STAKEHOLDER_ROLES.DEVELOPER;

/**
 * Display labels, keyed by the stored enum value. The discipline labels are
 * settled copy and are used exactly as written.
 */
export const ROLE_LABELS = {
  developer: 'Developer',
  funder: 'Funder',
  sales_agent: 'Sales Agent',
  contractor: 'Contractor',
  architect: 'Architect',
  quantity_surveyor: 'Quantity Surveyor',
  structural_engineer: 'Structural Engineer',
  services_mep_engineer: 'Services / MEP Engineer',
  planning_consultant: 'Planning Consultant',
  project_manager: 'Project Manager',
  clerk_of_works: 'Clerk of Works',
  other_consultant: 'Other consultant',
  other: 'Other',
  // The retired value. Named so it reads as a row awaiting reassignment, not as
  // a choice anyone could have made today.
  consultant: 'Consultant (unspecified)',
};

/**
 * Values the picker no longer offers. They remain valid stored values and keep
 * their labels; they are simply not choosable for a new party.
 */
export const RETIRED_ROLES = new Set([STAKEHOLDER_ROLES.LEGACY_CONSULTANT]);

export function isRetiredRole(value) {
  return RETIRED_ROLES.has(value);
}

/**
 * The label for a stored role value, or null for an unrecognised one, so a
 * caller renders nothing rather than a raw enum string.
 */
export function roleLabel(value) {
  return ROLE_LABELS[value] ?? null;
}

/**
 * The picker's options, grouped. The principals sit at the top level; the
 * consultant disciplines sit under their own group, which is what replaced the
 * single Consultant option. Other closes the list as the general catch-all,
 * while "Other consultant" is the catch-all within the disciplines.
 *
 * Retired values are absent by construction, so no new record can take one.
 */
export const ROLE_GROUPS = [
  {
    label: null,
    options: [
      STAKEHOLDER_ROLES.DEVELOPER,
      STAKEHOLDER_ROLES.FUNDER,
      STAKEHOLDER_ROLES.SALES_AGENT,
      STAKEHOLDER_ROLES.CONTRACTOR,
    ],
  },
  {
    label: 'Consultants',
    options: [
      STAKEHOLDER_ROLES.ARCHITECT,
      STAKEHOLDER_ROLES.QUANTITY_SURVEYOR,
      STAKEHOLDER_ROLES.STRUCTURAL_ENGINEER,
      STAKEHOLDER_ROLES.SERVICES_MEP_ENGINEER,
      STAKEHOLDER_ROLES.PLANNING_CONSULTANT,
      STAKEHOLDER_ROLES.PROJECT_MANAGER,
      STAKEHOLDER_ROLES.CLERK_OF_WORKS,
      STAKEHOLDER_ROLES.OTHER_CONSULTANT,
    ],
  },
  {
    label: null,
    options: [STAKEHOLDER_ROLES.OTHER],
  },
].map((g) => ({
  label: g.label,
  options: g.options.map((value) => ({ value, label: ROLE_LABELS[value] })),
}));

/**
 * The flat list of choosable values, in picker order.
 */
export const PICKER_ROLES = ROLE_GROUPS.flatMap((g) =>
  g.options.map((o) => o.value)
);

/**
 * The options a party's select renders, given the role that party currently
 * holds. A party still carrying a retired value keeps it visible and selected,
 * appended as its own group, so the row reads honestly and is not silently
 * reassigned by the act of opening the step. Every other party sees the
 * standard groups only.
 */
export function roleOptionsFor(currentValue) {
  if (!isRetiredRole(currentValue)) return ROLE_GROUPS;
  return [
    ...ROLE_GROUPS,
    {
      label: 'Needs reassignment',
      options: [{ value: currentValue, label: ROLE_LABELS[currentValue] }],
    },
  ];
}
