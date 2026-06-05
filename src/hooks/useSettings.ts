import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SettingsMap } from '../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<SettingsMap>('get_settings')
      .then(setSettings)
      .catch(() => {
        // Fall back to hardcoded defaults per D-27
        setSettings({
          default_tax_rate: 0,
          cashier_discount_enabled: false,
          expiry_warning_days: 60,
          expiry_critical_days: 30,
          default_reorder_level: 10,
          currency_symbol: 'Rs.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return { settings, loading };
}
