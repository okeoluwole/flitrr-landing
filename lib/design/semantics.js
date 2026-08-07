/**
 * The semantic colour mappings (Session K, the first sub-step of Note 15).
 *
 * Five domains render coloured state on the instrument: criticality, the
 * objective status ladder, the risk severity band, the stage state, and the
 * programme variance read. Before this module, each screen picked its own
 * expression: eleven separate value-to-class lookups across seven components,
 * with criticality alone styled in eight CSS modules. This module is now the
 * one place a domain value resolves to a design token. A surface may still
 * hold its own CSS classes, but the tokens those classes spend, and the label,
 * shape and weight beside them, come from here and are never re-picked
 * locally.
 *
 * Two rules govern every mapping, from Note 15:
 *   1. Colour is tied to meaning and carries nothing decorative. Amber is
 *      criticality, only. Red is breach or a failed write, only. Green is a
 *      recorded fact (met, ahead), never a status verdict.
 *   2. Colour is never the only carrier. Every appearance states a label and
 *      a non-colour carrier (fill presence, border style, mark shape, weight),
 *      so the read holds for a colour-blind lender and in a printed export.
 *
 * Each appearance names design tokens (custom property names defined in
 * app/globals.css), never raw colour values. Every function throws on an
 * unknown value: a silent fallback is how a wrong status ends up rendering
 * as Healthy.
 *
 * The appearance shape, uniform across domains:
 *   label        the word the surface shows for the value
 *   ink          text token
 *   fill         background token, or null for transparent
 *   border       border token, or null for none
 *   borderStyle  'solid' | 'dashed' | null (dashed marks absence or a
 *                derived, not observed, reading)
 *   shape        the container idiom: 'pill' (criticality and the ladder),
 *                'tag' (severity, 4px corners), 'bar' | 'point' (chart marks),
 *                'line' (plain text)
 *   mark         a glyph carrier where one exists: 'ring' | 'disc' |
 *                'bullseye' | null
 *   markFill     the glyph's own colour token where a mark exists and does
 *                not simply take the ink. A mark is a glyph beside the
 *                label, never the seat under it: label text always sits on
 *                fill (or the surface), so fill alone decides contrast.
 *   weight       font weight for the label
 */

// ── Criticality: Critical, Standard, and the unlinked governance gap ──
// Vocabulary: lib/engine/criticality.js (Session D derives it at capture;
// the database trigger enforces it). The shipped canon is CriticalityChip:
// amber wash and full border for Critical, quiet outline for Standard, a
// dashed outline for an item that has not named the objective it serves.
const CRITICALITY_APPEARANCE = Object.freeze({
  critical: Object.freeze({
    label: 'Critical',
    ink: '--app-signal-ink',
    fill: '--app-signal-wash',
    border: '--app-critical-border',
    borderStyle: 'solid',
    shape: 'pill',
    mark: null,
    weight: 500,
  }),
  standard: Object.freeze({
    label: 'Standard',
    ink: '--app-ink-secondary',
    fill: null,
    border: '--app-border',
    borderStyle: 'solid',
    shape: 'pill',
    mark: null,
    weight: 500,
  }),
  unlinked: Object.freeze({
    label: 'Needs a link',
    ink: '--app-ink-muted',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'pill',
    mark: null,
    weight: 500,
  }),
});

// ── The objective status ladder: Session B4's five rungs ──
// Vocabulary: lib/engine/objectiveLadder.js. The shipped canon is the
// cockpit's status label: colour spends nothing on calm, the amber outline
// brightens as exposure grows, and the one filled label is Compromised,
// in danger red, because amber is exposure and red is breach.
const OBJECTIVE_STATUS_APPEARANCE = Object.freeze({
  healthy: Object.freeze({
    label: 'Healthy',
    ink: '--app-ink-secondary',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'pill',
    mark: null,
    weight: 600,
  }),
  at_risk: Object.freeze({
    label: 'At risk',
    ink: '--app-signal-ink-dim',
    fill: null,
    border: '--app-signal-border-dim',
    borderStyle: 'solid',
    shape: 'pill',
    mark: null,
    weight: 600,
  }),
  slipping: Object.freeze({
    label: 'Slipping',
    ink: '--app-signal-ink',
    fill: null,
    border: '--app-signal-border',
    borderStyle: 'solid',
    shape: 'pill',
    mark: null,
    weight: 600,
  }),
  compromised: Object.freeze({
    label: 'Compromised',
    ink: '--app-danger',
    fill: '--app-danger-wash',
    border: '--app-danger-border',
    borderStyle: 'solid',
    shape: 'pill',
    mark: null,
    weight: 600,
  }),
  not_scored: Object.freeze({
    label: 'Not scored',
    ink: '--app-ink-muted',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'pill',
    mark: null,
    weight: 600,
  }),
});

// ── The risk severity band: Session B3's monochrome intensity ramp ──
// Vocabulary: lib/engine/severity.js. Severity is how bad; criticality is
// what it threatens. The two axes never blur, so severity never takes
// amber: it is a monochrome ramp from the bright ink fill down to a dashed
// outline, in the 4px tag shape (criticality holds the pill shape).
const SEVERITY_BAND_APPEARANCE = Object.freeze({
  serious: Object.freeze({
    label: 'Serious',
    ink: '--app-primary-ink',
    fill: '--app-ink',
    border: null,
    borderStyle: null,
    shape: 'tag',
    mark: null,
    weight: 500,
  }),
  moderate: Object.freeze({
    label: 'Worth watching',
    ink: '--app-ink',
    fill: '--app-fill-strong',
    border: null,
    borderStyle: null,
    shape: 'tag',
    mark: null,
    weight: 500,
  }),
  minor: Object.freeze({
    label: 'Minor',
    ink: '--app-ink-secondary',
    fill: '--app-fill',
    border: null,
    borderStyle: null,
    shape: 'tag',
    mark: null,
    weight: 500,
  }),
  unscored: Object.freeze({
    label: 'Not yet scored',
    ink: '--app-ink-muted',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'tag',
    mark: null,
    weight: 500,
  }),
});

// ── The stage state: Session A's sequential, concurrent, complete ──
// Vocabulary: lib/engine/stageStates.js. A sequential stage is the plain
// solid read. A concurrent stage is real but runs beside another, so its
// bar is the dashed outline: present, not yet the single live track. A
// stage complete before adoption is the quiet past: muted, faint, and
// labelled, never deleted from the picture.
const STAGE_STATE_APPEARANCE = Object.freeze({
  sequential: Object.freeze({
    label: 'Sequential',
    ink: '--app-ink-secondary',
    fill: '--app-surface-raised',
    border: '--app-border',
    borderStyle: 'solid',
    shape: 'bar',
    mark: null,
    weight: 500,
  }),
  concurrent: Object.freeze({
    label: 'Concurrent',
    ink: '--app-ink-secondary',
    fill: '--app-fill',
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'bar',
    mark: null,
    weight: 500,
  }),
  complete: Object.freeze({
    label: 'Already complete',
    ink: '--app-ink-muted',
    fill: '--app-fill-faint',
    border: '--app-hairline',
    borderStyle: 'solid',
    shape: 'bar',
    mark: null,
    weight: 500,
  }),
});

// ── The programme variance read: Session B2's chart series ──
// The baseline is the locked reference: seated, quiet, solid. The current
// position is the observed fact: bright, filled. The forecast is derived,
// not observed, so it reads hollow and dashed. Drift is the gap between
// them: a dashed connector in the secondary ink, whose urgency comes from
// the schedule band below, never from the drift line itself.
const PROGRAMME_VARIANCE_APPEARANCE = Object.freeze({
  baseline: Object.freeze({
    label: 'Baseline',
    ink: '--app-ink-secondary',
    fill: '--app-surface-raised',
    border: '--app-border',
    borderStyle: 'solid',
    shape: 'bar',
    mark: null,
    weight: 500,
  }),
  current: Object.freeze({
    label: 'Current',
    ink: '--app-ink',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'point',
    mark: 'disc',
    markFill: '--app-ink',
    weight: 500,
  }),
  forecast: Object.freeze({
    label: 'Forecast',
    ink: '--app-ink',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'point',
    mark: 'ring',
    weight: 500,
  }),
  drift: Object.freeze({
    label: 'Drift',
    ink: '--app-ink-secondary',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'dashed',
    shape: 'line',
    mark: null,
    weight: 400,
  }),
});

// ── The schedule band: the tracker's three-band axis, locked 2026-07-11 ──
// The engine keys stay green, amber and red; the surface never says those
// words. Green renders as On course, a calm hollow ring. Amber renders as
// Slipping, the bright monochrome disc: the watch band the framework
// absorbs. Red renders as Critical slip, the one amber read, because every
// red condition is criticality-gated: a standard milestone can never reach
// red, so the red band IS live criticality and earns amber under "amber
// means criticality only". Danger red stays reserved for breach and for
// failed writes.
const SCHEDULE_BAND_APPEARANCE = Object.freeze({
  green: Object.freeze({
    label: 'On course',
    ink: '--app-ink-secondary',
    fill: null,
    border: '--app-border-strong',
    borderStyle: 'solid',
    shape: 'point',
    mark: 'ring',
    weight: 500,
  }),
  amber: Object.freeze({
    label: 'Slipping',
    ink: '--app-ink',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'point',
    mark: 'disc',
    markFill: '--app-ink',
    weight: 500,
  }),
  red: Object.freeze({
    label: 'Critical slip',
    ink: '--app-signal-ink',
    fill: '--app-critical-bg',
    border: '--app-critical-border',
    borderStyle: 'solid',
    shape: 'point',
    mark: 'bullseye',
    markFill: '--app-signal',
    weight: 600,
  }),
});

// ── The per-row variance direction: which way a point sits ──
// Vocabulary: VARIANCE_DIRECTIONS in app/pulse/app/programme/scheduleModel.js,
// derived from the signed week gap under the display-rounding convention
// (within half a week either side reads on baseline).
//
// The tracker's variance cell shows a five-rung ramp, and it is deliberately
// NOT a five-value vocabulary: the engine has no such thing. It is these
// three directions composed with the three-band schedule axis, in that
// precedence. A flagged row takes its BAND, so the loud two rungs are
// scheduleBandAppearance('amber') and ('red') and are owned there. An
// unflagged row takes its DIRECTION, which is this table. That is why an
// honestly behind but unflagged point (the knock-on case: pushed by upstream
// drift, not itself past its date) reads in plain secondary ink and never
// borrows the watch band's brightness.
//
// Ahead spends the success green because ahead is a recorded fact, not a
// status verdict, which is exactly what the green rule permits. On baseline
// spends no colour at all and drops to 500: calm is the absence of a signal,
// carried by weight, not hue.
const VARIANCE_DIRECTION_APPEARANCE = Object.freeze({
  ahead: Object.freeze({
    label: 'Ahead',
    ink: '--app-success',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'line',
    mark: null,
    weight: 600,
  }),
  on_baseline: Object.freeze({
    label: 'On baseline',
    ink: '--app-ink-muted',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'line',
    mark: null,
    weight: 500,
  }),
  behind: Object.freeze({
    label: 'Behind',
    ink: '--app-ink-secondary',
    fill: null,
    border: null,
    borderStyle: null,
    shape: 'line',
    mark: null,
    weight: 600,
  }),
});

// ── The criticality MARK: the same semantic, worn as a glyph ──
// A pill will not fit on a matrix pin, a rank square, a risk number or a
// milestone dot, so those surfaces stand the solid amber in place of the
// word. It is the same criticality, in a different container: the surface
// fixes the glyph's shape (square in a register, disc on a timeline), the
// language fixes its ink. scheduleBandAppearance('red') already spends the
// same markFill for the same reason, which is why this is a shared read
// rather than a second amber.
const CRITICALITY_MARK = Object.freeze({
  label: 'Critical',
  ink: '--app-ground',
  fill: '--app-signal',
  border: '--app-signal',
  borderStyle: 'solid',
  shape: 'mark',
  mark: null,
  weight: 600,
});

// ── The paper register ──
// The Brief is the one surface that leaves the screen, so it reads in the
// --doc-* paper group rather than the instrument's --app-*. That is a change
// of MEDIUM, never of meaning: this table is the only place the two
// registers are tied together, so the document can keep its own ink without
// becoming a second, rival source of what a colour means. The app's own
// print block already remaps --app-signal-ink to #856414, which is
// --doc-ochre exactly, so the pairing below is what the stylesheet had
// already concluded on its own.
const PAPER_COUNTERPART = Object.freeze({
  '--app-signal': '--doc-signal',
  '--app-signal-ink': '--doc-ochre',
  '--app-signal-wash': '--doc-signal-wash',
  '--app-critical-border': '--doc-signal-border',
  '--app-ground': '--doc-navy',
  '--app-ink': '--doc-ink',
  '--app-ink-secondary': '--doc-ink-2',
  '--app-ink-muted': '--doc-ink-3',
  '--app-border': '--doc-line',
  '--app-border-strong': '--doc-line-strong',
});

function paper(token) {
  if (token == null) return null;
  const counterpart = PAPER_COUNTERPART[token];
  if (!counterpart) {
    throw new Error(
      `No paper counterpart for ${token}. Add it to PAPER_COUNTERPART in ` +
        `lib/design/semantics.js rather than picking a --doc-* token locally.`
    );
  }
  return counterpart;
}

/** The same appearance, expressed in the document's paper register. */
export function onPaper(appearance) {
  return Object.freeze({
    ...appearance,
    ink: paper(appearance.ink),
    fill: paper(appearance.fill),
    border: paper(appearance.border),
  });
}

/** Look a value up in a domain table, or fail loudly. */
function resolve(table, domain, value) {
  const appearance = table[value];
  if (!appearance) {
    throw new Error(
      `Unknown ${domain} value: ${JSON.stringify(value)}. ` +
        `Expected one of: ${Object.keys(table).join(', ')}.`
    );
  }
  return appearance;
}

/** Criticality: 'critical' | 'standard' | 'unlinked'. */
export function criticalityAppearance(value) {
  return resolve(CRITICALITY_APPEARANCE, 'criticality', value);
}

/** The solid amber glyph that stands in for the Critical pill where a pill
 *  will not fit. Shape belongs to the surface; the ink belongs here. */
export function criticalityMarkAppearance() {
  return CRITICALITY_MARK;
}

/** Criticality in the document's paper register (the Brief and its export).
 *  Same mapping, same meaning, --doc-* ink. */
export function criticalityAppearanceOnPaper(value) {
  return onPaper(criticalityAppearance(value));
}

/** The criticality mark in the document's paper register. */
export function criticalityMarkAppearanceOnPaper() {
  return onPaper(CRITICALITY_MARK);
}

/** Objective status ladder: 'healthy' | 'at_risk' | 'slipping' |
 *  'compromised' | 'not_scored'. */
export function objectiveStatusAppearance(status) {
  return resolve(OBJECTIVE_STATUS_APPEARANCE, 'objective status', status);
}

/** Risk severity band: 'serious' | 'moderate' | 'minor' | 'unscored'. */
export function severityBandAppearance(key) {
  return resolve(SEVERITY_BAND_APPEARANCE, 'severity band', key);
}

/** Stage state: 'sequential' | 'concurrent' | 'complete'. */
export function stageStateAppearance(state) {
  return resolve(STAGE_STATE_APPEARANCE, 'stage state', state);
}

/** Programme variance series: 'baseline' | 'current' | 'forecast' | 'drift'. */
export function programmeVarianceAppearance(series) {
  return resolve(PROGRAMME_VARIANCE_APPEARANCE, 'programme variance', series);
}

/** Schedule band: engine 'green' | 'amber' | 'red', rendered as On course,
 *  Slipping, Critical slip. */
export function scheduleBandAppearance(band) {
  return resolve(SCHEDULE_BAND_APPEARANCE, 'schedule band', band);
}

/** Per-row variance direction: 'ahead' | 'on_baseline' | 'behind'. The tone
 *  an UNFLAGGED row reads in; a flagged row takes scheduleBandAppearance
 *  instead, which is the whole of the tracker's five-rung ramp. */
export function varianceDirectionAppearance(direction) {
  return resolve(
    VARIANCE_DIRECTION_APPEARANCE,
    'variance direction',
    direction
  );
}

/**
 * The catalogue the review route and the tests walk: every mapping, every
 * value, in presentation order. Each entry names the surface that consumes
 * it so the swatch page can say what a colour means, not just show it.
 */
export const SEMANTIC_MAPPINGS = Object.freeze([
  Object.freeze({
    id: 'criticality',
    name: 'Criticality',
    note: 'Derived at capture from the objective an item serves (Session D). Amber is spent here and nowhere else.',
    values: Object.freeze(['critical', 'standard', 'unlinked']),
    appearance: criticalityAppearance,
  }),
  Object.freeze({
    id: 'objective-status',
    name: 'Objective status ladder',
    note: 'The dashboard cockpit read (Session B4). Amber is exposure, red is breach, colour spends nothing on calm.',
    values: Object.freeze([
      'healthy',
      'at_risk',
      'slipping',
      'compromised',
      'not_scored',
    ]),
    appearance: objectiveStatusAppearance,
  }),
  Object.freeze({
    id: 'severity-band',
    name: 'Risk severity band',
    note: 'How bad, never what it threatens (Session B3). A monochrome intensity ramp in the tag shape; criticality keeps the pill.',
    values: Object.freeze(['serious', 'moderate', 'minor', 'unscored']),
    appearance: severityBandAppearance,
  }),
  Object.freeze({
    id: 'stage-state',
    name: 'Stage state',
    note: 'Sequential, concurrent, or complete before adoption (Session A). Dashed means running beside, faint means the past.',
    values: Object.freeze(['sequential', 'concurrent', 'complete']),
    appearance: stageStateAppearance,
  }),
  Object.freeze({
    id: 'programme-variance',
    name: 'Programme variance',
    note: 'The chart series (Session B2): the locked baseline, the observed position, the derived forecast, and the drift between them.',
    values: Object.freeze(['baseline', 'current', 'forecast', 'drift']),
    appearance: programmeVarianceAppearance,
  }),
  Object.freeze({
    id: 'schedule-band',
    name: 'Schedule band',
    note: 'The three-band schedule axis. Red is criticality-gated by the engine, so Critical slip is the one amber read.',
    values: Object.freeze(['green', 'amber', 'red']),
    appearance: scheduleBandAppearance,
  }),
  Object.freeze({
    id: 'variance-direction',
    name: 'Variance direction',
    note: "The tracker's per-row tone where the row is not flagged. A flagged row takes its schedule band instead, so the two tables together are the whole ramp.",
    values: Object.freeze(['ahead', 'on_baseline', 'behind']),
    appearance: varianceDirectionAppearance,
  }),
]);
