import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import type { BackupStatus } from '@/types/report';
import { Loader2, Save, Play, Download, FolderOpen, ChevronDown, ChevronRight, Cloud, CloudOff } from 'lucide-react';

interface BackupTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

export function BackupTab({ settings, session, onSaved }: BackupTabProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Local backup
  const [localPath, setLocalPath] = useState('');

  // Drive (advanced)
  const [driveConnected, setDriveConnected] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalPath(settings.local_backup_path || '');
  }, [settings]);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await tauri.backup.getStatus(session.token);
      setBackupStatus(status);
      setDriveConnected(status.google_drive_connected);
    } catch {
      // Ignore
    } finally {
      setStatusLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        local_backup_path: localPath || null,
      });
      setMessage({ type: 'success', text: 'Backup settings saved' });
      onSaved();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setMessage(null);
    try {
      const result = await tauri.backup.trigger(session.token);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message });
      await fetchStatus();
      onSaved();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Backup failed' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const backups = await tauri.backup.listDriveBackups(session.token);
      if (backups.length === 0) {
        setMessage({ type: 'error', text: 'No backups found' });
        setRestoring(false);
        return;
      }
      const latest = backups.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())[0];
      const confirmed = window.confirm(
        `Restore backup from ${new Date(latest.created_time).toLocaleString()}?\n\n` +
        `File: ${latest.name}\n\n` +
        '⚠ This will REPLACE all current data. A pre-restore backup will be created automatically.'
      );
      if (!confirmed) { setRestoring(false); return; }
      await tauri.backup.restore(session.token, latest.id, 'drive');
      setMessage({ type: 'success', text: 'Restore complete. Please restart the app.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoring(false);
    }
  };

  const lastBackup = backupStatus?.last_backup_time
    ? new Date(backupStatus.last_backup_time).toLocaleString()
    : null;
  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(backupStatus!.last_backup_time!).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Backup Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading status...
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {lastBackup ? (
                <p className="text-green-700">✅ Last backup: {lastBackup}</p>
              ) : (
                <p className="text-muted-foreground">No backups yet</p>
              )}
              {daysSinceBackup > 3 && (
                <p className="text-amber-700">⚠ No backup in {daysSinceBackup} days</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Creates a snapshot of your database. It will be saved to the local folder if configured.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleBackupNow} disabled={backingUp} size="sm">
              {backingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Backup Now
            </Button>
            <Button onClick={handleRestore} disabled={restoring} variant="outline" size="sm">
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Restore Latest
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Local Folder Backup — PRIMARY method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Local Folder Backup <span className="text-xs font-normal text-muted-foreground">(Recommended)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Backups are saved as <code>pharmaCare_backup_YYYY-MM-DD.db.gz</code> files.
            You can use a USB drive path like <code>D:\Backups</code> (Windows) or <code>/mnt/usb/pharmacy-backups</code> (Linux).
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="local-path">Folder Path</Label>
              <Input
                id="local-path"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="e.g. D:\Backups or /mnt/usb/backups"
              />
            </div>
            <Button variant="outline" size="sm" className="mb-0.5" onClick={handleSaveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty to skip local folder backup. Backups are always created in the app data directory.
          </p>
        </CardContent>
      </Card>

      {/* Google Drive — Advanced */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Google Drive Backup {driveConnected ? '(Connected)' : '(Advanced — requires API setup)'}
        </button>
        {showAdvanced && (
          <Card className="mt-3">
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                To use Google Drive backup, you need to create OAuth credentials in the{' '}
                <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a>.
                This is recommended for technical users only.
              </p>
              {driveConnected ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Cloud className="h-4 w-4" /> Connected to Google Drive
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CloudOff className="h-4 w-4" /> Not connected
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
