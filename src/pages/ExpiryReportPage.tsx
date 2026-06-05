import type { SessionDto } from '@/types/session';

interface ExpiryReportPageProps {
  session: SessionDto;
}

export function ExpiryReportPage({ session: _session }: ExpiryReportPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Expiry Report</h1>
      <p className="text-muted-foreground">Expiry report coming soon...</p>
    </div>
  );
}
