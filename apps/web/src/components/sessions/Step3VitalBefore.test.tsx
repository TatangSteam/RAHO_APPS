import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Step3VitalBefore from './Step3VitalBefore';
import { SessionWorkflowDraftProvider, type SessionDraftKey } from './SessionWorkflowDraftContext';
import { useCallback, useMemo, useState } from 'react';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { userId: 'nurse-1', role: 'NAKES' } }),
}));

jest.mock('@/lib/sessionApi', () => ({
  sessionApi: { upsertVitalSign: jest.fn() },
}));

function VitalBeforeHarness() {
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const vitalSigns = useMemo(() => [], []);
  const updateDraft = useCallback((key: SessionDraftKey, value: unknown) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  }, []);
  const clearDraft = useCallback((key: SessionDraftKey) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <SessionWorkflowDraftProvider
      drafts={drafts}
      updateDraft={updateDraft}
      clearDraft={clearDraft}
    >
      <Step3VitalBefore
        sessionId="session-1"
        vitalSigns={vitalSigns}
        isLocked={false}
        onComplete={jest.fn()}
      />
    </SessionWorkflowDraftProvider>
  );
}

describe('Step3VitalBefore', () => {
  it('keeps typed values when workflow autosave re-renders its provider', async () => {
    render(<VitalBeforeHarness />);

    const systolicInput = screen.getByLabelText(/Sistol/);
    fireEvent.change(systolicInput, { target: { value: '120' } });

    await waitFor(() => expect(systolicInput).toHaveValue('120'));
  });
});
