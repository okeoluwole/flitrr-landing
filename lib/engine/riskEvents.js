/**
 * Risk events (Note 19). Pure, deterministic reading of the append-only
 * project_risk_events table (migration 030). No DB, no React, no network, no
 * system clock: every input is passed in, so the same inputs always give the
 * same verdict and the whole module is unit-testable in isolation.
 *
 * WHY THIS MODULE EXISTS. The register was telling five of six risks that
 * "Severity has escalated." on a register that had never been reviewed and had
 * recorded no change at all. The sentence came from the ESCALATED_SEVERITY
 * trigger in monitor.js, which is a LEVEL test: it fires when a risk's score
 * sits at or above the escalation threshold for its criticality. That test is
 * correct and is not changed here. What was wrong was the wording: a level was
 * being reported as a change. A seeded medium-by-medium risk that nobody has
 * touched has not escalated. It has never moved.
 *
 * THE RULE, which is the deterministic principle applied to words: an
 * escalation is a RECORDED EVENT, never an inference. deriveEscalation returns
 * something only when a row in project_risk_events shows a band actually being
 * raised, and what it returns carries the four facts that make the claim
 * checkable: from, to, when and who. With no such row it returns null and the
 * surface renders no escalation line at all. On a freshly seeded register,
 * which has no events, every risk returns null.
 *
 * WHAT IS RECORDED. A 'scored' event whose from_value and to_value are severity
 * BAND keys ('serious', 'moderate', 'minor', 'unscored'). The band is what the
 * developer sees and what the escalation sentence is about, so the band is what
 * is recorded. A rescore that leaves the band where it was writes nothing:
 * there is no band transition to record, and an event log full of non-events
 * would be as misleading as the sentence this replaces. The current likelihood
 * and impact stay on project_risks; this table holds transitions only.
 */

import { SEVERITY_RANK, deriveSeverity } from './severity.js';

// The event types migration 030 defines. Only SCORED is written today; the
// other three exist so a reviewed, status or note event can be appended later
// without reworking the schema (see the D2 design note in monitor.js).
export const RISK_EVENT_TYPES = {
  SCORED: 'scored',
  STATUS_CHANGED: 'status_changed',
  REVIEWED: 'reviewed',
  NOTE_SET: 'note_set',
};

/**
 * Did a band move from `from` to `to` count as a raise? SEVERITY_RANK ascends
 * by urgency (serious = 0), so a raise is a strictly smaller rank. An unknown
 * band on either side is not a raise: the claim has to be checkable, and a band
 * this engine cannot rank is not.
 *
 * A first score (from is null, the risk had no band before) is deliberately NOT
 * a raise. Arriving somewhere is not escalating to it.
 */
export function isBandRaise(from, to) {
  const fromRank = SEVERITY_RANK[from];
  const toRank = SEVERITY_RANK[to];
  if (fromRank == null || toRank == null) return false;
  return toRank < fromRank;
}

// An ISO timestamp as epoch milliseconds; null when missing or unparseable, so
// the ordering below never throws on a partial row.
function epoch(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Group events by the risk they belong to, newest first within each risk. One
 * pass, so a page that has read a project's events once can ask about every
 * risk without rescanning.
 */
export function eventsByRisk(events) {
  const byRisk = new Map();
  for (const e of events ?? []) {
    if (e == null || !e.risk_id) continue;
    const held = byRisk.get(e.risk_id);
    if (held) held.push(e);
    else byRisk.set(e.risk_id, [e]);
  }
  for (const list of byRisk.values()) {
    list.sort((a, b) => (epoch(b.occurred_at) ?? 0) - (epoch(a.occurred_at) ?? 0));
  }
  return byRisk;
}

/**
 * The most recent recorded escalation for one risk, or null when there is none.
 * Reads only 'scored' events whose recorded band transition was a raise, so a
 * rescore that lowered the band, a first score, and an unscored risk all return
 * null, as does a risk with no events at all.
 *
 * Returns { from, to, at, by }: the band before, the band after, the ISO
 * timestamp it happened, and the actor id. The caller turns those into words;
 * this module never holds display strings.
 *
 * `events` is the risk's own events in any order (or the whole project's, since
 * a risk_id filter is applied). Ordering is by occurred_at, newest first.
 */
export function deriveEscalation(events, riskId) {
  let best = null;
  let bestAt = null;
  for (const e of events ?? []) {
    if (e == null) continue;
    if (riskId != null && e.risk_id !== riskId) continue;
    if (e.event_type !== RISK_EVENT_TYPES.SCORED) continue;
    if (!isBandRaise(e.from_value, e.to_value)) continue;
    const at = epoch(e.occurred_at);
    // Newest wins. A row with no readable timestamp can still stand as the
    // escalation when nothing better is on record, but never displaces a dated
    // one.
    if (best == null || (at != null && (bestAt == null || at > bestAt))) {
      best = e;
      bestAt = at;
    }
  }
  if (best == null) return null;
  return {
    from: best.from_value,
    to: best.to_value,
    at: best.occurred_at ?? null,
    by: best.actor_id ?? null,
  };
}

/**
 * The latest recorded escalation for every risk in one project's event set.
 * Returns a Map of risk id -> the deriveEscalation shape, holding only the
 * risks that actually have one. A register with no events gets an empty map,
 * which is what makes "no escalation line anywhere" the default rather than a
 * special case that has to be remembered.
 */
export function escalationsByRisk(events) {
  const out = new Map();
  for (const [riskId, list] of eventsByRisk(events)) {
    const escalation = deriveEscalation(list, riskId);
    if (escalation) out.set(riskId, escalation);
  }
  return out;
}

/**
 * The event row a rescore writes, or null when the band did not move. Pure row
 * shaping: no clock (occurred_at is the database's NOW() default) and no id
 * invention, the same convention reconcileDecisionStore.decisionRowFrom follows.
 *
 * Both bands are derived here from the likelihood and impact pairs, so the one
 * derivation in severity.js decides what a band is and the caller cannot record
 * a band the engine would not agree with.
 */
export function buildScoredEvent({
  projectId,
  riskId,
  before,
  after,
  actorId = null,
}) {
  const from = deriveSeverity(before?.likelihood, before?.impact).key;
  const to = deriveSeverity(after?.likelihood, after?.impact).key;
  if (from === to) return null;
  return {
    project_id: projectId,
    risk_id: riskId,
    event_type: RISK_EVENT_TYPES.SCORED,
    from_value: from,
    to_value: to,
    actor_id: actorId,
  };
}
