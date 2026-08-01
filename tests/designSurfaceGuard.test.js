/**
 * The converted-surface guards (Session K, Note 15 sub-step 2).
 *
 * Sub-step 1 sealed colour: no raw colour literal in any app CSS module
 * (designTokenGuard). This file seals what the sweep converts, surface by
 * surface: type rides the --app-text scale, positive space rides the
 * --app-space rhythm, amber is spent only by rules whose own name declares
 * criticality, and the shared tags stay in lock-step with their mappings
 * (SeverityTag with severityBandAppearance; from sub-step 3, CriticalityChip
 * and the wizard's classification pill with criticalityAppearance). Every
 * assertion is computed from app/globals.css or lib/design/semantics.js,
 * never from a hard-coded copy, and there are NO exempt files: later
 * sub-steps add their surfaces to CONVERTED as they convert them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  severityBandAppearance,
  criticalityAppearance,
} from '../lib/design/semantics.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const GLOBALS = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');

/** Every custom property NAME defined anywhere in globals.css. */
const DEFINED_TOKENS = new Set(
  [...GLOBALS.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])
);

/** The surfaces the sweep has converted so far. Grows, never shrinks.
 *  Sub-step 3 adds the nine-step initiation flow: the wizard sheet every
 *  step shares, plus the flow's own small companions (CriticalityChip,
 *  DateField, SuiteNudge, ErrorNote). PageHeader stays OUT deliberately:
 *  its pulse-line eyebrow mark is the language's one sanctioned amber
 *  chrome element, and this guard rightly holds no exemption list, so the
 *  header seals with its own sub-step rather than an exception here. */
const CONVERTED = [
  'app/pulse/app/actions/ActionLog.module.css',
  'app/pulse/app/risk/RiskRegister.module.css',
  'app/pulse/app/components/SeverityTag.module.css',
  'app/pulse/app/components/InitiationWizard.module.css',
  'app/pulse/app/components/CriticalityChip.module.css',
  'app/pulse/app/components/DateField.module.css',
  'app/pulse/app/components/SuiteNudge.module.css',
  'app/pulse/app/components/ErrorNote.module.css',
];

function read(rel) {
  return readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
}

/** CSS with comments stripped, so prose never counts as a declaration. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The rule blocks of a stylesheet as { selector, body } pairs, walking
 * through at-rule nesting (a media block's inner rules are returned, the
 * at-rule shell itself is not).
 */
function rules(css) {
  const out = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const selector = stack.pop();
      if (selector && !selector.startsWith('@')) out.push({ selector, body: buf });
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

describe('type on a converted surface rides the --app-text scale', () => {
  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const offenders = [];
      for (const m of css.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const value = m[1].trim();
        const token = value.match(/^var\((--app-text-[a-z0-9]+)\)$/);
        if (!token) {
          offenders.push(value);
        } else if (!DEFINED_TOKENS.has(token[1])) {
          offenders.push(`${value} (token not in globals.css)`);
        }
      }
      expect(
        offenders,
        `font sizes off the scale in ${rel}: ${offenders.join(', ')}`
      ).toEqual([]);
    });
  }
});

describe('positive space on a converted surface rides the --app-space rhythm', () => {
  const SPACING_PROP =
    /(?:^|[;{])\s*(padding(?:-block|-inline|-top|-right|-bottom|-left)?|margin(?:-block|-inline|-top|-right|-bottom|-left)?|gap|row-gap|column-gap|scroll-margin-top)\s*:\s*([^;}]+)/g;

  // A value part is legal if it is a rhythm token that exists, a zero, auto,
  // a pixel length (control geometry: hairlines, insets, hit minima), or a
  // NEGATIVE rem (a hit-area or optical compensation, which the rhythm does
  // not model). A positive rem or em literal is exactly the drift this
  // guard exists to stop.
  const LEGAL =
    /^(var\(--app-space-[0-9]\)|0|auto|-[0-9.]+rem|[0-9.]+px)$/;

  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const offenders = [];
      for (const m of css.matchAll(SPACING_PROP)) {
        for (const part of m[2].trim().split(/\s+/)) {
          const token = part.match(/^var\((--app-space-[0-9])\)$/);
          if (!LEGAL.test(part)) {
            offenders.push(`${m[1]}: ${m[2].trim()}`);
            break;
          }
          if (token && !DEFINED_TOKENS.has(token[1])) {
            offenders.push(`${m[1]}: ${m[2].trim()} (token not in globals.css)`);
            break;
          }
        }
      }
      expect(
        offenders,
        `space off the rhythm in ${rel}:\n  ${offenders.join('\n  ')}`
      ).toEqual([]);
    });
  }
});

describe('amber is spent only by rules named for criticality', () => {
  const AMBER = /--app-(signal|critical)/;

  for (const rel of CONVERTED) {
    it(rel, () => {
      const offenders = [];
      for (const { selector, body } of rules(stripComments(read(rel)))) {
        if (AMBER.test(body) && !/critical/i.test(selector)) {
          offenders.push(selector);
        }
      }
      expect(
        offenders,
        `amber outside a criticality-named rule in ${rel}: ${offenders.join(', ')}`
      ).toEqual([]);
    });
  }
});

describe('SeverityTag stays in lock-step with severityBandAppearance', () => {
  const css = stripComments(read('app/pulse/app/components/SeverityTag.module.css'));
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.replace(/^\./, ''), body])
  );

  for (const band of ['serious', 'moderate', 'minor', 'unscored']) {
    it(`.${band} spends exactly the mapping's tokens`, () => {
      const a = severityBandAppearance(band);
      const body = blocks.get(band);
      expect(body, `.${band} missing from SeverityTag.module.css`).toBeTruthy();

      expect(body).toContain(`var(${a.ink})`);
      if (a.fill) {
        expect(body).toContain(`background: var(${a.fill})`);
      } else {
        expect(body).toContain('background: transparent');
      }
      if (a.border) {
        expect(body).toContain(`var(${a.border})`);
      }
      if (a.borderStyle === 'dashed') {
        expect(body).toContain('dashed');
      }
    });
  }

  it('severity never borrows amber', () => {
    expect(AMBER_FREE(css)).toBe(true);
  });

  function AMBER_FREE(text) {
    return !/--app-(signal|critical)/.test(text);
  }
});

describe('CriticalityChip stays in lock-step with criticalityAppearance', () => {
  const css = stripComments(
    read('app/pulse/app/components/CriticalityChip.module.css')
  );
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.replace(/^\./, ''), body])
  );

  for (const value of ['critical', 'standard', 'unlinked']) {
    it(`.${value} spends exactly the mapping's tokens`, () => {
      const a = criticalityAppearance(value);
      const body = blocks.get(value);
      expect(
        body,
        `.${value} missing from CriticalityChip.module.css`
      ).toBeTruthy();

      expect(body).toContain(`var(${a.ink})`);
      if (a.fill) {
        expect(body).toContain(`background: var(${a.fill})`);
      } else {
        expect(body).toContain('background: transparent');
      }
      if (a.border) {
        expect(body).toContain(`var(${a.border})`);
      }
      if (a.borderStyle === 'dashed') {
        expect(body).toContain('dashed');
      }
    });
  }
});

describe('the wizard classification pill spends the criticality mapping', () => {
  // The ranking's Non-negotiable pill IS the criticality read in the
  // classification's own vocabulary, so its tokens are the mapping's,
  // never a local re-pick. Computed from criticalityAppearance so a
  // corrected mapping propagates here without reopening the surface.
  const css = stripComments(
    read('app/pulse/app/components/InitiationWizard.module.css')
  );
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.replace(/^\./, ''), body])
  );

  it('.rankBadgeCritical carries exactly the critical appearance', () => {
    const a = criticalityAppearance('critical');
    const body = blocks.get('rankBadgeCritical');
    expect(
      body,
      '.rankBadgeCritical missing from InitiationWizard.module.css'
    ).toBeTruthy();

    expect(body).toContain(`var(${a.ink})`);
    expect(body).toContain(`background-color: var(${a.fill})`);
    expect(body).toContain(`var(${a.border})`);
    expect(body).toContain(`font-weight: ${a.weight}`);
  });
});
