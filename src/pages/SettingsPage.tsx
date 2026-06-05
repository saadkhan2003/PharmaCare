import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { PharmacyInfoTab } from '@/components/settings/PharmacyInfoTab';
import { FinancialTab } from '@/components/settings/FinancialTab';
import { InventoryTab } from '@/components/settings/InventoryTab';
import { BackupTab } from '@/components/settings/BackupTab';
import type { SessionDto } from '@/types/session';

interface SettingsPageProps {
  session: SessionDto;
}

const tabs = [
  { id: 'pharmacy', label: 'Pharmacy Info' },
  { id: 'financial', label: 'Financial' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'backup', label: 'Backup' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function SettingsPage({ session }: SettingsPageProps) {
  const { settings, loading, refresh } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>('pharmacy');

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
      </div>
    </div>
  );
}
