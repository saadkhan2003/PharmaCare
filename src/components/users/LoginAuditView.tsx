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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { tauri } from '@/lib/tauri';
import { formatDateTime } from '@/lib/formatDate';
import type { LoginAttemptDto } from '@/types/user';

interface LoginAuditViewProps {
  sessionToken: string;
}

interface Filters {
  username: string;
  status: 'all' | 'success' | 'failed';
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 20;

export function LoginAuditView({ sessionToken }: LoginAuditViewProps) {
  const [attempts, setAttempts] = useState<LoginAttemptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<Filters>({
    username: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });

  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    username: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.audit.getLoginAttemptsFiltered(sessionToken, {
        username: appliedFilters.username || null,
        success:
          appliedFilters.status === 'all'
            ? null
            : appliedFilters.status === 'success',
        start_date: appliedFilters.startDate || null,
        end_date: appliedFilters.endDate || null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setAttempts(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load login attempts'
      );
    } finally {
      setLoading(false);
    }
  }, [sessionToken, appliedFilters, page]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  useEffect(() => {
    setPage(0);
  }, [appliedFilters]);

  const handleApply = () => {
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    const empty: Filters = { username: '', status: 'all', startDate: '', endDate: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const canNext = attempts.length === PAGE_SIZE;
  const displayPage = page + 1;
  const totalPages = canNext ? page + 2 : page + 1;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="px-4 pb-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
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

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Username</label>
          <Input
            placeholder="Filter by username..."
            value={filters.username}
            onChange={(e) =>
              setFilters((f) => ({ ...f, username: e.target.value }))
            }
            className="w-48"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <div className="flex rounded-lg border">
            {(['all', 'success', 'failed'] as const).map((val) => (
              <button
                key={val}
                onClick={() => setFilters((f) => ({ ...f, status: val }))}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  filters.status === val
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                } ${val === 'all' ? 'rounded-l-lg' : ''} ${val === 'failed' ? 'rounded-r-lg' : ''}`}
              >
                {val === 'all' ? 'All' : val === 'success' ? 'Success' : 'Failed'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="w-40"
          />
        </div>

        <Button size="sm" onClick={handleApply}>
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-lg border-dashed p-8 text-center text-sm text-muted-foreground">
          No login attempts match the current filters
        </div>
      ) : (
        <>
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

          <Pagination
            page={displayPage}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p - 1)}
          />
        </>
      )}
    </div>
  );
}
