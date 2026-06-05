import { SetupWizard } from '../components/auth/SetupWizard';
import type { CreateOwnerDto } from '../lib/tauri';

interface SetupWizardPageProps {
  onComplete: (payload: CreateOwnerDto) => void;
  error: string | null;
  loading: boolean;
}

/**
 * Setup wizard page — renders the SetupWizard centered on screen.
 * On completion, calls onComplete which triggers create_initial_owner in useAuth.
 */
export function SetupWizardPage({ onComplete, error, loading }: SetupWizardPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <SetupWizard onComplete={onComplete} error={error} loading={loading} />
      </div>
    </div>
  );
}
