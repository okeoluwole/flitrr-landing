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
  criticalityMarkAppearance,
  onPaper,
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

describe('the paper register states its holes instead of hiding them', () => {
  /**
   * PAPER_COUNTERPART is the ONE place the instrument's --app-* register is
   * tied to the document's --doc-*, so a surface can never pick a paper
   * colour locally. It does not cover every token, and it should not: the
   * --doc-* register belongs to the document, and inventing a paper value
   * for a mapping no document renders would be picking a colour with
   * nothing to check it against.
   *
   * The hole is not the failure. A hole NOBODY CAN SEE is: onPaper throws
   * at the call site, so a mapping that cannot cross to paper looks exactly
   * like one that has simply never been asked to. Ten of the twenty six
   * appearances were in that state, and the two most recently found were
   * found by someone calling them by hand.
   *
   * This table is the record. It is held in both directions so it cannot
   * rot: an unlisted hole fails as a hole nobody stated, a listed hole that
   * has since been closed fails as a stale entry, and a listed hole whose
   * missing tokens have changed fails as a hole that moved. That is the
   * same discipline sub-step 6 gave CONVERTED and EXCLUDED.
   *
   * Every entry shares one root cause: the Brief renders criticality and
   * nothing else, so these are exactly the mappings no document has ever
   * shown. Close one by rendering it on paper first, then naming the
   * counterpart the document actually needs.
   */
  const STATED_HOLES = new Map([
    [
      'objective-status:at_risk',
      {
        missing: ['--app-signal-ink-dim', '--app-signal-border-dim'],
        why: 'The dimmed amber voice, one notch below Slipping at the same shape. The Brief renders no ladder, so no document has ever had to hold two amber rungs apart on paper, and the gap between a dim ochre and --doc-ochre is precisely the thing that cannot be guessed: too close and the ladder levels, too far and At risk reads as calm.',
      },
    ],
    [
      'objective-status:compromised',
      {
        missing: ['--app-danger', '--app-danger-wash', '--app-danger-border'],
        why: 'Breach red. The --doc-* register has no danger family at all, and the app red is tuned for a dark ground (the global navy red is illegible there, which is why --app-danger exists). A document red is a decision nobody has taken.',
      },
    ],
    [
      'severity-band:serious',
      {
        missing: ['--app-primary-ink'],
        why: 'The loud end of the severity ramp is ink INVERTED onto a bright fill, so its text colour is the console dark. On paper that inversion has no meaning: the fill would already be dark on light.',
      },
    ],
    [
      'severity-band:moderate',
      {
        missing: ['--app-fill-strong'],
        why: "A step on the translucent-light ramp: white at 14% over a dark ground. Over paper the same alpha reads as nothing at all. A paper intensity ramp has to be rebuilt against paper, not translated step by step.",
      },
    ],
    [
      'severity-band:minor',
      {
        missing: ['--app-fill'],
        why: 'The same ramp at 7%. Same reason as moderate: the ramp is a property of the dark ground, not a colour that can cross.',
      },
    ],
    [
      'stage-state:sequential',
      {
        missing: ['--app-surface-raised'],
        why: 'A stage bar seats on the raised panel surface. Paper has one surface and earns its depth from type and the drop shadow, never from a lifted fill, so the counterpart is a question about the document, not about this token.',
      },
    ],
    [
      'stage-state:concurrent',
      {
        missing: ['--app-fill'],
        why: 'The translucent-light ramp again. The dashed border is what carries "running beside", and that carrier crosses to paper already.',
      },
    ],
    [
      'stage-state:complete',
      {
        missing: ['--app-fill-faint', '--app-hairline'],
        why: 'The quiet past: the faintest fill on the ramp under the faintest line. Both are alphas over dark. The label carries the meaning, so a document could render this rung today with no fill at all.',
      },
    ],
    [
      'programme-variance:baseline',
      {
        missing: ['--app-surface-raised'],
        why: 'The chart series seat. The Brief renders no chart, so there is no document geometry for a series to sit in yet.',
      },
    ],
    [
      'variance-direction:ahead',
      {
        missing: ['--app-success'],
        why: 'Recorded-fact green. The --doc-* register has no green, and the one rule green must obey (a recorded fact, never a status verdict) is about WHEN it is spent, not what shade a document should spend.',
      },
    ],
  ]);

  /** Every --app-* token PAPER_COUNTERPART knows how to cross, read from
   *  the module's own source so this can never drift from the real table. */
  const COVERED = new Set(
    [
      ...readFileSync(
        path.join(HERE, '..', 'lib', 'design', 'semantics.js'),
        'utf8'
      )
        .match(/const PAPER_COUNTERPART = Object\.freeze\(\{([\s\S]*?)\}\);/)[1]
        .matchAll(/'(--app-[a-z0-9-]+)'\s*:/g),
    ].map((m) => m[1])
  );

  /** Every appearance in the language, including the criticality mark,
   *  which has its own paper export and sits outside SEMANTIC_MAPPINGS. */
  const EVERY_APPEARANCE = [
    ...SEMANTIC_MAPPINGS.flatMap((m) =>
      m.values.map((v) => [`${m.id}:${v}`, m.appearance(v)])
    ),
    ['criticality-mark:mark', criticalityMarkAppearance()],
  ];

  /**
   * The tokens onPaper translates.
   *
   * This list is deliberately a SECOND, hand-maintained copy of the one in
   * lib/design/semantics.js rather than an import of it. Importing would
   * make the module both the thing under test and the definition of what
   * counts as tested: a part dropped from onPaper would vanish from this
   * list at the same instant and every assertion below would still pass,
   * on a language that had quietly stopped crossing it. The copy is the
   * expectation; the module has to meet it. The pairing is held by the
   * assertion at the end of this block, which proves each part named here
   * really is translated rather than merely un-thrown.
   *
   * markFill joined the list when it was found missing. It had passed
   * through untranslated, so a paper appearance could still hand back an
   * --app-* mark colour: the glyph would keep its screen ink while the
   * label around it moved to --doc-*. Nothing hit it, because the only
   * marked appearance any document renders is the criticality mark, whose
   * colour travels as `fill`. That is why it never bit, not why it was
   * safe.
   */
  const CROSSING = ['ink', 'fill', 'border', 'markFill'];

  function holesIn(appearance) {
    return CROSSING.map((part) => appearance[part]).filter(
      (token) => token != null && !COVERED.has(token)
    );
  }

  it('finds a hole in exactly the appearances the table states', () => {
    const found = EVERY_APPEARANCE.filter(([, a]) => holesIn(a).length > 0).map(
      ([key]) => key
    );
    expect(
      [...found].sort(),
      'an appearance with an unstated paper hole, or a stated hole that has since been closed'
    ).toEqual([...STATED_HOLES.keys()].sort());
  });

  it('states the exact tokens each hole is missing', () => {
    for (const [key, appearance] of EVERY_APPEARANCE) {
      const stated = STATED_HOLES.get(key);
      if (!stated) continue;
      expect(
        holesIn(appearance),
        `${key}: the stated hole has moved. Update the entry, do not widen it.`
      ).toEqual(stated.missing);
    }
  });

  it('gives every stated hole a reason, not just a name', () => {
    // A bare allowlist would be the failure mode wearing a test's clothes.
    for (const [key, { why }] of STATED_HOLES) {
      expect(typeof why, key).toBe('string');
      expect(why.length, `${key} needs a real reason`).toBeGreaterThan(60);
    }
  });

  it('every appearance the table does NOT state crosses to paper cleanly', () => {
    // The other half of the claim: onPaper is not merely un-thrown, it is
    // called, and every token it returns is a --doc-* token.
    for (const [key, appearance] of EVERY_APPEARANCE) {
      if (STATED_HOLES.has(key)) continue;
      const onPaperAppearance = onPaper(appearance);
      for (const part of CROSSING) {
        const token = onPaperAppearance[part];
        if (token != null) {
          expect(token, `${key}.${part} should be a --doc-* token`).toMatch(
            /^--doc-/
          );
        }
      }
    }
  });

  it('a stated hole really does throw, so the record is not theoretical', () => {
    for (const [key, appearance] of EVERY_APPEARANCE) {
      if (!STATED_HOLES.has(key)) continue;
      expect(() => onPaper(appearance), `${key} should throw`).toThrow(
        /No paper counterpart/
      );
    }
  });

  it('translates every part it names, so the list above is not decorative', () => {
    // The other direction of the hand-maintained copy. A part named in
    // CROSSING that onPaper does not actually translate would hand back an
    // --app-* token inside a paper appearance, which IS the markFill
    // defect. Proven on the real appearances, and the second loop is what
    // stops it passing vacuously: a part no appearance carries would be
    // checked zero times and prove nothing, so it has to fail instead.
    const carriers = new Map(CROSSING.map((part) => [part, 0]));
    for (const [key, appearance] of EVERY_APPEARANCE) {
      if (STATED_HOLES.has(key)) continue;
      const crossed = onPaper(appearance);
      for (const part of CROSSING) {
        if (appearance[part] == null) continue;
        carriers.set(part, carriers.get(part) + 1);
        expect(
          crossed[part],
          `${key}.${part} = ${appearance[part]} was left untranslated`
        ).toMatch(/^--doc-/);
      }
    }
    for (const [part, count] of carriers) {
      expect(
        count,
        `no appearance carries a ${part}, so naming it in CROSSING proves nothing`
      ).toBeGreaterThan(0);
    }
  });

  it('crossing to paper changes the medium, never the fields', () => {
    // onPaper is a change of register, so an appearance and its paper
    // counterpart describe the same thing and must have the same shape.
    // Only three of the twenty six appearances carry a markFill at all;
    // translating it must not hand the other twenty three a null one.
    for (const [key, appearance] of EVERY_APPEARANCE) {
      if (STATED_HOLES.has(key)) continue;
      expect(Object.keys(onPaper(appearance)).sort(), key).toEqual(
        Object.keys(appearance).sort()
      );
    }
  });
});
