import { useIsDark } from '../../hooks/useIsDark';

export function ChartTooltipContent({ active, payload, label, formatter }: any) {
  const dark = useIsDark();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{
        background: dark ? '#1e1e1e' : '#fff',
        borderColor: dark ? '#333' : '#e5e7eb',
        color: dark ? '#e5e5e5' : '#111827',
      }}
    >
      <p className="mb-1 font-medium" style={{ color: dark ? '#e5e5e5' : '#374151' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

export function chartAxisStyle(dark: boolean) {
  return {
    tick: { fontSize: 10, fill: dark ? '#a1a1aa' : '#6b7280' },
    axisLine: { stroke: dark ? '#333' : '#e5e7eb' },
    tickLine: { stroke: dark ? '#333' : '#e5e7eb' },
  };
}

export function chartLegendStyle(dark: boolean) {
  return {
    wrapperStyle: { fontSize: 11, color: dark ? '#a1a1aa' : '#6b7280' },
  };
}

export const CHART_COLORS = {
  primary: '#6366f1',
  profit: '#22c55e',
  revenue: '#3b82f6',
  cost: '#ef4444',
  neutral: '#8b5cf6',
};

export function useChartColors() {
  const dark = useIsDark();
  return {
    primary: dark ? '#818cf8' : '#6366f1',
    profit: dark ? '#4ade80' : '#22c55e',
    revenue: dark ? '#60a5fa' : '#3b82f6',
    cost: dark ? '#f87171' : '#ef4444',
    neutral: dark ? '#a78bfa' : '#8b5cf6',
  };
}
