import { describe, it, expect } from 'vitest';
import {
  splitProjects,
  projectAction,
  isLockedRecordError,
} from '../app/pulse/app/projectListModel';

/**
 * The project list's removal model (projectListModel.js): the working/archived
 * split and the one removal action a row offers. The rule mirrors the 037
 * delete guard exactly, so these tests pin the UI side of the same boundary
 * the database enforces: a draft (never locked) deletes, a record archives,
 * an archived record restores, and a member touches nothing.
 */

const draft = { id: 'a', status: 'draft' };
const active = { id: 'b', status: 'active' };
const onHold = { id: 'c', status: 'on_hold' };
const completed = { id: 'd', status: 'completed' };
const archived = { id: 'e', status: 'archived' };

describe('splitProjects', () => {
  it('splits archived rows onto the shelf and keeps everything else working', () => {
    const { working, archived: shelf } = splitProjects([
      draft,
      active,
      archived,
      onHold,
    ]);
    expect(working.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(shelf.map((p) => p.id)).toEqual(['e']);
  });

  it('preserves the incoming order inside each register', () => {
    const first = { id: 'x', status: 'archived' };
    const second = { id: 'y', status: 'archived' };
    const { archived: shelf } = splitProjects([first, active, second]);
    expect(shelf.map((p) => p.id)).toEqual(['x', 'y']);
  });

  it('returns two empty registers for an empty or missing list', () => {
    expect(splitProjects([])).toEqual({ working: [], archived: [] });
    expect(splitProjects(null)).toEqual({ working: [], archived: [] });
    expect(splitProjects(undefined)).toEqual({ working: [], archived: [] });
  });
});

describe('projectAction', () => {
  it('offers delete on a draft: never locked, nothing of governance value', () => {
    expect(projectAction(draft, true)).toBe('delete');
  });

  it('offers archive on every working record, whatever its status', () => {
    expect(projectAction(active, true)).toBe('archive');
    expect(projectAction(onHold, true)).toBe('archive');
    expect(projectAction(completed, true)).toBe('archive');
  });

  it('offers restore on an archived record', () => {
    expect(projectAction(archived, true)).toBe('restore');
  });

  it('offers a member nothing, matching the 024 write policies', () => {
    expect(projectAction(draft, false)).toBeNull();
    expect(projectAction(active, false)).toBeNull();
    expect(projectAction(archived, false)).toBeNull();
  });

  it('offers nothing for a missing project', () => {
    expect(projectAction(null, true)).toBeNull();
    expect(projectAction(undefined, true)).toBeNull();
  });
});

describe('isLockedRecordError', () => {
  it('recognises the 037 guard refusal by its stated name', () => {
    expect(
      isLockedRecordError({
        message:
          'project_is_locked_record: this project’s brief has been locked, so it is a governance record. Archive it instead of deleting it.',
      })
    ).toBe(true);
  });

  it('leaves every other failure to the generic copy', () => {
    expect(isLockedRecordError({ message: 'Failed to fetch' })).toBe(false);
    expect(isLockedRecordError({ message: '' })).toBe(false);
    expect(isLockedRecordError({})).toBe(false);
    expect(isLockedRecordError(null)).toBe(false);
    expect(isLockedRecordError(undefined)).toBe(false);
  });
});
