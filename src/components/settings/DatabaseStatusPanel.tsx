import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { DbStatus } from '@/types/report';
import { Loader2, RefreshCw, Database, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface DatabaseStatusPanelProps {
  session: SessionDto;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  const sep = path.includes('\\') ? '\\' : '/';
  const parts = path.split(sep);
  if (parts.length <= 2) return `...${path.slice(-maxLen)}`;
  return `${parts[0]}${sep}...${sep}${parts.slice(-2).join(sep)}`;
}

export function DatabaseStatusPanel({ session }: DatabaseStatusPanelProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tauri.db.getStatus(session.token);
      setStatus(result);
      setLastChecked(new Date());
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await tauri.db.optimize(session.token);
      toast('success', 'Database optimized successfully', 'Defragmented tables and optimized query plans');
      fetchStatus();
    } catch (err: unknown) {
      toast('error', 'Optimization failed', err instanceof Error ? err.message : String(err));
    } finally {
      setOptimizing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const migrationProgress = status
    ? Math.round((status.migration_version / status.total_migrations) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading database status...
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Path</span>
                <p className="font-mono text-xs mt-0.5 truncate" title={status.db_path}>
                  {truncatePath(status.db_path)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Size</span>
                <p className="font-medium mt-0.5">{formatBytes(status.db_size_bytes)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Migrations</span>
                <p className="mt-0.5">
                  v{status.migration_version} of {status.total_migrations}
                </p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${migrationProgress}%` }}
                  />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">WAL Mode</span>
                <p className="mt-0.5 flex items-center gap-1.5">
                  {status.wal_mode ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Enabled</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5 text-red-600" /> Disabled</>
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Foreign Keys</span>
                <p className="mt-0.5 flex items-center gap-1.5">
                  {status.foreign_keys ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Enabled</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5 text-red-600" /> Disabled</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOptimize}
                  disabled={optimizing || loading}
                  className="gap-1.5"
                  title="Run VACUUM and SQLite query optimizer to reclaim space and accelerate queries"
                >
                  {optimizing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 text-amber-500" />
                  )}
                  Optimize DB
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStatus}
                  disabled={loading || optimizing}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-destructive">Failed to load database status</p>
        )}
      </CardContent>
    </Card>
  );
}
