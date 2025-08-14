'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Smartphone,
  Monitor,
  Tablet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Globe,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface DeviceSession {
  id: string;
  user_id: string;
  session_id: string;
  device_name: string;
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  ip_address: string;
  location: {
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  device_fingerprint: string;
  is_trusted: boolean;
  is_current: boolean;
  last_active: string;
  first_seen: string;
  created_at: string;
}

interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  metadata: any;
  ip_address: string;
  user_agent: string;
  location: any;
  created_at: string;
}

export default function SecuritySettingsPage() {
  console.log('SecuritySettingsPage rendering');
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    console.log('SecuritySettingsPage mounted');
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    console.log('fetchSecurityData called');
    try {
      // Use API route to fetch data server-side
      const response = await fetch('/api/security/sessions');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Security data from API:', data);

      setDeviceSessions(data.sessions || []);
      setSecurityEvents(data.events || []);
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security information');
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      // Delete the device session
      const { error: deleteError } = await supabase
        .from('device_sessions')
        .delete()
        .eq('id', sessionId);

      if (deleteError) throw deleteError;

      // Log security event
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('security_events').insert({
          user_id: user.id,
          event_type: 'session_revoked',
          severity: 'info',
          description: 'Session revoked from security settings',
          metadata: { session_id: sessionId },
        });
      }

      // Update local state
      setDeviceSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default'; // Changed from 'warning' to 'default'
      default:
        return 'secondary';
    }
  };

  const getEventIcon = (eventType: string, severity: string) => {
    if (severity === 'critical')
      return <XCircle className="h-4 w-4 text-red-500" />;
    if (severity === 'warning')
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Security Settings</h1>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices">Active Sessions</TabsTrigger>
          <TabsTrigger value="events">Security Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage devices and browsers that are currently signed in to your
                account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deviceSessions.length === 0 ? (
                <Alert>
                  <AlertDescription>No active sessions found</AlertDescription>
                </Alert>
              ) : (
                deviceSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={session.is_current ? 'border-green-500' : ''}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getDeviceIcon(session.device_type)}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {session.device_name || `${session.os} Device`}
                              </p>
                              {session.is_current && (
                                <Badge variant="secondary" className="text-xs">
                                  Current Session
                                </Badge>
                              )}
                              {session.is_trusted && (
                                <Badge variant="secondary" className="text-xs">
                                  Trusted
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {session.browser} {session.browser_version} on{' '}
                                {session.os} {session.os_version}
                              </p>
                              {session.location?.city && (
                                <p className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {session.location.city},{' '}
                                  {session.location.country}
                                </p>
                              )}
                              <p className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last active{' '}
                                {formatDistanceToNow(
                                  new Date(session.last_active),
                                  { addSuffix: true }
                                )}
                              </p>
                              <p className="text-xs">
                                First seen:{' '}
                                {format(new Date(session.first_seen), 'PPp')}
                              </p>
                            </div>
                          </div>
                        </div>
                        {!session.is_current && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => revokeSession(session.id)}
                            disabled={revoking === session.id}
                          >
                            {revoking === session.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Revoke'
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Activity</CardTitle>
              <CardDescription>
                Recent security-related events on your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityEvents.length === 0 ? (
                <Alert>
                  <AlertDescription>No recent security events</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {securityEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50"
                    >
                      {getEventIcon(event.event_type, event.severity)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {event.description}
                          </p>
                          <Badge
                            variant={getSeverityColor(event.severity)}
                            className="text-xs"
                          >
                            {event.severity}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'PPp')}
                          {event.ip_address && ` • IP: ${event.ip_address}`}
                          {event.location?.city &&
                            ` • ${event.location.city}, ${event.location.country}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
