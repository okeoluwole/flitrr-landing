/**
 * The semantic mappings (Session K, Note 15 sub-step 1).
 *
 * Each mapping is a pure function from a domain value to design tokens. These
 * tests pin three promises: an unknown value fails loudly rather than falling
 * back to a default colour; every token a mapping names actually exists in
 * app/globals.css; and the mappings stay in lock-step with the engine
 * vocabularies and the labels the shipped surfaces already speak, so the
 * language cannot drift apart from the product it describes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  criticalityAppearance,
  objectiveStatusAppearance,
  severityBandAppearance,
  stageStateAppearance,
  programmeVarianceAppearance,
  scheduleBandAppearance,
  varianceDirectionAppearance,
  SEMANTIC_MAPPINGS,
} from '../lib/design/semantics.js';
import { CRITICALITY } from '../lib/engine/criticality.js';
import { LADDER_STATUSES } from '../lib/engine/objectiveLadder.js';
import { SEVERITY_BANDS, deriveSeverity } from '../lib/engine/severity.js';
import { STAGE_STATE } from '../lib/engine/stageStates.js';
import { VARIANCE_DIRECTIONS } from '../app/pulse/app/programme/scheduleModel.js';
import { LADDER_LABELS } from '../app/pulse/app/dashboard/dashboardRead.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS = readFileSync(path.join(HERE, '..', 'app', 'globals.css'), 'utf8');

/** Every custom property NAME defined anywhere in globals.css. */
const DEFINED_TOKENS = new Set(
  [...GLOBALS.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])
);

const ALL_FUNCTIONS = [
  { fn: criticalityAppearance, domain: 'criticality' },
  { fn: objectiveStatusAppearance, domain: 'objective status' },
  { fn: severityBandAppearance, domain: 'severity band' },
  { fn: stageStateAppearance, domain: 'stage state' },
  { fn: programmeVarianceAppearance, domain: 'programme variance' },
  { fn: scheduleBandAppearance, domain: 'schedule band' },
];

describe('unknown values fail loudly', () => {
  it.each(ALL_FUNCTIONS)('$domain throws on an unknown value', ({ fn }) => {
    expect(() => fn('nonsense')).toThrow(/Unknown .* value/);
    expect(() => fn(undefined)).toThrow(/Unknown/);
    expect(() => fn(null)).toThrow(/Unknown/);
    expect(() => fn('')).toThrow(/Unknown/);
  });

  it('the error names the domain and the legal values', () => {
    expect(() => objectiveStatusAppearance('ok')).toThrow(
      /objective status.*healthy.*compromised/s
    );
  });
});

describe('every mapping resolves every domain value to real tokens', () => {
  for (const mapping of SEMANTIC_MAPPINGS) {
    describe(mapping.name, () => {
      it('covers its values with complete, frozen appearances', () => {
        for (const value of mapping.values) {
          const a = mapping.appearance(value);
          expect(Object.isFrozen(a)).toBe(true);
          expect(a.label).toBeTruthy();
          expect(a.ink).toMatch(/^--app-/);
          expect(typeof a.weight).toBe('number');
          expect(a.shape).toBeTruthy();
        }
      });

      it('names only tokens that exist in globals.css', () => {
        for (const value of mapping.values) {
          const a = mapping.appearance(value);
          for (const token of [a.ink, a.fill, a.border]) {
            if (token != null) {
              expect(DEFINED_TOKENS.has(token), `${token} missing`).toBe(true);
            }
          }
        }
      });

      it('never lets colour carry the meaning alone: labels are distinct', () => {
        const labels = mapping.values.map((v) => mapping.appearance(v).label);
        expect(new Set(labels).size).toBe(labels.length);
      });
    });
  }
});

describe('the mappings stay in lock-step with the engine vocabularies', () => {
  it('criticality covers the engine vocabulary', () => {
    for (const value of Object.values(CRITICALITY)) {
      expect(() => criticalityAppearance(value)).not.toThrow();
    }
  });

  it('the ladder covers the engine vocabulary, with the shipped labels', () => {
    for (const status of Object.values(LADDER_STATUSES)) {
      const a = objectiveStatusAppearance(status);
      expect(a.label).toBe(LADDER_LABELS[status]);
    }
  });

  it('severity covers the engine bands, with the engine labels', () => {
    for (const band of SEVERITY_BANDS) {
      expect(severityBandAppearance(band.key).label).toBe(band.label);
    }
    const unscored = deriveSeverity(null, null);
    expect(severityBandAppearance(unscored.key).label).toBe(unscored.label);
  });

  it('stage state covers the engine vocabulary', () => {
    for (const state of Object.values(STAGE_STATE)) {
      expect(() => stageStateAppearance(state)).not.toThrow();
    }
  });

  it('variance direction covers the engine vocabulary, and only it', () => {
    // Sub-step 5 converted the tracker, so the pin that used to sit here
    // (a bare assertion that the vocabulary had not moved) is replaced by
    // the real lock-step: every direction the engine emits has an
    // appearance, and the mapping invents none the engine does not emit.
    // The tracker's variance cell shows five rungs; the other two are the
    // schedule band's, taken first when a row is flagged, so this table is
    // deliberately three and must stay three.
    const engine = Object.values(VARIANCE_DIRECTIONS);
    for (const direction of engine) {
      expect(() => varianceDirectionAppearance(direction)).not.toThrow();
    }
    const mapped = SEMANTIC_MAPPINGS.find(
      (m) => m.id === 'variance-direction'
    );
    expect([...mapped.values].sort()).toEqual([...engine].sort());
  });

  it('the loud two rungs of the tracker ramp belong to the schedule band', () => {
    // The five-rung CSS ladder is two engine vocabularies composed, never a
    // five-value vocabulary of its own. This states the seam: a direction is
    // never allowed to spend a band's ink, so a later edit cannot quietly
    // move the watch band or the critical slip into the direction table.
    const bandInks = ['amber', 'red'].map((b) => scheduleBandAppearance(b).ink);
    for (const direction of Object.values(VARIANCE_DIRECTIONS)) {
      expect(
        bandInks,
        `${direction} must not spend a schedule band's ink`
      ).not.toContain(varianceDirectionAppearance(direction).ink);
    }
  });
});

describe('the colour discipline holds across the whole language', () => {
  const amberTokens = /--app-(signal|critical)/;
  const dangerTokens = /--app-danger/;
  const successTokens = /--app-success/;

  it('amber appears only where the value is live criticality', () => {
    const allowedAmber = new Set([
      'criticality:critical',
      'objective-status:at_risk',
      'objective-status:slipping',
      'schedule-band:red',
    ]);
    for (const mapping of SEMANTIC_MAPPINGS) {
      for (const value of mapping.values) {
        const a = mapping.appearance(value);
        const spendsAmber = [a.ink, a.fill, a.border].some(
          (t) => t != null && amberTokens.test(t)
        );
        const key = `${mapping.id}:${value}`;
        expect(
          spendsAmber,
          `${key} ${spendsAmber ? 'spends' : 'does not spend'} amber`
        ).toBe(allowedAmber.has(key));
      }
    }
  });

  it('danger red appears only on Compromised: breach, never exposure', () => {
    for (const mapping of SEMANTIC_MAPPINGS) {
      for (const value of mapping.values) {
        const a = mapping.appearance(value);
        const spendsDanger = [a.ink, a.fill, a.border].some(
          (t) => t != null && dangerTokens.test(t)
        );
        expect(spendsDanger, `${mapping.id}:${value}`).toBe(
          mapping.id === 'objective-status' && value === 'compromised'
        );
      }
    }
  });

  it('success green appears only on a recorded fact, never a status verdict', () => {
    // The rule (Note 15) is that green marks a recorded fact (met, ahead)
    // and never a status verdict. Until sub-step 5 no mapping had a value
    // that WAS a recorded fact, so this assertion could be a blanket ban and
    // still be right by accident. The tracker's variance direction brought
    // the first one: 'ahead' states an observed position, not a judgement
    // about it. So the assertion now takes the same shape as the amber
    // census above, an explicit allowed set, and still bites on every other
    // value in the language.
    const allowedSuccess = new Set(['variance-direction:ahead']);
    for (const mapping of SEMANTIC_MAPPINGS) {
      for (const value of mapping.values) {
        const a = mapping.appearance(value);
        const spendsSuccess = [a.ink, a.fill, a.border].some(
          (t) => t != null && successTokens.test(t)
        );
        const key = `${mapping.id}:${value}`;
        expect(
          spendsSuccess,
          `${key} ${spendsSuccess ? 'spends' : 'does not spend'} success green`
        ).toBe(allowedSuccess.has(key));
      }
    }
  });

  it('the two chip axes keep their shapes apart: pill vs tag', () => {
    for (const value of ['critical', 'standard', 'unlinked']) {
      expect(criticalityAppearance(value).shape).toBe('pill');
    }
    for (const value of ['serious', 'moderate', 'minor', 'unscored']) {
      expect(severityBandAppearance(value).shape).toBe('tag');
    }
  });
});
