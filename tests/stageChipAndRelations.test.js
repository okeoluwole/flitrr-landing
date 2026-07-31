import { describe, it, expect } from 'vitest';
import {
  STAGE_NAMES,
  STAGE_ORDER,
  stageLabel,
  stageName,
} from '../lib/engine/stageNames.js';
import { assembleBrief, criticalFlag } from '../app/pulse/app/components/briefModel.js';
import { LIST_CONFIG } from '../app/pulse/app/components/listStepConfig.js';
import { objectiveRelation } from '../app/pulse/app/actions/actionModel.js';

/**
 * Note 7's relabel line and Note 8's status chip.
 *
 * The chip named a count ("Stage 1 of 8") over a framework that numbers its
 * stages 0 to 7, and the objective link said "Serves objective" on a risk card
 * whose own intro said the risk threatens its objective. Both are label changes:
 * nothing about what a field links to, or how criticality derives from it,
 * moves here.
 */

// The framework's own stage names (the Eight Stage Mandates), verbatim.
const FRAMEWORK_STAGES = [
  [0, 'Land and Site Acquisition'],
  [1, 'Project Objectives and Funding'],
  [2, 'Consultant Appointment'],
  [3, 'Design and Planning Approvals'],
  [4, 'Contractor Procurement'],
  [5, 'Construction'],
  [6, 'Completion and Handover'],
  [7, 'Sales and Disposal'],
];

describe('the stage chip string, for each of the eight stages', () => {
  it.each(FRAMEWORK_STAGES)('reads "Stage %i: %s"', (stage, name) => {
    expect(stageLabel(stage)).toBe(`Stage ${stage}: ${name}`);
  });

  it('never uses the "of 8" form', () => {
    for (const stage of STAGE_ORDER) {
      expect(stageLabel(stage)).not.toContain('of 8');
    }
  });

  it('keeps the framework numbering, 0 to 7', () => {
    expect(STAGE_ORDER).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Object.keys(STAGE_NAMES).map(Number).sort((a, b) => a - b)).toEqual(
      STAGE_ORDER
    );
  });

  it('uses the framework names verbatim', () => {
    for (const [stage, name] of FRAMEWORK_STAGES) {
      expect(stageName(stage)).toBe(name);
    }
  });

  it('falls back to the bare number outside the eight, and to null on junk', () => {
    expect(stageLabel(8)).toBe('Stage 8');
    expect(stageLabel(-1)).toBe('Stage -1');
    expect(stageLabel('3')).toBe('Stage 3: Design and Planning Approvals');
    expect(stageLabel('later')).toBe(null);
    expect(stageName(8)).toBe(null);
  });

  // Number(null) and Number('') are both 0, so an absent stage must be rejected
  // before the coercion or it labels itself Stage 0 and looks entirely correct.
  it('reads an absent stage as unreadable, never as Stage 0', () => {
    expect(stageLabel(null)).toBe(null);
    expect(stageLabel(undefined)).toBe(null);
    expect(stageLabel('')).toBe(null);
  });
});

describe("the Brief's stage chip", () => {
  const model = assembleBrief({
    def: { name: 'Lekki Court' },
    ctx: {},
    objectives: [],
    rankOrder: [],
    lists: {},
    gates: [],
  });

  // The Project Brief is Stage 1's own produce, so the chip names that stage.
  // It reads its stage from exactly where it always did; only the form changed.
  it('names Stage 1 by number and name', () => {
    expect(model.identity.stageLabel).toBe(
      'Stage 1: Project Objectives and Funding'
    );
  });

  it('drops the "of 8" form', () => {
    expect(model.identity.stageLabel).not.toContain('of 8');
  });
});

describe('the objective link label on the capture cards', () => {
  it('reads "Threatens objective" on risks', () => {
    expect(LIST_CONFIG.risks.linkLabel).toBe('Threatens objective');
  });

  it.each(['assumptions', 'constraints', 'dependencies'])(
    'reads "Bears on objective" on %s',
    (key) => {
      expect(LIST_CONFIG[key].linkLabel).toBe('Bears on objective');
    }
  );

  // Workstreams and milestones genuinely serve their objective, so their label
  // is untouched. The vocabulary distinguishes; it does not flatten the other
  // way.
  it.each(['workstreams', 'milestones'])(
    'leaves "Serves objective" on %s',
    (key) => {
      expect(LIST_CONFIG[key].linkLabel).toBe('Serves objective');
    }
  );

  it('gives every list a label', () => {
    for (const cfg of Object.values(LIST_CONFIG)) {
      expect(typeof cfg.linkLabel).toBe('string');
    }
  });

  // The label is the only thing that moved. What the field links to, and the
  // criticality derived from it, are Session D's and are enforced at the
  // database.
  it('changes nothing else about the risk card', () => {
    expect(LIST_CONFIG.risks.table).toBe('project_risks');
    expect(LIST_CONFIG.risks.captureBasis).toBe(true);
    expect(LIST_CONFIG.risks.requiredField).toBe('description');
  });
});

describe('the residual "vs" form in the Brief', () => {
  it('says a risk threatens its objective', () => {
    expect(criticalFlag('risk', 'Cost')).toBe('Critical, threatens Cost');
  });

  it.each(['assumption', 'constraint', 'dependency'])(
    'says a %s bears on its objective',
    (kind) => {
      expect(criticalFlag(kind, 'Cost')).toBe('Critical, bears on Cost');
    }
  );

  it('never renders the "vs" form', () => {
    for (const kind of ['risk', 'assumption', 'constraint', 'dependency']) {
      expect(criticalFlag(kind, 'Cost')).not.toContain('vs ');
    }
  });

  // An unlinked item has no relationship to state, so the flag reads plainly
  // rather than inventing one.
  it('reads plainly when nothing is linked', () => {
    expect(criticalFlag('risk', null)).toBe('Critical');
    expect(criticalFlag('assumption', undefined)).toBe('Critical');
  });

  // One vocabulary across the product: the Brief cannot drift from the Action
  // Log and the Risk register, because it builds on their verb.
  it('speaks the vocabulary the Action Log already delivered', () => {
    for (const kind of ['risk', 'assumption', 'constraint', 'dependency']) {
      expect(criticalFlag(kind, 'Cost')).toBe(
        `Critical, ${objectiveRelation(kind, 'Cost')}`
      );
    }
  });
});
