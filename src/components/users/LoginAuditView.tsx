import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { tauri } from '@/lib/tauri';
import { formatDateTime } from '@/lib/formatDate';
import type { LoginAttemptDto } from '@/types/user';

interface LoginAuditViewProps {
  sessionToken: string;
}

export function LoginAuditView({ sessionToken }: LoginAuditViewProps) {
  const [attempts, setAttempts] = useState<LoginAttemptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.audit.getLoginAttempts(sessionToken);
      setAttempts(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load login attempts'
      );
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No login attempts recorded
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Failure Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attempts.map((attempt) => (
          <TableRow key={attempt.id}>
            <TableCell className="text-muted-foreground">
              {formatDateTime(attempt.created_at)}
            </TableCell>
            <TableCell className="font-medium">{attempt.username}</TableCell>
            <TableCell>
              {attempt.success ? (
                <Badge
                  variant="outline"
                  className="border-green-300 text-green-700"
                >
                  ✓ Success
                </Badge>
              ) : (
                <Badge variant="destructive">✗ Failure</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {attempt.failure_reason || '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
