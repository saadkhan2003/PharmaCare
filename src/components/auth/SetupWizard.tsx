import { useState, type FormEvent } from 'react';

interface SetupWizardProps {
  onComplete: (session: import('../../lib/tauri').CreateOwnerDto) => void;
  error: string | null;
  loading: boolean;
}

/**
 * First-run setup wizard for creating the initial Owner account.
 *
 * Step 1: Welcome screen with app introduction
 * Step 2: Owner account creation form with validation:
 *   - full_name, username, password (min 6 chars), confirm password
 *   - Passwords must match
 *   - All fields required
 *
 * On success, the Tauri command auto-logs in and returns a session.
 */
export function SetupWizard({ onComplete, error, loading }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleWelcomeNext = () => {
    setStep(1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate fields
    if (!fullName.trim() || !username.trim() || !password) {
      setValidationError('All fields are required');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    onComplete({
      full_name: fullName.trim(),
      username: username.trim(),
      password,
      owner_email: ownerEmail.trim() || null,
    });
  };

  if (step === 0) {
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to PharmaCare</h1>
          <p className="text-gray-500 mt-2">
            Your pharmacy management system for processing medicine sales,
            tracking inventory, and managing stock — all without internet access.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-left text-sm text-blue-800">
          <p className="font-medium mb-1">Before you begin</p>
          <p>
            This setup wizard will guide you through creating the first Owner account.
            As the Owner, you will be able to add pharmacists and manage the system.
          </p>
        </div>

        <button
          onClick={handleWelcomeNext}
          className="py-2 px-6 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Get Started
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-gray-900">Create Owner Account</h2>
        <p className="text-sm text-gray-500 mt-1">
          This will be the primary administrator account
        </p>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Enter your full name"
          required
          disabled={loading}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="setupUsername" className="block text-sm font-medium text-gray-700 mb-1">
          Username
        </label>
        <input
          id="setupUsername"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Choose a username"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="setupPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="setupPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Minimum 6 characters"
          required
          minLength={6}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Re-enter your password"
          required
          minLength={6}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="ownerEmail" className="block text-sm font-medium text-gray-700 mb-1">
          Recovery Email <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="ownerEmail"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="owner@pharmacy.com"
          disabled={loading}
        />
        <p className="text-xs text-gray-400 mt-1">
          Used for password recovery. Requires internet to send reset code.
        </p>
      </div>

      {(validationError || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {validationError || error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating account...' : 'Create Owner Account'}
      </button>
    </form>
  );
}
