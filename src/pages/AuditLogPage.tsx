import { LoginAuditView } from '@/components/users/LoginAuditView';
import type { SessionDto } from '@/types/session';

interface AuditLogPageProps {
  session: SessionDto;
}

export function AuditLogPage({ session }: AuditLogPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Login Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all login attempts ordered by most recent first.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <LoginAuditView sessionToken={session.token} />
      </div>
    </div>
  );
}
