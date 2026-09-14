import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';

interface ImportMedicinesDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  sessionToken: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ImportMedicinesDialog({
  open,
  onClose,
  onImported,
  sessionToken,
}: ImportMedicinesDialogProps) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const rows = lines.slice(0, 6).map((line) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') {
            inQuotes = !inQuotes;
          } else if (line[i] === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += line[i];
          }
        }
        result.push(current.trim());
        return result;
      });
      setPreview(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const res = await tauri.medicines.importCsv(sessionToken, csvText);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setResult({ imported: 0, skipped: 0, errors: [message] });
    } finally {
      setImporting(false);
    }
  }, [csvText, sessionToken, onImported]);

  const handleClose = useCallback(() => {
    setCsvText('');
    setPreview([]);
    setResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Medicines from CSV</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border border-dashed p-6 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Upload a CSV file with your medicine data
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose CSV File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            {fileName && (
              <p className="mt-2 text-xs text-muted-foreground">{fileName}</p>
            )}
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-foreground mb-1">Expected format:</p>
            <code className="text-xs text-muted-foreground block whitespace-pre-wrap">
              name,generic_name,brand_name,category,unit,purchase_price,retail_price,reorder_level,shelf_location,notes
            </code>
            <p className="text-xs text-muted-foreground mt-1">
              Categories: Tablet, Syrup, Injection, OTC, Prescription.
              Units: Strip, Bottle, Vial, Box, Sachet.
              Rows with invalid data will be skipped.
            </p>
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                Preview (first {preview.length} rows):
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {preview[0]?.map((_, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground">
                          {preview[0][i]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-b last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2 py-1 text-muted-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-md p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{result.imported} medicine(s) imported successfully</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span>{result.skipped} row(s) skipped</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded bg-destructive/10 p-2">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!csvText.trim() || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? 'Importing...' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
