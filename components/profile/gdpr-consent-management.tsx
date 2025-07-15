'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Clock, Check, X, AlertTriangle } from 'lucide-react';

interface ConsentStatus {
  user_id: string;
  current_consent: {
    gdpr_consent: boolean;
    gdpr_consent_date: string | null;
    consent_details: Record<string, unknown>;
  };
  consent_history: Array<{
    endpoint: string;
    last_request: string;
    request_count: number;
  }>;
  privacy_policy_version: string;
  last_updated: string | null;
}

interface ConsentPreferences {
  data_processing: boolean;
  marketing: boolean;
  analytics: boolean;
}

export function GdprConsentManagement() {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(
    null
  );
  const [consentPreferences, setConsentPreferences] =
    useState<ConsentPreferences>({
      data_processing: false,
      marketing: false,
      analytics: false,
    });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const loadConsentStatus = async () => {
    try {
      const response = await fetch('/api/gdpr/consent');

      if (!response.ok) {
        throw new Error('Failed to load consent status');
      }

      const data: ConsentStatus = await response.json();
      setConsentStatus(data);

      // Parse consent details to set individual preferences
      const details = data.current_consent.consent_details || {};
      setConsentPreferences({
        data_processing: data.current_consent.gdpr_consent || false,
        marketing:
          (details as { marketing_consent?: boolean }).marketing_consent ||
          false,
        analytics:
          (details as { analytics_consent?: boolean }).analytics_consent ||
          false,
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading consent status:', error);
      }
      toast({
        title: 'Loading failed',
        description: 'Failed to load consent preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load current consent status
  useEffect(() => {
    loadConsentStatus();
  }, []);

  const updateConsent = async (consentType: string, consentGiven: boolean) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consent_type: consentType,
          consent_given: consentGiven,
          consent_details: {
            consent_method: 'settings',
            privacy_policy_version:
              consentStatus?.privacy_policy_version || '1.0',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update consent');
      }

      const result = await response.json();

      toast({
        title: 'Consent updated',
        description: result.message,
      });

      // Reload consent status to get the latest data
      await loadConsentStatus();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating consent:', error);
      }
      toast({
        title: 'Update failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update consent preferences.',
        variant: 'destructive',
      });

      // Revert the UI change
      await loadConsentStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleConsentChange = async (
    consentType: keyof ConsentPreferences,
    checked: boolean
  ) => {
    // Update local state immediately for responsive UI
    setConsentPreferences((prev) => ({
      ...prev,
      [consentType]: checked,
    }));

    // Map frontend consent types to API consent types
    const apiConsentType =
      consentType === 'data_processing' ? 'data_processing' : consentType;
    await updateConsent(apiConsentType, checked);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Consent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Loading consent preferences...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy & Consent Management
        </CardTitle>
        <CardDescription>
          Manage your data processing consent preferences. These settings
          control how we process your personal data.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Status Overview */}
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Current Consent Status</h4>
            <Badge
              variant={
                consentStatus?.current_consent.gdpr_consent
                  ? 'default'
                  : 'secondary'
              }
            >
              {consentStatus?.current_consent.gdpr_consent ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Consented
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  No Consent
                </>
              )}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Last updated: {formatDate(consentStatus?.last_updated || null)}
            </div>
            <div>
              Privacy Policy Version:{' '}
              {consentStatus?.privacy_policy_version || '1.0'}
            </div>
          </div>
        </div>

        <Separator />

        {/* Consent Preferences */}
        <div className="space-y-4">
          <h4 className="font-medium">Consent Preferences</h4>

          {/* Data Processing Consent (Required) */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="data-processing">Data Processing</Label>
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Essential consent for processing your personal data to provide
                our services. This includes account management, content saving,
                and core functionality.
              </p>
            </div>
            <Switch
              id="data-processing"
              checked={consentPreferences.data_processing}
              onCheckedChange={(checked) =>
                handleConsentChange('data_processing', checked)
              }
              disabled={isSaving}
            />
          </div>

          {/* Marketing Consent (Optional) */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="marketing">Marketing Communications</Label>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Receive marketing emails, newsletters, and promotional content
                about new features and updates.
              </p>
            </div>
            <Switch
              id="marketing"
              checked={consentPreferences.marketing}
              onCheckedChange={(checked) =>
                handleConsentChange('marketing', checked)
              }
              disabled={isSaving}
            />
          </div>

          {/* Analytics Consent (Optional) */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="analytics">Analytics & Performance</Label>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Help us improve our service by allowing anonymous usage
                analytics and performance monitoring.
              </p>
            </div>
            <Switch
              id="analytics"
              checked={consentPreferences.analytics}
              onCheckedChange={(checked) =>
                handleConsentChange('analytics', checked)
              }
              disabled={isSaving}
            />
          </div>
        </div>

        <Separator />

        {/* Important Notice */}
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-medium text-orange-900">
                Important Information
              </h5>
              <p className="text-sm text-orange-800">
                Withdrawing consent for data processing will limit your access
                to our services. If you withdraw consent, we will only process
                your data where we have other legal grounds to do so.
              </p>
            </div>
          </div>
        </div>

        {/* Consent History */}
        {consentStatus?.consent_history &&
          consentStatus.consent_history.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Recent Consent Activity</h4>
                <div className="space-y-2">
                  {consentStatus.consent_history
                    .slice(0, 5)
                    .map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm border rounded p-2"
                      >
                        <span className="text-muted-foreground">
                          {activity.endpoint
                            .replace('/api/gdpr/consent/', '')
                            .replace('-', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(activity.last_request)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={loadConsentStatus}
            disabled={isLoading || isSaving}
          >
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
