import { describe, it, expect } from 'vitest';
import {
  SCHEME_SUMMARY_COLUMNS,
  SCHEME_FULL_COLUMNS,
  SCHEME_NAME_MAX_LENGTH,
  cleanSchemeName,
  engineVersionNote,
  schemeSummary,
  listSchemes,
  insertScheme,
  updateScheme,
  getScheme,
  deleteScheme,
} from '../lib/stack/schemeStore.js';

/**
 * STACK saved scheme store (Bucket 3.2). Proves the pure helpers (name
 * cleaning, the engine version note, the client summary shape) and the async
 * wrappers against a faithful in-memory fake of the migration 028 contract:
 * the BEFORE INSERT trigger tenants a row, the shared trigger bumps
 * updated_at on save-over while the audit stamp survives, and row level
 * security scopes reads to the organisation and writes to an admin (a denied
 * insert reports a policy violation, a denied update matches no row, a denied
 * delete removes nothing without error). So a save goes through the genuine
 * insertScheme and the reads through the genuine load functions, exactly the
 * calls the server actions make.
 */

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const ADMIN = 'user-admin';

// ── A faithful in-memory fake of the migration 028 store ────────────────────
// One table, stack_schemes. The caller identity carries an organisation and a
// role; RLS scopes every read to the organisation and every write to an admin.
function makeFakeSupabase({ organisationId = ORG, role = 'admin', rows = [] } = {}) {
  const table = rows.map((r) => ({ ...r }));
  let idSeq = 0;
  let clock = 0;
  const stamp = () => `2026-07-13T00:00:${String(++clock).padStart(2, '0')}.000Z`;
  const isAdmin = role === 'admin';
  const writes = { inserts: 0, updates: 0, deletes: 0 };

  const visible = () => table.filter((r) => r.organisation_id === organisationId);

  // Project the requested columns, as PostgREST does, so a summary read really
  // comes back without the inputs payload.
  function project(row, columns) {
    const wanted = columns.split(',').map((c) => c.trim());
    const out = {};
    for (const key of wanted) out[key] = row[key];
    return out;
  }

  function selectBuilder(columns) {
    const filters = [];
    let order = null;
    const matched = () => {
      let out = visible().filter((r) => filters.every(([c, v]) => r[c] === v));
      if (order) {
        out = [...out].sort((a, b) => {
          const va = a[order.col];
          const vb = b[order.col];
          if (va === vb) return 0;
          const cmp = va < vb ? -1 : 1;
          return order.ascending ? cmp : -cmp;
        });
      }
      return out.map((r) => project(r, columns));
    };
    return {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      order(col, opts) {
        order = { col, ascending: opts?.ascending !== false };
        return this;
      },
      single() {
        return Promise.resolve().then(() => {
          const out = matched();
          if (out.length !== 1) {
            return {
              data: null,
              error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
            };
          }
          return { data: out[0], error: null };
        });
      },
      then(resolve, reject) {
        return Promise.resolve({ data: matched(), error: null }).then(resolve, reject);
      },
    };
  }

  function insertBuilder(values) {
    return {
      select(columns) {
        return {
          single() {
            return Promise.resolve().then(() => {
              if (!isAdmin) {
                return {
                  data: null,
                  error: { code: '42501', message: 'new row violates row-level security policy for table "stack_schemes"' },
                };
              }
              if (typeof values.name !== 'string' || values.name.trim().length === 0) {
                return {
                  data: null,
                  error: { code: '23514', message: 'new row violates check constraint "stack_schemes_name_not_blank"' },
                };
              }
              writes.inserts += 1;
              const now = stamp();
              const row = {
                id: `scheme-${++idSeq}`,
                // The 028 BEFORE INSERT trigger: tenant to the caller when the
                // insert does not set an organisation.
                organisation_id: values.organisation_id ?? organisationId,
                name: values.name,
                inputs: values.inputs,
                engine_version: values.engine_version,
                created_by: ADMIN,
                created_at: now,
                updated_at: now,
              };
              table.push(row);
              return { data: project(row, columns), error: null };
            });
          },
        };
      },
    };
  }

  function updateBuilder(patch) {
    const filters = [];
    return {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      select(columns) {
        return {
          single() {
            return Promise.resolve().then(() => {
              // RLS: a non-admin's update matches no row at all.
              const targets = isAdmin
                ? visible().filter((r) => filters.every(([c, v]) => r[c] === v))
                : [];
              if (targets.length !== 1) {
                return {
                  data: null,
                  error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
                };
              }
              writes.updates += 1;
              const row = table.find((r) => r.id === targets[0].id);
              Object.assign(row, patch, { updated_at: stamp() });
              return { data: project(row, columns), error: null };
            });
          },
        };
      },
    };
  }

  function deleteBuilder() {
    const filters = [];
    return {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      then(resolve, reject) {
        let removed = 0;
        if (isAdmin) {
          for (let i = table.length - 1; i >= 0; i--) {
            const r = table[i];
            if (r.organisation_id !== organisationId) continue;
            if (!filters.every(([c, v]) => r[c] === v)) continue;
            table.splice(i, 1);
            removed += 1;
          }
        }
        if (removed > 0) writes.deletes += 1;
        return Promise.resolve({ data: null, error: null, count: removed }).then(resolve, reject);
      },
    };
  }

  return {
    from(name) {
      if (name !== 'stack_schemes') throw new Error(`unexpected table ${name}`);
      return {
        select: (columns) => selectBuilder(columns),
        insert: (values) => insertBuilder(values),
        update: (patch) => updateBuilder(patch),
        delete: () => deleteBuilder(),
      };
    },
    _table: table,
    _writes: writes,
  };
}

const INPUTS = { fundingStrategy: 'Joint venture', gdv: 5_000_000, programmeMonths: 24 };

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('cleanSchemeName', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanSchemeName('  Riverside Yard  ')).toBe('Riverside Yard');
  });

  it('rejects blank and non-string names', () => {
    expect(cleanSchemeName('')).toBeNull();
    expect(cleanSchemeName('   ')).toBeNull();
    expect(cleanSchemeName(null)).toBeNull();
    expect(cleanSchemeName(undefined)).toBeNull();
    expect(cleanSchemeName(42)).toBeNull();
  });

  it('caps the length', () => {
    const long = 'x'.repeat(SCHEME_NAME_MAX_LENGTH + 40);
    expect(cleanSchemeName(long)).toHaveLength(SCHEME_NAME_MAX_LENGTH);
  });
});

describe('engineVersionNote', () => {
  it('is silent when the versions match', () => {
    expect(engineVersionNote('1.0.0', '1.0.0')).toBeNull();
  });

  it('is silent when either version is missing', () => {
    expect(engineVersionNote(null, '1.0.0')).toBeNull();
    expect(engineVersionNote('1.0.0', null)).toBeNull();
    expect(engineVersionNote('', '')).toBeNull();
  });

  it('names both versions when they differ', () => {
    const note = engineVersionNote('1.0.0', '1.1.0');
    expect(note).toContain('1.0.0');
    expect(note).toContain('1.1.0');
    // The punctuation discipline holds even in generated sentences.
    expect(note).not.toMatch(/[–—]/);
  });
});

describe('schemeSummary', () => {
  it('maps a stored row to the client shape', () => {
    expect(
      schemeSummary({
        id: 's1',
        name: 'Riverside Yard',
        engine_version: '1.0.0',
        created_at: 'a',
        updated_at: 'b',
        inputs: INPUTS,
      })
    ).toEqual({
      id: 's1',
      name: 'Riverside Yard',
      engineVersion: '1.0.0',
      createdAt: 'a',
      updatedAt: 'b',
    });
  });
});

describe('column sets', () => {
  it('keeps the inputs payload out of the summary read', () => {
    expect(SCHEME_SUMMARY_COLUMNS).not.toContain('inputs');
    expect(SCHEME_FULL_COLUMNS).toContain('inputs');
  });
});

// ── Save, list, load, save-over, delete ──────────────────────────────────────

describe('insertScheme and listSchemes', () => {
  it('saves and lists newest first, without the inputs payload', async () => {
    const supabase = makeFakeSupabase();

    const first = await insertScheme(supabase, {
      name: 'First scheme',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(first.error).toBeNull();
    const second = await insertScheme(supabase, {
      name: 'Second scheme',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(second.error).toBeNull();

    const { schemes, error } = await listSchemes(supabase);
    expect(error).toBeNull();
    expect(schemes.map((s) => s.name)).toEqual(['Second scheme', 'First scheme']);
    expect(schemes[0]).not.toHaveProperty('inputs');
    expect(schemes[0].engine_version).toBe('1.0.0');
  });

  it('trims the stored name', async () => {
    const supabase = makeFakeSupabase();
    const { scheme } = await insertScheme(supabase, {
      name: '  Riverside Yard  ',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(scheme.name).toBe('Riverside Yard');
  });

  it('rejects a blank name before any write reaches the database', async () => {
    const supabase = makeFakeSupabase();
    const { scheme, error } = await insertScheme(supabase, {
      name: '   ',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(scheme).toBeNull();
    expect(error).toBeTruthy();
    expect(supabase._writes.inserts).toBe(0);
  });

  it('lists an empty organisation as an empty array', async () => {
    const supabase = makeFakeSupabase();
    const { schemes, error } = await listSchemes(supabase);
    expect(error).toBeNull();
    expect(schemes).toEqual([]);
  });
});

describe('getScheme', () => {
  it('round-trips the complete input set', async () => {
    const supabase = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(supabase, {
      name: 'Round trip',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });

    const { scheme, error } = await getScheme(supabase, saved.id);
    expect(error).toBeNull();
    expect(scheme.inputs).toEqual(INPUTS);
    expect(scheme.engine_version).toBe('1.0.0');
  });

  it('reports a scheme outside the organisation as not found', async () => {
    const supabase = makeFakeSupabase({
      rows: [
        {
          id: 'foreign',
          organisation_id: OTHER_ORG,
          name: 'Someone else',
          inputs: INPUTS,
          engine_version: '1.0.0',
          created_by: 'other',
          created_at: 'a',
          updated_at: 'a',
        },
      ],
    });
    const { scheme, error } = await getScheme(supabase, 'foreign');
    expect(scheme).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });
});

describe('updateScheme (save-over)', () => {
  it('replaces name, inputs and engine stamp, bumps updated_at, and preserves the audit stamp', async () => {
    const supabase = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(supabase, {
      name: 'Version one',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });

    const newInputs = { ...INPUTS, gdv: 6_000_000 };
    const { scheme: updated, error } = await updateScheme(supabase, {
      id: saved.id,
      name: 'Version two',
      inputs: newInputs,
      engineVersion: '1.1.0',
    });

    expect(error).toBeNull();
    expect(updated.name).toBe('Version two');
    expect(updated.engine_version).toBe('1.1.0');
    expect(updated.created_at).toBe(saved.created_at);
    expect(updated.updated_at > saved.updated_at).toBe(true);

    const stored = supabase._table.find((r) => r.id === saved.id);
    expect(stored.inputs).toEqual(newInputs);
    expect(stored.created_by).toBe(ADMIN);
  });

  it('rejects a blank name before any write reaches the database', async () => {
    const supabase = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(supabase, {
      name: 'Keep me',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    const { scheme, error } = await updateScheme(supabase, {
      id: saved.id,
      name: '',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(scheme).toBeNull();
    expect(error).toBeTruthy();
    expect(supabase._writes.updates).toBe(0);
  });
});

describe('deleteScheme', () => {
  it('removes the scheme', async () => {
    const supabase = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(supabase, {
      name: 'Short lived',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });

    const { error } = await deleteScheme(supabase, saved.id);
    expect(error).toBeNull();
    const { schemes } = await listSchemes(supabase);
    expect(schemes).toEqual([]);
  });

  it('deletes nothing for an unknown id, without error', async () => {
    const supabase = makeFakeSupabase();
    await insertScheme(supabase, { name: 'Still here', inputs: INPUTS, engineVersion: '1.0.0' });
    const { error } = await deleteScheme(supabase, 'no-such-id');
    expect(error).toBeNull();
    const { schemes } = await listSchemes(supabase);
    expect(schemes).toHaveLength(1);
  });
});

// ── Row level security, as the database reports it ──────────────────────────

describe('a member (admin-write denied by row level security)', () => {
  it('still reads the organisation list', async () => {
    const admin = makeFakeSupabase();
    await insertScheme(admin, { name: 'Org scheme', inputs: INPUTS, engineVersion: '1.0.0' });

    const member = makeFakeSupabase({ role: 'member', rows: admin._table });
    const { schemes, error } = await listSchemes(member);
    expect(error).toBeNull();
    expect(schemes).toHaveLength(1);
  });

  it('has an insert refused as a policy violation, passed up faithfully', async () => {
    const supabase = makeFakeSupabase({ role: 'member' });
    const { scheme, error } = await insertScheme(supabase, {
      name: 'Not allowed',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(scheme).toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('has a save-over come back as no row', async () => {
    const admin = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(admin, {
      name: 'Org scheme',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });

    const member = makeFakeSupabase({ role: 'member', rows: admin._table });
    const { scheme, error } = await updateScheme(member, {
      id: saved.id,
      name: 'Renamed',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });
    expect(scheme).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });

  it('has a delete remove nothing, without error', async () => {
    const admin = makeFakeSupabase();
    const { scheme: saved } = await insertScheme(admin, {
      name: 'Org scheme',
      inputs: INPUTS,
      engineVersion: '1.0.0',
    });

    const member = makeFakeSupabase({ role: 'member', rows: admin._table });
    const { error } = await deleteScheme(member, saved.id);
    expect(error).toBeNull();
    const { schemes } = await listSchemes(member);
    expect(schemes).toHaveLength(1);
  });
});
