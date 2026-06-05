import type { SessionDto } from '../types/session';

interface DashboardPageProps {
  session: SessionDto;
}

/**
 * Placeholder dashboard page — shows current user info.
 * Full dashboard implementation comes in Phase 3.
 */
export function DashboardPage({ session }: DashboardPageProps) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Coming in Phase 3</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Session</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900 font-medium">{session.full_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Username</dt>
            <dd className="text-gray-900 font-medium">{session.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Role</dt>
            <dd className="text-gray-900 font-medium capitalize">{session.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
