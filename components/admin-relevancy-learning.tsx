'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface PromptAdjustment {
  id: string;
  lounge_id: string;
  adjustment_type: 'keep' | 'filter' | 'borderline';
  adjustment_text: string;
  reason: string;
  suggested_at: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  active: boolean;
  corrections_addressed: number;
  effectiveness_score: number | null;
  lounges?: {
    name: string;
  };
}

interface AnalysisRun {
  id: string;
  run_date: string;
  corrections_analyzed: number;
  suggestions_generated: number;
  analysis_summary: any;
  completed_at: string;
}

export function AdminRelevancyLearning() {
  const [pendingSuggestions, setPendingSuggestions] = useState<
    PromptAdjustment[]
  >([]);
  const [activeSuggestions, setActiveSuggestions] = useState<
    PromptAdjustment[]
  >([]);
  const [recentRuns, setRecentRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading relevancy data via API...');

      // Fetch pending suggestions via API
      const pendingResponse = await fetch(
        '/api/admin/relevancy-suggestions?status=pending'
      );
      const pendingData = await pendingResponse.json();

      if (!pendingResponse.ok) {
        throw new Error(
          pendingData.error || 'Failed to fetch pending suggestions'
        );
      }

      // Fetch active suggestions via API
      const activeResponse = await fetch(
        '/api/admin/relevancy-suggestions?status=active'
      );
      const activeData = await activeResponse.json();

      if (!activeResponse.ok) {
        throw new Error(
          activeData.error || 'Failed to fetch active suggestions'
        );
      }

      // Fetch analysis runs via API
      const runsResponse = await fetch('/api/relevancy/analysis-runs');
      const runsData = await runsResponse.json();

      if (!runsResponse.ok) {
        throw new Error(runsData.error || 'Failed to fetch analysis runs');
      }

      console.log('Loaded data:', {
        pending: pendingData.suggestions,
        active: activeData.suggestions,
        runs: runsData.runs,
      });

      setPendingSuggestions(pendingData.suggestions || []);
      setActiveSuggestions(activeData.suggestions || []);
      setRecentRuns(runsData.runs || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load relevancy data'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestionId: string) => {
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/relevancy-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
          suggestion_id: suggestionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve suggestion');
      }

      toast.success('Suggestion approved and activated');
      await loadData();
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to approve suggestion'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/relevancy-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          suggestion_id: suggestionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject suggestion');
      }

      toast.success('Suggestion rejected');
      await loadData();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to reject suggestion'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDeactivate = async (suggestionId: string) => {
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/relevancy-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deactivate',
          suggestion_id: suggestionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate adjustment');
      }

      toast.success('Adjustment deactivated');
      await loadData();
    } catch (error) {
      console.error('Error deactivating adjustment:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to deactivate adjustment'
      );
    } finally {
      setProcessing(false);
    }
  };

  const triggerAnalysis = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/cron/analyze-relevancy', {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'development'}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        toast.success(
          `Analysis complete: ${data.suggestions_generated} new suggestions`
        );
        await loadData();
      } else {
        toast.error('Analysis failed');
      }
    } catch (error) {
      console.error('Error triggering analysis:', error);
      toast.error('Failed to trigger analysis');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'keep':
        return 'bg-green-100 text-green-800';
      case 'filter':
        return 'bg-red-100 text-red-800';
      case 'borderline':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relevancy Learning System</h2>
          <p className="text-muted-foreground">
            Review and approve AI-suggested improvements to content filtering
          </p>
        </div>
        <Button onClick={triggerAnalysis} disabled={processing}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Run Analysis Now
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Suggestions ({pendingSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active Adjustments ({activeSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="history">Analysis History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingSuggestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No pending suggestions</p>
                <p className="text-sm text-muted-foreground">
                  Suggestions will appear here after the weekly analysis runs
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingSuggestions.map((suggestion) => (
              <Card key={suggestion.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {suggestion.lounges?.name} Lounge
                      </CardTitle>
                      <Badge
                        className={getTypeColor(suggestion.adjustment_type)}
                      >
                        {suggestion.adjustment_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(suggestion.id)}
                        disabled={processing}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(suggestion.id)}
                        disabled={processing}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-medium">Adjustment:</p>
                    <p className="text-sm bg-muted p-2 rounded">
                      {suggestion.adjustment_text}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Reasoning:</p>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Addresses {suggestion.corrections_addressed} corrections
                    </span>
                    <span>
                      Suggested{' '}
                      {new Date(suggestion.suggested_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeSuggestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No active adjustments</p>
              </CardContent>
            </Card>
          ) : (
            activeSuggestions.map((adjustment) => (
              <Card key={adjustment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {adjustment.lounges?.name} Lounge
                      </CardTitle>
                      <Badge
                        className={getTypeColor(adjustment.adjustment_type)}
                      >
                        {adjustment.adjustment_type}
                      </Badge>
                      <Badge variant="outline" className="bg-green-50">
                        Active
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeactivate(adjustment.id)}
                      disabled={processing}
                    >
                      Deactivate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm bg-muted p-2 rounded">
                    {adjustment.adjustment_text}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Approved{' '}
                      {new Date(adjustment.approved_at!).toLocaleDateString()}
                    </span>
                    {adjustment.effectiveness_score && (
                      <span>
                        Effectiveness: {adjustment.effectiveness_score}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {recentRuns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No analysis runs yet</p>
              </CardContent>
            </Card>
          ) : (
            recentRuns.map((run) => (
              <Card key={run.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Analysis Run - {new Date(run.run_date).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Corrections Analyzed
                      </p>
                      <p className="text-2xl font-bold">
                        {run.corrections_analyzed}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Suggestions Generated
                      </p>
                      <p className="text-2xl font-bold">
                        {run.suggestions_generated}
                      </p>
                    </div>
                  </div>
                  {run.analysis_summary && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">
                        Summary by Lounge:
                      </p>
                      <div className="space-y-1">
                        {Object.entries(run.analysis_summary).map(
                          ([lounge, summary]: [string, any]) => (
                            <div
                              key={lounge}
                              className="text-sm bg-muted p-2 rounded"
                            >
                              <span className="font-medium">{lounge}:</span>{' '}
                              {summary.corrections_count} corrections analyzed,{' '}
                              {summary.suggestions_count} suggestions
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
