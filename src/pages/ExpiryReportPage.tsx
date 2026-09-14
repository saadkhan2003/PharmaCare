import { ExpiryReport } from '@/components/reports/ExpiryReport';
import type { SessionDto } from '@/types/session';

interface ExpiryReportPageProps {
  session: SessionDto;
}

export function ExpiryReportPage({ session }: ExpiryReportPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expiry Report</h1>
          <p className="text-sm text-muted-foreground">
            Monitor medicine batches approaching expiry.
          </p>
        </div>
      </div>

      <ExpiryReport session={session} />
    </div>
  );
}
