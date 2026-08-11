import { useCallback, useState } from 'react';

export function persistActiveTabInUrl<T extends string>(tab: T, defaultTab: T) {
  const url = new URL(window.location.href);

  if (tab === defaultTab) {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', tab);
  }

  window.history.replaceState(window.history.state, '', url);
}

export function usePersistentTabs<T extends string>(initialTab: T) {
  const [activeTab, setActiveTab] = useState<T>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<T>>(() => new Set([initialTab]));

  const activateTab = useCallback((tab: T) => {
    setVisitedTabs((current) => {
      if (current.has(tab)) return current;
      const next = new Set(current);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

  return { activeTab, visitedTabs, activateTab };
}
