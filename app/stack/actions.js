'use server';

/**
 * STACK server actions. The engine runs here, on the server, and is never
 * imported by a client component, so the deterministic modelling logic is never
 * shipped to the browser. The client sends the raw form values; this action
 * coerces and merges them onto the base case, runs the appraisal, and returns
 * the plain, serialisable result.
 *
 * The scheme actions (Bucket 3.2) sit on the same boundary: they take raw form
 * values, normalise them to the complete input set here, and hand storage to
 * the scheme store (lib/stack/schemeStore.js). Row level security (028) scopes
 * every read to the caller's organisation and every write to an organisation
 * admin; these actions map its refusals to plain sentences rather than
 * widening anything.
 */

import {
  computeAppraisal,
  baseCaseInputs,
  ENGINE_VERSION,
} from '../../lib/stack/engine/index.js';
import { createClient } from '../../lib/supabase/server.js';
import {
  listSchemes,
  insertScheme,
  updateScheme,
  getScheme,
  deleteScheme,
  engineVersionNote,
  schemeSummary,
} from '../../lib/stack/schemeStore.js';

// The input fields that are numbers. Everything else is an enum string or a
// date string. Optional per-unit metrics stay null unless a value is given.
const NUMERIC_FIELDS = new Set([
  'gdv',
  'salesCostsRate',
  'constructionCost',
  'professionalFees',
  'statutory',
  'acquisitionLegal',
  'landValue',
  'sdlt',
  'programmeMonths',
  'constructionStartMonth',
  'constructionEndMonth',
  'completionSaleMonth',
  'devManagementFeeRate',
  'seniorLtcCap',
  'seniorLtgdvCap',
  'seniorInterestRate',
  'seniorArrangementFee',
  'seniorExitFee',
  'preferredReturnRate',
  'cashEquityPartnerSplit',
  'residualProfitToCapital',
  'targetProfitOnCost',
  'mezzanineInterestRate',
  'mezzanineCombinedLtc',
  'equityMultipleHurdle',
  'presaleProportionNdv',
  'corporationTaxRate',
  'carriedInterest',
  'constructionContingency',
  'holdingCostPerMonth',
  'buildCostInflation',
  'salesValueGrowth',
  'considerBand',
  'netSaleableArea',
  'numberOfUnits',
]);

/**
 * Coerce a raw input map onto a complete, typed input set. Missing or blank
 * fields fall back to the base case, so a partial input still computes.
 *
 * @param {object} raw the raw form values, strings or numbers
 * @returns {object} a complete engine input set
 */
function normaliseInputs(raw) {
  const inputs = baseCaseInputs();
  if (!raw) return inputs;

  for (const [key, value] of Object.entries(raw)) {
    if (!(key in inputs)) continue;
    if (value === undefined || value === null || value === '') continue;
    inputs[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
  }
  return inputs;
}

/**
 * The meta block the read-only views read alongside the result: labels, credit
 * ratios, the cashflow calendar. The result holds no inputs, so the normalised
 * input set rides here.
 */
function buildMeta(inputs) {
  return {
    currency: inputs.reportingCurrency,
    commencementDate: inputs.commencementDate,
    strategy: inputs.fundingStrategy,
    inputs,
  };
}

/**
 * Run the development appraisal for a raw input map.
 *
 * @param {object} raw the raw form values
 * @returns {Promise<{ ok: boolean, result?: object, error?: string }>}
 */
export async function runAppraisal(raw) {
  try {
    const inputs = normaliseInputs(raw);
    const result = computeAppraisal(inputs);
    return { ok: true, result, meta: buildMeta(inputs) };
  } catch (err) {
    return { ok: false, error: 'The appraisal could not be computed from these inputs.' };
  }
}

// ── Saved schemes (Bucket 3.2) ──────────────────────────────────────────────

/**
 * Map a database refusal to a plain sentence. Row level security reports an
 * admin-only write from a member as a policy violation (42501), and a write or
 * read against a row the caller cannot see as no row at all (PGRST116). Either
 * way the caller gets a sentence, never a raw database message.
 */
function writeErrorSentence(error, fallback) {
  if (error?.code === '42501' || /row-level security/i.test(error?.message ?? '')) {
    return 'Only an organisation admin can change saved schemes.';
  }
  if (error?.code === 'PGRST116') {
    return 'That scheme could not be found.';
  }
  return fallback;
}

/**
 * Read the organisation's saved schemes, newest first, and hand back the
 * client shape. Shared by every action that returns a refreshed list.
 */
async function refreshedSchemes(supabase) {
  const { schemes, error } = await listSchemes(supabase);
  if (error) return null;
  return schemes.map(schemeSummary);
}

/**
 * List the organisation's saved schemes, newest first.
 *
 * @returns {Promise<{ ok: boolean, schemes?: object[], error?: string }>}
 */
export async function fetchSchemes() {
  const supabase = await createClient();
  const { schemes, error } = await listSchemes(supabase);
  if (error) {
    return { ok: false, error: 'Saved schemes could not be loaded.' };
  }
  return { ok: true, schemes: schemes.map(schemeSummary) };
}

/**
 * Save a scheme: a new one when schemeId is null, a save-over otherwise. The
 * raw form values are normalised to the complete input set here, so what is
 * stored always computes, and the current ENGINE_VERSION is stamped on.
 * Returns the stored scheme and the refreshed list.
 *
 * @param {{ name: string, raw: object, schemeId?: string|null }} payload
 * @returns {Promise<{ ok: boolean, scheme?: object, schemes?: object[], error?: string }>}
 */
export async function saveScheme({ name, raw, schemeId = null }) {
  const supabase = await createClient();
  const inputs = normaliseInputs(raw);

  const { scheme, error } = schemeId
    ? await updateScheme(supabase, { id: schemeId, name, inputs, engineVersion: ENGINE_VERSION })
    : await insertScheme(supabase, { name, inputs, engineVersion: ENGINE_VERSION });

  if (error) {
    return { ok: false, error: writeErrorSentence(error, 'The scheme could not be saved.') };
  }

  const schemes = await refreshedSchemes(supabase);
  return { ok: true, scheme: schemeSummary(scheme), schemes: schemes ?? [] };
}

/**
 * Load a saved scheme and recompute it under the current engine. Returns the
 * scheme summary, the complete input set (for the form), the fresh result and
 * meta (for the report), and the engine version note when the stored stamp
 * differs from the engine that just ran.
 *
 * @param {string} id the scheme to load
 * @returns {Promise<{ ok: boolean, scheme?: object, inputs?: object, result?: object, meta?: object, engineNote?: string|null, error?: string }>}
 */
export async function openScheme(id) {
  const supabase = await createClient();
  const { scheme, error } = await getScheme(supabase, id);
  if (error) {
    return { ok: false, error: writeErrorSentence(error, 'The scheme could not be loaded.') };
  }

  try {
    const inputs = normaliseInputs(scheme.inputs);
    const result = computeAppraisal(inputs);
    return {
      ok: true,
      scheme: schemeSummary(scheme),
      inputs,
      result,
      meta: buildMeta(inputs),
      engineNote: engineVersionNote(scheme.engine_version, ENGINE_VERSION),
    };
  } catch (err) {
    return { ok: false, error: 'The saved scheme could not be recomputed.' };
  }
}

/**
 * Delete a saved scheme and return the refreshed list.
 *
 * @param {string} id the scheme to delete
 * @returns {Promise<{ ok: boolean, schemes?: object[], error?: string }>}
 */
export async function removeScheme(id) {
  const supabase = await createClient();
  const { error } = await deleteScheme(supabase, id);
  if (error) {
    return { ok: false, error: writeErrorSentence(error, 'The scheme could not be deleted.') };
  }
  const schemes = await refreshedSchemes(supabase);
  return { ok: true, schemes: schemes ?? [] };
}
