import type { SessionDto } from '@/types/session';

interface PurchasesPageProps {
  session: SessionDto;
}

export function PurchasesPage({ session: _session }: PurchasesPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Purchases</h1>
      <p className="text-muted-foreground">Purchase management coming soon...</p>
    </div>
  );
}
