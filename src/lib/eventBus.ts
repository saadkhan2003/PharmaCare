import React from 'react';

// Typed event bus using window CustomEvents
// All events are prefixed with 'pharmacare:' for namespace isolation

type EventMap = {
  'medicines-changed': undefined;
  'sales-changed': undefined;
  'purchases-changed': undefined;
  'suppliers-changed': undefined;
  'debts-changed': undefined;
  'settings-changed': undefined;
  'supplier-debts-changed': undefined;
};

export function dispatchEvent<K extends keyof EventMap>(event: K, detail?: EventMap[K]) {
  window.dispatchEvent(new CustomEvent(event, { detail }));
}

export function useEventBus<K extends keyof EventMap>(
  event: K,
  handler: () => void
) {
  React.useEffect(() => {
    const listener = () => handler();
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  }, [handler, event]);
}

// Convenience hook that returns a refreshKey that increments when the event fires
export function useAutoRefresh<K extends keyof EventMap>(
  event: K
): [number] {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const bump = React.useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEventBus(event, bump);

  return [refreshKey];
}
