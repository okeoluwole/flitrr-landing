/**
 * STACK saved scheme store (Bucket 3.2), the data layer over stack_schemes
 * (migration 028).
 *
 * INPUTS ONLY, NEVER RESULTS. The engine is deterministic, so a saved scheme
 * holds the complete input set and the engine version that computed it at the
 * moment of save; a loaded scheme recomputes under the current engine. The
 * store never touches the engine: normalising inputs and recomputing are the
 * server action's job, storage is this layer's.
 *
 * ORG-SCOPED, ROLE-ENFORCED BY THE DATABASE. Row level security (028, the
 * uniform 024 rule) scopes every read to the caller's organisation and every
 * write to an organisation admin, and the BEFORE INSERT trigger tenants a new
 * scheme, so no function here takes or sets organisation_id. This layer passes
 * the database's answer up faithfully; it never widens it.
 *
 * THE SHAPE. Following the repo's persistence convention
 * (programmeActualsStore, programmeBaselineStore): the pure helpers carry the
 * logic and are unit-tested in isolation, and the async functions are thin
 * wrappers that take the caller's already-awaited Supabase client and return
 * the data alongside Supabase's { error } (null on error).
 */

// The columns the list surface reads. Deliberately without inputs: the list is
// a directory, not a payload, and an organisation's schemes should stay cheap
// to fetch however large each input set is.
export const SCHEME_SUMMARY_COLUMNS =
  'id, name, engine_version, created_at, updated_at';

// The columns a full load reads: the summary plus the input set itself.
export const SCHEME_FULL_COLUMNS = `${SCHEME_SUMMARY_COLUMNS}, inputs`;

// The longest name the store accepts. The database only requires non-blank
// (028); the cap is a UX guard so the list stays readable.
export const SCHEME_NAME_MAX_LENGTH = 120;

/**
 * Clean a scheme name for storage: trim it and cap its length. Returns the
 * cleaned name, or null when nothing usable remains, so callers can reject a
 * blank name before it reaches the database (which would reject it anyway via
 * the not-blank check in 028).
 */
export function cleanSchemeName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, SCHEME_NAME_MAX_LENGTH);
}

/**
 * The sentence shown when a scheme saved under one engine version is recomputed
 * under another, so the developer knows the figures may not match the run they
 * saved. Null when the versions match (the normal case) or when either version
 * is missing, since no honest comparison can be made then.
 */
export function engineVersionNote(savedVersion, currentVersion) {
  if (!savedVersion || !currentVersion) return null;
  if (savedVersion === currentVersion) return null;
  return `Saved under engine ${savedVersion}, recomputed under ${currentVersion}. Figures may differ from the saved run.`;
}

/**
 * The client shape of a scheme summary, from a stored row: camelCase and
 * without the input payload, the one shape the list surface and every action
 * response share.
 */
export function schemeSummary(row) {
  return {
    id: row.id,
    name: row.name,
    engineVersion: row.engine_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List the organisation's saved schemes, newest first (updated_at DESC, the
 * order the 028 index serves). Row level security scopes the read; no filter is
 * passed here. Returns { schemes, error }, an empty array when there are none.
 */
export async function listSchemes(supabase) {
  const { data, error } = await supabase
    .from('stack_schemes')
    .select(SCHEME_SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) return { schemes: null, error };
  return { schemes: data ?? [], error: null };
}

/**
 * Save a new scheme: a name, the complete engine input set, and the engine
 * version stamping what computed it. organisation_id and created_by are the
 * database's to fill (the 028 trigger and the caller's session). A blank name
 * is rejected before the write. Returns { scheme, error }, the stored summary
 * row on success.
 */
export async function insertScheme(supabase, { name, inputs, engineVersion }) {
  const cleanName = cleanSchemeName(name);
  if (cleanName === null) {
    return { scheme: null, error: new Error('a scheme name is required') };
  }
  const { data, error } = await supabase
    .from('stack_schemes')
    .insert({ name: cleanName, inputs, engine_version: engineVersion })
    .select(SCHEME_SUMMARY_COLUMNS)
    .single();
  if (error) return { scheme: null, error };
  return { scheme: data, error: null };
}

/**
 * Save over an existing scheme: replace its name, inputs, and engine version
 * stamp in one write. created_by and created_at are untouched (the audit stamp
 * survives a save-over); updated_at bumps via the shared trigger. Returns
 * { scheme, error }; a scheme the caller cannot see or write (row level
 * security) comes back as an error, never as someone else's row.
 */
export async function updateScheme(supabase, { id, name, inputs, engineVersion }) {
  const cleanName = cleanSchemeName(name);
  if (cleanName === null) {
    return { scheme: null, error: new Error('a scheme name is required') };
  }
  const { data, error } = await supabase
    .from('stack_schemes')
    .update({ name: cleanName, inputs, engine_version: engineVersion })
    .eq('id', id)
    .select(SCHEME_SUMMARY_COLUMNS)
    .single();
  if (error) return { scheme: null, error };
  return { scheme: data, error: null };
}

/**
 * Load one scheme in full, inputs included, for the load-back path. Returns
 * { scheme, error }.
 */
export async function getScheme(supabase, id) {
  const { data, error } = await supabase
    .from('stack_schemes')
    .select(SCHEME_FULL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return { scheme: null, error };
  return { scheme: data, error: null };
}

/**
 * Delete a saved scheme. Row level security restricts this to an organisation
 * admin; a scheme outside the caller's reach deletes nothing and is not an
 * error, exactly as the database reports it. Returns { error }.
 */
export async function deleteScheme(supabase, id) {
  const { error } = await supabase
    .from('stack_schemes')
    .delete()
    .eq('id', id);
  return { error: error ?? null };
}
