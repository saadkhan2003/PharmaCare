import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  showDateFilter?: boolean;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const QUICK_OPTIONS = [
  { label: 'Today', getStart: getToday, getEnd: getToday },
  { label: 'This Week', getStart: getWeekStart, getEnd: getToday },
  { label: 'This Month', getStart: getMonthStart, getEnd: getToday },
  { label: 'Last 30 Days', getStart: () => daysAgo(30), getEnd: getToday },
  { label: 'This Year', getStart: getYearStart, getEnd: getToday },
] as const;

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  showDateFilter = true,
}: DateRangePickerProps) {
  const handleQuickSelect = useCallback(
    (getStart: () => string, getEnd: () => string) => {
      onChange(getStart(), getEnd());
    },
    [onChange]
  );

  if (!showDateFilter) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="h-8 w-36 text-xs"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {QUICK_OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            variant="outline"
            size="xs"
            onClick={() => handleQuickSelect(opt.getStart, opt.getEnd)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
