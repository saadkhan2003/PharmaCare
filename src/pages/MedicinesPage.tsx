import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Upload } from 'lucide-react';
import { MedicineList } from '@/components/medicines/MedicineList';
import { MedicineForm } from '@/components/medicines/MedicineForm';
import { ImportMedicinesDialog } from '@/components/medicines/ImportMedicinesDialog';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/components/ui/toast-provider';
import { tauri } from '@/lib/tauri';
import { dispatchEvent, useAutoRefresh } from '@/lib/eventBus';
import { playSuccess, playDelete } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';
import type { MedicineListItem, MedicinePharmacistDto } from '@/types/medicine';
import { MEDICINE_CATEGORIES } from '@/types/medicine';

interface MedicinesPageProps {
  session: SessionDto;
}

export function MedicinesPage({ session }: MedicinesPageProps) {
  const isOwner = session.role === 'owner';
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [medicines, setMedicines] = useState<(MedicineListItem | MedicinePharmacistDto)[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState<number | undefined>(undefined);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [eventRefreshKey] = useAutoRefresh('medicines-changed');
  const refreshKey = internalRefreshKey + eventRefreshKey;
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<string>('All');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 50;
  const [importOpen, setImportOpen] = useState(false);

  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      if (categoryFilter !== 'All' && m.category !== categoryFilter) return false;
      if (stockFilter === 'Low Stock' && !(m.current_stock <= m.reorder_level && m.current_stock > 0)) return false;
      if (stockFilter === 'Out of Stock' && m.current_stock !== 0) return false;
      if (activeFilter === 'Active' && !m.is_active) return false;
      if (activeFilter === 'Deactivated' && m.is_active) return false;
      return true;
    });
  }, [medicines, categoryFilter, stockFilter, activeFilter]);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      if (debouncedSearch.trim()) {
        if (isOwner) {
          const result = await tauri.medicines.search(session.token, debouncedSearch, page, perPage);
          setMedicines(result.items);
          setTotalPages(result.total_pages);
        } else {
          const result = await tauri.medicines.searchPharmacist(session.token, debouncedSearch, page, perPage);
          setMedicines(result.items);
          setTotalPages(result.total_pages);
        }
      } else {
        if (isOwner) {
          const result = await tauri.medicines.list(session.token, page, perPage);
          setMedicines(result.items);
          setTotalPages(result.total_pages);
        } else {
          const result = await tauri.medicines.searchPharmacist(session.token, '', page, perPage);
          setMedicines(result.items);
          setTotalPages(result.total_pages);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to fetch medicines:', err);
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isOwner, session.token, page, perPage]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleEdit = useCallback((id: number) => {
    setEditingMedicineId(id);
    setFormOpen(true);
  }, []);

  const handleDeactivate = useCallback(
    async (id: number) => {
      try {
        await tauri.medicines.deactivate(session.token, id);
        playDelete();
        toast('success', 'Medicine deactivated');
        setInternalRefreshKey((prev) => prev + 1);
      } catch (err: unknown) {
        console.error('Failed to deactivate medicine:', err);
        toast('error', 'Failed to deactivate medicine');
      }
    },
    [session.token, toast]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await tauri.medicines.delete(session.token, id);
        playDelete();
        toast('success', 'Medicine deleted');
        setInternalRefreshKey((prev) => prev + 1);
      } catch (err: unknown) {
        console.error('Failed to delete medicine:', err);
        toast('error', 'Failed to delete medicine');
      }
    },
    [session.token, toast]
  );

  const handleAddClick = useCallback(() => {
    setEditingMedicineId(undefined);
    setFormOpen(true);
  }, []);

  const [formSaved, setFormSaved] = useState(false);

  const handleFormSave = useCallback(() => {
    setFormSaved(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    if (formSaved) {
      playSuccess();
      toast('success', editingMedicineId ? 'Medicine updated' : 'Medicine added');
      setFormSaved(false);
    }
    setEditingMedicineId(undefined);
    setInternalRefreshKey((prev) => prev + 1);
  }, [formSaved, editingMedicineId, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medicines</h1>
          <p className="text-sm text-muted-foreground">Manage medicine inventory and stock levels.</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Medicine
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, generic name, brand, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Category:</span>
          {(['All', ...MEDICINE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Stock:</span>
          {(['All', 'Low Stock', 'Out of Stock'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStockFilter(s)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                stockFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          {(['All', 'Active', 'Deactivated'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActiveFilter(a)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                activeFilter === a
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <MedicineList
          medicines={filteredMedicines}
          loading={loading}
          role={session.role}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
        />
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <MedicineForm
        open={formOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        sessionToken={session.token}
        medicineId={editingMedicineId}
        role={session.role}
      />

      <ImportMedicinesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { dispatchEvent('medicines-changed'); setInternalRefreshKey((prev) => prev + 1); }}
        sessionToken={session.token}
      />
    </div>
  );
}
