/**
 * The dashboard read (Dashboard module, M9.2): the copy layer over the
 * objective health engine, the way pulseRead.js already reads for the Brief.
 * It takes the engine's output and returns strings. The engine returns no
 * copy and never will.
 *
 * EVERY STRING COMES FROM THE M9.2 COPY SHEET. Nothing is invented and
 * nothing is templated into existence at runtime beyond the sheet's own
 * slots (names, counts, weeks, dates). Every trigger key the engine's frozen
 * vocabulary can emit is covered below; a key without a string throws,
 * because a missing string is a build error, never a licence for a generic
 * fallback line.
 *
 * Week figures round to the nearest whole week. Weeks throughout, never
 * months: the Programme surface speaks weeks and two units is a translation
 * cost the developer pays.
 *
 * The two date triggers (date_past_target, date_within_tolerance) return no
 * reason line of their own: the Time date line (section 2.4) carries them,
 * and it renders whenever dateSignal exists, independent of what set the
 * state.
 */

import {
  HEALTH_STATES,
  HEALTH_TRIGGERS,
  DATE_VERDICTS,
} from '../../../../lib/engine/objectiveHealth';
import { OBJECTIVE_META } from '../components/objectiveMeta';
import { formatList } from '../components/briefFormat';

// ---------------------------------------------------------------------------
// Section 3: the page.

export const PAGE_TITLE = 'Project dashboard';
export const PAGE_SUB =
  'Where the project stands against the objectives you set.';
export const BRIEF_NOT_LOCKED =
  'Lock your Brief to open the dashboard. Your objectives are set in the Brief, and this page reads through them.';

// Lifecycle stage names (framework Section 4), for Band 1's stage fact.
export const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

// Section 2.6: one link per group, never one per item.
export const GROUP_LINKS = {
  risks: 'Open in Risk register',
  actions: 'Open in Action Log',
  milestones: 'Open in Programme',
};

// The milestone flag rendered in the house schedule words (the locked 3.5
// RAG reconciliation): engine amber reads Slipping, engine red reads
// Critical slip.
export const MILESTONE_FLAG_WORDS = { amber: 'Slipping', red: 'Critical slip' };

// Section 2.1: the state labels, by ladder.
const STATE_LABELS = {
  [HEALTH_STATES.HOLDING]: 'Holding',
  [HEALTH_STATES.UNDER_PRESSURE]: 'Under pressure',
  [HEALTH_STATES.COMPROMISED]: 'Compromised',
  [HEALTH_STATES.ABSORBING]: 'Absorbing',
  [HEALTH_STATES.EXHAUSTED]: 'Exhausted',
  [HEALTH_STATES.NOT_SCORED]: 'Not scored',
};

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The objective's display name from its type. The engine carries types; the
// sheet speaks names.
export function objectiveName(type) {
  return NAME_BY_TYPE[type] ?? type ?? '';
}

export function stateLabel(row) {
  return STATE_LABELS[row.state] ?? row.state;
}

// Section 2.1: the classification, demoted to a small dim word beside the
// objective name. It is context, not news: it was set once at initiation and
// has not changed since, so it never carries the row's weight.
export function classificationWord(row) {
  return row.isProtected ? 'Protected' : 'Flexible';
}

// ---------------------------------------------------------------------------
// Small formatting helpers, the sheet's own conventions.

// Objective and item counts inside sentences are words ("Two critical
// actions"); tallies and week figures are digits ("5 risks", "15 weeks").
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

function numberWord(n, capitalise = false) {
  const word = NUMBER_WORDS[n] ?? String(n);
  return capitalise ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

// Nearest whole week, the sheet's rounding rule.
function roundWeeks(x) {
  return Math.round(Math.abs(x));
}

// "15 weeks" / "1 week": the lead figure carries the unit.
function weeksUnit(x) {
  const n = roundWeeks(x);
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

// "14 April 2028". Dates on this surface are day month year in full, parsed
// as UTC so a plain date string never shifts a day.
export function formatDate(value) {
  if (value == null) return null;
  const epoch =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(epoch)) return null;
  return new Date(epoch).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function epochOf(value) {
  if (value == null) return null;
  const epoch =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isNaN(epoch) ? null : epoch;
}

// A missing string is a build error, never a fallback line.
function uncovered(key) {
  throw new Error(`dashboardRead: no copy for trigger key "${key}"`);
}

// The N-of-M lead for rules 1 and 2, where N is the count in the state and M
// the count of protected objectives. "Three of your four" while some stand
// apart; when none do, "Both" or "All three", because "three of your three"
// is factually right and badly written.
function countOfProtected(n, m) {
  if (n < m) return `${numberWord(n, true)} of your ${numberWord(m)}`;
  return m === 2 ? 'Both of your' : `All ${numberWord(m)} of your`;
}

// ---------------------------------------------------------------------------
// Section 1.1: the state sentence. One only, selected by sentenceRule.

// The [reason] slot for Rule 1 with a single compromised objective, from the
// compromised objective's trigger.
function compromisedReason(row) {
  const { key, detail } = row.trigger ?? {};
  switch (key) {
    case HEALTH_TRIGGERS.SERIOUS_RISK:
      return (detail?.acceptedCount ?? 0) > 0
        ? 'a Serious risk is live against it, and you have accepted it'
        : 'a Serious risk is live against it';
    case HEALTH_TRIGGERS.PROGRAMME_RED:
      return 'a milestone serving it has slipped past your tolerance';
    case HEALTH_TRIGGERS.DATE_PAST_TARGET:
      return `your forecast completes ${weeksUnit(detail?.totalWeeksLate ?? 0)} after your target`;
    default:
      return uncovered(key);
  }
}

export function stateSentence(health) {
  const rows = health?.objectives ?? [];
  const protectedRows = rows.filter((r) => r.isProtected);
  const flexibleRows = rows.filter((r) => !r.isProtected);

  switch (health?.project?.sentenceRule) {
    case 0:
      return 'Nothing is scored yet, so there is no read to give. Score your risks to open it.';

    case 1: {
      const compromised = protectedRows.filter(
        (r) => r.state === HEALTH_STATES.COMPROMISED
      );
      const names = compromised.map((r) => objectiveName(r.type));
      if (compromised.length === 1) {
        return `${names[0]} is compromised. You protected it, and ${compromisedReason(compromised[0])}.`;
      }
      return `${countOfProtected(compromised.length, protectedRows.length)} protected objectives are compromised: ${formatList(names)}.`;
    }

    case 2: {
      const pressured = protectedRows.filter(
        (r) => r.state === HEALTH_STATES.UNDER_PRESSURE
      );
      const names = pressured.map((r) => objectiveName(r.type));
      if (pressured.length === 1) {
        return `${names[0]} is under pressure. It is the only protected objective currently exposed.`;
      }
      return `${countOfProtected(pressured.length, protectedRows.length)} protected objectives are under pressure: ${formatList(names)}.`;
    }

    case 3: {
      const exhausted = flexibleRows.filter(
        (r) => r.state === HEALTH_STATES.EXHAUSTED
      );
      const names = exhausted.map((r) => objectiveName(r.type));
      if (exhausted.length === 1) {
        return `${names[0]} has absorbed as much as it can. Your next setback lands on something you protected.`;
      }
      return `${formatList(names)} have absorbed as much as they can. Your next setback lands on something you protected.`;
    }

    case 4: {
      const absorbing = flexibleRows.filter(
        (r) => r.state === HEALTH_STATES.ABSORBING
      );
      const names = absorbing.map((r) => objectiveName(r.type));
      if (absorbing.length === 1) {
        return `Every protected objective is holding. ${names[0]} is absorbing the pressure, which is what you classified it to do.`;
      }
      return `Every protected objective is holding. ${formatList(names)} are absorbing the pressure, which is what you classified them to do.`;
    }

    case 5:
      return 'Every objective is holding.';

    default:
      return uncovered(`sentenceRule ${health?.project?.sentenceRule}`);
  }
}

// ---------------------------------------------------------------------------
// Section 1.2: the supporting lines. At most two; Line A precedes Line B.
// Each carries the href of the module that fixes it (null for Line A).

export function supportingLines(health, { hasBaseline, openRiskCount, hrefs }) {
  const lines = [];
  const rows = health?.objectives ?? [];

  // Line A: over-constraint, only when every objective is protected.
  if (rows.length > 0 && rows.every((r) => r.isProtected)) {
    lines.push({
      text: 'You protected all five objectives, so this project has no give. Any setback lands on something you said cannot move.',
      href: null,
    });
  }

  // Line B: the blind spot. One only, the highest priority that fires.

  // 1. A protected objective is Not scored.
  const blindProtected = rows.filter(
    (r) => r.isProtected && r.state === HEALTH_STATES.NOT_SCORED
  );
  if (blindProtected.length > 0) {
    const names = blindProtected.map((r) => objectiveName(r.type));
    lines.push({
      text:
        blindProtected.length === 1
          ? `${names[0]} is protected and nothing is scored against it. This read cannot see it.`
          : `${formatList(names)} are protected and nothing is scored against them. This read cannot see them.`,
      href: hrefs?.risk ?? null,
    });
    return lines;
  }

  // 2. Unlinked items exist.
  const unlinkedRisks = health?.unlinked?.risks?.length ?? 0;
  const unlinkedActions = health?.unlinked?.actions?.length ?? 0;
  if (unlinkedRisks > 0 || unlinkedActions > 0) {
    const riskPart = `${unlinkedRisks} ${unlinkedRisks === 1 ? 'risk' : 'risks'}`;
    const actionPart = `${unlinkedActions} ${unlinkedActions === 1 ? 'action' : 'actions'}`;
    const subject =
      unlinkedRisks > 0 && unlinkedActions > 0
        ? `${riskPart} and ${actionPart} are`
        : unlinkedRisks > 0
          ? `${riskPart} ${unlinkedRisks === 1 ? 'is' : 'are'}`
          : `${actionPart} ${unlinkedActions === 1 ? 'is' : 'are'}`;
    lines.push({
      text: `${subject} not linked to an objective, so they sit outside this read.`,
      href: unlinkedRisks > 0 ? (hrefs?.risk ?? null) : (hrefs?.actions ?? null),
    });
    return lines;
  }

  // 3. Unscored risks exist.
  const unscored = health?.unscoredRiskCount ?? 0;
  if (unscored > 0) {
    lines.push({
      text: `${unscored} of your ${openRiskCount} risks ${unscored === 1 ? 'is' : 'are'} unscored, so this read is incomplete.`,
      href: hrefs?.risk ?? null,
    });
    return lines;
  }

  // 4. No programme baseline is locked.
  if (!hasBaseline) {
    lines.push({
      text: 'No programme baseline is locked, so schedule pressure is not in this read.',
      href: hrefs?.programmeSetup ?? null,
    });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Section 1.3: the four facts. Each returns { label, value, detail }, detail
// null where the sheet gives none.

export const FACT_NOT_SET = 'Not set';

export function factStage(currentStage) {
  return {
    label: 'Stage',
    value: `Stage ${currentStage}`,
    detail: STAGE_NAMES[currentStage] ?? null,
  };
}

export function factComplete(percentComplete) {
  if (percentComplete == null) {
    return { label: 'Complete', value: FACT_NOT_SET, detail: null };
  }
  return {
    label: 'Complete',
    value: `${percentComplete}% complete`,
    detail: null,
  };
}

/**
 * Fact 3: forecast completion against TARGET, both dates always named. The
 * Programme surface compares to baseline and keeps doing so; this fact asks
 * whether the commitment will be met, a different question, and naming both
 * dates is what stops the two reading as a contradiction.
 */
export function factForecast(forecastCompletion, targetCompletionDate) {
  const forecastEpoch = epochOf(forecastCompletion);
  if (forecastEpoch == null) {
    return { label: 'Forecast completion', value: FACT_NOT_SET, detail: null };
  }
  const value = formatDate(forecastCompletion);
  const targetEpoch = epochOf(targetCompletionDate);
  if (targetEpoch == null) {
    return {
      label: 'Forecast completion',
      value,
      detail: 'No target completion date set',
    };
  }
  const target = formatDate(targetCompletionDate);
  const weeks = Math.round((forecastEpoch - targetEpoch) / MS_PER_WEEK);
  const detail =
    weeks > 0
      ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} after your target of ${target}`
      : weeks < 0
        ? `${-weeks} ${weeks === -1 ? 'week' : 'weeks'} before your target of ${target}`
        : `Exactly your target of ${target}`;
  return { label: 'Forecast completion', value, detail };
}

/**
 * Fact 4: the next gate. It makes no claim about whether the gate can be
 * passed; the bearing-actions count is the Action Log's own gateReadiness.
 *
 * The value is the snapshot's own baked gate NAME, read, never synthesised:
 * stage arithmetic would happily produce "Gate 7 to 8", a gate that does not
 * exist. With no gate left in the snapshot the fact says so, and Stage 7
 * resolves itself.
 */
export function factGate(nextGate, readiness, hasBaseline) {
  if (!hasBaseline) {
    return { label: 'Next gate', value: FACT_NOT_SET, detail: null };
  }
  if (nextGate == null) {
    return { label: 'Next gate', value: 'No gate ahead', detail: null };
  }
  const open = readiness?.open ?? 0;
  const critical = readiness?.critical ?? 0;
  const bearing =
    open === 0
      ? 'No open actions bear on it.'
      : `${open} open ${open === 1 ? 'action bears' : 'actions bear'} on it${critical > 0 ? `, ${critical} critical` : ''}.`;
  const date = formatDate(nextGate.baselineDate);
  return {
    label: 'Next gate',
    value: nextGate.name ?? FACT_NOT_SET,
    detail: date ? `${date}. ${bearing}` : bearing,
  };
}

// ---------------------------------------------------------------------------
// Section 2.2 and 2.3: the reason line. One per row, selected by the trigger
// key. A REASON, never an inventory. The two date triggers return null: the
// date line carries them.

// Section 2.3: the Not scored line. Credits milestones that serve the
// objective rather than dismissing them; a Not scored row is never a dead
// end (the surface links it to the Risk register).
function notScoredLine(row, name) {
  const milestones = row?.items?.milestones ?? [];
  const n = milestones.length;
  if (n === 0) return `Nothing scored against ${name} yet.`;
  const clause =
    n === 1
      ? 'One milestone serves it and it has not slipped, but no risk has been assessed.'
      : n === 2
        ? 'Two milestones serve it and neither has slipped, but no risk has been assessed.'
        : `${numberWord(n, true)} milestones serve it and none has slipped, but no risk has been assessed.`;
  return `Nothing scored against ${name} yet. ${clause}`;
}

export function reasonLine(row) {
  const name = objectiveName(row.type);
  const { key, detail } = row.trigger ?? {};
  switch (key) {
    case HEALTH_TRIGGERS.NOT_SCORED:
      return notScoredLine(row, name);
    case HEALTH_TRIGGERS.HOLDING:
      return `Nothing is currently pressing on ${name}.`;
    case HEALTH_TRIGGERS.SERIOUS_RISK:
      return (detail?.acceptedCount ?? 0) > 0
        ? `A Serious risk is live against ${name}, and you have accepted it.`
        : `A Serious risk is live against ${name}.`;
    case HEALTH_TRIGGERS.SERIOUS_RISKS:
      return `${numberWord(detail?.count ?? 2, true)} Serious risks are live against ${name}. It has no give left.`;
    case HEALTH_TRIGGERS.MODERATE_RISK:
      return (detail?.count ?? 1) === 1
        ? `A risk worth watching is live against ${name}.`
        : `${numberWord(detail.count, true)} risks worth watching are live against ${name}.`;
    case HEALTH_TRIGGERS.OPEN_CRITICAL_ACTIONS:
      return (detail?.count ?? 1) === 1
        ? `A critical action is open against ${name}.`
        : `${numberWord(detail.count, true)} critical actions are open against ${name}.`;
    case HEALTH_TRIGGERS.PROGRAMME_RED:
      return `A milestone serving ${name} has slipped past your tolerance.`;
    case HEALTH_TRIGGERS.PROGRAMME_AMBER:
      return `A milestone serving ${name} is slipping.`;
    case HEALTH_TRIGGERS.DATE_PAST_TARGET:
    case HEALTH_TRIGGERS.DATE_WITHIN_TOLERANCE:
      // Carried by the date line (2.4), which always renders when the date
      // signal exists.
      return null;
    default:
      return uncovered(key);
  }
}

// ---------------------------------------------------------------------------
// Section 2.4: the Time date line. Rendered whenever dateSignal exists,
// independent of what set the state. Case selection reads the exact signs
// (consistent with the engine's own reading); the figures displayed are
// rounded to the nearest whole week, the lead figure carrying the unit and
// the decomposition figures bare, the sheet's own convention.

function dateLineCore(signal) {
  const total = signal.totalWeeksLate;
  const planned = signal.plannedWeeksLate;
  const slipped = signal.slippedWeeks;

  if (total > 0) {
    if (planned != null && planned > 0 && slipped != null) {
      if (slipped > 0) {
        const rp = roundWeeks(planned);
        const rs = roundWeeks(slipped);
        return `Your forecast completes ${weeksUnit(total)} after your target. ${rp} ${rp === 1 ? 'was' : 'were'} baked in when you locked the programme, and ${rs} ${rs === 1 ? 'has' : 'have'} slipped since.`;
      }
      if (slipped < 0) {
        return `Your forecast completes ${weeksUnit(total)} after your target. ${roundWeeks(planned)} were baked in when you locked the programme, and you have pulled back ${roundWeeks(slipped)}. It is not enough.`;
      }
      // The planning gap alone: the delivery has not moved.
      return `The programme you locked completes ${weeksUnit(total)} after your target. That was true the day you locked it.`;
    }
    if (slipped != null && slipped > 0) {
      return `Your forecast completes ${weeksUnit(total)} after your target. The plan was sound; delivery has slipped.`;
    }
    // No decomposition to give (no baseline completion supplied).
    return `Your forecast completes ${weeksUnit(total)} after your target.`;
  }

  // On or before the target.
  if (planned != null && planned > 0) {
    return `You locked a programme that missed your target by ${weeksUnit(planned)}. You have pulled back ${roundWeeks(slipped)}, and you are now forecast to make it.`;
  }
  if (signal.verdict === DATE_VERDICTS.NO_ROOM) {
    return `You are forecast to make your target with ${weeksUnit(total)} in hand. There is no room left.`;
  }
  return `Your forecast completes ${weeksUnit(total)} before your target.`;
}

export function dateLine(row) {
  const signal = row?.dateSignal;
  if (signal == null) return null;
  const core = dateLineCore(signal);
  // On a Not scored Time row both lines render, the date line prefixed so
  // neither claim contaminates the other (sheet 2.4, last case).
  if (row.state === HEALTH_STATES.NOT_SCORED) {
    return `Separately: ${core.charAt(0).toLowerCase()}${core.slice(1)}`;
  }
  return core;
}

// ---------------------------------------------------------------------------
// Section 2.5: the drift notice. Reported where the engine detected it,
// never resolved here.

export function driftLine(row) {
  const drift = row?.drift;
  if (drift == null) return null;
  const name = objectiveName(row.type);
  if (drift.live === 'critical') {
    return `${name} is protected, but your locked programme still monitors it as standard. Re-baseline to bring them into line.`;
  }
  return `${name} is flexible, but your locked programme still monitors it as critical. Re-baseline to bring them into line.`;
}
