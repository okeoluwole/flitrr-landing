/**
 * The print block's coverage (Note 15 follow-on, Part A).
 *
 * The instrument is a screen surface. If any app page beyond the Brief
 * reaches a printer, the @media print block in app/globals.css flips the
 * --app-* tokens to dark-on-white so the sheet stays legible instead of
 * printing near-white ink on white. That is the block's own stated intent.
 *
 * It did not finish the job. It remapped the two amber INKS and left every
 * amber wash, border and solid at its screen value, so a criticality wash
 * printed as 0.10 alpha of a bright yellow on white and the criticality
 * mark printed as #F4C031. The loudest thing on the instrument became the
 * faintest thing on the page, which inverts the read criticality exists to
 * carry, and nothing could see it: a token nobody remapped looks exactly
 * like a token nobody needed to remap.
 *
 * That is the same shape designSemantics gave the paper register's holes,
 * and this test is the same answer. The claim is deliberately NOT "every
 * --app-* token must be remapped", because some legitimately must not be.
 * It is: every token left at its screen value is named here with a reason,
 * held in both directions, so a new omission fails as unstated and a stale
 * entry fails as rotted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const GLOBALS = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');

const CSS = GLOBALS.replace(/\/\*[\s\S]*?\*\//g, '');

/** The source of the block opening at `from`, brace-matched. */
function blockAt(css, from) {
  const open = css.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

function declarations(source) {
  const out = new Map();
  for (const m of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  }
  return out;
}

/**
 * Every custom property defined OUTSIDE any at-rule: the screen values.
 * The at-rule exclusion is what separates a definition from a medium
 * override, which is the whole distinction this file is about.
 */
const BASE = (() => {
  const defs = new Map();
  const stack = [];
  let buf = '';
  for (const ch of CSS) {
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const selector = stack.pop() ?? '';
      const insideAtRule =
        selector.startsWith('@') || stack.some((s) => s.startsWith('@'));
      if (!insideAtRule) {
        for (const [name, value] of declarations(buf)) defs.set(name, value);
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  return defs;
})();

/** Everything the @media print block re-tunes. */
const PRINT = (() => {
  const at = CSS.indexOf('@media print');
  expect(at, '@media print block not found in globals.css').toBeGreaterThan(-1);
  return declarations(blockAt(CSS, at));
})();

/**
 * The unit, stated so a later count means the same thing: every --app-*
 * custom property EXCEPT the four scales, which carry lengths and faces
 * rather than colour and so need no flip. Elevation is not excluded, and
 * does not need to be: the block already remaps all three to `none`.
 */
// The family root is matched as well as its steps, because --app-radius is
// a token in its own right beside --app-radius-sm and --app-radius-lg. A
// bare prefix would have let it through, and did.
const SCALE = /^--app-(text|space|font|radius)(-|$)/;
const inScope = (name) => name.startsWith('--app-') && !SCALE.test(name);

const DEFINED = [...BASE.keys()].filter(inScope).sort();
const REMAPPED = [...PRINT.keys()].filter(inScope).sort();
const UNREMAPPED = DEFINED.filter((name) => !PRINT.has(name));

/**
 * The tokens deliberately left at their screen value, each with the reason.
 * Three groups, and they are NOT equivalent: one is a token nothing spends,
 * one is a pair measurement showed is not broken on paper, and one is
 * chrome that never reaches the page at all.
 */
const SCREEN_ONLY = new Map([
  [
    '--app-signal-strong',
    {
      why: 'The one amber left behind, and only because nothing consumes it: a repo-wide search finds its definition and two lines of documentation, no var(--app-signal-strong) anywhere. Picking a paper value for a spend that does not exist is the same guess the paper register refuses to make, so the decision waits for its first consumer. This entry is where it gets taken.',
    },
  ],
  [
    '--app-danger-wash',
    {
      why: 'The --doc-* register has no danger family to borrow from, and unlike the amber pair this one is not broken on paper: the salmon rgb(232, 120, 100) is far darker than the bright amber, so at 0.12 over white the wash still seats the remapped --app-danger #9c3d2a at 6.00:1. Inventing a paper red to fix something measurement says is working is how a register acquires a second, rival source of meaning.',
    },
  ],
  [
    '--app-danger-border',
    {
      why: 'Same reason as the wash it pairs with. Composited over white the 0.45 salmon lands at rgb(245, 194, 185), which still reads as an edge, where the bright amber border it superficially resembled composited to rgb(250, 229, 168) and read as nothing. The two cases look identical in shape and differ in fact, which is why each was measured rather than assumed.',
    },
  ],
  ...[
    '--app-console-raised',
    '--app-console-edge',
    '--app-on-console',
    '--app-on-console-secondary',
    '--app-on-console-faint',
    '--app-console-hairline',
    '--app-console-hairline-strong',
  ].map((name) => [
    name,
    {
      why: 'Console chrome, which never reaches the page: DashboardShell.module.css hides .topBar with display: none !important inside its own @media print block, and every consumption of a console token in the repo sits on .topBar or one of its descendants. A token no printed rule can spend has no paper value to get wrong. (--app-console itself IS remapped, harmlessly, for the same reason it does not matter.)',
    },
  ]),
  ...['--app-focus', '--app-focus-on-console'].map((name) => [
    name,
    {
      why: 'A focus ring is a live interaction state. Paper has no keyboard focus, so no :focus-visible rule can match in the print medium and the token is unreachable there. Remapping it would be dressing a state that cannot occur, and --app-focus-ring (the paired soft glow, which CAN bleed through a box-shadow) is remapped to transparent precisely because it is the half of the pair that does reach the page.',
    },
  ]),
]);

/**
 * The three amber values borrowed from the document register, made
 * computable. The print block writes them literally rather than as
 * var(--doc-*), because the two registers are deliberately independent and
 * lib/design/semantics.js is the ONE place they are tied together. That
 * keeps the pairing traceable without making it structural, and this table
 * is what stops the comment saying one thing while the value says another.
 */
const PAPER_BORROW = new Map([
  ['--app-signal-wash', '--doc-signal-wash'],
  ['--app-signal-border', '--doc-signal-border'],
  ['--app-signal-ink', '--doc-ochre'],
]);

describe('the print block covers what it claims to cover', () => {
  it('parsed both halves, so the assertions below can bite', () => {
    expect(DEFINED.length).toBeGreaterThan(40);
    expect(REMAPPED.length).toBeGreaterThan(20);
  });

  it('leaves at its screen value exactly the tokens named here', () => {
    expect(
      [...UNREMAPPED].sort(),
      'a token left at its screen value with no stated reason, or a stated ' +
        'reason for a token that is now remapped. The print block flips the ' +
        'instrument to dark-on-white; a token that misses the flip prints its ' +
        'screen value on white and nothing says so.'
    ).toEqual([...SCREEN_ONLY.keys()].sort());
  });

  it('names nothing that has stopped being defined', () => {
    // A stale entry is how a list starts lying, so it is held to the
    // stylesheet the same way CONVERTED is held to the filesystem.
    const real = new Set(DEFINED);
    const ghosts = [...SCREEN_ONLY.keys()].filter((name) => !real.has(name));
    expect(ghosts, `listed but no longer defined:\n  ${ghosts.join('\n  ')}`)
      .toEqual([]);
  });

  it('gives every screen-only token a reason, not just a name', () => {
    // A bare allowlist would be the failure mode wearing a test's clothes.
    for (const [name, { why }] of SCREEN_ONLY) {
      expect(typeof why, name).toBe('string');
      expect(why.length, `${name} needs a real reason`).toBeGreaterThan(60);
    }
  });

  it('remaps the whole amber family bar the one stated exception', () => {
    // The defect this file exists for, stated directly: amber is the one
    // colour the language gives a single meaning, so a half-remapped amber
    // family is a criticality read that inverts itself on paper.
    const amber = DEFINED.filter((name) => /^--app-signal/.test(name));
    expect(amber.length, 'the amber filter has gone stale').toBeGreaterThan(4);
    const missed = amber.filter(
      (name) => !PRINT.has(name) && !SCREEN_ONLY.has(name)
    );
    expect(missed, `amber left on screen values:\n  ${missed.join('\n  ')}`)
      .toEqual([]);
  });
});

describe('the print block borrows the document register by value, not by reference', () => {
  it('every borrowed value equals the --doc-* token it names', () => {
    for (const [appToken, docToken] of PAPER_BORROW) {
      const printed = PRINT.get(appToken);
      const doc = BASE.get(docToken);
      expect(doc, `${docToken} is not defined in globals.css`).toBeTruthy();
      expect(
        printed,
        `${appToken} should carry ${docToken}'s value (${doc})`
      ).toBe(doc);
    }
  });

  it('no print value reaches for a --doc-* token through var()', () => {
    // The coupling lib/design/semantics.js exists to prevent. A var()
    // reference here would make the instrument depend on the document,
    // rather than the two registers agreeing on a value and saying so.
    const offenders = [...PRINT]
      .filter(([, value]) => /var\(\s*--doc-/.test(value))
      .map(([name, value]) => `${name}: ${value}`);
    expect(
      offenders,
      `the print block must write --doc-* values literally:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('the amber solid deliberately does NOT take --doc-signal', () => {
    // The one borrow that was checked and refused. --doc-signal is the same
    // bright #F4C031, and on the document it works because PAPER_COUNTERPART
    // maps --app-ground to --doc-navy, so the criticality mark reads navy on
    // amber at 10.97:1. This block remaps --app-ground to #ffffff, so the
    // same value would be white on amber at 1.69:1. A value cannot be
    // borrowed without the context that justified it.
    expect(PRINT.get('--app-signal')).not.toBe(BASE.get('--doc-signal'));
    expect(PRINT.get('--app-signal')).toBe(BASE.get('--doc-ochre'));
  });
});
