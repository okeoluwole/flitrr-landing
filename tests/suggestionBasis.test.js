import { describe, it, expect } from 'vitest';
import {
  deriveProposals,
  playBasis,
  confirmedPlayCriticality,
  buildActionFromPlay,
  buildRiskFromPlay,
} from '../lib/playbook/playbookModel.js';
import { toStoredCriticality } from '../lib/engine/criticality.js';
import {
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
  deriveSeverity,
} from '../lib/engine/severity.js';
import { LIST_CONFIG } from '../app/pulse/app/components/listStepConfig.js';
import {
  LIKELIHOOD_OPTIONS as REGISTER_LIKELIHOOD,
  IMPACT_OPTIONS as REGISTER_IMPACT,
} from '../app/pulse/app/risk/riskModel.js';

/**
 * Notes 18.2, 18.3 and 19.3: a suggestion states its basis and wears no
 * criticality chip until the developer confirms the objective it serves.
 *
 * Notes 19.4: one scale, one vocabulary, across the Step 8 capture and the
 * register that reads the very same columns.
 */

// A project whose Cost is non-negotiable and Scope is flexible.
const objectivesByType = {
  cost: { id: 'obj-cost', classification: 'non_negotiable' },
  scope: { id: 'obj-scope', classification: 'flexible' },
  quality: { id: 'obj-quality', classification: 'flexible' },
};
const nameByType = { cost: 'Cost', scope: 'Scope', quality: 'Quality' };

const play = (over = {}) => ({
  id: 'play-1',
  slug: 'scope-and-fees-against-brief',
  type: 'action',
  stage: 2,
  title: 'Check every scope of services and fee against the Brief',
  why: 'A consultant scoped from their standard template will deliver their standard service.',
  objective: 'cost',
  always_critical: false,
  ...over,
});

const proposals = (plays) =>
  deriveProposals({
    plays,
    states: [],
    currentStage: 2,
    type: 'action',
    objectivesByType,
    nameByType,
  });

describe('a suggestion states the basis it was selected on', () => {
  it('names the stage and the objective classification that surfaced it', () => {
    const [p] = proposals([play()]);
    expect(p.basis).toBe(
      'Stage 2 playbook, selected because Cost is non-negotiable on this project.'
    );
  });

  it('says so plainly when a play applies to every project at the stage', () => {
    const [p] = proposals([play({ always_critical: true, objective: 'quality' })]);
    expect(p.basis).toBe(
      'Stage 2 playbook. It applies on every project at this stage.'
    );
  });

  it('claims no classification basis when the objective is flexible', () => {
    const [p] = proposals([play({ objective: 'scope' })]);
    expect(p.basis).toBe('Stage 2 playbook, for this stage of your project.');
    expect(p.basis).not.toContain('non-negotiable');
  });

  it('carries a basis on every proposal, without exception', () => {
    const all = proposals([
      play({ id: 'a' }),
      play({ id: 'b', objective: 'scope' }),
      play({ id: 'c', always_critical: true }),
    ]);
    expect(all).toHaveLength(3);
    for (const p of all) {
      expect(p.basis).toBeTruthy();
      expect(p.basis).toContain('Stage 2 playbook');
    }
  });

  it('surfaces the basis without changing the selection', () => {
    // Stage keying and the acted-on filter are untouched: a Stage 3 play does
    // not surface at Stage 2.
    expect(proposals([play({ stage: 3 })])).toHaveLength(0);
    expect(
      deriveProposals({
        plays: [play()],
        states: [{ play_id: 'play-1' }],
        currentStage: 2,
        type: 'action',
        objectivesByType,
        nameByType,
      })
    ).toHaveLength(0);
  });

  it('is written straight from the proposal, so a caller cannot desync it', () => {
    const [p] = proposals([play()]);
    expect(playBasis(p, objectivesByType)).toBe(p.basis);
  });
});

describe('criticality derives on Add, not before it', () => {
  const cascade = (id) =>
    toStoredCriticality(
      id,
      Object.fromEntries(
        Object.values(objectivesByType).map((o) => [o.id, o])
      )
    );

  // The chip a play used to wear was classifying an item that did not exist:
  // criticality derives from an objective link, and the developer had agreed
  // to none.
  it('derives standard while no objective is confirmed', () => {
    const [p] = proposals([play()]);
    expect(confirmedPlayCriticality(p, null, cascade)).toBe('standard');
    expect(confirmedPlayCriticality(p, '', cascade)).toBe('standard');
  });

  it('derives critical once a non-negotiable objective is confirmed', () => {
    const [p] = proposals([play()]);
    expect(confirmedPlayCriticality(p, 'obj-cost', cascade)).toBe('critical');
  });

  it('derives standard when the confirmed objective is flexible', () => {
    const [p] = proposals([play()]);
    expect(confirmedPlayCriticality(p, 'obj-scope', cascade)).toBe('standard');
  });

  // always_critical is the framework's own floor, set by the play rather than
  // by this project, so it holds whatever the link.
  it('holds an always-critical play at critical whatever the link', () => {
    const [p] = proposals([play({ always_critical: true })]);
    expect(confirmedPlayCriticality(p, null, cascade)).toBe('critical');
    expect(confirmedPlayCriticality(p, 'obj-scope', cascade)).toBe('critical');
  });

  it('writes the confirmed link and criticality onto the accepted action', () => {
    const [p] = proposals([play()]);
    const row = buildActionFromPlay(p, 'project-1', {
      linkedObjectiveId: 'obj-scope',
      criticality: 'standard',
    });
    expect(row.linked_objective_id).toBe('obj-scope');
    expect(row.criticality).toBe('standard');
  });

  it('writes the confirmed link and criticality onto the accepted risk', () => {
    const [p] = proposals([play()]);
    const row = buildRiskFromPlay(p, 'project-1', {
      linkedObjectiveId: null,
      criticality: 'standard',
    });
    expect(row.linked_objective_id).toBeNull();
    expect(row.criticality).toBe('standard');
    // And the risk records that it came from a play, not the Brief.
    expect(row.source).toBe('playbook');
    expect(row.source_id).toBe('play-1');
  });

  it('falls back to the play mapping when nothing was confirmed', () => {
    const [p] = proposals([play()]);
    const row = buildActionFromPlay(p, 'project-1');
    expect(row.linked_objective_id).toBe('obj-cost');
    expect(row.criticality).toBe('critical');
  });
});

describe('one scale, one vocabulary across Step 8 and the register', () => {
  const step8 = LIST_CONFIG.risks.fields;
  const likelihoodField = step8.find((f) => f.name === 'likelihood');
  const impactField = step8.find((f) => f.name === 'impact');

  // The capture said Low, Medium, High while the register that reads the very
  // same columns said Unlikely, Possible, Likely. Two vocabularies for one
  // stored scale left the developer to work out they were the same answer.
  it('gives Step 8 the register plain-language labels', () => {
    expect(likelihoodField.options.map((o) => o.label)).toEqual([
      'Unlikely',
      'Possible',
      'Likely',
    ]);
    expect(impactField.options.map((o) => o.label)).toEqual([
      'Limited',
      'Significant',
      'Severe',
    ]);
  });

  it('leaves Low, Medium and High nowhere in the capture', () => {
    for (const field of [likelihoodField, impactField]) {
      for (const label of field.options.map((o) => o.label)) {
        expect(['Low', 'Medium', 'High']).not.toContain(label);
      }
    }
  });

  it('reads the identical option objects the register reads', () => {
    expect(likelihoodField.options).toBe(LIKELIHOOD_OPTIONS);
    expect(impactField.options).toBe(IMPACT_OPTIONS);
    expect(REGISTER_LIKELIHOOD).toBe(LIKELIHOOD_OPTIONS);
    expect(REGISTER_IMPACT).toBe(IMPACT_OPTIONS);
  });

  it('stores the same risk_level values it always did', () => {
    expect(LIKELIHOOD_OPTIONS.map((o) => o.value)).toEqual([
      'low',
      'medium',
      'high',
    ]);
    expect(IMPACT_OPTIONS.map((o) => o.value)).toEqual([
      'low',
      'medium',
      'high',
    ]);
    expect(likelihoodField.default).toBe('medium');
    expect(impactField.default).toBe('medium');
  });

  it('leaves the severity derivation exactly as it was', () => {
    expect(deriveSeverity('medium', 'medium').label).toBe('Worth watching');
    expect(deriveSeverity('high', 'high').label).toBe('Serious');
    expect(deriveSeverity('low', 'low').label).toBe('Minor');
    expect(deriveSeverity(null, 'high').label).toBe('Not yet scored');
  });
});
