/**
 * The Programme forecast-completion engine (Programme module Phase 3.4). The
 * third pure engine of the tracking surface, alongside the percent-complete
 * engine (3.1) and the RAG engine (3.2): it takes the frozen v1 baseline, the
 * met-points view, and today, and produces a forecast completion date for every
 * point, every activity, and every stage, plus the forecast completion for the
 * programme, by rolling the actuals forward through the running order on the
 * baseline's own spacing. The surface derives variance as the forecast minus the
 * baseline; this engine returns the forecast dates, and the baseline dates are
 * already carried in the baseline the surface holds.
 *
 * Pure and deterministic: no DB, no React, no network, and above all no system
 * clock. Today comes in as an input, never read from the clock, so the same
 * baseline, met-points view, and today always give the same forecast. It reads
 * the baseline as plain input (it does not load it) and the met-points view as
 * plain input, and computes. It mutates nothing it is given.
 *
 * THE INPUT IT READS:
 *
 *  - The baseline, the frozen assembled programme from a locked v1
 *    (lib/engine/programmeAssembly.js, stored by programmeBaselineStore.js):
 *    stages, each holding its ordered activities, each activity holding its
 *    milestones (each with a stable key and a baseline date), and each stage
 *    holding its stageStart and its gate (a key, gate_<stage>, a baseline date,
 *    and closesActivityKey). This engine reads the structure and the baseline
 *    dates; it reads no criticality and no durations beyond the spacing the
 *    baseline dates already carry.
 *  - The met-points view, the same map the sibling engines read, keyed by the
 *    point identifier as it appears in the baseline (milestone keys and gate
 *    keys in one keyspace). Unlike 3.1 and 3.2, THIS ENGINE READS THE MET DATE:
 *    the actual date is what the roll re-anchors to. The canonical entry is
 *    { met: true, metDate }; a point not in the map is not met; an explicit
 *    { met: false } is not met; a met record for a point the baseline does not
 *    contain is ignored. Accepts a plain object or a Map.
 *  - Today's date, passed in. Required: a forecast with no today is meaningless
 *    (the roll floors unmet work at today), so the engine throws rather than
 *    guessing the date. The engine never reads the system clock.
 *
 * THE RUNNING ORDER, the structure the roll walks:
 *
 *  - The spine, stages 0 through 6, runs in sequence. Each stage forecast-starts
 *    when the previous applicable stage's gate is reached: the gate's actual met
 *    date if it is met, otherwise its forecast date. The first applicable spine
 *    stage forecast-starts at its baseline stageStart.
 *  - Within a stage, activities run in sequence, and within an activity the
 *    milestones sit at their offsets; the gate closes the stage's final
 *    activity. The chain within a stage is therefore linear: each activity's
 *    milestones in order, activity by activity, then the gate last.
 *  - Stage 7, sales and disposal, is the one parallel branch: it runs concurrent
 *    with construction as the baseline placed it, never serialised onto the end
 *    of the spine. See the anchoring rule below.
 *
 * THE ROLL, the rule at every point:
 *
 *  - A met point's forecast date is its actual met date. It is a fact, not a
 *    projection, and it re-anchors the running position for what follows, in
 *    either direction: an actual ahead of its baseline pulls what follows
 *    earlier, behind its baseline pushes it later. The roll never floors at the
 *    baseline, so a programme running ahead shows an earlier finish.
 *  - An unmet point's forecast is its revised start plus its remaining span. Its
 *    revised start is the later of the running position (the forecast, or
 *    actual, completion of what precedes it in the running order) and today: a
 *    point cannot start in the past, so work that should have started weeks ago
 *    forecasts as if it starts now, and no unmet point's forecast ever lands
 *    before today. A met point's date may sit in the past; it is a fact.
 *  - The remaining span of an unmet point is its baseline spacing: the gap from
 *    the previous item's baseline position to its own baseline date. With no
 *    partial-progress state, an unmet stretch carries its full baseline span.
 *
 * THE BASELINE SPACING AS THE DURATIONS. The roll's segments are the gaps the
 * baseline itself carries between consecutive items in the running order, so on
 * day one, nothing met and today at the start, the forecast reproduces the
 * baseline exactly and the surface's variance reads zero. This is deliberate:
 * the template's typicalWeeks diverge from the gateWeeks the baseline was
 * assembled on (the held divergence parked for the durations pass), and
 * re-rolling on typicalWeeks would invent a drift no one decided. The baseline
 * dates are the shown input; the roll re-anchors them and nothing else. The
 * spacing is signed: a baseline whose dates run against the running order (a
 * hand-set date out of sequence, an offset landing past its agreed gate, the
 * honest first-draft positions assembly leaves as they fall) reproduces as it
 * stands rather than being smoothed here, so an untouched programme never shows
 * a phantom variance. The chain still re-anchors in running order, and an unmet
 * point's forecast still floors at today whatever the spacing says.
 *
 * THE STAGE 7 ANCHORING, first-draft and parked for the durations pass. Stage 7
 * is anchored where the baseline placed it, carrying the drift of the spine it
 * overlaps, and rolls its own chain from there:
 *
 *  - Its chain anchors at its first dated point's baseline position, the
 *    placement the baseline actually holds (its stageStart is a serial artefact
 *    of the rolling chain, not the placement, so it is not read as the anchor).
 *  - The anchor is shifted by the drift of the latest applicable spine gate
 *    whose baseline date is on or before that anchor: that gate's forecast, or
 *    actual, minus its baseline. A sales run placed mid-construction so carries
 *    construction's start drift; one placed after handover carries gate 6's
 *    drift, which degrades gracefully to the serial behaviour while preserving
 *    the baseline gap. With no spine gate before the anchor the drift is zero.
 *  - From that shifted anchor stage 7 rolls its own chain under the same rule as
 *    every other stage: its actuals re-anchor it, its unmet points floor at
 *    today. The programme finish then respects the concurrency: whichever
 *    branch lands last is the finish, never handover plus a sales run that was
 *    never planned to follow it.
 *
 * WHAT A FORECAST COMPLETION MEANS PER LEVEL. A point's forecast is the roll's
 * date for it. An activity's forecast completion is the forecast of its last
 * trackable point: the gate for the stage's closing activity (the gate closes
 * it), otherwise its last keyed milestone; a non-closing activity with no keyed
 * milestone reports null, because nothing observable dates it (the guard mirrors
 * the percent engine's point-less exclusion). A stage's forecast completion is
 * its gate's forecast or actual. The programme forecast completion is the latest
 * forecast across every applicable stage's points.
 *
 * HONEST EDGES, mirrored from the siblings:
 *
 *  - An unmet milestone under a met gate still rolls (floored at today): unmet is
 *    unmet, exactly as the RAG engine still flags it. The met gate itself
 *    re-anchors the chain, so the phantom never leaks into the next stage.
 *  - A met point with no recorded met date (a passed gate whose passed_at is
 *    absent) is a fact with no date: its forecast is null, it never re-anchors,
 *    and the chain carries its baseline spacing forward unchanged. When that
 *    dateless fact is a gate, the carried running position, drift and all, is
 *    what crosses the stage boundary, so an observed slip is never erased by a
 *    gate the mechanic passed without a date.
 *  - Not-applicable stages are excluded exactly as in 3.1 and 3.2: an applicable
 *    === false stage contributes no forecast, no drift, and no candidate for the
 *    programme finish; the spine chain rolls straight across it. Only an
 *    explicit applicable === false skips a stage.
 *
 * OUT OF SCOPE HERE: no percent-complete (3.1), no RAG (3.2), no persistence, no
 * store, no migration, no database, no UI, no reading of the baseline from the
 * store, no manual re-forecast (this figure is computed from the actuals, never
 * from a hand-entered future date), and no reading of the system clock.
 */

// The stages that run concurrent with the spine rather than on it. Stage 7,
// sales and disposal, is the one parallel branch: the first-draft running order
// (specification Section 6), parked for the durations pass with the rest of the
// overlap question. Frozen so a caller cannot mutate the running order.
export const CONCURRENT_STAGES = Object.freeze([7]);

// One week in milliseconds. Weeks are whole seven-day spans, so measuring them
// in epoch milliseconds is exact and timezone-neutral. The same convention as
// programmeSchedule.js, programmeAssembly.js, and programmeRAG.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Soft parse to epoch milliseconds, or null. An absent, empty or unparseable
// value (an undated point) is simply "no date". Accepts a Date, an ISO date
// string (a plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds. Mirrors
// programmeRAG.softEpoch and programmeAssembly.softEpoch.
function softEpoch(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isNaN(epoch) ? null : epoch;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const epoch = Date.parse(trimmed);
    return Number.isNaN(epoch) ? null : epoch;
  }
  return null;
}

// An epoch as a Date, or null. The engine computes in epochs and returns Dates,
// unrounded, the same as the siblings; display formatting is the surface's.
function toDate(epoch) {
  return epoch == null ? null : new Date(epoch);
}

/**
 * The met record for a single point in the met-points view, or null when the
 * point is not met. The met-or-not rule is identical to the sibling engines so
 * the three read one view the same way: the canonical entry is { met: true,
 * metDate }, any present entry whose `met` is not false marks the point met, a
 * bare truthy value is accepted too, and a point not in the map is not met.
 * Unlike the siblings this engine reads the met date: it is parsed here, and a
 * met record with no parseable date comes back with metEpoch null (met, but
 * undated). Accepts the view as a Map or a plain object keyed by the point id.
 */
function metRecord(metView, key) {
  if (key == null || metView == null) return null;
  const record = metView instanceof Map ? metView.get(key) : metView[key];
  if (record == null) return null;
  if (typeof record === 'object') {
    if (record.met === false) return null;
    return { metEpoch: softEpoch(record.metDate) };
  }
  return record ? { metEpoch: null } : null;
}

/**
 * Roll one point through the chain. The chain state carries the running
 * position (the forecast, or actual, completion of what precedes the point) and
 * the previous item's baseline position (what the point's baseline spacing is
 * measured from). Returns the point's forecast epoch (the actual for a dated
 * met point, null for an undated met point) alongside its met flag, and
 * advances the state.
 */
function rollPoint(baselineEpoch, met, state, todayEpoch) {
  // The point's baseline spacing from the previous item, signed: the baseline's
  // own placement is reproduced as it stands, even where a hand-set date or an
  // overhung offset runs against the running order, so an untouched programme
  // never shows a phantom variance.
  const gap =
    baselineEpoch != null && state.prevBaselineEpoch != null
      ? baselineEpoch - state.prevBaselineEpoch
      : 0;

  let forecastEpoch;
  if (met && met.metEpoch != null) {
    // A fact: the actual met date, re-anchoring the chain in either direction.
    forecastEpoch = met.metEpoch;
    state.positionEpoch = met.metEpoch;
  } else if (met) {
    // Met but undated (a passed gate with no recorded passed_at): a fact with no
    // date. No forecast is asserted and the chain carries the baseline spacing
    // forward unchanged, so what follows is neither pulled nor pushed by it.
    forecastEpoch = null;
    if (state.positionEpoch != null) state.positionEpoch += gap;
  } else {
    // Unmet: the revised start is the later of the running position and today (a
    // point cannot start in the past), plus the remaining baseline span. The
    // outer floor holds the never-before-today rule where the signed spacing
    // runs backwards.
    const revisedStart = Math.max(state.positionEpoch ?? todayEpoch, todayEpoch);
    forecastEpoch = Math.max(revisedStart + gap, todayEpoch);
    state.positionEpoch = forecastEpoch;
  }

  if (baselineEpoch != null) state.prevBaselineEpoch = baselineEpoch;
  return { met: met != null, forecastEpoch };
}

/**
 * Roll one applicable stage's chain: each activity's keyed milestones in order,
 * activity by activity, then the gate last, from the given anchors. Returns the
 * stage node (without the stage number and flags, which the caller owns) plus
 * the gate's effective epoch, the forecast-or-actual the spine chain and the
 * drift rule read.
 */
function rollStage(stage, metView, todayEpoch, anchorPositionEpoch, anchorBaselineEpoch) {
  const state = {
    positionEpoch: anchorPositionEpoch,
    prevBaselineEpoch: anchorBaselineEpoch,
  };
  const gate = stage?.gate ?? null;
  const closesKey =
    gate != null && typeof gate.closesActivityKey === 'string'
      ? gate.closesActivityKey
      : null;

  const activities = (stage?.activities ?? []).map((activity) => {
    const closesStage = closesKey != null && activity?.key === closesKey;
    let lastForecastEpoch = null;
    let hasTrackablePoint = false;

    // A milestone with no key cannot be looked up in the view, so it is not a
    // trackable point and is skipped, exactly as the percent engine skips it.
    // Its baseline spacing folds into the next item's gap untouched.
    const milestones = (activity?.milestones ?? [])
      .filter((m) => m?.key != null)
      .map((m) => {
        const rolled = rollPoint(
          softEpoch(m.baselineDate),
          metRecord(metView, m.key),
          state,
          todayEpoch
        );
        lastForecastEpoch = rolled.forecastEpoch;
        hasTrackablePoint = true;
        return {
          key: m.key,
          met: rolled.met,
          forecastDate: toDate(rolled.forecastEpoch),
        };
      });

    return {
      key: activity?.key ?? null,
      closesStage,
      // The closing activity's completion is the gate's, patched in below once
      // the gate has rolled. A non-closing activity completes at its last
      // trackable point; with none, nothing observable dates it, so null.
      forecastCompletion: hasTrackablePoint ? toDate(lastForecastEpoch) : null,
      milestones,
    };
  });

  // The gate rolls last: it closes the stage's final activity, so its forecast
  // is the stage's completion, and its actual re-anchors the chain for the
  // stage that follows.
  let gateNode = null;
  let gateEffectiveEpoch = null;
  if (gate != null && gate.key != null) {
    const rolled = rollPoint(
      softEpoch(gate.baselineDate),
      metRecord(metView, gate.key),
      state,
      todayEpoch
    );
    gateEffectiveEpoch = rolled.forecastEpoch;
    gateNode = {
      key: gate.key,
      met: rolled.met,
      forecastDate: toDate(rolled.forecastEpoch),
    };
  }

  for (const activity of activities) {
    if (activity.closesStage) {
      activity.forecastCompletion = toDate(gateEffectiveEpoch);
    }
  }

  return {
    forecastStart: toDate(anchorPositionEpoch),
    forecastCompletion: toDate(gateEffectiveEpoch),
    activities,
    gate: gateNode,
    gateEffectiveEpoch,
    // The chain's final running position. It equals the gate's forecast or
    // actual wherever the gate is dated; where the gate is a dateless met fact
    // it is the carried position, drift and all, the boundary crosses on.
    carriedEpoch: gateEffectiveEpoch ?? state.positionEpoch,
  };
}

// The shape of an excluded (not-applicable) stage: structure kept, no dates. The
// met flags are still read honestly from the view (they are facts), but the
// stage contributes no forecast, no drift, and no candidate for the finish.
function excludedStage(stage, metView, concurrent) {
  const gate = stage?.gate ?? null;
  const closesKey =
    gate != null && typeof gate.closesActivityKey === 'string'
      ? gate.closesActivityKey
      : null;
  return {
    stage: stage?.stage ?? null,
    applicable: false,
    concurrent,
    forecastStart: null,
    forecastCompletion: null,
    anchorGateKey: null,
    driftWeeks: null,
    activities: (stage?.activities ?? []).map((activity) => ({
      key: activity?.key ?? null,
      closesStage: closesKey != null && activity?.key === closesKey,
      forecastCompletion: null,
      milestones: (activity?.milestones ?? [])
        .filter((m) => m?.key != null)
        .map((m) => ({
          key: m.key,
          met: metRecord(metView, m.key) != null,
          forecastDate: null,
        })),
    })),
    gate:
      gate != null && gate.key != null
        ? {
            key: gate.key,
            met: metRecord(metView, gate.key) != null,
            forecastDate: null,
          }
        : null,
  };
}

// The baseline position of a stage's first trackable point, in running order:
// its first keyed milestone with a parseable baseline date, else its gate's.
// This is the placement the baseline holds for a concurrent stage, the anchor
// its chain rolls from. Null when the stage holds no dated point at all.
function firstPointBaselineEpoch(stage) {
  for (const activity of stage?.activities ?? []) {
    for (const milestone of activity?.milestones ?? []) {
      if (milestone?.key == null) continue;
      const epoch = softEpoch(milestone.baselineDate);
      if (epoch != null) return epoch;
    }
  }
  return softEpoch(stage?.gate?.baselineDate);
}

/**
 * Derive the forecast completion for a frozen baseline against a met-points
 * view at a given today.
 *
 *   baseline   the frozen assembled programme (assembleProgramme's output, or
 *              the programme stored on a baseline row): { stages: [...] }. Read
 *              as plain input, never loaded here.
 *   metPoints  the met-points view (buildMetPointsView's output): a plain object
 *              or Map keyed by the point id, each met point carrying
 *              { met: true, metDate }. Absent or empty means nothing is met.
 *   today      a Date, an ISO date string, or epoch milliseconds. Required: the
 *              roll floors unmet work at today and the engine never reads the
 *              clock, so a missing today throws.
 *
 * Returns the forecast tree, deterministic for the same inputs, every date a
 * Date and unrounded (display rounding is the surface's concern):
 *   {
 *     forecastCompletion,      the programme finish: the latest forecast across
 *                              every applicable stage's points, respecting the
 *                              concurrency (whichever branch lands last), or
 *                              null when nothing is dated
 *     stages: [
 *       {
 *         stage,               the stage number
 *         applicable,          false for a stage marked not applicable
 *         concurrent,          true for the parallel branch (stage 7)
 *         forecastStart,       the chain anchor: the previous gate's forecast or
 *                              actual on the spine, the drift-shifted placement
 *                              on the concurrent branch; null when excluded
 *         forecastCompletion,  the stage's gate forecast or actual, or null
 *         anchorGateKey,       concurrent working: the spine gate whose drift
 *                              the anchor carries, or null
 *         driftWeeks,          concurrent working: that drift in weeks (exact,
 *                              signed, unrounded), or null
 *         activities: [
 *           {
 *             key,
 *             closesStage,     whether the stage's gate closes this activity
 *             forecastCompletion,  the gate's date for the closing activity,
 *                              else the last keyed milestone's, else null
 *             milestones: [
 *               { key, met, forecastDate }   the actual date when met (a fact),
 *                              the rolled date when unmet, null for a met point
 *                              with no recorded date or an excluded stage
 *             ]
 *           }
 *         ],
 *         gate: { key, met, forecastDate }
 *       }
 *     ]
 *   }
 */
export function deriveForecast(baseline, metPoints, today) {
  const todayEpoch = softEpoch(today);
  if (todayEpoch == null) {
    throw new Error('deriveForecast: a today date is required');
  }

  const stageDefs = baseline?.stages ?? [];
  const concurrentSet = new Set(CONCURRENT_STAGES);
  const nodeByIndex = new Map();

  // Pass one, the spine, in baseline order. The chain state carried stage to
  // stage: the previous applicable gate's forecast-or-actual (what the next
  // stage forecast-starts from) and its baseline date (the fallback anchor for
  // a stage that carries no stageStart of its own).
  let prevGateEffectiveEpoch = null;
  let prevGateBaselineEpoch = null;
  let firstApplicableSeen = false;
  // The applicable spine gates in order, the drift anchors the concurrent
  // branch reads: each with its key, baseline date, and forecast-or-actual.
  const spineGates = [];

  stageDefs.forEach((stage, index) => {
    if (concurrentSet.has(stage?.stage)) return;
    if (stage?.applicable === false) {
      // Excluded: the spine chain rolls straight across it, exactly as the
      // rolling chain skipped it at assembly.
      nodeByIndex.set(index, excludedStage(stage, metPoints, false));
      return;
    }

    const stageStartEpoch = softEpoch(stage?.stageStart);
    // The first applicable spine stage forecast-starts at its baseline start;
    // every later one starts when the previous gate is reached: the stage's own
    // baseline start shifted by that gate's drift, actual or forecast minus
    // baseline. On an assembled baseline the stage start IS the previous gate's
    // baseline date, so the anchor is exactly the gate's actual or forecast; on
    // a foreign baseline any planned lag between the two is preserved. With no
    // usable drift (a dateless chain behind it, a missing stageStart) the
    // anchor falls back to what is held rather than guessing.
    let anchorPositionEpoch;
    if (!firstApplicableSeen) {
      anchorPositionEpoch = stageStartEpoch;
    } else if (
      prevGateEffectiveEpoch != null &&
      prevGateBaselineEpoch != null &&
      stageStartEpoch != null
    ) {
      anchorPositionEpoch =
        stageStartEpoch + (prevGateEffectiveEpoch - prevGateBaselineEpoch);
    } else {
      anchorPositionEpoch = prevGateEffectiveEpoch ?? stageStartEpoch;
    }
    const anchorBaselineEpoch = stageStartEpoch ?? prevGateBaselineEpoch;
    firstApplicableSeen = true;

    const rolled = rollStage(
      stage,
      metPoints,
      todayEpoch,
      anchorPositionEpoch,
      anchorBaselineEpoch
    );

    const gateBaselineEpoch = softEpoch(stage?.gate?.baselineDate);
    if (stage?.gate?.key != null && gateBaselineEpoch != null) {
      spineGates.push({
        key: stage.gate.key,
        baselineEpoch: gateBaselineEpoch,
        effectiveEpoch: rolled.carriedEpoch,
      });
    }
    prevGateEffectiveEpoch = rolled.carriedEpoch;
    prevGateBaselineEpoch = gateBaselineEpoch ?? prevGateBaselineEpoch;

    nodeByIndex.set(index, {
      stage: stage?.stage ?? null,
      applicable: true,
      concurrent: false,
      forecastStart: rolled.forecastStart,
      forecastCompletion: rolled.forecastCompletion,
      anchorGateKey: null,
      driftWeeks: null,
      activities: rolled.activities,
      gate: rolled.gate,
    });
  });

  // Pass two, the concurrent branch, anchored where the baseline placed it and
  // carrying the drift of the spine it overlaps.
  stageDefs.forEach((stage, index) => {
    if (!concurrentSet.has(stage?.stage)) return;
    if (stage?.applicable === false) {
      nodeByIndex.set(index, excludedStage(stage, metPoints, true));
      return;
    }

    const anchorBaselineEpoch = firstPointBaselineEpoch(stage);

    // The drift anchor: the latest applicable spine gate whose baseline date is
    // on or before the branch's baseline placement. Its drift, forecast or
    // actual minus baseline, is what the branch's placement carries.
    let anchorGate = null;
    if (anchorBaselineEpoch != null) {
      for (const gate of spineGates) {
        if (gate.effectiveEpoch == null) continue;
        if (gate.baselineEpoch > anchorBaselineEpoch) continue;
        if (anchorGate == null || gate.baselineEpoch >= anchorGate.baselineEpoch) {
          anchorGate = gate;
        }
      }
    }
    const driftEpochs =
      anchorGate == null ? 0 : anchorGate.effectiveEpoch - anchorGate.baselineEpoch;
    const anchorPositionEpoch =
      anchorBaselineEpoch == null ? null : anchorBaselineEpoch + driftEpochs;

    const rolled = rollStage(
      stage,
      metPoints,
      todayEpoch,
      anchorPositionEpoch,
      anchorBaselineEpoch
    );

    nodeByIndex.set(index, {
      stage: stage?.stage ?? null,
      applicable: true,
      concurrent: true,
      forecastStart: rolled.forecastStart,
      forecastCompletion: rolled.forecastCompletion,
      anchorGateKey: anchorGate?.key ?? null,
      driftWeeks: anchorGate == null ? null : driftEpochs / MS_PER_WEEK,
      activities: rolled.activities,
      gate: rolled.gate,
    });
  });

  const stages = stageDefs.map((stage, index) => nodeByIndex.get(index));

  // The programme finish: the latest forecast across every applicable stage's
  // points, which respects the concurrency because both branches' points are
  // candidates and whichever lands last is the finish.
  let finishEpoch = null;
  for (const node of stages) {
    if (node == null || node.applicable === false) continue;
    const candidates = [
      ...node.activities.flatMap((a) => a.milestones.map((m) => m.forecastDate)),
      node.gate?.forecastDate ?? null,
    ];
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const epoch = candidate.getTime();
      if (finishEpoch == null || epoch > finishEpoch) finishEpoch = epoch;
    }
  }

  return {
    forecastCompletion: toDate(finishEpoch),
    stages,
  };
}
