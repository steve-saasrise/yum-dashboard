'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContentWithRelevancy {
  id: string;
  title: string;
  description: string | null;
  url: string;
  platform: string;
  published_at: string;
  relevancy_score: number | null;
  relevancy_reason: string | null;
  relevancy_checked_at: string | null;
  creators: {
    display_name: string;
  };
}

export function AdminRelevancyDashboard() {
  const [content, setContent] = useState<ContentWithRelevancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showLowRelevancy, setShowLowRelevancy] = useState(true);
  const { toast } = useToast();
  const supabase = createClient();

  const fetchContent = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Not authenticated',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `/api/admin/relevancy-check?lowRelevancy=${showLowRelevancy}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const runRelevancyCheck = async () => {
    setProcessing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'Not authenticated',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/relevancy-check', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 50 }),
      });

      if (!response.ok) {
        throw new Error('Failed to run relevancy check');
      }

      const data = await response.json();
      toast({
        title: 'Success',
        description: data.message,
      });

      // Refresh content list
      await fetchContent();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run relevancy check',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [showLowRelevancy]);

  const getRelevancyBadge = (score: number | null) => {
    if (score === null) {
      return <Badge variant="secondary">Not Checked</Badge>;
    }
    if (score >= 75) {
      return <Badge className="bg-green-500">High ({score})</Badge>;
    }
    if (score >= 50) {
      return <Badge className="bg-yellow-500">Medium ({score})</Badge>;
    }
    return <Badge className="bg-red-500">Low ({score})</Badge>;
  };

  const uncheckedCount = content.filter(
    (c) => c.relevancy_score === null
  ).length;
  const lowRelevancyCount = content.filter(
    (c) => c.relevancy_score !== null && c.relevancy_score < 70
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relevancy Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>{uncheckedCount} unchecked items</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>{lowRelevancyCount} low relevancy items</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLowRelevancy(!showLowRelevancy)}
              >
                {showLowRelevancy ? 'Show All' : 'Show Low Relevancy Only'}
              </Button>
              <Button onClick={runRelevancyCheck} disabled={processing}>
                {processing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Run Relevancy Check
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Recent Content</h3>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {content.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          by {item.creators.display_name} • {item.platform}
                        </p>
                      </div>
                      {getRelevancyBadge(item.relevancy_score)}
                    </div>
                    {item.relevancy_reason && (
                      <p className="text-xs text-muted-foreground italic">
                        {item.relevancy_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
