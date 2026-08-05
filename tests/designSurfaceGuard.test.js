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
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  severityBandAppearance,
  criticalityAppearance,
  criticalityAppearanceOnPaper,
  criticalityMarkAppearanceOnPaper,
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
  // Sub-step 4: the Generated Brief, screen and print, and the member's
  // read-only frame around the same sheet.
  'app/pulse/app/components/Brief.module.css',
  'app/pulse/app/components/MemberBriefView.module.css',
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

/** Split a declaration value into top-level parts, keeping a balanced
 *  function call (calc, clamp, min, max) together as a single part. */
function splitTop(value) {
  const parts = [];
  let depth = 0;
  let buf = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (buf) parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

/** Every custom property named inside a value. */
function varsIn(value) {
  return [...value.matchAll(/var\((--[a-z0-9-]+)\)/gi)].map((m) => m[1]);
}

/** The value with its var() calls blanked out, so what remains is the bare
 *  arithmetic. Used to prove a calc smuggles in no untokenised length. */
function withoutVars(value) {
  return value.replace(/var\((--[a-z0-9-]+)\)/gi, ' ');
}

const BARE_LENGTH = /[0-9.]+(rem|em|px|%|ch|v[hwminax]+)/;

/**
 * The one fluid type value the language permits: a masthead whose BOUNDS
 * ride the scale and whose ramp between them is viewport-relative. Written
 * as a shape rather than a file exemption, so any surface may use it and no
 * surface can use it to smuggle a raw size past the guard.
 */
const FLUID_ON_SCALE =
  /^clamp\(\s*var\(--app-text-[a-z0-9]+\)\s*,\s*[0-9.]+(?:vw|vh|vmin|vmax)\s*,\s*var\(--app-text-[a-z0-9]+\)\s*\)$/;

describe('type on a converted surface rides the --app-text scale', () => {
  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const offenders = [];
      for (const m of css.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const value = m[1]
          .trim()
          .replace(/\s*!important$/, '')
          .replace(/\s+/g, ' ');
        const token = value.match(/^var\((--app-text-[a-z0-9]+)\)$/);
        const named = varsIn(value);
        if (token) {
          if (!DEFINED_TOKENS.has(token[1])) {
            offenders.push(`${value} (token not in globals.css)`);
          }
        } else if (FLUID_ON_SCALE.test(value)) {
          for (const t of named) {
            if (!DEFINED_TOKENS.has(t)) {
              offenders.push(`${value} (${t} not in globals.css)`);
            }
          }
        } else {
          offenders.push(value);
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

  /**
   * A calc() is on the rhythm when every length inside it is a rhythm token
   * and the arithmetic itself carries no bare length. That lets a surface
   * COMPOSE a measure the eight steps cannot name on their own (the Brief's
   * margin rail is a seat plus a gutter; a hit area is given back as
   * negative margin) without reopening the door to hand-picked values.
   */
  function calcOnRhythm(part) {
    if (!/^calc\(/.test(part)) return false;
    const named = varsIn(part);
    if (named.length === 0) return false;
    if (
      !named.every(
        (t) => /^--app-space-[0-9]$/.test(t) && DEFINED_TOKENS.has(t)
      )
    ) {
      return false;
    }
    return !BARE_LENGTH.test(withoutVars(part));
  }

  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const offenders = [];
      for (const m of css.matchAll(SPACING_PROP)) {
        // !important is a flag on the declaration, not a part of its value.
        const value = m[2]
          .trim()
          .replace(/\s*!important$/, '')
          .replace(/\s+/g, ' ');
        for (const part of splitTop(value)) {
          const token = part.match(/^var\((--app-space-[0-9])\)$/);
          if (!LEGAL.test(part) && !calcOnRhythm(part)) {
            offenders.push(`${m[1]}: ${value}`);
            break;
          }
          if (token && !DEFINED_TOKENS.has(token[1])) {
            offenders.push(`${m[1]}: ${value} (token not in globals.css)`);
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
  // Sub-step 4 widened this from --app-* to BOTH registers. The Brief reads
  // in the --doc-* paper group, so a surface carrying --doc-signal or
  // --doc-ochre was spending a second amber this census could not see, and
  // passing. A guard that passes for the wrong reason is worse than none,
  // because it gets counted as evidence.
  const AMBER = /--(app|doc)-(signal|critical|ochre)/;

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

describe("the Brief's criticality rules spend the mapping, in paper ink", () => {
  // The Brief keeps its own --doc-* register because it is the one surface
  // that leaves the screen. Keeping its INK is not the same as keeping its
  // own MEANING: every rule below is computed from criticalityAppearance
  // through the paper counterpart table, so the document expresses the one
  // criticality rather than rivalling it. A correction to the mapping
  // propagates here without reopening the Brief.
  const css = stripComments(read('app/pulse/app/components/Brief.module.css'));
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.trim(), body])
  );

  const pill = criticalityAppearanceOnPaper('critical');
  const mark = criticalityMarkAppearanceOnPaper();

  // Selector -> the appearance it wears and the parts of it that rule sets.
  // The pill family carries the wash; the mark family stands the solid
  // amber in for the word where no pill would fit.
  const RULES = [
    ['.tagCritical', pill, ['fill', 'ink']],
    ['.wsCardCritical', pill, ['fill', 'border']],
    ['.criticalFlag', pill, ['ink']],
    ['.objCardCritical .objRank', mark, ['fill', 'border', 'ink']],
    ['.insightCritical .iBadge', mark, ['fill', 'border', 'ink']],
    ['.pinCritical', mark, ['fill', 'border', 'ink']],
    ['.rNumCritical', mark, ['fill', 'ink']],
    ['.msMarkerCritical', mark, ['fill', 'border']],
  ];

  for (const [selector, appearance, parts] of RULES) {
    it(`${selector} spends the mapping's paper tokens`, () => {
      const body = blocks.get(selector);
      expect(body, `${selector} missing from Brief.module.css`).toBeTruthy();
      for (const part of parts) {
        expect(
          body,
          `${selector} should spend ${part} = var(${appearance[part]})`
        ).toContain(`var(${appearance[part]})`);
      }
    });
  }

  it('no criticality rule in the Brief re-picks a paper colour locally', () => {
    // Whatever amber any of these rules spends must be a token the paper
    // mapping names. A hand-picked --doc-* amber would fail here even if it
    // happened to look identical.
    const legal = new Set(
      [pill.ink, pill.fill, pill.border, mark.ink, mark.fill, mark.border]
    );
    const offenders = [];
    for (const [selector] of RULES) {
      for (const token of varsIn(blocks.get(selector) || '')) {
        if (/signal|ochre|critical/.test(token) && !legal.has(token)) {
          offenders.push(`${selector}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('--doc-* stays a colour and face register, never a second scale', () => {
  // This is the thing that blocked sub-step 4 in the first place: the print
  // block had grown 37 hand-picked font sizes and 52 hand-picked spacings
  // under --doc-*, a second scale in all but name. The Brief now rides the
  // one --app-text scale and the one --app-space rhythm, and these two
  // assertions are what stop a later session quietly rebuilding the fork.
  const DOC_DEFINITIONS = [...GLOBALS.matchAll(/(--doc-[a-z0-9-]+)\s*:/gi)].map(
    (m) => m[1]
  );

  function cssFilesUnder(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...cssFilesUnder(full));
      else if (entry.name.endsWith('.css')) out.push(full);
    }
    return out;
  }

  it('defines at least one --doc-* token, so the assertions below can bite', () => {
    expect(DOC_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('no --doc-* name implies a type size or a spacing step', () => {
    // Face names (--doc-font-serif, --doc-font-mono) are the register's job
    // and stay legal; a SIZE or a RHYTHM name is what must never appear.
    const FORBIDDEN =
      /(text|size|space|spacing|gap|pad|padding|margin|leading|track|tracking|rhythm|scale|step)/i;
    const offenders = DOC_DEFINITIONS.filter((name) => FORBIDDEN.test(name));
    expect(
      offenders,
      `--doc-* is a colour and face register; these names imply type or space: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('no --doc-* token is consumed by a font-size or a spacing property', () => {
    const SIZE_OR_SPACE =
      /(font-size|padding(?:-block|-inline|-top|-right|-bottom|-left)?|margin(?:-block|-inline|-top|-right|-bottom|-left)?|gap|row-gap|column-gap|letter-spacing|line-height)\s*:\s*([^;}]+)/g;
    const offenders = [];
    for (const file of cssFilesUnder(path.join(ROOT, 'app'))) {
      const css = stripComments(readFileSync(file, 'utf8'));
      for (const m of css.matchAll(SIZE_OR_SPACE)) {
        for (const token of varsIn(m[2])) {
          if (token.startsWith('--doc-')) {
            offenders.push(
              `${path.relative(ROOT, file)}: ${m[1]}: ${m[2].trim()}`
            );
          }
        }
      }
    }
    expect(
      offenders,
      `--doc-* consumed as type or space:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});

describe("the Brief's margin rail cannot drift out of its own gutter", () => {
  // The section numeral is absolutely positioned into the padding the
  // section reserves for it. The two are written as the same composition so
  // one can never be changed without the other; this holds that pairing on
  // both the screen rule and the print override.
  const css = stripComments(read('app/pulse/app/components/Brief.module.css'));

  const rails = [...css.matchAll(/padding-left:\s*(calc\([^;]+?\));/g)].map(
    (m) => m[1].replace(/\s+/g, '')
  );
  const offsets = [...css.matchAll(/left:\s*(calc\(-1 \*[^;]+?\));/g)].map((m) =>
    m[1].replace(/\s+/g, '')
  );

  it('every rail is a composition of rhythm steps', () => {
    expect(rails.length).toBeGreaterThan(0);
    for (const rail of rails) {
      expect(varsIn(rail).every((t) => /^--app-space-[0-9]$/.test(t))).toBe(
        true
      );
    }
  });

  it('each rail has a numeral offset that is exactly its negation', () => {
    expect(offsets.length).toBe(rails.length);
    for (const rail of rails) {
      const inner = rail.replace(/^calc\(/, '').replace(/\)$/, '');
      const negation = `calc(-1*(${inner}))`;
      expect(
        offsets,
        `no numeral offset negates the rail ${rail}`
      ).toContain(negation);
    }
  });
});
