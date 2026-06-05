import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import type { ExpiryReportRow } from '@/lib/tauri';

interface ExpiryReportProps {
  sessionToken: string;
}

type SortField = 'medicine_name' | 'remaining_qty' | 'expiry_date' | 'days_remaining';
type SortDir = 'asc' | 'desc';

const FILTER_OPTIONS = [
  { label: 'All', minDays: undefined as number | undefined, maxDays: undefined as number | undefined },
  { label: 'Within 30 days', minDays: undefined, maxDays: 30 },
  { label: 'Within 60 days', minDays: undefined, maxDays: 60 },
  { label: 'Within 90 days', minDays: undefined, maxDays: 90 },
  { label: 'Expired only', minDays: -999, maxDays: 0 },
] as const;

function getDaysColor(days: number): string {
  if (days <= 0) return 'bg-red-700 text-white';
  if (days <= 30) return 'bg-red-100 text-red-800 border-red-300';
  if (days <= 60) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-green-100 text-green-800 border-green-300';
}

function getDaysLabel(days: number): string {
  if (days <= 0) return 'Expired';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function ExpiryReport({ sessionToken }: ExpiryReportProps) {
  const [rows, setRows] = useState<ExpiryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterIndex, setFilterIndex] = useState(0);
  const [sortField, setSortField] = useState<SortField>('days_remaining');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchReport = useCallback(
    async (minDays?: number, maxDays?: number) => {
      setLoading(true);
      try {
        const result = await tauri.expiry.getReport(sessionToken, minDays, maxDays);
        setRows(result);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    const filter = FILTER_OPTIONS[filterIndex];
    fetchReport(filter.minDays, filter.maxDays);
  }, [fetchReport, filterIndex]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField]
  );

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'medicine_name':
          cmp = a.medicine_name.localeCompare(b.medicine_name);
          break;
        case 'remaining_qty':
          cmp = a.remaining_qty - b.remaining_qty;
          break;
        case 'expiry_date':
          cmp = a.expiry_date.localeCompare(b.expiry_date);
          break;
        case 'days_remaining':
          cmp = a.days_remaining - b.days_remaining;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 gap-1 font-medium"
        onClick={() => handleSort(field)}
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </Button>
    </TableHead>
  );

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Show items:</span>
          <Select
            value={filterIndex.toString()}
            onValueChange={(value: string | null) => {
              if (value !== null) setFilterIndex(parseInt(value));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((opt, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No expiring medicines found matching your criteria.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="medicine_name">Medicine Name</SortHeader>
                <TableHead>Batch</TableHead>
                <SortHeader field="remaining_qty">Quantity</SortHeader>
                <SortHeader field="expiry_date">Expiry Date</SortHeader>
                <SortHeader field="days_remaining">Days Left</SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, index) => (
                <TableRow key={`${row.batch_id}-${index}`}>
                  <TableCell className="font-medium">
                    {row.medicine_name}
                    {row.generic_name && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.generic_name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    #{row.batch_id}
                  </TableCell>
                  <TableCell>{row.remaining_qty}</TableCell>
                  <TableCell>{row.expiry_date}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getDaysColor(row.days_remaining)}
                    >
                      {getDaysLabel(row.days_remaining)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
