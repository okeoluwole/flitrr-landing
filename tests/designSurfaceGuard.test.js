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
  stackVerdictAppearance,
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
  // The follow-on: the composition primitives themselves. The token layer
  // names colours and semantics.js names meanings; neither named SHAPES,
  // so the seated panel and the mono micro-label pill existed only as
  // prose in the language and as N hand-built copies in the surfaces.
  'app/components/instrument.module.css',
  // The loose-ends arc: STACK's tool joins the language. Authored before
  // Note 15 on the marketing faces and a hand-picked rhythm, converted
  // whole: shared chrome, the app faces, the --app-space rhythm, composed
  // panels, and the verdict on stackVerdictAppearance.
  'app/stack/app/stack.module.css',
  // The launcher audit: /dashboard, the product launcher every signed-in
  // reader lands on. Its type half was mechanical, every literal already an
  // exact token. Its space half moved geometry, which is why it waited for
  // a sub-step that could look at the result: this one also rebuilt the
  // grid onto the content, dropped the sub line, and made the seated panel
  // the target it had been advertising itself as.
  'app/dashboard/page.module.css',
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

describe('CONVERTED covers every authenticated module, computed not remembered', () => {
  /**
   * Sub-step 6 closes Note 15, so the sweep must leave behind proof that it
   * closed rather than a claim resting on somebody's memory.
   *
   * Without this, CONVERTED reads as complete because nobody can see what is
   * missing from it. That is the same false-green shape the amber census had
   * before sub-step 4 widened it to both registers, and the same shape that
   * left four authenticated modules unhomed until sub-step 5 counted them:
   * DashboardShell had never belonged to any sub-step at all, and it carries
   * an amber spend. A list that cannot say what it omits is not evidence.
   *
   * So every .module.css under the two authenticated trees must be either
   * CONVERTED or named here with a reason. Adding a module to the app now
   * fails this test until someone decides which it is.
   */
  /**
   * app/dashboard joined the trees in the Note 15 follow-on, and its
   * absence was the exact false-green shape this block exists to kill.
   *
   * designTokenGuard's SCOPE_DIRS were ['app/pulse/app', 'app/dashboard'];
   * these TREES were ['app/pulse/app', 'app/components']. So
   * app/dashboard/page.module.css and app/dashboard/team/page.module.css
   * were held to "no raw colour literal" and were UNREACHABLE by the
   * completeness check: neither converted nor excluded, simply invisible
   * to it. Both are real authenticated surfaces. /dashboard is where every
   * signed-in reader lands (middleware, the login form, the auth callback
   * and the reset-password flow all default there, and DashboardShell's
   * wordmark links to it), and /dashboard/team is the team and access
   * engine. The sweep that was meant to make this list computable had
   * counted its own trees and not the guard's.
   */
  const TREES = ['app/pulse/app', 'app/components', 'app/dashboard', 'app/stack/app'];

  const EXCLUDED = [
    // The marketing system. All four stand on the scoped .page token set of
    // the public site, not on --app-*, and are out of Note 15 entirely.
    // considered.module.css is that token set's own home: the shared ground
    // (tokens, buttons, the design-partner form) the four marketing page
    // modules compose from.
    'app/components/considered/considered.module.css',
    'app/components/considered/SiteFooter.module.css',
    'app/components/considered/SiteNav.module.css',
    'app/components/considered/StackGlance.module.css',
  ];

  /**
   * A third category, and it is NOT a softer EXCLUDED.
   *
   * EXCLUDED means "on another system, out of Note 15 entirely", which is
   * true of the two marketing modules and false of these two. Calling
   * these excluded would be the same species of lie the chain keeps
   * finding: a list that reads as complete because nobody can see what is
   * missing from it. They are in Note 15's remit, on --app-*, behind auth,
   * and simply never put through a sub-step.
   *
   * So they are stated instead, with the work each still needs. This turns
   * an invisible hole into a recorded one, which is the whole discipline
   * designSemantics' STATED_HOLES embodies: the hole is not the failure,
   * a hole nobody can see is.
   *
   * Held from BOTH sides. An entry must still genuinely fail conversion
   * (the assertion below re-runs the real checks), so this can never
   * become a parking space for a surface that has since been converted and
   * left here out of habit.
   */
  const UNCONVERTED = new Map([
    [
      'app/dashboard/team/page.module.css',
      {
        why: 'The team and access engine: invites, seat count, role chips, deactivation. Same shape as the launcher and further from the language. All 7 distinct sizes across its 16 font-size declarations are exact scale steps written as literals (base, 2xs, md, control, sm, xs, 3xs), so the type is mechanical here too. Its 18 spacing declarations include 1.25rem, 0.3rem, 1.6rem, 1.75rem, 1.1rem, 0.9rem, 0.4rem and 0.6rem, none of them rhythm steps. It also hand-builds both primitives this session extracted, so converting it wants doing after that landing, not before.',
      },
    ],
  ]);

  function modulesUnder(dir) {
    const out = [];
    const abs = path.join(ROOT, dir);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...modulesUnder(rel));
      else if (entry.name.endsWith('.module.css')) out.push(rel);
    }
    return out;
  }

  const found = TREES.flatMap(modulesUnder).sort();

  it('finds modules at all, so the assertions below can bite', () => {
    expect(found.length).toBeGreaterThan(10);
  });

  it('every module is either converted, excluded, or stated unconverted', () => {
    const accounted = new Set([...CONVERTED, ...EXCLUDED, ...UNCONVERTED.keys()]);
    const orphans = found.filter((rel) => !accounted.has(rel));
    expect(
      orphans,
      `unhomed authenticated modules. Convert them, or name them in ` +
        `EXCLUDED or UNCONVERTED with a reason:\n  ${orphans.join('\n  ')}`
    ).toEqual([]);
  });

  it('names nothing that has stopped existing', () => {
    // A stale entry is how a list starts lying. All three lists are held to
    // the filesystem, so a deleted or moved module fails here rather than
    // quietly padding the count.
    const real = new Set(found);
    const ghosts = [...CONVERTED, ...EXCLUDED, ...UNCONVERTED.keys()].filter(
      (rel) => !real.has(rel)
    );
    expect(
      ghosts,
      `listed but not on disk:\n  ${ghosts.join('\n  ')}`
    ).toEqual([]);
  });

  it('files nothing under two headings at once', () => {
    const converted = new Set(CONVERTED);
    expect(EXCLUDED.filter((rel) => converted.has(rel))).toEqual([]);
    const excluded = new Set(EXCLUDED);
    expect(
      [...UNCONVERTED.keys()].filter(
        (rel) => converted.has(rel) || excluded.has(rel)
      )
    ).toEqual([]);
  });

  it('gives every stated-unconverted module a reason, not just a name', () => {
    for (const [rel, { why }] of UNCONVERTED) {
      expect(typeof why, rel).toBe('string');
      expect(why.length, `${rel} needs a real reason`).toBeGreaterThan(60);
    }
  });

  it('every stated-unconverted module really is still unconverted', () => {
    // The other direction, and the one that stops this becoming a parking
    // space. A surface listed here must STILL fail the converted-surface
    // checks; the moment someone puts it through a sub-step, this fails and
    // says where it belongs. The checks are the real ones, called through
    // the same helpers the CONVERTED assertions use, so the two can never
    // mean different things.
    for (const [rel] of UNCONVERTED) {
      const offenders = [...typeOffenders(rel), ...spaceOffenders(rel)];
      expect(
        offenders.length,
        `${rel} now passes the converted-surface checks. It is converted: ` +
          `move it from UNCONVERTED to CONVERTED.`
      ).toBeGreaterThan(0);
    }
  });
});

/**
 * Every font-size in a module that is not on the --app-text scale.
 *
 * Hoisted out of the assertion below so the UNCONVERTED list can be held
 * from the other side: an entry there must still PRODUCE offenders, or it
 * has quietly become converted and the list has become a parking space.
 * The assertion itself is unchanged; this is the same check, called twice.
 */
function typeOffenders(rel) {
  const css = stripComments(read(rel));
  const js = siblingJs(rel);
  const spans = svgTextTagSpans(js);

  /** True when every class in the selector is used in the sibling JS,
   *  and every one of those uses is on an SVG text element. */
  function drawnInSvgCoordinates(selector) {
    const names = classesIn(selector);
    if (names.length === 0) return false;
    return names.every((name) => {
      const uses = [...js.matchAll(new RegExp(`\\bstyles\\.${name}\\b`, 'g'))];
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
      } else if (/^[0-9.]+px$/.test(value) && drawnInSvgCoordinates(selector)) {
        // Chart text: part of the drawing, not of the document's type.
      } else {
        offenders.push(`${selector}: ${value}`);
      }
    }
  }
  return offenders;
}

describe('type on a converted surface rides the --app-text scale', () => {
  for (const rel of CONVERTED) {
    it(rel, () => {
      const offenders = typeOffenders(rel);
      expect(
        offenders,
        `font sizes off the scale in ${rel}:\n  ${offenders.join('\n  ')}`
      ).toEqual([]);
    });
  }
});

/**
 * Every positive-space declaration in a module that is off the --app-space
 * rhythm. Hoisted for the same reason as typeOffenders above.
 */
const spaceOffenders = (() => {
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

  return function spaceOffenders(rel) {
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
    return offenders;
  };
})();

describe('positive space on a converted surface rides the --app-space rhythm', () => {
  for (const rel of CONVERTED) {
    it(rel, () => {
      const offenders = spaceOffenders(rel);
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
   * Category (a): the exposure reads, added in sub-step 6 and widened by
   * the STACK conversion.
   *
   * The dashboard's amber is not criticality and renaming it to say so
   * would be a lie: criticality is what an item THREATENS, the ladder is
   * how threatened an objective currently IS. objectiveStatusAppearance
   * gives at_risk and slipping amber deliberately, because on the ladder
   * amber is EXPOSURE, brightening toward breach while red stays reserved
   * for breach itself. designSemantics already names those two in its
   * allowedAmber set. STACK's CONSIDER verdict is the same argument in the
   * appraisal's vocabulary (inside the consider band: exposed, not
   * failed), and stackVerdictAppearance spends exactly the ladder's bright
   * amber for it. The axes never blur, so the names must not either.
   *
   * The permission and the lock-step are the SAME assertion: a rule passes
   * only if every amber token it spends belongs to ONE exposure
   * appearance, and it spends at least one. A rule that merely looks like
   * a status name does not pass; a rule that reaches for any other amber
   * does not pass, even one resolving to an identical value.
   */
  function isLadderRung(body) {
    const spent = varsIn(body).filter((t) => AMBER_TOKEN.test(t));
    if (spent.length === 0) return false;
    const EXPOSURE = [
      objectiveStatusAppearance('at_risk'),
      objectiveStatusAppearance('slipping'),
      stackVerdictAppearance('CONSIDER'),
    ];
    return EXPOSURE.some((a) => {
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
      // five that did were found: they spent the retired --app-signal-border
      // and --app-critical-bg where the mapping named --app-critical-border
      // and --app-signal-wash. Those two pairs were byte-identical twins,
      // which is why the wrong name still looked right, and the reason a
      // later session collapsed the four names into --app-signal-wash and
      // --app-signal-border. Both retired names are gone; the shape of the
      // mistake they made possible is what this assertion still catches.
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

describe("the STACK verdict wears stackVerdictAppearance, tag and cells alike", () => {
  // The loose-ends arc. Before conversion the tool told three colour
  // stories of its own: GO wore the success green (a status verdict, which
  // is exactly what the green rule excludes), CONSIDER a hand-picked amber
  // wash, and the comparison's selected route a decorative amber. The
  // verdict now has one mapping, and these assertions are computed from it
  // so a corrected mapping propagates here without reopening the surface.
  const css = stripComments(read('app/stack/app/stack.module.css'));
  const blocks = new Map(
    rules(css).map(({ selector, body }) => [selector.trim(), body])
  );

  // Selector -> the decision it wears and the parts of the appearance that
  // rule sets. The tag family carries the full read; the sensitivity cells
  // spend the ink alone, weight marking the two flagged reads.
  const RULES = [
    ['.decisionGo', 'GO', ['ink', 'border']],
    ['.decisionConsider', 'CONSIDER', ['ink', 'border']],
    ['.decisionNoGo', 'NO GO', ['ink', 'fill', 'border']],
    ['.cellGo', 'GO', ['ink']],
    ['.cellConsider', 'CONSIDER', ['ink']],
    ['.cellNoGo', 'NO GO', ['ink']],
  ];

  for (const [selector, decision, parts] of RULES) {
    it(`${selector} spends the '${decision}' appearance`, () => {
      const a = stackVerdictAppearance(decision);
      const body = blocks.get(selector);
      expect(body, `${selector} missing from stack.module.css`).toBeTruthy();
      for (const part of parts) {
        expect(
          body,
          `${selector} should spend ${part} = var(${a[part]})`
        ).toContain(`var(${a[part]})`);
      }
    });
  }

  it('the tag family states its fill either way, so calm stays hollow', () => {
    // GO and CONSIDER have no fill in the mapping and must say so rather
    // than inherit whatever the base rule carries; NO GO is the one filled
    // read.
    expect(stackVerdictAppearance('GO').fill).toBeNull();
    expect(stackVerdictAppearance('CONSIDER').fill).toBeNull();
    expect(blocks.get('.decisionGo')).toContain('background: transparent');
    expect(blocks.get('.decisionConsider')).toContain('background: transparent');
    expect(stackVerdictAppearance('NO GO').fill).toBeTruthy();
  });

  it('no verdict rule re-picks a signal or danger colour locally', () => {
    // Whatever loud token any of these rules spends must be one the
    // mapping names. A hand-picked amber or red fails here even where it
    // resolves to an identical value.
    const legal = new Set(
      ['GO', 'CONSIDER', 'NO GO'].flatMap((d) => {
        const a = stackVerdictAppearance(d);
        return [a.ink, a.fill, a.border, a.markFill].filter(Boolean);
      })
    );
    const offenders = [];
    for (const [selector] of RULES) {
      for (const token of varsIn(blocks.get(selector) || '')) {
        if (/signal|ochre|critical|danger/.test(token) && !legal.has(token)) {
          offenders.push(`${selector}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the tool spends no success green: a verdict is not a recorded fact', () => {
    // The green rule, held at the stylesheet: the report's one green left
    // with the conversion, and nothing may bring one back without a value
    // that IS a recorded fact.
    expect(/--app-success/.test(css)).toBe(false);
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

describe('a composition primitive cannot be hand-built again', () => {
  /**
   * The follow-on's other half. The token layer names COLOURS and
   * lib/design/semantics.js names MEANINGS; neither names SHAPES, so two
   * idioms the design language describes by name had no existence in the
   * code. The seated panel was spent as four separate properties by 31
   * rules across 13 files, and the mono micro-label pill as five by nine
   * rules across seven. That is the same "one intent expressed N times"
   * disease the token layer was cured of, one level up.
   *
   * app/components/instrument.module.css holds them now, and a consumer
   * REMOVES the declarations and composes instead. So the claim is simply
   * that nobody carries a whole recipe by hand any more: if you want it,
   * you compose it, and then you do not carry it.
   *
   * Scoped as a computable SHAPE, not a file allowlist: any rule, in any
   * authenticated module, that sets every property of a recipe to the
   * recipe's own value. Two limits, stated rather than hidden:
   *
   *   1. It fires on the WHOLE recipe. A rule carrying three of the four
   *      is a different idiom, not a lapse, and ProgrammeTracking's
   *      .blockEmpty is today's only one: an empty-state well that always
   *      nests INSIDE .panel or .block, so it drops the shadow rather than
   *      double-seating a panel within a panel. The language is explicit
   *      that panels seat on hairlines and never float as gapped cards.
   *      Widening this to three-of-four would flag that as a defect and be
   *      wrong.
   *   2. It fires on the recipe's own VALUES. Workspace's .nextStep sets
   *      the same four properties from --app-surface-raised and
   *      --app-border-strong, and is a raised call to action rather than a
   *      seated panel. A guard keyed on property names alone would drag it
   *      in and force a variant that means something else.
   */
  const TREES = ['app/pulse/app', 'app/components', 'app/dashboard', 'app/stack/app'];
  const PRIMITIVE = 'app/components/instrument.module.css';

  const RECIPES = [
    {
      name: 'seatedPanel',
      declarations: [
        /(?:^|[;{\s])background:\s*var\(--app-surface\)\s*(?:;|$)/,
        /(?:^|[;{\s])border:\s*1px solid var\(--app-border\)\s*(?:;|$)/,
        /(?:^|[;{\s])border-radius:\s*var\(--app-radius-lg\)\s*(?:;|$)/,
        /(?:^|[;{\s])box-shadow:\s*var\(--app-elev-1\)\s*(?:;|$)/,
      ],
    },
    {
      name: 'microLabel',
      declarations: [
        /(?:^|[;{\s])font-family:\s*var\(--app-font-mono\), monospace\s*(?:;|$)/,
        /(?:^|[;{\s])font-size:\s*var\(--app-text-2xs\)\s*(?:;|$)/,
        /(?:^|[;{\s])font-weight:\s*500\s*(?:;|$)/,
        /(?:^|[;{\s])text-transform:\s*uppercase\s*(?:;|$)/,
        /(?:^|[;{\s])border-radius:\s*999px\s*(?:;|$)/,
      ],
    },
  ];

  function modulesUnder(dir) {
    const out = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...modulesUnder(rel));
      else if (entry.name.endsWith('.module.css')) out.push(rel);
    }
    return out;
  }

  const modules = TREES.flatMap(modulesUnder).filter((rel) => rel !== PRIMITIVE);

  it('found the modules, so the assertions below can bite', () => {
    expect(modules.length).toBeGreaterThan(15);
  });

  it('the primitives really are defined where they claim to be', () => {
    // Without this the assertion below would pass beautifully on a repo
    // where the recipes had been deleted and every consumer left bare.
    const css = stripComments(read(PRIMITIVE));
    const defined = new Map(
      rules(css).map(({ selector, body }) => [selector.trim(), body])
    );
    for (const recipe of RECIPES) {
      const body = defined.get(`.${recipe.name}`);
      expect(body, `.${recipe.name} missing from ${PRIMITIVE}`).toBeTruthy();
      for (const declaration of recipe.declarations) {
        // microLabel's own declarations may arrive through its composes
        // chain, so check the recipe resolves rather than the literal rule.
        const resolved =
          body +
          (body.match(/composes:\s*([A-Za-z][A-Za-z0-9_-]*)/g) || [])
            .map((c) => defined.get(`.${c.split(/\s+/).pop()}`) ?? '')
            .join('\n');
        expect(
          declaration.test(resolved),
          `.${recipe.name} no longer carries ${declaration}`
        ).toBe(true);
      }
    }
  });

  for (const recipe of RECIPES) {
    it(`no surface hand-builds ${recipe.name}`, () => {
      const offenders = [];
      for (const rel of modules) {
        for (const { selector, body } of rules(stripComments(read(rel)))) {
          if (recipe.declarations.every((d) => d.test(body))) {
            offenders.push(`${rel} ${selector.trim()}`);
          }
        }
      }
      expect(
        offenders,
        `${recipe.name} spelled out by hand instead of composed. Remove the ` +
          `declarations and add:\n  composes: ${recipe.name} from ` +
          `'<relative path>/instrument.module.css';\n  ${offenders.join('\n  ')}`
      ).toEqual([]);
    });
  }

  it('the primitives are actually consumed, not merely defined', () => {
    // A recipe nobody composes is a recipe that has quietly been abandoned
    // while the guard above went on passing for want of anything to catch.
    const composed = new Map(RECIPES.map((r) => [r.name, 0]));
    for (const rel of modules) {
      for (const m of read(rel).matchAll(
        /composes:\s*([A-Za-z][A-Za-z0-9_-]*)\s+from\s+'[^']*instrument\.module\.css'/g
      )) {
        if (composed.has(m[1])) composed.set(m[1], composed.get(m[1]) + 1);
      }
    }
    // neutralChip composes microLabel inside the primitive, so surfaces
    // reaching for the chip count toward the label too.
    for (const [name, count] of composed) {
      expect(count, `nothing composes ${name}`).toBeGreaterThan(0);
    }
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
