/**
 * Suite nudges (PULSE Framework Section 10).
 *
 * One entry per sibling Flitrr product PULSE can point to from initiation, at
 * the field where that product does the deeper job: ROUTE at the procurement
 * route (Step 1), STACK at the financial baseline (Step 6). The nudge turns a
 * boundary into a path: PULSE captures the fact and points to the sibling that
 * builds the strategy or the model behind it.
 *
 * `available` is the ship switch, and it is the no-overclaim rule in one flag.
 * It is false until that product is actually live, so every nudge is dormant
 * today and PULSE shows no pointer to something that is not there. When ROUTE
 * or STACK ships, set its `available` to true and its `href`, and the nudge
 * goes live with no other change. The second gate, App-tier only, lives in the
 * SuiteNudge component: an orchestrated run already has the whole suite.
 */
export const SUITE_NUDGES = {
  route: {
    name: 'ROUTE',
    // ROUTE has not shipped. Keep false until it is live (Section 10).
    available: false,
    blurb:
      'ROUTE can guide you to the right procurement strategy and the scope matrix for this project.',
    cta: 'Explore ROUTE',
    // Set when ROUTE ships.
    href: null,
  },
  stack: {
    name: 'STACK',
    // STACK has not shipped. Used by Step 6 (added in a later sub-step).
    available: false,
    blurb: 'STACK can build the financial model behind the budget you are setting.',
    cta: 'Explore STACK',
    href: null,
  },
};
