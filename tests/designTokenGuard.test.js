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
