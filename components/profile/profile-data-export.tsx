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
      // Create export data object
      const exportData = {
        user_info: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          username: profile.username,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          last_sign_in_at: profile.last_sign_in_at,
        },
        export_timestamp: new Date().toISOString(),
        export_type: 'user_profile_data',
      };

      // Convert to JSON
      const dataStr = JSON.stringify(exportData, null, 2);

      // Create and download file
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `profile_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Data exported',
        description: 'Your profile data has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export your data. Please try again.',
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
      {isExporting ? 'Exporting...' : 'Export My Data'}
    </Button>
  );
}
