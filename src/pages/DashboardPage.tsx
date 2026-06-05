import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTauriCommand } from '../hooks/useTauriCommand';
import { useSettings } from '../hooks/useSettings';
import { tauri } from '../lib/tauri';
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

  const fetchDashboard = useCallback(async () => {
    if (isOwner) {
      await fetchOwner(() => tauri.sales.getOwnerDashboard(session.token));
    } else {
      await fetchPharmacist(() => tauri.sales.getPharmacistDashboard(session.token));
    }
  }, [isOwner, fetchOwner, fetchPharmacist, session.token]);

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
          onClick && count > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
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
      <Card>
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

            {/* Top Sellers Chart (full width) */}
            <TopSellersChart data={ownerData.top_sellers} />
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
