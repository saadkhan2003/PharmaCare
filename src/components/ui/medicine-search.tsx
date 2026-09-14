import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { tauri } from '@/lib/tauri';

interface MedicineSearchDropdownProps {
  sessionToken: string;
  currencySymbol: string;
  value: string;
  onSelect: (medicine: { id: number; name: string; purchase_price: number; retail_price: number }) => void;
  placeholder?: string;
  className?: string;
}

interface MedicineResult {
  id: number;
  name: string;
  purchase_price: number;
  retail_price: number;
  current_stock: number;
  unit: string;
}

export function MedicineSearchDropdown({
  sessionToken,
  currencySymbol,
  value,
  onSelect,
  placeholder = 'Search medicines...',
  className,
}: MedicineSearchDropdownProps) {
  const [query, setQuery] = useState(value);
  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<MedicineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setOpen(true);

    tauri.medicines
      .search(sessionToken, debouncedQuery, 1, 15)
      .then((data) => {
        if (!cancelled) {
          setResults(
            data.items.map((m) => ({
              id: m.id,
              name: m.name,
              purchase_price: m.purchase_price,
              retail_price: m.retail_price,
              current_stock: m.current_stock,
              unit: m.unit,
            }))
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, sessionToken]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleSelect = useCallback((medicine: MedicineResult) => {
    onSelect(medicine);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }, [open, results, selectedIndex, handleSelect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDropdownPosition = () => {
    if (!containerRef.current) return { top: 0, left: 0, width: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    };
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        className="h-10 w-full min-w-0 rounded-lg border border-input bg-transparent pl-9 pr-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && (results.length > 0 || loading) && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: getDropdownPosition().top,
            left: getDropdownPosition().left,
            width: getDropdownPosition().width,
            zIndex: 9999,
          }}
          className="max-h-64 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          {loading && (
            <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {!loading && results.map((medicine, index) => (
            <button
              key={medicine.id}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(medicine)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{medicine.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Stock: {medicine.current_stock} {medicine.unit}
                </p>
              </div>
              <span className="ml-2 shrink-0 text-sm font-medium">
                {currencySymbol}{medicine.retail_price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
