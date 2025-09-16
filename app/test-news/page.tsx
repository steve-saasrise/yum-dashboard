'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, DollarSign } from 'lucide-react';

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
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateNews = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">GPT-5 News Digest Test</h1>
        <p className="text-muted-foreground mb-6">
          Test the GPT-5 powered SaaS news generation service
        </p>

        <Button
          onClick={generateNews}
          disabled={loading}
          size="lg"
          className="mb-6"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating News...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate SaaS News Digest
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {newsData && (
        <div className="space-y-6">
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
