'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useProfile } from '@/hooks/use-auth';

export function ProfileDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const user = useUser();
  const profile = useProfile();

  const handleExportData = async () => {
    if (!user || !profile) return;

    setIsExporting(true);
    try {
      // Call the comprehensive GDPR data export API
      const response = await fetch('/api/gdpr/export', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Get the data as blob for download
      const blob = await response.blob();

      // Extract filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `user_data_export_${new Date().toISOString().split('T')[0]}.json`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Complete data export successful',
        description:
          'Your complete user data has been downloaded successfully. This includes your profile, saved content, topics, and all associated data.',
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Data export error:', error);
      }
      toast({
        title: 'Export failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to export your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={handleExportData}
      disabled={isExporting}
    >
      <Download className="h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export All My Data'}
    </Button>
  );
}
