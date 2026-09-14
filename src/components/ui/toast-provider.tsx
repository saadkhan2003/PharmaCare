import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<ToastType, string> = {
  success: 'border-l-green-400 bg-green-600 text-white',
  error: 'border-l-red-400 bg-red-600 text-white',
  info: 'border-l-blue-400 bg-blue-600 text-white',
  warning: 'border-l-amber-400 bg-amber-600 text-white',
};

const iconColors: Record<ToastType, string> = {
  success: 'text-white',
  error: 'text-white',
  info: 'text-white',
  warning: 'text-white',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    const timer = setTimeout(() => {
      removeToast(id);
    }, 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  const handleMouseEnter = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const handleMouseLeave = useCallback((id: number) => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[380px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              onMouseEnter={() => handleMouseEnter(t.id)}
              onMouseLeave={() => handleMouseLeave(t.id)}
              className={cn(
                'flex items-start gap-3 rounded-md border border-l-4 p-4 shadow-lg animate-scale-in',
                colors[t.type]
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconColors[t.type])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white break-words">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-white/80 mt-0.5">{t.description}</p>
                )}
              </div>
              <button onClick={() => removeToast(t.id)} className="shrink-0 text-white/70 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
