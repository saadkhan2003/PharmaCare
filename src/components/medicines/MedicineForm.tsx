import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { MEDICINE_CATEGORIES, MEDICINE_UNITS } from '@/types/medicine';
import type { MedicineDto, CreateMedicineDto, UpdateMedicineDto } from '@/types/medicine';

interface MedicineFormProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  medicineId?: number;
  role: string;
}

interface FormState {
  name: string;
  generic_name: string;
  brand_name: string;
  category: string;
  unit: string;
  retail_price: string;
  purchase_price: string;
  reorder_level: string;
  shelf_location: string;
  notes: string;
  initial_stock: string;
  initial_expiry_date: string;
}

interface FormErrors {
  name?: string;
  category?: string;
  unit?: string;
  retail_price?: string;
  purchase_price?: string;
  generic?: string;
}

const emptyForm: FormState = {
  name: '',
  generic_name: '',
  brand_name: '',
  category: '',
  unit: '',
  retail_price: '',
  purchase_price: '',
  reorder_level: '10',
  shelf_location: '',
  notes: '',
  initial_stock: '',
  initial_expiry_date: '',
};

export function MedicineForm({
  open,
  onClose,
  sessionToken,
  medicineId,
  role,
}: MedicineFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const isEdit = medicineId !== undefined;
  const isOwner = role === 'owner';

  // Load existing data in edit mode
  useEffect(() => {
    if (open && isEdit && medicineId) {
      setLoadingData(true);
      tauri.medicines.get(sessionToken, medicineId)
        .then((medicine: MedicineDto) => {
          setForm({
            name: medicine.name,
            generic_name: medicine.generic_name || '',
            brand_name: medicine.brand_name || '',
            category: medicine.category,
            unit: medicine.unit,
            retail_price: medicine.retail_price.toString(),
            purchase_price: medicine.purchase_price.toString(),
            reorder_level: medicine.reorder_level.toString(),
            shelf_location: medicine.shelf_location || '',
            notes: medicine.notes || '',
            initial_stock: '',
            initial_expiry_date: '',
          });
        })
        .catch((err: Error) => {
          setSubmitError(err.message || 'Failed to load medicine data');
        })
        .finally(() => setLoadingData(false));
    }
  }, [open, isEdit, medicineId, sessionToken]);

  // Reset form when opening in create mode
  useEffect(() => {
    if (open && !isEdit) {
      setForm(emptyForm);
      setErrors({});
      setSubmitError(null);
    }
  }, [open, isEdit]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (!form.name.trim()) {
      errs.name = 'Name is required';
    }
    if (!form.category) {
      errs.category = 'Category is required';
    }
    if (!form.unit) {
      errs.unit = 'Unit is required';
    }
    const retail = parseFloat(form.retail_price);
    if (isNaN(retail) || retail < 0) {
      errs.retail_price = 'Valid retail price is required';
    }
    if (isOwner) {
      const purchase = parseFloat(form.purchase_price);
      if (isNaN(purchase) || purchase < 0) {
        errs.purchase_price = 'Valid purchase price is required';
      }
      if (!isNaN(retail) && !isNaN(purchase) && retail < purchase) {
        errs.retail_price = 'Retail price must be >= purchase price';
      }
    }
    return errs;
  }, [form, isOwner]);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (isEdit && medicineId) {
        const payload: UpdateMedicineDto = {
          name: form.name.trim() || undefined,
          generic_name: form.generic_name.trim() || null,
          brand_name: form.brand_name.trim() || null,
          category: form.category || undefined,
          unit: form.unit || undefined,
          retail_price: parseFloat(form.retail_price) || undefined,
          purchase_price: parseFloat(form.purchase_price) || undefined,
          reorder_level: parseInt(form.reorder_level) || null,
          shelf_location: form.shelf_location.trim() || null,
          notes: form.notes.trim() || null,
        };
        await tauri.medicines.update(sessionToken, medicineId, payload);
      } else {
        const initialStock = form.initial_stock ? parseInt(form.initial_stock) : null;
        const payload: CreateMedicineDto = {
          name: form.name.trim(),
          generic_name: form.generic_name.trim() || null,
          brand_name: form.brand_name.trim() || null,
          category: form.category,
          unit: form.unit,
          retail_price: parseFloat(form.retail_price),
          purchase_price: isOwner ? parseFloat(form.purchase_price) : 0,
          reorder_level: parseInt(form.reorder_level) || null,
          shelf_location: form.shelf_location.trim() || null,
          notes: form.notes.trim() || null,
          initial_stock: initialStock && initialStock > 0 ? initialStock : null,
          initial_expiry_date: form.initial_expiry_date.trim() || null,
        };
        await tauri.medicines.create(sessionToken, payload);
      }
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save medicine'
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, isEdit, medicineId, sessionToken, isOwner, onClose, validate]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setForm(emptyForm);
        setErrors({});
        setSubmitError(null);
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Paracetamol 500mg"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Generic Name */}
            <div className="grid gap-2">
              <Label htmlFor="generic_name">Generic Name</Label>
              <Input
                id="generic_name"
                placeholder="Paracetamol"
                value={form.generic_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, generic_name: e.target.value }))
                }
              />
            </div>

            {/* Brand Name */}
            <div className="grid gap-2">
              <Label htmlFor="brand_name">Brand Name</Label>
              <Input
                id="brand_name"
                placeholder="Panadol"
                value={form.brand_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brand_name: e.target.value }))
                }
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={form.category}
                onValueChange={(value: string | null) => {
                  if (value) setForm((prev) => ({ ...prev, category: value }));
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MEDICINE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category}</p>
              )}
            </div>

            {/* Unit */}
            <div className="grid gap-2">
              <Label htmlFor="unit">Unit *</Label>
              <Select
                value={form.unit}
                onValueChange={(value: string | null) => {
                  if (value) setForm((prev) => ({ ...prev, unit: value }));
                }}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {MEDICINE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit && (
                <p className="text-xs text-destructive">{errors.unit}</p>
              )}
            </div>

            {/* Retail Price */}
            <div className="grid gap-2">
              <Label htmlFor="retail_price">Retail Price *</Label>
              <Input
                id="retail_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="10.00"
                value={form.retail_price}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, retail_price: e.target.value }))
                }
              />
              {errors.retail_price && (
                <p className="text-xs text-destructive">{errors.retail_price}</p>
              )}
            </div>

            {/* Purchase Price (owner only) */}
            {isOwner && (
              <div className="grid gap-2">
                <Label htmlFor="purchase_price">Purchase Price *</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5.00"
                  value={form.purchase_price}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      purchase_price: e.target.value,
                    }))
                  }
                />
                {errors.purchase_price && (
                  <p className="text-xs text-destructive">{errors.purchase_price}</p>
                )}
              </div>
            )}

            {/* Initial Stock & Expiry (only for new medicines) */}
            {!isEdit && (
              <>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-foreground mb-3">Opening Stock</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="initial_stock">Quantity</Label>
                      <Input
                        id="initial_stock"
                        type="number"
                        min="0"
                        placeholder="100"
                        value={form.initial_stock}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, initial_stock: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="initial_expiry_date">Expiry Date</Label>
                      <Input
                        id="initial_expiry_date"
                        type="date"
                        value={form.initial_expiry_date}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, initial_expiry_date: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set initial stock to add this medicine to inventory immediately.
                    Stock is tracked in batches for expiry control.
                  </p>
                </div>
              </>
            )}

            {/* Reorder Level */}
            <div className="grid gap-2">
              <Label htmlFor="reorder_level">Reorder Level</Label>
              <Input
                id="reorder_level"
                type="number"
                min="0"
                placeholder="10"
                value={form.reorder_level}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    reorder_level: e.target.value,
                  }))
                }
              />
            </div>

            {/* Shelf Location */}
            <div className="grid gap-2">
              <Label htmlFor="shelf_location">Shelf Location</Label>
              <Input
                id="shelf_location"
                placeholder="A-12"
                value={form.shelf_location}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    shelf_location: e.target.value,
                  }))
                }
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
           <Button
            onClick={handleSubmit}
            disabled={submitting || loadingData}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting
              ? 'Saving...'
              : isEdit
                ? 'Update Medicine'
                : 'Create Medicine'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
