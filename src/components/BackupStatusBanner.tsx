import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTauriCommand } from '@/hooks/useTauriCommand';
import { tauri } from '@/lib/tauri';
import type { BackupStatus } from '@/types/report';
import type { SessionDto } from '@/types/session';

interface BackupStatusBannerProps {
  session: SessionDto;
}

export function BackupStatusBanner({ session }: BackupStatusBannerProps) {
  const { data: backupStatus, execute: fetchBackupStatus } =
    useTauriCommand<BackupStatus>();

  const checkBackup = () => {
    fetchBackupStatus(() => tauri.backup.getStatus(session.token));
  };

  useEffect(() => {
    checkBackup();
    const interval = setInterval(checkBackup, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!backupStatus) return null;

  const missed =
    !backupStatus.last_backup_time ||
    new Date().getTime() - new Date(backupStatus.last_backup_time).getTime() > 3 * 24 * 60 * 60 * 1000;

  if (!missed) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      <span>
        Warning: No backup in over 3 days. Back up your data in Settings.
      </span>
    </div>
  );
}
