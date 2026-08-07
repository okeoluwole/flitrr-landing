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
  scheduleBandAppearance,
  varianceDirectionAppearance,
  objectiveStatusAppearance,
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
 *  DateField, SuiteNudge, ErrorNote). PageHeader stayed OUT until sub-step
 *  6: its pulse-line eyebrow mark is the language's one sanctioned amber
 *  chrome element, and this guard rightly holds no exemption list, so the
 *  header waited for a guard shape that could state the claim rather than
 *  an exception here. See BRAND MARK below. */
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
  // Sub-step 5: the three Programme surfaces. The tracker is the live
  // instrument, set-up is where a curated template becomes this project's
  // baseline, and the gate review is the go or no-go decision.
  'app/pulse/app/programme/ProgrammeTracking.module.css',
  'app/pulse/app/programme/setup/ProgrammeSetup.module.css',
  'app/pulse/app/gate/GateReview.module.css',
  // Sub-step 6, the chrome. It must recede: the test of chrome is that
  // converting it changes nothing a reader would name.
  'app/pulse/app/components/PageHeader.module.css',
  'app/pulse/app/components/ViewOnlyBadge.module.css',
  'app/components/DashboardShell.module.css',
  // Sub-step 6, the front door: the one surface a reader meets before any
  // project context exists.
  'app/pulse/app/page.module.css',
  // Sub-step 6: the cockpit and the launcher. "Where do I go, and what
  // needs me". The dashboard's spine is the objective status ladder.
  'app/pulse/app/dashboard/ProjectDashboard.module.css',
  'app/pulse/app/workspace/Workspace.module.css',
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

/**
 * The one px font-size the language permits, added in sub-step 5: type
 * inside an SVG-coordinate context.
 *
 * A chart is drawn in a fixed viewBox, so its text is positioned in the same
 * coordinate space as its bars and gridlines. A rem size would scale with the
 * user's root font size while the geometry around it did not, so labels would
 * overrun their gridlines and collide at exactly the accessibility setting
 * meant to help. Chart text is part of the drawing, not part of the
 * document's type.
 *
 * The allowance is a SHAPE, not a file exemption and not a class-name
 * allowlist: a class may hold a px font-size only if every use of it in the
 * surface's own JS is on an SVG <text> or <tspan> element. That cannot be
 * abused, because claiming it requires the class to genuinely be chart text.
 * It fails closed: a class the JS never uses, or uses on an HTML element, or
 * reaches only through a string rather than `styles.<name>`, does not get it.
 */
const SVG_TEXT_TAGS = /<(text|tspan)\b/g;

/** The [start, end) spans of every SVG text opening tag in a JS source,
 *  brace-aware so an expression attribute cannot end the tag early. */
function svgTextTagSpans(js) {
  const spans = [];
  for (const m of js.matchAll(SVG_TEXT_TAGS)) {
    let depth = 0;
    let i = m.index;
    for (; i < js.length; i++) {
      const ch = js[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    spans.push([m.index, i]);
  }
  return spans;
}

/**
 * BRAND MARK: the second amber allowance, added in sub-step 6.
 *
 * Two rules on the chrome spend amber and are not criticality: PageHeader's
 * pulse-line eyebrow glyph and DashboardShell's Flitrr brand dot. Renaming
 * them to declare criticality would be a lie in the file, and an exemption
 * list is what this guard refuses to hold, so the allowance is a SHAPE.
 *
 * The real claim is that these marks MEAN NOTHING. A semantic amber must be
 * perceivable and labelled: the language's second colour rule says every
 * state also reads through its label, shape or weight, so a status is always
 * announced. A brand mark is the exact inverse: it is hidden from assistive
 * technology entirely, and it is a fixed-size glyph rather than a run of
 * type or a container. So a rule may spend amber where, for every class in
 * its selector:
 *   1. the class is used in the surface's own JS, and EVERY use sits on an
 *      element carrying aria-hidden, and
 *   2. the class is drawn at a fixed pixel width AND height in this
 *      stylesheet, so it is a glyph and not a label or a panel.
 *
 * That cannot be abused. To smuggle a status read through it you would have
 * to hide that status from screen readers and pin it to a fixed glyph box,
 * which breaks the colour rule far more loudly than a naming slip and fails
 * the accessibility guards besides. It fails closed: a class the JS never
 * uses, or uses on a visible element, or that has no fixed glyph box, does
 * not get the allowance.
 *
 * It is NARROWER than "brand mark" as a concept, deliberately. An amber
 * wordmark set in type would not pass, because it would carry a label and
 * have no glyph box. Only a decorative fixed-size glyph passes, which is
 * what both of these actually are.
 */
const DECORATIVE = /aria-hidden\s*=\s*(?:"true"|\{\s*true\s*\})/;

/** The source of the JSX opening tag enclosing a given index, brace-aware
 *  so an expression attribute cannot end the tag early. */
function openingTagAt(js, index) {
  const start = js.lastIndexOf('<', index);
  if (start === -1) return '';
  let depth = 0;
  let i = start;
  for (; i < js.length; i++) {
    const ch = js[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) break;
  }
  return js.slice(start, i + 1);
}

/** Every rule body in a stylesheet whose selector names this class. */
function bodiesFor(css, name) {
  const token = new RegExp(`\\.${name}(?![A-Za-z0-9_-])`);
  return rules(css)
    .filter(({ selector }) => token.test(selector))
    .map(({ body }) => body)
    .join('\n');
}

/** Every class name mentioned in a selector. */
function classesIn(selector) {
  return [...selector.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
}

/** The component a CSS module dresses: Foo.module.css -> Foo.js beside it. */
function siblingJs(rel) {
  const guess = rel.replace(/\.module\.css$/, '.js');
  try {
    return read(guess);
  } catch {
    return '';
  }
}

describe('type on a converted surface rides the --app-text scale', () => {
  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const js = siblingJs(rel);
      const spans = svgTextTagSpans(js);

      /** True when every class in the selector is used in the sibling JS,
       *  and every one of those uses is on an SVG text element. */
      function drawnInSvgCoordinates(selector) {
        const names = classesIn(selector);
        if (names.length === 0) return false;
        return names.every((name) => {
          const uses = [
            ...js.matchAll(new RegExp(`\\bstyles\\.${name}\\b`, 'g')),
          ];
          if (uses.length === 0) return false;
          return uses.every((u) =>
            spans.some(([start, end]) => u.index > start && u.index < end)
          );
        });
      }

      const offenders = [];
      for (const { selector, body } of rules(css)) {
        for (const m of body.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
          const value = m[1]
            .trim()
            .replace(/\s*!important$/, '')
            .replace(/\s+/g, ' ');
          const token = value.match(/^var\((--app-text-[a-z0-9]+)\)$/);
          const named = varsIn(value);
          if (token) {
            if (!DEFINED_TOKENS.has(token[1])) {
              offenders.push(`${selector}: ${value} (token not in globals.css)`);
            }
          } else if (FLUID_ON_SCALE.test(value)) {
            for (const t of named) {
              if (!DEFINED_TOKENS.has(t)) {
                offenders.push(`${selector}: ${value} (${t} not in globals.css)`);
              }
            }
          } else if (
            /^[0-9.]+px$/.test(value) &&
            drawnInSvgCoordinates(selector)
          ) {
            // Chart text: part of the drawing, not of the document's type.
          } else {
            offenders.push(`${selector}: ${value}`);
          }
        }
      }
      expect(
        offenders,
        `font sizes off the scale in ${rel}:\n  ${offenders.join('\n  ')}`
      ).toEqual([]);
    });
  }
});

describe('positive space on a converted surface rides the --app-space rhythm', () => {
  // scroll-margin-top is deliberately NOT in this list, from sub-step 5.
  // The rhythm models positive space between things. scroll-margin-top is
  // not that: it is a compensation for the height of sticky chrome, so that
  // an anchored element lands below the header instead of under it, and its
  // correct value is whatever that chrome measures. The tracker carries
  // 24rem and 14rem for exactly that reason. The nearest rhythm step is
  // 4rem, so snapping would be a 320px error that silently breaks scroll
  // anchoring, a defect no test would catch and no static render would show.
  // It is the same category as the Brief's margin rail and the negative
  // hit-area margins this guard already exempts: geometry derived from
  // another measurement, not a step on a scale.
  const SPACING_PROP =
    /(?:^|[;{])\s*(padding(?:-block|-inline|-top|-right|-bottom|-left)?|margin(?:-block|-inline|-top|-right|-bottom|-left)?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g;

  // A value part is legal if it is a rhythm token that exists, a zero, auto,
  // a pixel length (control geometry: hairlines, insets, hit minima), or a
  // NEGATIVE rem (a hit-area or optical compensation, which the rhythm does
  // not model). A positive rem or em literal is exactly the drift this
  // guard exists to stop.
  //
  // The px arm is signed from sub-step 5. It always meant to be: a negative
  // px is the intersection of the two categories already named above, a
  // hairline overlap given back (the tracker's tab pulls its 2px underline
  // over the bar's 1px border with margin-bottom: -1px) and the standard
  // visually-hidden clip's margin: -1px. No converted surface had needed one
  // before, so the omission had never bitten.
  const LEGAL =
    /^(var\(--app-space-[0-9]\)|0|auto|-[0-9.]+rem|-?[0-9.]+px)$/;

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
  const AMBER_TOKEN = /^--(app|doc)-(signal|critical|ochre)/;

  for (const rel of CONVERTED) {
    it(rel, () => {
      const css = stripComments(read(rel));
      const js = siblingJs(rel);

      /** Category (b): a decorative, fixed-size glyph. See BRAND MARK. */
      function isBrandMark(selector) {
        const names = classesIn(selector);
        if (names.length === 0) return false;
        return names.every((name) => {
          const uses = [
            ...js.matchAll(new RegExp(`\\bstyles\\.${name}\\b`, 'g')),
          ];
          if (uses.length === 0) return false;
          if (!uses.every((u) => DECORATIVE.test(openingTagAt(js, u.index)))) {
            return false;
          }
          const own = bodiesFor(css, name);
          return (
            /(?:^|[;{\s])width\s*:\s*[0-9.]+px/.test(own) &&
            /(?:^|[;{\s])height\s*:\s*[0-9.]+px/.test(own)
          );
        });
      }

      const offenders = [];
      for (const { selector, body } of rules(css)) {
        if (!AMBER.test(body)) continue;
        if (/critical/i.test(selector)) continue;
        if (isLadderRung(body)) continue;
        if (isBrandMark(selector)) continue;
        offenders.push(selector);
      }
      expect(
        offenders,
        `amber outside a criticality-named rule in ${rel}: ${offenders.join(', ')}`
      ).toEqual([]);
    });
  }

  /**
   * Category (a): the objective status ladder, added in sub-step 6.
   *
   * The dashboard's amber is not criticality and renaming it to say so
   * would be a lie: criticality is what an item THREATENS, the ladder is
   * how threatened an objective currently IS. objectiveStatusAppearance
   * gives at_risk and slipping amber deliberately, because on the ladder
   * amber is EXPOSURE, brightening toward breach while red stays reserved
   * for breach itself. designSemantics already names those two in its
   * allowedAmber set. The axes never blur, so the names must not either.
   *
   * The permission and the lock-step are the SAME assertion: a rule passes
   * only if every amber token it spends belongs to ONE ladder rung's
   * appearance, and it spends at least one. A rule that merely looks like a
   * status name does not pass; a rule that reaches for any other amber does
   * not pass, even one resolving to an identical value.
   */
  function isLadderRung(body) {
    const spent = varsIn(body).filter((t) => AMBER_TOKEN.test(t));
    if (spent.length === 0) return false;
    return ['at_risk', 'slipping'].some((rung) => {
      const a = objectiveStatusAppearance(rung);
      const own = new Set(
        [a.ink, a.fill, a.border, a.markFill].filter(Boolean)
      );
      return spent.every((t) => own.has(t));
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

describe('the Programme surfaces spend the mappings, not a local amber', () => {
  // Sub-step 5. Thirteen rules here were named so that the amber census
  // could see them, and a name is not evidence: /critical/i in a selector
  // proves nothing about what the rule spends. These tables are the durable
  // half. Every expectation is computed from semantics.js, so a correction
  // to a mapping propagates here without reopening the surfaces, and a rule
  // that drifts off its mapping fails whether or not it is still named for
  // criticality.
  //
  // Two mappings are in play, and which one a rule answers to is the point.
  // scheduleBandAppearance('red') is the tracker's live Critical slip, an
  // engine verdict about a point's position. criticalityAppearance
  // ('critical') is the classification itself. They spend the same amber
  // for the same reason (the red band is criticality-gated), but they are
  // different reads and the tables keep them apart.
  const band = scheduleBandAppearance('red');
  const critical = criticalityAppearance('critical');

  const SURFACES = [
    [
      'app/pulse/app/programme/ProgrammeTracking.module.css',
      [
        // The live band verdict.
        ['.cardCriticalSlip', band, ['fill', 'border']],
        ['.detailCriticalSlip', band, ['fill', 'border']],
        ['.tileValueCritical', band, ['ink']],
        ['.cardFigureCriticalSlip', band, ['ink']],
        ['.varCriticalSlip', band, ['ink']],
        ['.stCriticalSlip', band, ['markFill']],
        ['.cxCriticalSlip', band, ['markFill']],
        ['text.cxCriticalSlip', band, ['ink']],
        // The classification itself: a count of critical points, and the
        // house Critical pill on a lookahead row.
        ['.tileSubCritical', critical, ['ink']],
        ['.lookCriticalityCritical', critical, ['ink', 'fill', 'border']],
      ],
    ],
    [
      'app/pulse/app/programme/setup/ProgrammeSetup.module.css',
      [
        ['.cardCritical', critical, ['fill', 'border']],
        ['.tierChipCritical', critical, ['ink', 'fill', 'border']],
        ['.badgeCritical', critical, ['ink', 'fill', 'border']],
      ],
    ],
    [
      'app/pulse/app/gate/GateReview.module.css',
      [
        // Every objective non-negotiable IS the framework's structural-risk
        // state, so the over-constraint caution earns the criticality wash,
        // and .passedAckCritical is the standing record of the same read.
        ['.itemCritical', critical, ['fill', 'border']],
        ['.itemCritical .iconOut', critical, ['ink']],
        ['.passedAckCritical', critical, ['ink']],
      ],
    ],
  ];

  for (const [rel, table] of SURFACES) {
    const blocks = new Map(
      rules(stripComments(read(rel))).map(({ selector, body }) => [
        selector.trim(),
        body,
      ])
    );

    for (const [selector, appearance, parts] of table) {
      it(`${rel.split('/').pop()} ${selector} spends the mapping`, () => {
        const body = blocks.get(selector);
        expect(body, `${selector} missing from ${rel}`).toBeTruthy();
        for (const part of parts) {
          expect(
            body,
            `${selector} should spend ${part} = var(${appearance[part]})`
          ).toContain(`var(${appearance[part]})`);
        }
      });
    }

    it(`${rel.split('/').pop()} re-picks no amber locally`, () => {
      // Whatever amber any of these rules spends must be a token one of the
      // two mappings names. A hand-picked amber fails here even where it
      // happens to resolve to an identical value, which is exactly how the
      // five that did (--app-signal-border and --app-critical-bg for the
      // mapping's --app-critical-border and --app-signal-wash) were found.
      const legal = new Set(
        [band, critical].flatMap((a) => [a.ink, a.fill, a.border, a.markFill])
      );
      const offenders = [];
      for (const [selector] of table) {
        for (const token of varsIn(blocks.get(selector) || '')) {
          if (/signal|ochre|critical/.test(token) && !legal.has(token)) {
            offenders.push(`${selector}: ${token}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("the tracker's variance ramp is its two engine vocabularies", () => {
  // The CSS shows five rungs. The engine has no five-value vocabulary, and
  // inventing one in the design layer is the drift these mappings exist to
  // stop. It is the three directions composed with the three-band axis:
  // a flagged row takes its BAND, an unflagged row its DIRECTION. These
  // assertions hold each rung to whichever vocabulary owns it.
  const css = stripComments(
    read('app/pulse/app/programme/ProgrammeTracking.module.css')
  );
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.trim(), body])
  );

  const DIRECTION_RUNGS = [
    ['.varAhead', 'ahead'],
    ['.varQuiet', 'on_baseline'],
    ['.varBehind', 'behind'],
  ];

  for (const [selector, direction] of DIRECTION_RUNGS) {
    it(`${selector} is varianceDirectionAppearance('${direction}')`, () => {
      const a = varianceDirectionAppearance(direction);
      const body = blocks.get(selector);
      expect(body, `${selector} missing`).toBeTruthy();
      expect(body).toContain(`color: var(${a.ink})`);
      // Weight is the non-colour carrier: calm reads at 500, a stated
      // direction at 600, so the ramp survives a colour-blind read.
      expect(body).toContain(`font-weight: ${a.weight}`);
    });
  }

  for (const [selector, key] of [
    ['.varSlip', 'amber'],
    ['.varCriticalSlip', 'red'],
  ]) {
    it(`${selector} is scheduleBandAppearance('${key}')`, () => {
      const body = blocks.get(selector);
      expect(body, `${selector} missing`).toBeTruthy();
      expect(body).toContain(`color: var(${scheduleBandAppearance(key).ink})`);
    });
  }

  it('the two vocabularies never bleed into each other', () => {
    // A direction must not wear a band's ink, and a band rung must not wear
    // a direction's. This is what stops a later edit collapsing the five
    // rungs into one invented ladder.
    const directionInks = DIRECTION_RUNGS.map(
      ([, d]) => varianceDirectionAppearance(d).ink
    );
    const bandInks = ['amber', 'red'].map((b) => scheduleBandAppearance(b).ink);
    for (const ink of bandInks) expect(directionInks).not.toContain(ink);
  });
});

describe("the dashboard's ladder is objectiveStatusAppearance, rung by rung", () => {
  // Sub-step 6. The ladder is the cockpit's spine and its whole argument is
  // GRADIENT: calm spends no colour, exposure brightens, breach is the one
  // filled label. Each rung reads twice, as a status label and as a painted
  // left edge, and the JS maps both straight off LADDER_STATUSES. These
  // assertions hold every rung of both carriers to the mapping, so a later
  // edit cannot flatten two rungs into one look without failing here.
  //
  // Sub-step 6 found the edges out of step: At risk was painted in
  // --app-signal-border, which is SLIPPING's token, and Slipping in the raw
  // --app-signal, which belongs to no rung at all. A cross-rung bleed is
  // exactly what these tables exist to catch.
  const css = stripComments(
    read('app/pulse/app/dashboard/ProjectDashboard.module.css')
  );
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.trim(), body])
  );

  // Selector -> the rung it wears and the parts of that appearance it sets.
  // The label family carries ink, fill and border; the edge family is a
  // painted stripe, so it carries the rung's ink as its paint.
  const RUNGS = [
    ['.statusQuiet', 'healthy', ['ink']],
    ['.statusOutlinedDim', 'at_risk', ['ink', 'border']],
    ['.statusOutlined', 'slipping', ['ink', 'border']],
    ['.statusDanger', 'compromised', ['ink', 'fill', 'border']],
    ['.statusDashed', 'not_scored', ['ink', 'border']],
    ['.rowEdgeThin::before', 'at_risk', ['ink']],
    ['.rowEdgeLine::before', 'slipping', ['ink']],
    ['.rowEdgeBar::before', 'compromised', ['ink']],
    ['.rowEdgeDashed::before', 'not_scored', ['border']],
  ];

  for (const [selector, rung, parts] of RUNGS) {
    it(`${selector} is objectiveStatusAppearance('${rung}')`, () => {
      const a = objectiveStatusAppearance(rung);
      const body = blocks.get(selector);
      expect(body, `${selector} missing from ProjectDashboard.module.css`)
        .toBeTruthy();
      for (const part of parts) {
        expect(
          body,
          `${selector} should spend ${part} = var(${a[part]})`
        ).toContain(`var(${a[part]})`);
      }
      // The non-colour carrier travels with the colour: a rung the mapping
      // marks dashed must read dashed, so the ramp survives without hue.
      if (a.borderStyle === 'dashed') expect(body).toContain('dashed');
    });
  }

  it('no ladder rule re-picks an amber the mapping does not name', () => {
    // A hand-picked amber fails here even where it resolves to an identical
    // value, which is how the two edge rules above were found.
    const legal = new Set(
      ['healthy', 'at_risk', 'slipping', 'compromised', 'not_scored'].flatMap(
        (r) => {
          const a = objectiveStatusAppearance(r);
          return [a.ink, a.fill, a.border, a.markFill].filter(Boolean);
        }
      )
    );
    const offenders = [];
    for (const [selector] of RUNGS) {
      for (const token of varsIn(blocks.get(selector) || '')) {
        if (/signal|ochre|critical/.test(token) && !legal.has(token)) {
          offenders.push(`${selector}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the two amber rungs never collapse into one look', () => {
    // The gradient IS the read. At risk and Slipping share the amber voice
    // and are separated by token, so a later edit that levels them fails.
    const dim = objectiveStatusAppearance('at_risk');
    const bright = objectiveStatusAppearance('slipping');
    expect(dim.ink).not.toBe(bright.ink);
    expect(dim.border).not.toBe(bright.border);
    for (const [a, b] of [
      ['.statusOutlinedDim', '.statusOutlined'],
      ['.rowEdgeThin::before', '.rowEdgeLine::before'],
    ]) {
      expect(blocks.get(a)).not.toBe(blocks.get(b));
    }
  });

  it('calm spends no colour and breach is the one filled rung', () => {
    // Stated from the mapping, not from a copy of it: the surface may not
    // quietly give Healthy a fill or take Compromised's away.
    expect(objectiveStatusAppearance('healthy').fill).toBeNull();
    expect(objectiveStatusAppearance('healthy').border).toBeNull();
    expect(blocks.get('.statusQuiet')).toContain('background: transparent');
    for (const rung of ['at_risk', 'slipping']) {
      expect(objectiveStatusAppearance(rung).fill).toBeNull();
    }
    expect(objectiveStatusAppearance('compromised').fill).toBeTruthy();
  });
});

describe("the workspace's critical read is the criticality mapping", () => {
  // The one amber on the launcher: an open critical action in a module's
  // live read. It passes the census on its name, and a name is not
  // evidence, so it is held to the mapping like every other named rule.
  const blocks = new Map(
    rules(stripComments(read('app/pulse/app/workspace/Workspace.module.css'))).map(
      ({ selector, body }) => [selector.trim(), body]
    )
  );

  it('.footCritical spends the critical appearance ink', () => {
    const a = criticalityAppearance('critical');
    const body = blocks.get('.footCritical');
    expect(body, '.footCritical missing from Workspace.module.css').toBeTruthy();
    expect(body).toContain(`var(${a.ink})`);
  });

  it('.footCritical re-picks no other amber', () => {
    const a = criticalityAppearance('critical');
    const legal = new Set([a.ink, a.fill, a.border].filter(Boolean));
    const offenders = varsIn(blocks.get('.footCritical') || '').filter(
      (t) => /signal|ochre|critical/.test(t) && !legal.has(t)
    );
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
