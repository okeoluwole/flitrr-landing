/**
 * The wizard's step-action model (Note 1).
 *
 * The action bar used to offer Back and a bare Next. Every navigation already
 * persists the step (A0), so Next did save, but the label never said so. A
 * developer who wanted their work kept could not tell, and the observed
 * behaviour in the end-to-end test was the classic wizard failure: leaving
 * through the exit control to be sure the step was saved, then walking back in.
 *
 * So both forward actions carry the Save prefix, and both of them mean it:
 *
 *   Save & Continue  persist this step, then advance to the next.
 *   Save & Exit      persist this step, then leave for the projects list.
 *
 * The symmetry is the point. Shortening either label for visual balance would
 * put the doubt straight back, so neither is shortened.
 *
 * Placement is Back on the left, then Save & Exit and Save & Continue on the
 * right, with Save & Continue primary.
 *
 * On the final step (the Brief) there is no next step, so the continue slot is
 * held by the Brief's own generate-and-lock action, which lives in the panel
 * and is untouched by this model. Save & Exit still applies there.
 *
 * Pure and presentation-free: it names actions and their order, and orchestrates
 * the save-then-leave sequence. The wizard shell supplies the persistence and
 * the navigation.
 */

// Where Save & Exit lands: the projects list.
export const PROJECTS_HREF = '/pulse/app';

export const STEP_ACTION = {
  BACK: 'back',
  SAVE_EXIT: 'saveExit',
  SAVE_CONTINUE: 'saveContinue',
  // Rendered by StepGeneratedBrief, not the action bar. Named here so the model
  // can state what holds the continue slot on the final step.
  GENERATE_AND_LOCK: 'generateAndLock',
};

export const ACTION_LABELS = {
  [STEP_ACTION.BACK]: 'Back',
  [STEP_ACTION.SAVE_EXIT]: 'Save & Exit',
  [STEP_ACTION.SAVE_CONTINUE]: 'Save & Continue',
};

/**
 * The actions for a step, in render order: Back on the left, then the right
 * hand pair. Each entry carries its side, whether it is the primary action, and
 * where it renders ('bar' for the action bar, 'panel' for the Brief's own
 * control).
 *
 * Back is always listed; it is disabled on Step 1 rather than removed, so the
 * bar does not reflow between steps. That is the shell's call, not this
 * model's.
 */
export function stepActions(step, totalSteps) {
  const n = Number(step);
  const total = Number(totalSteps);
  const isFinal = Number.isInteger(n) && Number.isInteger(total) && n >= total;

  const actions = [
    {
      action: STEP_ACTION.BACK,
      label: ACTION_LABELS[STEP_ACTION.BACK],
      side: 'left',
      primary: false,
      rendersIn: 'bar',
    },
    {
      action: STEP_ACTION.SAVE_EXIT,
      label: ACTION_LABELS[STEP_ACTION.SAVE_EXIT],
      side: 'right',
      primary: false,
      rendersIn: 'bar',
    },
  ];

  if (isFinal) {
    // The Brief. The generate-and-lock action holds the continue slot, in the
    // panel with the rest of the lock controls; the bar carries Back and
    // Save & Exit only.
    actions.push({
      action: STEP_ACTION.GENERATE_AND_LOCK,
      label: null,
      side: 'right',
      primary: true,
      rendersIn: 'panel',
    });
    return actions;
  }

  actions.push({
    action: STEP_ACTION.SAVE_CONTINUE,
    label: ACTION_LABELS[STEP_ACTION.SAVE_CONTINUE],
    side: 'right',
    primary: true,
    rendersIn: 'bar',
  });
  return actions;
}

/**
 * The actions the action bar itself renders, in order.
 */
export function barActions(step, totalSteps) {
  return stepActions(step, totalSteps).filter((a) => a.rendersIn === 'bar');
}

/**
 * True when the bar carries this action on this step.
 */
export function hasAction(step, totalSteps, action) {
  return stepActions(step, totalSteps).some((a) => a.action === action);
}

/**
 * Save & Exit: persist the current step, and only then leave.
 *
 * Persisting first is the whole point of the label. A failed save keeps the
 * developer on the step with the error in view rather than routing away from
 * work that was never written, so `exit` is never called after a failure.
 *
 * `persist` returns an error (or null); a throw is treated as a failure too.
 * Returns { saved, error }, so the caller can surface the error itself.
 */
export async function saveAndExit({ persist, exit }) {
  let error = null;
  try {
    error = (await persist()) ?? null;
  } catch (thrown) {
    error = thrown instanceof Error ? thrown : new Error(String(thrown));
  }
  if (error) return { saved: false, error };
  exit();
  return { saved: true, error: null };
}
