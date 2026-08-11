import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { persistActiveTabInUrl, usePersistentTabs } from './usePersistentTabs';

const sectionLoads = { profile: 0, sessions: 0 };

function StatefulSection({ name }: { name: keyof typeof sectionLoads }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    sectionLoads[name] += 1;
  }, [name]);

  return (
    <label>
      {name}
      <input
        aria-label={`${name} input`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
}

function Harness() {
  const { activeTab, visitedTabs, activateTab } = usePersistentTabs<'profile' | 'sessions'>('profile');

  return (
    <>
      <button onClick={() => activateTab('profile')}>Profile</button>
      <button onClick={() => activateTab('sessions')}>Sessions</button>
      {visitedTabs.has('profile') && (
        <section hidden={activeTab !== 'profile'}>
          <StatefulSection name="profile" />
        </section>
      )}
      {visitedTabs.has('sessions') && (
        <section hidden={activeTab !== 'sessions'}>
          <StatefulSection name="sessions" />
        </section>
      )}
    </>
  );
}

describe('usePersistentTabs', () => {
  beforeEach(() => {
    sectionLoads.profile = 0;
    sectionLoads.sessions = 0;
  });

  it('mounts a section lazily and preserves its state when switching away and back', () => {
    render(<Harness />);

    expect(sectionLoads.profile).toBe(1);
    expect(sectionLoads.sessions).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'sessions input' }), {
      target: { value: 'draft tersimpan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));

    expect(screen.getByRole('textbox', { name: 'sessions input' })).toHaveValue('draft tersimpan');
    expect(sectionLoads.sessions).toBe(1);
  });

  it('persists the active section in the URL without creating a navigation entry', () => {
    window.history.replaceState({}, '', '/members/member-1?filter=active');
    const historyLength = window.history.length;

    persistActiveTabInUrl('sessions', 'profile');
    expect(window.location.pathname).toBe('/members/member-1');
    expect(window.location.search).toBe('?filter=active&tab=sessions');
    expect(window.history.length).toBe(historyLength);

    persistActiveTabInUrl('profile', 'profile');
    expect(window.location.search).toBe('?filter=active');
  });
});
