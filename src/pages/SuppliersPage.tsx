import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/components/ui/toast-provider';
import { tauri } from '@/lib/tauri';
import { playSuccess } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';
import type { SupplierDto } from '@/types/supplier';

interface SuppliersPageProps {
  session: SessionDto;
}

export function SuppliersPage({ session }: SuppliersPageProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      if (debouncedSearch.trim()) {
        const result = await tauri.suppliers.search(session.token, debouncedSearch);
        setSuppliers(result);
      } else {
        const result = await tauri.suppliers.list(session.token);
        setSuppliers(result);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch suppliers:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, session.token]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers, refreshKey]);

  const handleEdit = useCallback((id: number) => {
    setEditingSupplierId(id);
    setFormOpen(true);
  }, []);

  const handleDeactivate = useCallback(
    async (id: number) => {
      try {
        await tauri.suppliers.deactivate(session.token, id);
        setRefreshKey((prev) => prev + 1);
      } catch (err: unknown) {
        console.error('Failed to deactivate supplier:', err);
      }
    },
    [session.token]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await tauri.suppliers.delete(session.token, id);
      toast('success', 'Supplier deleted');
      setRefreshKey((prev) => prev + 1);
    },
    [session.token, toast]
  );

  const handleAddClick = useCallback(() => {
    setEditingSupplierId(undefined);
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
      toast('success', editingSupplierId ? 'Supplier updated' : 'Supplier added');
      setFormSaved(false);
    }
    setEditingSupplierId(undefined);
    setRefreshKey((prev) => prev + 1);
  }, [formSaved, editingSupplierId, toast]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <SupplierList
          suppliers={suppliers}
          loading={loading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
        />
      </div>

      <SupplierForm
        open={formOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        sessionToken={session.token}
        supplierId={editingSupplierId}
      />
    </div>
  );
}
