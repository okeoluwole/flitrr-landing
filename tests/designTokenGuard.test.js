/**
 * The raw-colour guard (Session K, Note 15 sub-step 1).
 *
 * The most reliable tell of generated UI is the same intent expressed as
 * four slightly different values in four modules. Session K consolidated
 * every raw colour literal in the authenticated app's CSS modules onto the
 * tokens in app/globals.css; this test is what keeps the language from
 * drifting back apart across the five sub-steps that follow. A new shade
 * is added to globals.css as a token first, then consumed by name.
 *
 * Scope: every CSS module under the authenticated app (app/pulse/app,
 * app/dashboard, and the shared DashboardShell). Marketing and auth
 * surfaces keep their own system and are out of scope. globals.css is the
 * definition site, so it is exempt by construction. There are NO exempt
 * module files: the census that opened this session found 17 literals and
 * all 17 were converted, so the assertion starts absolute.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const SCOPE_DIRS = [
  path.join(ROOT, 'app', 'pulse', 'app'),
  path.join(ROOT, 'app', 'dashboard'),
  path.join(ROOT, 'app', 'stack', 'app'),
];
const SCOPE_FILES = [
  path.join(ROOT, 'app', 'components', 'DashboardShell.module.css'),
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.module.css')) out.push(full);
  }
  return out;
}

const files = SCOPE_DIRS.flatMap((d) => walk(d)).concat(SCOPE_FILES);

/** CSS with comments stripped, so a colour named in prose does not count. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const COLOUR_LITERAL =
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\bcolor-mix\(/gi;

describe('no CSS module in the app scope carries a raw colour literal', () => {
  it('found the scope (the app really is there)', () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    it(rel, () => {
      const css = stripComments(readFileSync(file, 'utf8'));
      const hits = [];
      for (const line of css.split('\n')) {
        const m = line.match(COLOUR_LITERAL);
        if (m) hits.push(line.trim());
      }
      expect(
        hits,
        `raw colour literal(s) in ${rel}; add a token to globals.css instead:\n  ${hits.join('\n  ')}`
      ).toEqual([]);
    });
  }
});

/**
 * The other half of the same discipline, one level down.
 *
 * The guard above seals CONSUMPTION: no module may express a colour as a
 * literal, so every intent is spent by name. That is worth nothing if the
 * token layer offers two names for one intent, and for a long time it did.
 * app/globals.css defined four amber tokens that were two pairs of
 * synonyms, byte-identical in value:
 *
 *   --app-signal-wash   == --app-critical-bg     rgba(244, 192, 49, 0.10)
 *   --app-signal-border == --app-critical-border rgba(244, 192, 49, 0.42)
 *
 * That fork sat BENEATH lib/design/semantics.js, so the semantic mappings
 * could not protect a surface from it: five rules spent the wrong token of
 * a pair and looked exactly right, and criticalityAppearance('critical')
 * was itself mixed, taking its fill from one family and its border from
 * the other. Both critical names are retired. This is what stops them, or
 * any new twin, coming back.
 */
describe('no two amber tokens in one register share a value', () => {
  const GLOBALS = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');

  /**
   * Why this is scoped to the amber family and not "no two tokens share a
   * value" anywhere. The obvious blanket shape is WRONG, and provably so:
   * at the commit before the collapse it would have flagged twelve
   * colliding groups in the --app-* set, and ten of them are legitimate.
   *
   *   --app-console == --app-surface-sunken == --app-primary-ink
   *   --app-on-console == --app-ink
   *   --app-console-hairline == --app-hairline
   *   --app-primary == --app-focus == --app-focus-on-console
   *   --app-text-xs == --app-space-3
   *   ... and five more
   *
   * Those are different REGISTERS that coincide today and are free to
   * diverge tomorrow (chrome against canvas, action against focus), or in
   * the last two cases different SCALES entirely, where a type step and a
   * rhythm step share a length and mean nothing whatever to each other.
   * A blanket assertion would be the third time in this chain that a test
   * was stricter than the rule it named, after sub-step 5's blanket green
   * ban and its unsigned px arm. Both had only ever held by accident.
   *
   * So the claim is the narrow true one: amber is the one colour the
   * language gives a single meaning (criticality), which is exactly why a
   * second name for one of its values is a defect rather than a
   * coincidence. Two names cannot mean one thing when the whole point of
   * the colour is that it means one thing.
   *
   * It IS wider than the --app-* set, and honestly so: the same claim
   * holds inside --doc-* and --color-* on their own terms. What it does
   * not do is compare ACROSS registers, because the brand amber is
   * deliberately the same value in all three (--app-signal == --doc-signal
   * == --color-signal-amber == #F4C031, and PAPER_COUNTERPART pairs the
   * first two on purpose). A cross-register guard would flag the language
   * working as designed.
   */
  const AMBER_NAME = /signal|critical|ochre/;
  const REGISTERS = ['--app-', '--doc-', '--color-'];

  /**
   * Every custom property defined OUTSIDE any at-rule, last definition
   * winning, which is the cascade's own answer for same-specificity :root
   * blocks. The at-rule exclusion matters: the print block re-tunes
   * --app-signal-ink and --app-signal-ink-dim toward paper, and that is
   * one token changing medium, never a second name for one value.
   */
  function baseDefinitions(css) {
    const defs = new Map();
    const stack = [];
    let buf = '';
    for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
      if (ch === '{') {
        stack.push(buf.trim());
        buf = '';
      } else if (ch === '}') {
        const selector = stack.pop();
        const insideAtRule =
          selector.startsWith('@') || stack.some((s) => s.startsWith('@'));
        if (!insideAtRule) {
          for (const m of buf.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
            defs.set(m[1], m[2].trim());
          }
        }
        buf = '';
      } else {
        buf += ch;
      }
    }
    return defs;
  }

  const DEFS = baseDefinitions(GLOBALS);

  /** A value reduced to what it actually paints, so an alias cannot
   *  smuggle a twin back in as var(--the-other-one). */
  function resolve(value) {
    let v = value.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 10; i++) {
      const alias = v.match(/^var\((--[a-z0-9-]+)\)$/);
      if (!alias || !DEFS.has(alias[1])) break;
      v = DEFS.get(alias[1]).toLowerCase().replace(/\s+/g, ' ').trim();
    }
    return v;
  }

  it('found the token layer (globals.css really did parse)', () => {
    expect(DEFS.size).toBeGreaterThan(100);
  });

  for (const register of REGISTERS) {
    it(`${register}*`, () => {
      const family = [...DEFS].filter(
        ([name]) => name.startsWith(register) && AMBER_NAME.test(name)
      );
      expect(
        family.length,
        `no amber tokens found under ${register}; the filter has gone stale`
      ).toBeGreaterThan(0);

      const byValue = new Map();
      for (const [name, value] of family) {
        const key = resolve(value);
        if (!byValue.has(key)) byValue.set(key, []);
        byValue.get(key).push(name);
      }

      const twins = [...byValue]
        .filter(([, names]) => names.length > 1)
        .map(([value, names]) => `${names.join(' == ')}  (${value})`);

      expect(
        twins,
        `two names for one amber value. Amber carries ONE meaning, so a\n` +
          `second name for a value is a fork the semantic mappings cannot\n` +
          `see. Keep one name and move its consumers:\n  ${twins.join('\n  ')}`
      ).toEqual([]);
    });
  }
});
