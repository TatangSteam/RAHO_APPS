export const SESSION_EDIT_WINDOW_HOURS = 4;
export const SESSION_EDIT_WINDOW_MS = SESSION_EDIT_WINDOW_HOURS * 60 * 60 * 1000;

type EditableSession = {
  isCompleted: boolean;
  completedAt: Date | null;
};

export function getSessionEditWindow(session: EditableSession, now = new Date()) {
  if (!session.isCompleted) {
    return { canEdit: true, deadline: null, remainingMs: null };
  }

  if (!session.completedAt) {
    return { canEdit: false, deadline: null, remainingMs: 0 };
  }

  const deadline = new Date(session.completedAt.getTime() + SESSION_EDIT_WINDOW_MS);
  const remainingMs = Math.max(0, deadline.getTime() - now.getTime());
  return { canEdit: remainingMs > 0, deadline, remainingMs };
}

export function assertSessionEditWindow(session: EditableSession, now = new Date()) {
  const window = getSessionEditWindow(session, now);
  if (!window.canEdit) {
    throw {
      status: 409,
      code: 'SESSION_EDIT_WINDOW_EXPIRED',
      message: `Batas koreksi sesi ${SESSION_EDIT_WINDOW_HOURS} jam setelah diselesaikan sudah berakhir. Hubungi Admin Manager untuk koreksi formal.`,
    };
  }
  return window;
}
