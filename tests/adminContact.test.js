import { describe, it, expect } from 'vitest';
import { buildAdminContactLine } from '../lib/team/adminContact.js';

/**
 * The read-only contact line: a member is told, by name, who to contact to
 * request a change, with a clean generic fallback when no name is available.
 */

describe('buildAdminContactLine', () => {
  it('names the admin when a name is given', () => {
    expect(buildAdminContactLine('Olu Okeoluwole')).toBe(
      'Contact your organisation admin, Olu Okeoluwole, to request changes.'
    );
  });

  it('falls back to a generic line when no name is available', () => {
    expect(buildAdminContactLine(null)).toBe(
      'Contact your organisation admin to request changes.'
    );
    expect(buildAdminContactLine(undefined)).toBe(
      'Contact your organisation admin to request changes.'
    );
    expect(buildAdminContactLine('')).toBe(
      'Contact your organisation admin to request changes.'
    );
  });

  it('treats a whitespace-only name as no name', () => {
    expect(buildAdminContactLine('   ')).toBe(
      'Contact your organisation admin to request changes.'
    );
  });

  it('trims surrounding whitespace from a real name', () => {
    expect(buildAdminContactLine('  Ada Lovelace  ')).toBe(
      'Contact your organisation admin, Ada Lovelace, to request changes.'
    );
  });

  it('ignores a non-string name rather than rendering it', () => {
    expect(buildAdminContactLine(42)).toBe(
      'Contact your organisation admin to request changes.'
    );
    expect(buildAdminContactLine({ full_name: 'x' })).toBe(
      'Contact your organisation admin to request changes.'
    );
  });

  it('contains no em dash or en dash', () => {
    const named = buildAdminContactLine('Sam');
    const generic = buildAdminContactLine(null);
    expect(named).not.toMatch(/[–—]/);
    expect(generic).not.toMatch(/[–—]/);
  });
});
