import { CreatorListView } from '@/components/creators/creator-list-view';

export default function CreatorsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Creator Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your followed creators across all platforms
          </p>
        </div>
        <CreatorListView />
      </div>
    </div>
  );
}
