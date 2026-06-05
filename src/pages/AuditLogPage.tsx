import type { SessionDto } from '@/types/session';

interface AuditLogPageProps {
  session: SessionDto;
}

export function AuditLogPage({ session: _session }: AuditLogPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Login Audit Log</h1>
      <p className="text-muted-foreground mt-2">Audit log viewer coming in a later task.</p>
    </div>
  );
}
