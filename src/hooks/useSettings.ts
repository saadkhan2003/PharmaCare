import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SettingsMap } from '../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
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
          pharmacy_name: 'PharmaCare',
          owner_name: '',
          phone: '',
          address: '',
          logo_path: '',
          auto_backup_time: '',
          local_backup_path: '',
          last_backup_time: null,
          last_backup_status: null,
          google_drive_connected: false,
          tax_enabled_default: false,
        });
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return { settings, loading, refresh };
}
