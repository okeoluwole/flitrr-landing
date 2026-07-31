import { describe, it, expect, vi } from 'vitest';
import {
  ACTION_LABELS,
  PROJECTS_HREF,
  STEP_ACTION,
  barActions,
  hasAction,
  saveAndExit,
  stepActions,
} from '../app/pulse/app/components/stepActions.js';

/**
 * Note 1: the wizard step actions.
 *
 * Both forward actions persist through the one path every navigation already
 * uses, and both labels say so. The final step (the Brief) has no next step, so
 * the continue slot passes to the Brief's own generate-and-lock action while
 * Save & Exit still applies.
 */

// The live flow: nine steps, the ninth being the Generated Brief.
const TOTAL = 9;
const BODY_STEPS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('the labels', () => {
  it('carries the Save prefix on both forward actions', () => {
    expect(ACTION_LABELS[STEP_ACTION.SAVE_CONTINUE]).toBe('Save & Continue');
    expect(ACTION_LABELS[STEP_ACTION.SAVE_EXIT]).toBe('Save & Exit');
  });

  it('leaves Back unchanged', () => {
    expect(ACTION_LABELS[STEP_ACTION.BACK]).toBe('Back');
  });

  it('offers no bare Next anywhere', () => {
    const labels = Object.values(ACTION_LABELS);
    expect(labels).not.toContain('Next');
  });

  // The symmetry is the point: a bare Next read as unsaved beside a Save & Exit,
  // which is what sent developers out through the exit control to be safe.
  it('never shortens one forward label against the other', () => {
    for (const key of [STEP_ACTION.SAVE_CONTINUE, STEP_ACTION.SAVE_EXIT]) {
      expect(ACTION_LABELS[key].startsWith('Save & ')).toBe(true);
    }
  });
});

describe('which actions render on which step', () => {
  it('offers Back, Save & Exit and Save & Continue on every step before the Brief', () => {
    for (const step of BODY_STEPS) {
      const actions = barActions(step, TOTAL).map((a) => a.action);
      expect(actions).toEqual([
        STEP_ACTION.BACK,
        STEP_ACTION.SAVE_EXIT,
        STEP_ACTION.SAVE_CONTINUE,
      ]);
    }
  });

  it('swaps Save & Continue for generate-and-lock on the Brief', () => {
    const actions = stepActions(TOTAL, TOTAL).map((a) => a.action);
    expect(actions).toContain(STEP_ACTION.GENERATE_AND_LOCK);
    expect(actions).not.toContain(STEP_ACTION.SAVE_CONTINUE);
  });

  it('still applies Save & Exit on the Brief', () => {
    expect(hasAction(TOTAL, TOTAL, STEP_ACTION.SAVE_EXIT)).toBe(true);
    expect(
      barActions(TOTAL, TOTAL).map((a) => a.action)
    ).toEqual([STEP_ACTION.BACK, STEP_ACTION.SAVE_EXIT]);
  });

  // The lock controls live in the panel with the rest of the Brief's actions,
  // and this session does not move or change them.
  it('leaves generate-and-lock to the panel, not the action bar', () => {
    const lock = stepActions(TOTAL, TOTAL).find(
      (a) => a.action === STEP_ACTION.GENERATE_AND_LOCK
    );
    expect(lock.rendersIn).toBe('panel');
    expect(barActions(TOTAL, TOTAL).map((a) => a.action)).not.toContain(
      STEP_ACTION.GENERATE_AND_LOCK
    );
  });

  it('keeps Back on every step', () => {
    for (let step = 1; step <= TOTAL; step += 1) {
      expect(hasAction(step, TOTAL, STEP_ACTION.BACK)).toBe(true);
    }
  });
});

describe('placement', () => {
  it('puts Back on the left and the pair on the right', () => {
    const [back, exit, cont] = stepActions(4, TOTAL);
    expect(back.side).toBe('left');
    expect(exit.side).toBe('right');
    expect(cont.side).toBe('right');
  });

  it('orders the right hand pair Save & Exit then Save & Continue', () => {
    const right = stepActions(4, TOTAL).filter((a) => a.side === 'right');
    expect(right.map((a) => a.action)).toEqual([
      STEP_ACTION.SAVE_EXIT,
      STEP_ACTION.SAVE_CONTINUE,
    ]);
  });

  it('makes Save & Continue the only primary', () => {
    const primaries = stepActions(4, TOTAL).filter((a) => a.primary);
    expect(primaries.map((a) => a.action)).toEqual([STEP_ACTION.SAVE_CONTINUE]);
  });

  it('makes generate-and-lock the primary on the Brief', () => {
    const primaries = stepActions(TOTAL, TOTAL).filter((a) => a.primary);
    expect(primaries.map((a) => a.action)).toEqual([
      STEP_ACTION.GENERATE_AND_LOCK,
    ]);
  });
});

describe('Save & Exit persists before it routes', () => {
  it('routes to the projects list', () => {
    expect(PROJECTS_HREF).toBe('/pulse/app');
  });

  it('persists first, then exits', async () => {
    const order = [];
    const persist = vi.fn(async () => {
      order.push('persist');
      return null;
    });
    const exit = vi.fn(() => order.push('exit'));

    const result = await saveAndExit({ persist, exit });

    expect(result).toEqual({ saved: true, error: null });
    expect(order).toEqual(['persist', 'exit']);
  });

  // Routing away from work that was never written is the one thing this action
  // must never do.
  it('does not exit when the save fails', async () => {
    const failure = new Error('save_failed');
    const exit = vi.fn();

    const result = await saveAndExit({ persist: async () => failure, exit });

    expect(exit).not.toHaveBeenCalled();
    expect(result.saved).toBe(false);
    expect(result.error).toBe(failure);
  });

  it('treats a thrown save as a failure and stays put', async () => {
    const exit = vi.fn();

    const result = await saveAndExit({
      persist: async () => {
        throw new Error('network');
      },
      exit,
    });

    expect(exit).not.toHaveBeenCalled();
    expect(result.saved).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('awaits the save rather than racing it', async () => {
    let settled = false;
    const exit = vi.fn(() => {
      expect(settled).toBe(true);
    });

    await saveAndExit({
      persist: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            settled = true;
            resolve(null);
          }, 5);
        }),
      exit,
    });

    expect(exit).toHaveBeenCalledTimes(1);
  });
});
