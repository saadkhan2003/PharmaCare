import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  return (
    <div className={cn('flex items-start justify-between rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive', className)}>
      <p>{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  );
}
