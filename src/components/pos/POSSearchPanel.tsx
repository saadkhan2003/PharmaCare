import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { MedicinePosDto } from '@/types/sale';

interface POSSearchPanelProps {
  session: SessionDto;
  onSelectMedicine: (medicine: MedicinePosDto) => void;
  selectedResultIndex: number;
  setSelectedResultIndex: (index: number) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  debouncedQuery: string;
  setQuery: (q: string) => void;
  onResultsCountChange?: (count: number) => void;
}

export function POSSearchPanel({
  session,
  onSelectMedicine,
  selectedResultIndex,
  setSelectedResultIndex,
  searchRef,
  onKeyDown,
  debouncedQuery,
  setQuery,
  onResultsCountChange,
}: POSSearchPanelProps) {
  const [query, setLocalQuery] = useState(debouncedQuery);
  const debouncedLocal = useDebounce(query, 200);
  const [results, setResults] = useState<MedicinePosDto[]>([]);
  const [loading, setLoading] = useState(false);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const emptyQuery = !query.trim();
  const noResults = query.trim().length > 0 && !loading && results.length === 0;

  // Sync debouncedQuery prop into local state when it changes externally
  useEffect(() => {
    setLocalQuery(debouncedQuery);
  }, [debouncedQuery]);

  // Sync local query up to parent
  useEffect(() => {
    setQuery(query);
  }, [query, setQuery]);

  useEffect(() => {
    onResultsCountChange?.(results.length);
  }, [results.length, onResultsCountChange]);

  // Fetch results when debounced local query changes
  useEffect(() => {
    if (!debouncedLocal.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    tauri.sales
      .searchMedicinesPos(session.token, debouncedLocal)
      .then((data) => {
        if (!cancelled) {
          setResults(data.slice(0, 20));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('POS search failed:', err); // M-5 fix: surface errors instead of swallowing
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedLocal, session.token]);

  // Scroll selected result into view (M-10 fix: clamp to valid range)
  useEffect(() => {
    if (resultsContainerRef.current && selectedResultIndex >= 0 && selectedResultIndex < results.length) {
      const el = resultsContainerRef.current.children[selectedResultIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedResultIndex, results.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
    setSelectedResultIndex(-1);
  };

  const getStockBadgeVariant = (stock: number, reorderLevel: number) => {
    if (stock === 0) return 'destructive';
    if (stock <= reorderLevel) return 'secondary';
    return 'default';
  };

  const getStockBadgeLabel = (stock: number) => {
    if (stock === 0) return 'Out of Stock';
    return `Stock: ${stock}`;
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(
        selectedResultIndex < results.length - 1 ? selectedResultIndex + 1 : selectedResultIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(selectedResultIndex > 0 ? selectedResultIndex - 1 : 0);
    } else if (e.key === 'Enter') {
      const targetIndex = selectedResultIndex >= 0 ? selectedResultIndex : (results.length === 1 ? 0 : -1);
      if (targetIndex >= 0 && targetIndex < results.length) {
        e.preventDefault();
        onSelectMedicine(results[targetIndex]);
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search medicines by name, generic name, or brand (Enter to add)..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInternal}
          className="h-14 py-6 pl-14 pr-4 text-xl"
        />
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground text-lg">Searching...</p>
          </div>
        )}

        {emptyQuery && !loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-lg text-center">
              Search medicines by name, generic name, or brand
            </p>
          </div>
        )}

        {noResults && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">No medicines found</p>
          </div>
        )}

        {results.length > 0 && !loading && (
          <div
            ref={resultsContainerRef}
            className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-2"
          >
            {results.map((medicine, index) => (
              <button
                key={medicine.id}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  index === selectedResultIndex
                    ? 'bg-accent border-accent-foreground'
                    : 'bg-card hover:bg-accent/50 border-border'
                }`}
                onClick={() => onSelectMedicine(medicine)}
                onMouseEnter={() => setSelectedResultIndex(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-lg font-semibold truncate">{medicine.name}</p>
                    {medicine.generic_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {medicine.generic_name}
                      </p>
                    )}
                    {medicine.shelf_location && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Shelf: {medicine.shelf_location}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-lg font-bold">Rs. {medicine.retail_price}</span>
                    <Badge
                      variant={getStockBadgeVariant(medicine.current_stock, medicine.reorder_level)}
                    >
                      {getStockBadgeLabel(medicine.current_stock)}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
