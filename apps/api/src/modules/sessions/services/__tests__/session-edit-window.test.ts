import {
  SESSION_EDIT_WINDOW_MS,
  assertSessionEditWindow,
  getSessionEditWindow,
} from '../session-edit-window';

describe('session edit window', () => {
  const completedAt = new Date('2026-08-26T08:00:00.000Z');

  it('keeps an unfinished session editable', () => {
    expect(getSessionEditWindow({ isCompleted: false, completedAt: null }).canEdit).toBe(true);
  });

  it('allows correction until four hours after completion', () => {
    const result = getSessionEditWindow(
      { isCompleted: true, completedAt },
      new Date(completedAt.getTime() + SESSION_EDIT_WINDOW_MS - 1),
    );
    expect(result.canEdit).toBe(true);
    expect(result.remainingMs).toBe(1);
  });

  it('rejects correction when the four-hour window has expired', () => {
    expect(() => assertSessionEditWindow(
      { isCompleted: true, completedAt },
      new Date(completedAt.getTime() + SESSION_EDIT_WINDOW_MS),
    )).toThrow(expect.objectContaining({ code: 'SESSION_EDIT_WINDOW_EXPIRED' }));
  });
});
