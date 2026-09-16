import { useEffect, useCallback, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTauriCommand } from '@/hooks/useTauriCommand';
import { tauri } from '@/lib/tauri';
import { useEventBus } from '@/lib/eventBus';
import type { BackupStatus } from '@/types/report';
import type { SessionDto } from '@/types/session';

interface BackupStatusBannerProps {
  session: SessionDto;
}

export function BackupStatusBanner({ session }: BackupStatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data: backupStatus, execute: fetchBackupStatus } =
    useTauriCommand<BackupStatus>();

  const checkBackup = useCallback(() => {
    fetchBackupStatus(() => tauri.backup.getStatus(session.token));
  }, [fetchBackupStatus, session.token]);

  useEffect(() => {
    checkBackup();
    const interval = setInterval(checkBackup, 30 * 1000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkBackup]);

  // Re-check whenever a backup finishes or settings update
  useEventBus('backup-completed', checkBackup);
  useEventBus('settings-changed', checkBackup);

  // Also check when window gains focus
  useEffect(() => {
    const onFocus = () => checkBackup();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkBackup]);

  if (dismissed || !backupStatus) return null;

  // Safe parsing helper
  const isBackupOverdue = () => {
    if (!backupStatus.last_backup_time) return true;

    // Normalize timestamp to ISO 8601 (replace space with T for WebKitGTK compatibility)
    const normalized = backupStatus.last_backup_time.includes('T')
      ? backupStatus.last_backup_time
      : backupStatus.last_backup_time.replace(' ', 'T');

    const backupTimestamp = new Date(normalized).getTime();
    if (isNaN(backupTimestamp)) {
      const fallbackTime = Date.parse(backupStatus.last_backup_time);
      if (isNaN(fallbackTime)) return false;
      return Date.now() - fallbackTime > 3 * 24 * 60 * 60 * 1000;
    }

    const diffMs = Date.now() - backupTimestamp;
    return diffMs > 3 * 24 * 60 * 60 * 1000;
  };

  if (!isBackupOverdue()) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between gap-3 mb-4 shadow-xs">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>
          Warning: No backup in over 3 days. Back up your data in Settings.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800 rounded p-1 hover:bg-amber-100 transition-colors"
        title="Dismiss alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
