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
import { Loader2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import type { SupplierDto, CreateSupplierDto, UpdateSupplierDto } from '@/types/supplier';

interface SupplierFormProps {
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  supplierId?: number;
}

interface FormState {
  company_name: string;
  contact_person: string;
  phone: string;
  address: string;
  payment_terms: string;
  notes: string;
}

interface FormErrors {
  company_name?: string;
}

const emptyForm: FormState = {
  company_name: '',
  contact_person: '',
  phone: '',
  address: '',
  payment_terms: '',
  notes: '',
};

export function SupplierForm({
  open,
  onClose,
  sessionToken,
  supplierId,
}: SupplierFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const isEdit = supplierId !== undefined;

  useEffect(() => {
    if (open && isEdit && supplierId) {
      setLoadingData(true);
      // We don't have a get_supplier endpoint, so we'll search all and find by ID
      tauri.suppliers.list(sessionToken)
        .then((suppliers: SupplierDto[]) => {
          const supplier = suppliers.find((s) => s.id === supplierId);
          if (supplier) {
            setForm({
              company_name: supplier.company_name,
              contact_person: supplier.contact_person || '',
              phone: supplier.phone || '',
              address: supplier.address || '',
              payment_terms: supplier.payment_terms || '',
              notes: supplier.notes || '',
            });
          }
        })
        .catch((err: Error) => {
          setSubmitError(err.message || 'Failed to load supplier data');
        })
        .finally(() => setLoadingData(false));
    }
  }, [open, isEdit, supplierId, sessionToken]);

  useEffect(() => {
    if (open && !isEdit) {
      setForm(emptyForm);
      setErrors({});
      setSubmitError(null);
    }
  }, [open, isEdit]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (!form.company_name.trim()) {
      errs.company_name = 'Company name is required';
    }
    return errs;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (isEdit && supplierId) {
        const payload: UpdateSupplierDto = {
          company_name: form.company_name.trim() || undefined,
          contact_person: form.contact_person.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          payment_terms: form.payment_terms.trim() || null,
          notes: form.notes.trim() || null,
        };
        await tauri.suppliers.update(sessionToken, supplierId, payload);
      } else {
        const payload: CreateSupplierDto = {
          company_name: form.company_name.trim(),
          contact_person: form.contact_person.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          payment_terms: form.payment_terms.trim() || null,
          notes: form.notes.trim() || null,
        };
        await tauri.suppliers.create(sessionToken, payload);
      }
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save supplier'
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, isEdit, supplierId, sessionToken, onClose, validate]);

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
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            {/* Company Name */}
            <div className="grid gap-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                placeholder="PharmaDistributor Ltd"
                value={form.company_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, company_name: e.target.value }))
                }
              />
              {errors.company_name && (
                <p className="text-xs text-destructive">{errors.company_name}</p>
              )}
            </div>

            {/* Contact Person */}
            <div className="grid gap-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                placeholder="John Doe"
                value={form.contact_person}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contact_person: e.target.value }))
                }
              />
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+92 300 1234567"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Shop #5, Main Market..."
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, address: e.target.value }))
                }
              />
            </div>

            {/* Payment Terms */}
            <div className="grid gap-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                placeholder="Net 30"
                value={form.payment_terms}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, payment_terms: e.target.value }))
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
          <Button onClick={handleSubmit} disabled={submitting || loadingData}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting
              ? 'Saving...'
              : isEdit
                ? 'Update Supplier'
                : 'Create Supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
