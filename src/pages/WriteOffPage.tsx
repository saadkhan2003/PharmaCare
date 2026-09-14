import { useState } from 'react';
import { WriteOffForm } from '@/components/returns/WriteOffForm';
import { useSettings } from '@/hooks/useSettings';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function WriteOffPage({ session }: Props) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Write Off</h1>
          <p className="text-sm text-muted-foreground">Remove damaged or expired stock from inventory.</p>
        </div>
      </div>
      <WriteOffForm
        key={refreshKey}
        sessionToken={session.token}
        currencySymbol={currencySymbol}
        onComplete={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
