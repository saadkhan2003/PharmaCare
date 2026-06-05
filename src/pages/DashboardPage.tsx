import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTauriCommand } from '../hooks/useTauriCommand';
import { useSettings } from '../hooks/useSettings';
import { tauri } from '../lib/tauri';
import type { BackupStatus } from '../types/report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Package,
  Cloud,
  CloudOff,
  Clock,
} from 'lucide-react';
import type { SessionDto } from '../types/session';
import type { OwnerDashboardDto, PharmacistDashboardDto } from '../types/sale';

interface DashboardPageProps {
  session: SessionDto;
}

/**
 * Dashboard page — role-appropriate display.
 *
 * Owner (D-41): today_sales, today_profit (green), month_sales,
 *   low_stock (clickable → /medicines), expiry_warning (yellow ≤60d),
 *   expiry_critical (red ≤30d), top 5 sellers (Recharts BarChart).
 *
 * Pharmacist (D-42): today_sales only, low_stock, expiry counts.
 *   NO profit or margin data.
 */
export function DashboardPage({ session }: DashboardPageProps) {
  const isOwner = session.role === 'owner';
  const navigate = useNavigate();
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';

  const {
    data: ownerData,
    error: ownerError,
    loading: ownerLoading,
    execute: fetchOwner,
  } = useTauriCommand<OwnerDashboardDto>();

  const {
    data: pharmacistData,
    error: pharmacistError,
    loading: pharmacistLoading,
    execute: fetchPharmacist,
  } = useTauriCommand<PharmacistDashboardDto>();

  // Backup status (owner only)
  const {
    data: backupStatus,
    loading: backupLoading,
    execute: fetchBackupStatus,
  } = useTauriCommand<BackupStatus>();

  const {
    data: overdueDebtCount,
    execute: fetchOverdueDebtCount,
  } = useTauriCommand<number>();

  const {
    data: dueSoonDebtCount,
    execute: fetchDueSoonDebtCount,
  } = useTauriCommand<number>();

  const fetchDashboard = useCallback(async () => {
    if (isOwner) {
      await fetchOwner(() => tauri.sales.getOwnerDashboard(session.token));
      await fetchBackupStatus(() => tauri.backup.getStatus(session.token));
      await fetchOverdueDebtCount(() => tauri.debt.getOverdueCount(session.token));
      await fetchDueSoonDebtCount(() => tauri.debt.getDueSoonCount(session.token));
    } else {
      await fetchPharmacist(() => tauri.sales.getPharmacistDashboard(session.token));
    }
  }, [isOwner, fetchOwner, fetchPharmacist, fetchBackupStatus, fetchOverdueDebtCount, fetchDueSoonDebtCount, session.token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const error = isOwner ? ownerError : pharmacistError;
  const loading = isOwner ? ownerLoading : pharmacistLoading;

  /** Shared alert card used by both roles */
  function AlertCard({
    title,
    count,
    icon: Icon,
    onClick,
    badgeClassName,
  }: {
    title: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    badgeClassName?: string;
  }) {
    return (
      <Card
        className={
          onClick && count > 0
            ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'
            : 'transition-all duration-200 hover:shadow-sm'
        }
        onClick={count > 0 ? onClick : undefined}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{count}</span>
            {count > 0 && (
              <Badge className={badgeClassName}>
                {count === 1 ? '1 item' : `${count} items`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  /** KPI card — large formatted number */
  function KpiCard({
    title,
    value,
    icon: Icon,
    colorClass,
  }: {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    colorClass?: string;
  }) {
    const formatted =
      Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);

    return (
      <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${colorClass ?? ''}`}>
            {currencySymbol}{formatted}
          </div>
        </CardContent>
      </Card>
    );
  }

  /** Loading skeleton cards */
  function LoadingSkeletons() {
    return (
      <>
        {Array.from({ length: isOwner ? 6 : 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </>
    );
  }

  /** Top sellers bar chart (owner only) */
  function TopSellersChart({ data }: { data: OwnerDashboardDto['top_sellers'] }) {
    if (data.length === 0) {
      return (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top 5 Selling Medicines (This Week)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No sales data this week</p>
          </CardContent>
        </Card>
      );
    }

    const chartData = data.map((s) => ({
      name: s.medicine_name.length > 18
        ? s.medicine_name.slice(0, 16) + '…'
        : s.medicine_name,
      quantity: s.total_qty,
    }));

    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Top 5 Selling Medicines (This Week)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, bottom: 40, left: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Bar
                  dataKey="quantity"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="Quantity Sold"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper: check if backup is missed (>3 days)
  function isBackupMissed(lastBackupTime: string | null): boolean {
    if (!lastBackupTime) return true;
    const lastBackup = new Date(lastBackupTime);
    const now = new Date();
    const diffMs = now.getTime() - lastBackup.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 72; // 3 days
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {session.role}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load dashboard: {error}
        </div>
      )}

      {/* Missed backup warning (owner only) */}
      {isOwner && backupStatus && isBackupMissed(backupStatus.last_backup_time) && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/settings')}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>
            {backupStatus.last_backup_time
              ? 'No backup in 3+ days. '
              : 'No backup has been performed yet. '}
            Go to Settings to back up your data.
          </span>
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <LoadingSkeletons />}

        {!loading && !error && isOwner && ownerData && (
          <>
            {/* KPI Cards */}
            <KpiCard
              title="Today's Sales"
              value={ownerData.today_sales}
              icon={DollarSign}
            />
            <KpiCard
              title="Today's Profit"
              value={ownerData.today_profit}
              icon={TrendingUp}
              colorClass="text-green-600"
            />
            <KpiCard
              title="Monthly Sales"
              value={ownerData.month_sales}
              icon={Calendar}
            />

            {/* Alert Cards */}
            <AlertCard
              title="Low Stock"
              count={ownerData.low_stock_count}
              icon={Package}
              onClick={() => navigate('/medicines')}
            />
            <AlertCard
              title="Expiry Warnings (≤60d)"
              count={ownerData.expiry_warning_count}
              icon={AlertTriangle}
              badgeClassName="bg-amber-100 text-amber-800 border-amber-200"
            />
            <AlertCard
              title="Expiry Critical (≤30d)"
              count={ownerData.expiry_critical_count}
              icon={AlertTriangle}
              badgeClassName="bg-red-100 text-red-800 border-red-200"
            />
            <AlertCard
              title="Debts Due Soon (≤3d)"
              count={dueSoonDebtCount ?? 0}
              icon={Calendar}
              onClick={() => navigate('/debts')}
              badgeClassName="bg-yellow-100 text-yellow-800 border-yellow-200"
            />
            <AlertCard
              title="Overdue Debts"
              count={overdueDebtCount ?? 0}
              icon={Clock}
              onClick={() => navigate('/debts')}
              badgeClassName="bg-amber-100 text-amber-800 border-amber-200"
            />

            {/* Top Sellers Chart (full width) */}
            <TopSellersChart data={ownerData.top_sellers} />

            {/* Backup Status Widget */}
            {!backupLoading && backupStatus && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Backup</CardTitle>
                  {backupStatus.google_drive_connected ? (
                    <Cloud className="h-4 w-4 text-green-600" />
                  ) : (
                    <CloudOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {backupStatus.google_drive_connected ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600 font-medium">Drive Connected</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Last backup:{' '}
                          {backupStatus.last_backup_time
                            ? new Date(backupStatus.last_backup_time).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                      {backupStatus.last_backup_status && (
                        <div className="text-sm">
                          Status:{' '}
                          <span
                            className={
                              backupStatus.last_backup_status === 'Success'
                                ? 'text-green-600 font-medium'
                                : 'text-red-600 font-medium'
                            }
                          >
                            {backupStatus.last_backup_status}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Drive Not Connected —{' '}
                      <button
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => navigate('/settings')}
                      >
                        Connect in Settings
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!loading && !error && !isOwner && pharmacistData && (
          <>
            {/* KPI Card — only today_sales (D-42) */}
            <KpiCard
              title="Today's Sales"
              value={pharmacistData.today_sales}
              icon={DollarSign}
            />

            {/* Alert Cards */}
            <AlertCard
              title="Low Stock"
              count={pharmacistData.low_stock_count}
              icon={Package}
              onClick={() => navigate('/medicines')}
            />
            <AlertCard
              title="Expiry Warnings (≤60d)"
              count={pharmacistData.expiry_warning_count}
              icon={AlertTriangle}
              badgeClassName="bg-amber-100 text-amber-800 border-amber-200"
            />
            <AlertCard
              title="Expiry Critical (≤30d)"
              count={pharmacistData.expiry_critical_count}
              icon={AlertTriangle}
              badgeClassName="bg-red-100 text-red-800 border-red-200"
            />
          </>
        )}
      </div>
    </div>
  );
}
