import { useState, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, CheckCircle2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';

interface ExportPdfButtonProps {
  document: ReactElement;
  fileName: string;
  sessionToken: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSaved?: (path: string) => void;
  onError?: (message: string) => void;
}

type Status = 'idle' | 'generating' | 'saving' | 'saved' | 'error';

export function ExportPdfButton({
  document,
  fileName,
  sessionToken,
  label = 'Export PDF',
  variant = 'outline',
  size = 'sm',
  className,
  onSaved,
  onError,
}: ExportPdfButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setStatus('generating');
    try {
      const blob = await pdf(document).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      setStatus('saving');
      const savedPath = await tauri.pdf.save(sessionToken, fileName, bytes);

      if (savedPath === null) {
        setStatus('idle');
        return;
      }

      setStatus('saved');
      onSaved?.(savedPath);
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF';
      setError(message);
      setStatus('error');
      onError?.(message);
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const icon =
    status === 'generating' || status === 'saving' ? (
      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
    ) : status === 'saved' ? (
      <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
    ) : (
      <FileDown className="h-4 w-4 mr-1" />
    );

  const text =
    status === 'generating'
      ? 'Generating...'
      : status === 'saving'
        ? 'Choose location...'
        : status === 'saved'
          ? 'Saved'
          : status === 'error'
            ? (error || 'Failed')
            : label;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={status === 'generating' || status === 'saving'}
      title={error ?? undefined}
    >
      {icon}
      {text}
    </Button>
  );
}
