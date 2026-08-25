'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type SessionDraftKey =
  | 'diagnosis'
  | 'vitalBefore'
  | 'infusion'
  | 'materials'
  | 'vitalAfter'
  | 'complaints'
  | 'evaluation';

type DraftContextValue = {
  drafts: Record<string, unknown>;
  updateDraft: (key: SessionDraftKey, value: unknown) => void;
  clearDraft: (key: SessionDraftKey) => void;
};

const SessionWorkflowDraftContext = createContext<DraftContextValue>({
  drafts: {},
  updateDraft: () => undefined,
  clearDraft: () => undefined,
});

export function SessionWorkflowDraftProvider({
  drafts,
  updateDraft,
  clearDraft,
  children,
}: DraftContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ drafts, updateDraft, clearDraft }),
    [clearDraft, drafts, updateDraft],
  );
  return (
    <SessionWorkflowDraftContext.Provider value={value}>
      {children}
    </SessionWorkflowDraftContext.Provider>
  );
}

export function useSessionWorkflowDraft<T extends object>(key: SessionDraftKey) {
  const context = useContext(SessionWorkflowDraftContext);
  return {
    initialDraft: (context.drafts[key] || {}) as Partial<T>,
    updateDraft: (value: T) => context.updateDraft(key, value),
    clearDraft: () => context.clearDraft(key),
  };
}
