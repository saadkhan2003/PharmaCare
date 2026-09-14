import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionDto } from '@/types/session';

export function useGlobalShortcuts(session: SessionDto | null) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        const openDialog = document.querySelector('[data-state="open"][role="dialog"]');
        if (openDialog) {
          (openDialog as HTMLElement).click();
        }
        return;
      }

      if (!e.ctrlKey) return;

      switch (e.key) {
        case '1':
          if (!isInput) { e.preventDefault(); navigate('/pos'); }
          break;
        case '2':
          if (!isInput) { e.preventDefault(); navigate('/dashboard'); }
          break;
        case '3':
          if (!isInput) { e.preventDefault(); navigate('/medicines'); }
          break;
        case 'r':
          if (!isInput) { e.preventDefault(); navigate('/reports'); }
          break;
        case 'l':
          if (!isInput) { e.preventDefault(); navigate('/settings'); }
          break;
        case '8':
          if (!isInput) { e.preventDefault(); navigate('/supplier-debts'); }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, navigate]);
}
