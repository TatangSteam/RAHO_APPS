'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

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
  const { drafts, updateDraft: updateContextDraft, clearDraft: clearContextDraft } = useContext(SessionWorkflowDraftContext);
  const updateDraft = useCallback(
    (value: T) => updateContextDraft(key, value),
    [key, updateContextDraft],
  );
  const clearDraft = useCallback(
    () => clearContextDraft(key),
    [clearContextDraft, key],
  );

  return {
    initialDraft: (drafts[key] || {}) as Partial<T>,
    updateDraft,
    clearDraft,
  };
}
