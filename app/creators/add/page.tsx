'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

export default function AddCreatorPage() {
  const router = useRouter();

  // Redirect to dashboard since the form is now in the modal
  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Add New Creator
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}