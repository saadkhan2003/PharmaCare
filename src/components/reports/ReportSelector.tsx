import { cn } from '@/lib/utils';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Package,
  AlertTriangle,
  CalendarClock,
  Truck,
  Users,
  Percent,
} from 'lucide-react';

interface ReportItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ReportCategory {
  name: string;
  items: ReportItem[];
}

const CATEGORIES: ReportCategory[] = [
  {
    name: 'Sales',
    items: [
      { id: 'daily-sales', label: 'Daily Sales', icon: TrendingUp },
      { id: 'monthly-pnl', label: 'Monthly P&L', icon: DollarSign },
      { id: 'sales-by-user', label: 'Sales by User', icon: Users },
    ],
  },
  {
    name: 'Stock',
    items: [
      { id: 'top-sellers', label: 'Top Sellers', icon: BarChart3 },
      { id: 'slow-moving', label: 'Slow-Moving', icon: Package },
      { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
      { id: 'expiry', label: 'Expiry Report', icon: CalendarClock },
    ],
  },
  {
    name: 'Financial',
    items: [
      { id: 'supplier-purchases', label: 'Supplier Purchases', icon: Truck },
      { id: 'profit-margin', label: 'Profit Margin', icon: Percent },
    ],
  },
];

interface ReportSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function ReportSelector({ selected, onSelect }: ReportSelectorProps) {
  return (
    <div className="w-56 shrink-0 border-r pr-4 space-y-4">
      {CATEGORIES.map((cat) => (
        <div key={cat.name}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {cat.name}
          </h3>
          <div className="space-y-0.5">
            {cat.items.map((item) => {
              const Icon = item.icon;
              const isActive = selected === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-left transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
