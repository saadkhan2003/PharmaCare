import { ExpiryReport } from '@/components/reports/ExpiryReport';
import type { SessionDto } from '@/types/session';

interface ExpiryReportPageProps {
  session: SessionDto;
}

export function ExpiryReportPage({ session }: ExpiryReportPageProps) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">Expiry Report</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Monitor medicine batches approaching expiry.
      </p>

      <ExpiryReport sessionToken={session.token} />
    </div>
  );
}
