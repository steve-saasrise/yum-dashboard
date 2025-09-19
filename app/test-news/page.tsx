'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  ExternalLink,
  DollarSign,
  Mail,
  Newspaper,
} from 'lucide-react';
import { EmailAdvertisersManager } from '@/components/email-advertisers-manager';

interface NewsItem {
  text: string;
  summary?: string;
  sourceUrl?: string;
  source?: string;
  amount?: string;
  series?: string;
}

interface BigStory {
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
}

interface NewsData {
  items: NewsItem[];
  bigStory?: BigStory;
  specialSection?: NewsItem[];
  specialSectionTitle?: string;
  topic: string;
  generatedAt: string;
}

export default function TestNewsPage() {
  const router = useRouter();
  const { state } = useAuth();
  const { user, loading: authLoading } = state;
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [saasNewsData, setSaasNewsData] = useState<any>(null);
  const [digestData, setDigestData] = useState<any>(null);

  useEffect(() => {
    async function checkAdminAccess() {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (user.user_metadata?.role === 'admin') {
        setIsAdmin(true);
        setCheckingAuth(false);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userData?.role === 'admin') {
        setIsAdmin(true);
        setCheckingAuth(false);

        try {
          await supabase.auth.updateUser({
            data: { role: userData.role },
          });
        } catch {
          // Ignore metadata update errors
        }
      } else {
        toast({
          title: 'Access Denied',
          description: 'Admin privileges required to access this page',
          variant: 'destructive',
        });
        router.push('/dashboard');
      }
    }

    if (!authLoading) {
      checkAdminAccess();
    }
  }, [user, authLoading, router]);

  if (authLoading || checkingAuth) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const generateNews = async () => {
    setLoading('gpt5-news');
    setError(null);

    try {
      const response = await fetch('/api/test-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loungeType: 'saas',
          maxBullets: 5,
          maxSpecialSection: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate news: ${response.statusText}`);
      }

      const data = await response.json();
      setNewsData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const triggerSaasNewsGeneration = async () => {
    setLoading('saas-news');
    setError(null);
    try {
      // Use the synchronous endpoint for local testing
      const response = await fetch('/api/test-news/generate-saas-news-sync', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Failed to generate SaaS news');
      setSaasNewsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  };

  const previewEmailDigest = async () => {
    setLoading('digest-preview');
    setError(null);
    try {
      const response = await fetch('/api/test-news/preview-digest', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Failed to generate digest preview');
      setDigestData(data.digestData);
      setEmailPreview(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  };

  const sendTestEmail = async () => {
    setLoading('send-test');
    setError(null);
    try {
      const response = await fetch('/api/test-news/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'steve@saasrise.com',
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Failed to send test email');
      alert('Test email sent successfully to steve@saasrise.com!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Email & News Test Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Test SaaS news generation and preview daily digest emails
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <EmailAdvertisersManager />

      <div className="grid gap-6 md:grid-cols-2 mb-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              SaaS News Generation
            </CardTitle>
            <CardDescription>
              Triggers the same process as /api/cron/generate-saas-news
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={triggerSaasNewsGeneration}
              disabled={loading === 'saas-news'}
              className="w-full"
            >
              {loading === 'saas-news' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating SaaS News...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate SaaS News
                </>
              )}
            </Button>

            {saasNewsData && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Generation Result:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(saasNewsData, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Daily Digest Email
            </CardTitle>
            <CardDescription>
              Preview the email that would be sent by
              /api/cron/send-daily-digest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Button
                onClick={previewEmailDigest}
                disabled={loading === 'digest-preview'}
                className="w-full"
              >
                {loading === 'digest-preview' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  'Preview Email Digest'
                )}
              </Button>

              <Button
                onClick={sendTestEmail}
                disabled={loading === 'send-test' || !emailPreview}
                variant="outline"
                className="w-full"
              >
                {loading === 'send-test' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Test Email to steve@saasrise.com'
                )}
              </Button>
            </div>

            {digestData && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Digest Data:</h3>
                <pre className="text-xs overflow-auto max-h-48">
                  {JSON.stringify(digestData, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {emailPreview && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>
              This is how the email will look when rendered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="rendered" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rendered">Rendered View</TabsTrigger>
                <TabsTrigger value="html">HTML Source</TabsTrigger>
              </TabsList>
              <TabsContent value="rendered">
                <div className="border rounded-lg p-4 bg-white">
                  <iframe
                    srcDoc={emailPreview}
                    className="w-full h-[600px] border-0"
                    title="Email Preview"
                  />
                </div>
              </TabsContent>
              <TabsContent value="html">
                <div className="border rounded-lg p-4 bg-muted">
                  <pre className="text-xs overflow-auto max-h-[600px]">
                    <code>{emailPreview}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">GPT-5 News Test</CardTitle>
          <CardDescription>
            Test the GPT-5 powered news generation directly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={generateNews}
            disabled={loading === 'gpt5-news'}
            size="lg"
            className="mb-6"
          >
            {loading === 'gpt5-news' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating News...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate GPT-5 SaaS News
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {newsData && (
        <div className="space-y-6 mt-6">
          {/* Big Story */}
          {newsData.bigStory && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">🔥 Big Story</CardTitle>
                  <Badge variant="secondary">{newsData.bigStory.source}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-semibold mb-2">
                  {newsData.bigStory.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {newsData.bigStory.summary}
                </p>
                {newsData.bigStory.sourceUrl && (
                  <a
                    href={newsData.bigStory.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary hover:underline"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Read full article
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* News Bullets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">📰 News Bullets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {newsData.items.map((item, index) => (
                  <div key={index} className="pb-4 border-b last:border-0">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-primary mt-1">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="font-medium mb-1">{item.text}</p>
                        {item.summary && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {item.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          {item.source && (
                            <Badge variant="outline">{item.source}</Badge>
                          )}
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:underline"
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Article
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Funding Section */}
          {newsData.specialSection && newsData.specialSection.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  💰 {newsData.specialSectionTitle || 'Funding & M&A'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {newsData.specialSection.map((item, index) => (
                    <div key={index} className="pb-4 border-b last:border-0">
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-green-600 mt-1" />
                        <div className="flex-1">
                          <p className="font-medium mb-1">{item.text}</p>
                          {item.summary && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.summary}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {item.amount && (
                              <Badge variant="default" className="bg-green-600">
                                {item.amount}
                              </Badge>
                            )}
                            {item.series && (
                              <Badge variant="secondary">{item.series}</Badge>
                            )}
                            {item.source && (
                              <Badge variant="outline">{item.source}</Badge>
                            )}
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-primary hover:underline"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Details
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Topic:</span> {newsData.topic}
                </div>
                <div>
                  <span className="font-medium">Generated:</span>{' '}
                  {new Date(newsData.generatedAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Total Items:</span>{' '}
                  {newsData.items.length +
                    (newsData.specialSection?.length || 0)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
