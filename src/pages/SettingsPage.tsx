import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { PharmacyInfoTab } from '@/components/settings/PharmacyInfoTab';
import { FinancialTab } from '@/components/settings/FinancialTab';
import { InventoryTab } from '@/components/settings/InventoryTab';
import { BackupTab } from '@/components/settings/BackupTab';
import { DatabaseStatusPanel } from '@/components/settings/DatabaseStatusPanel';
import { setEnabled as setSoundEnabled } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';

interface SettingsPageProps {
  session: SessionDto;
}

const tabs = [
  { id: 'pharmacy', label: 'Pharmacy Info' },
  { id: 'financial', label: 'Financial' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'backup', label: 'Backup' },
  { id: 'database', label: 'Database' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function SettingsPage({ session }: SettingsPageProps) {
  const { settings, loading, refresh } = useSettings(session.token);
  const [activeTab, setActiveTab] = useState<TabId>('pharmacy');
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    try {
      return localStorage.getItem('pharmacare_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    try {
      return (localStorage.getItem('pharmacare-theme') as 'light' | 'dark' | 'system') || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('pharmacare-theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.add('light');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <p className="text-destructive">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Preferences */}
      <div className="mb-6 rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Sound Effects</h3>
            <p className="text-xs text-muted-foreground">Play sounds on actions like confirm, save, and delete</p>
          </div>
          <button
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => setSoundEnabledState((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              soundEnabled ? 'bg-primary' : 'bg-input'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-sm transition-transform ${
                soundEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Theme</h3>
            <p className="text-xs text-muted-foreground">Choose your preferred color scheme</p>
          </div>
          <div className="flex gap-1 rounded-lg border bg-muted p-1">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  theme === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="flex space-x-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground border border-b-0 border-border -mb-px'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === 'pharmacy' && (
          <PharmacyInfoTab settings={settings} session={session} onSaved={refresh} />
        )}
        {activeTab === 'financial' && (
          <FinancialTab settings={settings} session={session} onSaved={refresh} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab settings={settings} session={session} onSaved={refresh} />
        )}
        {activeTab === 'backup' && (
          <BackupTab settings={settings} session={session} onSaved={refresh} />
        )}
        {activeTab === 'database' && (
          <DatabaseStatusPanel session={session} />
        )}
      </div>
    </div>
  );
}
