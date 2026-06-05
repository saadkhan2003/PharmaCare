import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { MedicineList } from '@/components/medicines/MedicineList';
import { MedicineForm } from '@/components/medicines/MedicineForm';
import { useDebounce } from '@/hooks/useDebounce';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { MedicineListItem, MedicinePharmacistDto } from '@/types/medicine';

interface MedicinesPageProps {
  session: SessionDto;
}

export function MedicinesPage({ session }: MedicinesPageProps) {
  const isOwner = session.role === 'owner';
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [medicines, setMedicines] = useState<(MedicineListItem | MedicinePharmacistDto)[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      if (debouncedSearch.trim()) {
        if (isOwner) {
          const result = await tauri.medicines.search(session.token, debouncedSearch);
          setMedicines(result);
        } else {
          const result = await tauri.medicines.searchPharmacist(session.token, debouncedSearch);
          setMedicines(result);
        }
      } else {
        if (isOwner) {
          const result = await tauri.medicines.list(session.token);
          setMedicines(result);
        } else {
          // Pharmacist doesn't have a list endpoint, use search with empty query
          const result = await tauri.medicines.searchPharmacist(session.token, '');
          setMedicines(result);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to fetch medicines:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isOwner, session.token]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines, refreshKey]);

  const handleEdit = useCallback((id: number) => {
    setEditingMedicineId(id);
    setFormOpen(true);
  }, []);

  const handleDeactivate = useCallback(
    async (id: number) => {
      try {
        await tauri.medicines.deactivate(session.token, id);
        setRefreshKey((prev) => prev + 1);
      } catch (err: unknown) {
        console.error('Failed to deactivate medicine:', err);
      }
    },
    [session.token]
  );

  const handleAddClick = useCallback(() => {
    setEditingMedicineId(undefined);
    setFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingMedicineId(undefined);
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Medicines</h1>
        {isOwner && (
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Medicine
          </Button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, generic name, brand, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <MedicineList
          medicines={medicines}
          loading={loading}
          role={session.role}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
        />
      </div>

      <MedicineForm
        open={formOpen}
        onClose={handleFormClose}
        sessionToken={session.token}
        medicineId={editingMedicineId}
        role={session.role}
      />
    </div>
  );
}
