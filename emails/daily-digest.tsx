import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  creator_name: string;
  platform: 'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss' | 'website';
  thumbnail_url?: string;
  published_at: string;
  ai_summary_short?: string;
  content_body?: string;
  engagement_metrics?: {
    likes?: number;
    views?: number;
    shares?: number;
    comments?: number;
  };
  reference_type?: 'quote' | 'retweet' | 'reply';
  referenced_content?: {
    id?: string;
    platform_content_id?: string;
    url?: string;
    text?: string;
    author?: {
      id?: string;
      username?: string;
      name?: string;
      avatar_url?: string;
      is_verified?: boolean;
    };
    created_at?: string;
    media_urls?: Array<{
      url: string;
      type: string;
      width?: number;
      height?: number;
    }>;
    engagement_metrics?: {
      likes?: number;
      views?: number;
      shares?: number;
      comments?: number;
    };
  };
}

interface DailyDigestEmailProps {
  loungeName: string;
  loungeDescription: string;
  content: ContentItem[];
  topSocialPosts?: ContentItem[];
  recipientEmail: string;
  unsubscribeUrl: string;
  date: string;
  aiNewsSummary?: {
    bigStory?: {
      title: string;
      summary: string;
      source?: string;
      sourceUrl?: string;
      imageUrl?: string;
    };
    bullets: Array<{
      text: string;
      summary?: string;
      sourceUrl?: string;
      imageUrl?: string;
      source?: string;
    }>;
    specialSection?: Array<{
      text: string;
      summary?: string;
      sourceUrl?: string;
      imageUrl?: string;
      source?: string;
      amount?: string;
      series?: string;
    }>;
    specialSectionTitle?: string;
    generatedAt: string;
  };
}

// Platform icon images - using hosted PNGs for email compatibility
const baseUrl = 'https://lounge.ai';
const platformIcons: Record<string, { src: string; alt: string }> = {
  youtube: {
    src: `${baseUrl}/icon-youtube.png`,
    alt: 'YouTube',
  },
  twitter: {
    src: `${baseUrl}/icon-x.png`,
    alt: 'X',
  },
  x: {
    src: `${baseUrl}/icon-x.png`,
    alt: 'X',
  },
  linkedin: {
    src: `${baseUrl}/icon-linkedin.png`,
    alt: 'LinkedIn',
  },
  threads: {
    src: `${baseUrl}/icon-threads.png`,
    alt: 'Threads',
  },
  rss: {
    src: `${baseUrl}/icon-rss.png`,
    alt: 'RSS',
  },
  website: {
    src: `${baseUrl}/icon-website.png`,
    alt: 'Website',
  },
};

// Helper function to truncate text to approximately 3 lines
const truncateToLines = (text: string, maxChars: number = 200): string => {
  if (!text) return '';
  if (text.length <= maxChars) return text;

  // Find a good break point (end of word)
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxChars * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
};

export const DailyDigestEmail = ({
  loungeName,
  loungeDescription,
  content,
  topSocialPosts,
  recipientEmail,
  unsubscribeUrl,
  date,
  aiNewsSummary,
}: DailyDigestEmailProps) => {
  const previewText = `Your ${loungeName} Daily Digest - ${content.length} updates`;

  return (
    <Html>
      <Head>
        <style>{`
          .button-hover:hover {
            background-color: #1A8BC4 !important;
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Link href="https://lounge.ai">
              <Img
                src="https://lounge.ai/official_lounge_logo.png"
                width="180"
                alt="Lounge"
                style={logo}
              />
            </Link>
            <Text style={dateText}>{date}</Text>
          </Section>

          {/* Lounge Title */}
          <Section style={loungeHeader}>
            <Heading style={loungeTitle}>{loungeName} Lounge</Heading>
            <Text style={loungeDesc}>{loungeDescription}</Text>
          </Section>

          <Section style={{ padding: '0 10px' }}>
            <Hr style={divider} />
          </Section>

          {/* Big Story of the Day */}
          {aiNewsSummary?.bigStory && (
            <>
              <Section style={bigStorySection}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Text style={{ fontSize: '16px', margin: '0 8px 0 0' }}>
                    ⭐
                  </Text>
                  <Heading as="h3" style={bigStoryTitle}>
                    Big Story of the Day
                  </Heading>
                </div>
                {aiNewsSummary.bigStory.imageUrl && (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '560px',
                      height: '315px',
                      margin: '16px 0',
                      overflow: 'hidden',
                      borderRadius: '8px',
                      position: 'relative' as const,
                    }}
                  >
                    <Img
                      src={aiNewsSummary.bigStory.imageUrl}
                      width="560"
                      height="560"
                      alt={aiNewsSummary.bigStory.title}
                      style={{
                        ...bigStoryImage,
                        width: '100%',
                        height: '560px',
                        objectFit: 'cover' as const,
                        objectPosition: 'center center' as const,
                        marginTop: '-122.5px', // Center vertically: -(560-315)/2
                      }}
                    />
                  </div>
                )}
                <Heading as="h3" style={bigStoryHeadline}>
                  {aiNewsSummary.bigStory.sourceUrl ? (
                    <Link
                      href={aiNewsSummary.bigStory.sourceUrl}
                      style={bigStoryHeadlineLink}
                    >
                      {aiNewsSummary.bigStory.title}
                    </Link>
                  ) : (
                    aiNewsSummary.bigStory.title
                  )}
                </Heading>
                <Text style={bigStorySummaryText}>
                  {aiNewsSummary.bigStory.summary}
                  {aiNewsSummary.bigStory.source && (
                    <>
                      {' '}
                      <span style={{ fontStyle: 'italic', color: '#6b7280' }}>
                        Source: {aiNewsSummary.bigStory.source}
                      </span>
                    </>
                  )}
                </Text>
                {aiNewsSummary.bigStory.sourceUrl && (
                  <Link
                    href={aiNewsSummary.bigStory.sourceUrl}
                    style={summaryLink}
                  >
                    Read more →
                  </Link>
                )}
              </Section>
              <Section style={{ padding: '0 10px' }}>
                <Hr style={divider} />
              </Section>
            </>
          )}

          {/* AI News Summary with Images */}
          {aiNewsSummary && aiNewsSummary.bullets.length > 0 && (
            <>
              <Section style={newsSummarySection}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Text style={{ fontSize: '16px', margin: '0 8px 0 0' }}>
                    🚀
                  </Text>
                  <Heading as="h3" style={newsSummaryTitle}>
                    Today's SaaS Headlines
                  </Heading>
                </div>
                <div style={{ marginTop: '16px' }}>
                  {aiNewsSummary.bullets.slice(0, 5).map((bullet, index) => (
                    <div key={index} style={newsItemContainer}>
                      {bullet.imageUrl && (
                        <div style={newsItemImageContainer}>
                          <Img
                            src={bullet.imageUrl}
                            width="120"
                            height="80"
                            alt=""
                            style={newsItemImage}
                          />
                        </div>
                      )}
                      <div style={newsItemContent}>
                        <div>
                          <Text style={newsItemText}>
                            <span style={newsItemNumber}>{index + 1}.</span>{' '}
                            {bullet.sourceUrl ? (
                              <Link
                                href={bullet.sourceUrl}
                                style={newsItemLink}
                              >
                                {bullet.text}
                              </Link>
                            ) : (
                              bullet.text
                            )}
                          </Text>
                          {bullet.summary && (
                            <Text
                              style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                margin: '0',
                                marginTop: '2px',
                                lineHeight: '1.4',
                                paddingLeft: '20px',
                              }}
                            >
                              {bullet.summary}
                            </Text>
                          )}
                          {bullet.source && (
                            <Text
                              style={{
                                fontSize: '12px',
                                color: '#9ca3af',
                                fontStyle: 'italic',
                                margin: '0',
                                marginTop: '2px',
                                paddingLeft: '20px',
                              }}
                            >
                              {bullet.source}
                            </Text>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section style={{ padding: '0 10px' }}>
                <Hr style={divider} />
              </Section>
            </>
          )}

          {/* Special Section (Fundraising or Growth Experiments) */}
          {aiNewsSummary?.specialSection &&
            aiNewsSummary.specialSection.length > 0 && (
              <>
                <Section style={newsSummarySection}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <Text style={{ fontSize: '16px', margin: '0 8px 0 0' }}>
                      {aiNewsSummary.specialSectionTitle?.includes('Growth')
                        ? '📊'
                        : '💰'}
                    </Text>
                    <Heading as="h3" style={newsSummaryTitle}>
                      {aiNewsSummary.specialSectionTitle ||
                        'Special Announcements'}
                    </Heading>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    {aiNewsSummary.specialSection
                      .slice(0, 5)
                      .map((item, index) => (
                        <div key={index} style={newsItemContainer}>
                          {item.imageUrl && (
                            <div style={newsItemImageContainer}>
                              <Img
                                src={item.imageUrl}
                                width="120"
                                height="80"
                                alt=""
                                style={newsItemImage}
                              />
                            </div>
                          )}
                          <div style={newsItemContent}>
                            <div>
                              <Text style={newsItemText}>
                                <span style={newsItemNumber}>{index + 1}.</span>{' '}
                                {item.sourceUrl ? (
                                  <Link
                                    href={item.sourceUrl}
                                    style={newsItemLink}
                                  >
                                    {item.text}
                                  </Link>
                                ) : (
                                  item.text
                                )}
                              </Text>
                              {item.summary && (
                                <Text
                                  style={{
                                    fontSize: '13px',
                                    color: '#6b7280',
                                    margin: '0',
                                    marginTop: '2px',
                                    lineHeight: '1.4',
                                    paddingLeft: '20px',
                                  }}
                                >
                                  {item.summary}
                                </Text>
                              )}
                              <Text
                                style={{
                                  margin: '0',
                                  marginTop: '4px',
                                  paddingLeft: '20px',
                                  fontSize: '12px',
                                }}
                              >
                                {item.amount && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      backgroundColor: '#d1fae5',
                                      color: '#065f46',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      marginRight: '8px',
                                    }}
                                  >
                                    {item.amount}
                                  </span>
                                )}
                                {item.series && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      backgroundColor: '#dbeafe',
                                      color: '#1e40af',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      marginRight: '8px',
                                    }}
                                  >
                                    {item.series}
                                  </span>
                                )}
                                {item.source && (
                                  <span
                                    style={{
                                      color: '#9ca3af',
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    • {item.source}
                                  </span>
                                )}
                              </Text>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </Section>
                <Section style={{ padding: '0 10px' }}>
                  <Hr style={divider} />
                </Section>
              </>
            )}

          {/* Top SaaS Social Posts */}
          {topSocialPosts && topSocialPosts.length > 0 && (
            <>
              <Section style={socialPostsSection}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Text style={{ fontSize: '16px', margin: '0 8px 0 0' }}>
                    💬
                  </Text>
                  <Heading as="h3" style={socialPostsTitle}>
                    Top SaaS Social Posts
                  </Heading>
                </div>
                <div style={{ marginTop: '16px' }}>
                  {topSocialPosts.slice(0, 5).map((post, index) => (
                    <div key={post.id} style={socialPostContainer}>
                      <div style={socialPostImageContainer}>
                        {post.thumbnail_url ? (
                          <Img
                            src={post.thumbnail_url}
                            width="120"
                            height="80"
                            alt=""
                            style={socialPostImage}
                          />
                        ) : (
                          <div style={socialPostPlaceholder}>
                            <Text style={socialPostPlaceholderText}>
                              {platformIcons[post.platform]?.alt || 'Post'}
                            </Text>
                          </div>
                        )}
                      </div>
                      <div style={socialPostContent}>
                        <div>
                          <Text style={{ margin: '0', marginBottom: '2px' }}>
                            <span style={socialPostNumber}>{index + 1}.</span>{' '}
                            <Link href={post.url} style={socialPostTitle}>
                              {post.title.length > 80
                                ? post.title.substring(0, 80) + '...'
                                : post.title}
                            </Link>
                          </Text>
                          <div style={{ paddingLeft: '20px' }}>
                            <Text
                              style={{
                                ...socialPostDescription,
                                margin: '0',
                                marginTop: '2px',
                              }}
                            >
                              {truncateToLines(
                                post.description || post.content_body || '',
                                200
                              )}
                            </Text>
                            <div
                              style={{
                                ...socialPostMeta,
                                marginTop: '4px',
                              }}
                            >
                              <table
                                style={{
                                  borderSpacing: 0,
                                  marginBottom: '4px',
                                }}
                              >
                                <tr>
                                  <td style={{ paddingRight: '6px' }}>
                                    <Img
                                      src={
                                        platformIcons[post.platform]?.src ||
                                        platformIcons.website.src
                                      }
                                      alt={
                                        platformIcons[post.platform]?.alt ||
                                        platformIcons.website.alt
                                      }
                                      width="14"
                                      height="14"
                                      style={platformIconImg}
                                    />
                                  </td>
                                  <td>
                                    <Text style={socialPostCreator}>
                                      by {post.creator_name}
                                    </Text>
                                  </td>
                                </tr>
                              </table>
                              {post.engagement_metrics && (
                                <Text style={socialPostEngagement}>
                                  {post.engagement_metrics.likes &&
                                    `❤️ ${post.engagement_metrics.likes.toLocaleString()}`}
                                  {post.engagement_metrics.views &&
                                    ` · ${post.engagement_metrics.views.toLocaleString()} views`}
                                  {post.engagement_metrics.comments &&
                                    ` · 💬 ${post.engagement_metrics.comments.toLocaleString()}`}
                                </Text>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section style={{ padding: '0 10px' }}>
                <Hr style={divider} />
              </Section>
            </>
          )}

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you're subscribed to the{' '}
              {loungeName} Daily Digest.
            </Text>
            <Text style={footerLinks}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
              {' • '}
              <Link
                href="https://lounge.ai/settings/account"
                style={footerLink}
              >
                Email Preferences
              </Link>
              {' • '}
              <Link href="https://lounge.ai/dashboard" style={footerLink}>
                Visit Dashboard
              </Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} Lounge. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

DailyDigestEmail.PreviewProps = {
  loungeName: 'SaaS',
  loungeDescription: 'Software as a Service industry news and insights',
  date: new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  recipientEmail: 'user@example.com',
  unsubscribeUrl: 'https://lounge.ai/settings/account',
  topSocialPosts: [
    {
      id: 'sp1',
      title: 'Why SaaS pricing is broken and how to fix it',
      description:
        "Most SaaS companies are pricing wrong and leaving millions on the table. Here's a comprehensive 10-point framework that increased our ARR by 300% in just 18 months...",
      url: 'https://example.com/post1',
      creator_name: 'Sarah Chen (@sarahchen)',
      platform: 'linkedin' as const,
      thumbnail_url:
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=120&h=120&fit=crop',
      published_at: new Date().toISOString(),
      ai_summary_short:
        'A data-driven pricing framework that helped increase ARR by 300%',
      engagement_metrics: {
        likes: 1247,
        views: 45000,
      },
    },
    {
      id: 'sp2',
      title: 'The Complete Guide to SaaS Metrics in 2025',
      description:
        "Everything you need to know about CAC, LTV, churn, and the advanced metrics that actually matter for scaling SaaS businesses profitably in today's competitive market",
      url: 'https://example.com/post2',
      creator_name: 'Ryan Allis (@ryanallis)',
      platform: 'twitter' as const,
      published_at: new Date().toISOString(),
      ai_summary_short:
        'Advanced SaaS metrics guide focusing on profitability over growth',
      engagement_metrics: {
        likes: 892,
        views: 23400,
        comments: 45,
      },
    },
    {
      id: 'sp3',
      title: 'Hot take: PLG is dead for B2B SaaS',
      url: 'https://example.com/post3',
      creator_name: 'Alex Rodriguez (@alexrod)',
      platform: 'threads' as const,
      published_at: new Date().toISOString(),
      description:
        "Product-led growth worked in 2020-2022, but the market has fundamentally shifted and buyers expect human interaction. Sales-led motion is making a strong comeback. Here's the data...",
      engagement_metrics: {
        likes: 2341,
        views: 67800,
      },
    },
    {
      id: 'sp4',
      title: 'Building a $10M ARR SaaS in stealth mode',
      url: 'https://youtube.com/watch?v=example',
      creator_name: 'Maria Santos (@mariasantos)',
      platform: 'youtube' as const,
      thumbnail_url:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=120&h=120&fit=crop',
      published_at: new Date().toISOString(),
      ai_summary_short:
        'How to build a profitable SaaS without any marketing or PR',
      engagement_metrics: {
        likes: 3456,
        views: 89000,
      },
    },
    {
      id: 'sp5',
      title: 'SaaS Trends Report Q3 2025',
      url: 'https://example.com/blog/trends',
      creator_name: 'Jason Fried (@jasonfried)',
      platform: 'rss' as const,
      published_at: new Date().toISOString(),
      description:
        'Latest trends reshaping SaaS: AI integration becoming table stakes, vertical solutions dominating horizontals, and the accelerating shift to consumption-based pricing models across all segments',
      engagement_metrics: {
        views: 12300,
      },
    },
  ],
  aiNewsSummary: {
    bigStory: {
      title: 'Salesforce announces new AI-powered CRM features',
      summary:
        'Salesforce unveils Einstein GPT integration for advanced automation and customer relationship management. Why it matters: Salesforce is doubling down on AI to defend CRM dominance. Competitors like HubSpot and Zoho will need to move faster or risk losing enterprise clients.',
      source: 'TechCrunch',
      sourceUrl: 'https://example.com/salesforce-ai',
      imageUrl:
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=560&h=560&fit=crop',
    },
    bullets: [
      {
        text: 'Notion launches AI workspace',
        summary:
          'AI-powered automation features help teams create docs and workflows 10x faster with natural language commands',
        sourceUrl: 'https://example.com/notion',
        source: 'The Verge',
        imageUrl:
          'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=120&h=120&fit=crop',
      },
      {
        text: 'Microsoft Teams adds analytics',
        summary:
          'Premium tier now includes meeting insights, attendance tracking, and engagement metrics for enterprise customers',
        sourceUrl: 'https://example.com/teams',
        source: 'The Verge',
        imageUrl:
          'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=120&h=120&fit=crop',
      },
      {
        text: 'Slack automates enterprise workflows',
        summary:
          'New no-code builder lets teams create custom automations across 2,400+ integrated apps without developers',
        sourceUrl: 'https://example.com/slack',
        source: 'Forbes',
        imageUrl:
          'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=120&h=120&fit=crop',
      },
      {
        text: 'Zoom launches developer platform',
        summary:
          'New APIs and SDKs enable deep SaaS integrations, custom video apps, and embedded collaboration features',
        sourceUrl: 'https://example.com/zoom',
        source: 'VentureBeat',
        imageUrl: 'https://via.placeholder.com/120x80/ede9fe/6d28d9?text=Zoom',
      },
      {
        text: 'Stripe unveils embedded finance',
        summary:
          'SaaS platforms can now offer banking, cards, and lending directly to customers through new Treasury APIs',
        sourceUrl: 'https://example.com/stripe',
        source: 'TechCrunch',
        imageUrl:
          'https://via.placeholder.com/120x80/f3e8ff/7c3aed?text=Stripe',
      },
    ],
    specialSection: [
      {
        text: 'Canva raises massive funding',
        summary:
          'Design platform secures funding from Franklin Templeton at $40B valuation to expand AI features globally',
        amount: '$1.5B',
        series: 'Late Stage',
        sourceUrl: 'https://example.com/canva-funding',
        source: 'TechCrunch',
        imageUrl: 'https://via.placeholder.com/120x80/fef3c7/f59e0b?text=Canva',
      },
      {
        text: 'Miro closes Series D',
        summary:
          'Collaboration platform raises capital led by ICONIQ Growth to accelerate enterprise sales and product development',
        amount: '$400M',
        series: 'Series D',
        sourceUrl: 'https://example.com/miro-funding',
        source: 'Forbes',
        imageUrl: 'https://via.placeholder.com/120x80/fed7aa/fb923c?text=Miro',
      },
      {
        text: 'Figma explores new funding',
        summary:
          'After $20B Adobe deal collapse, design tool considers new investment round at higher valuation',
        sourceUrl: 'https://example.com/figma-adobe',
        source: 'The Information',
        imageUrl: 'https://via.placeholder.com/120x80/fde68a/fbbf24?text=Figma',
      },
      {
        text: 'Airtable secures growth capital',
        summary:
          'No-code database platform raises funds at $11.7B valuation for international expansion and enterprise features',
        amount: '$735M',
        series: 'Series F',
        sourceUrl: 'https://example.com/airtable-funding',
        source: 'VentureBeat',
        imageUrl:
          'https://via.placeholder.com/120x80/fef3c7/fcd34d?text=Airtable',
      },
    ],
    specialSectionTitle: 'SaaS Fundraising Announcements',
    generatedAt: new Date().toISOString(),
  },
  content: [
    {
      id: '1',
      title: 'OpenAI Announces GPT-5 Release Date',
      description:
        'The next generation of language models is coming sooner than expected...',
      url: 'https://example.com/article1',
      creator_name: 'TechCrunch',
      platform: 'rss',
      published_at: new Date().toISOString(),
      ai_summary_short:
        'OpenAI reveals GPT-5 launch timeline with significant improvements in reasoning.',
    },
    {
      id: '2',
      title: 'Tweet by @nathanbenaich',
      description: '🙏',
      content_body: '🙏',
      url: 'https://x.com/nathanbenaich/status/example',
      creator_name: 'Nathan Benaich',
      platform: 'twitter',
      published_at: new Date().toISOString(),
      reference_type: 'quote',
      referenced_content: {
        id: '12345',
        text: "I'm running an AI usage survey for the State of AI Report. The results will be open sourced in October '25. It takes 10 mins and I want to hear from everyone, regardless of expertise. Head to stateofai.com/survey",
        author: {
          name: 'Nathan Benaich',
          username: 'nathanbenaich',
          is_verified: true,
        },
        created_at: new Date().toISOString(),
        engagement_metrics: {
          likes: 58,
          views: 37270,
        },
      },
    },
    {
      id: '3',
      title: 'Thread by @ryanallis',
      description: '',
      content_body: '',
      url: 'https://threads.net/@ryanallis/example',
      creator_name: 'Ryan Allis',
      platform: 'threads',
      published_at: new Date().toISOString(),
      reference_type: 'retweet',
      referenced_content: {
        id: '67890',
        text: 'GPT-5 is freaking awesome! The new capabilities include real-time video understanding, 10x faster inference, and native tool use.',
        author: {
          name: 'ChatGPTricks',
          username: 'chatgptricks',
          is_verified: true,
        },
        created_at: new Date().toISOString(),
        media_urls: [
          {
            url: 'https://pbs.twimg.com/media/GvfqVVkWgAAS4hD.jpg',
            type: 'image',
            width: 1200,
            height: 800,
          },
        ],
      },
    },
    {
      id: '4',
      title: 'How AI is Revolutionizing Healthcare',
      description:
        'A deep dive into machine learning applications in medical diagnosis...',
      url: 'https://youtube.com/watch?v=example',
      creator_name: 'Veritasium',
      platform: 'youtube',
      thumbnail_url: 'https://i.ytimg.com/vi/example/maxresdefault.jpg',
      published_at: new Date().toISOString(),
      ai_summary_short:
        'AI diagnostic tools now match doctor accuracy in detecting early-stage cancers.',
    },
  ],
} as DailyDigestEmailProps;

export default DailyDigestEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px',
  marginBottom: '64px',
  borderRadius: '5px',
  maxWidth: '600px',
};

const header = {
  padding: '20px 10px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
};

const dateText = {
  color: '#8898aa',
  fontSize: '14px',
  margin: '10px 0 0 0',
};

const loungeHeader = {
  padding: '0 10px 20px',
  textAlign: 'center' as const,
};

const loungeTitle = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
};

const loungeDesc = {
  color: '#666',
  fontSize: '14px',
  margin: '8px 0 0 0',
};

const divider = {
  borderColor: '#e6ebf1',
  margin: '15px 0',
};

const newsSummarySection = {};

const newsSummaryTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const summaryBulletList = {
  margin: '0',
  padding: '0 0 0 20px',
  color: '#4a5568',
};

const summaryBulletItem = {
  marginBottom: '8px',
  fontSize: '14px',
  lineHeight: '1.5',
};

const summaryBulletText = {
  margin: '0',
  color: '#4a5568',
};

const summaryLink = {
  color: '#2563eb',
  textDecoration: 'none',
  fontWeight: '500',
};

const contentSection = {
  padding: '0 10px',
};

const contentItem = {
  marginBottom: '0',
  padding: '10px 0',
};

const thumbnailColumn = {
  width: '120px',
  paddingRight: '20px',
  verticalAlign: 'top' as const,
};

const thumbnail = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
  marginBottom: '12px',
  display: 'block',
};

const contentColumn = {
  verticalAlign: 'top' as const,
};

const platformBadge = {
  marginBottom: '8px',
  borderSpacing: '0',
  padding: '0',
};

const platformIconCell = {
  padding: '0 8px 0 0',
  verticalAlign: 'middle' as const,
  width: 'auto',
};

const platformIconImg = {
  display: 'block',
  verticalAlign: 'middle' as const,
};

const creatorName = {
  color: '#8898aa',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0',
  display: 'inline',
  verticalAlign: 'middle' as const,
};

const contentTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '8px 0',
};

const contentDescription = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '8px 0 12px 0',
};

const viewButton = {
  backgroundColor: '#22ADEC',
  borderRadius: '3px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '8px 16px',
  display: 'inline-block',
  marginLeft: '0',
};

const contentDivider = {
  borderColor: '#f0f0f0',
  margin: '15px 0',
};

const footer = {
  padding: '20px 10px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  margin: '0 0 10px 0',
};

const footerLinks = {
  color: '#8898aa',
  fontSize: '12px',
  margin: '0 0 10px 0',
};

const footerLink = {
  color: '#556cd6',
  textDecoration: 'underline',
};

const copyright = {
  color: '#8898aa',
  fontSize: '11px',
  margin: '10px 0 0 0',
};

const referencedContentContainer = {
  margin: '12px 0',
};

const referenceLabel = {
  color: '#6b7280',
  fontSize: '11px',
  fontWeight: '500',
  marginBottom: '8px',
  display: 'block',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const referencedContentBox = {
  backgroundColor: '#fafafa',
  borderLeft: '3px solid rgba(34, 173, 236, 0.6)',
  borderRadius: '6px',
  padding: '12px',
};

const referencedAuthorContainer = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px',
};

const referencedAuthor = {
  color: '#1a1a1a',
  fontSize: '13px',
  fontWeight: '600',
  display: 'inline',
  margin: '0',
};

const referencedUsername = {
  color: '#6b7280',
  fontSize: '12px',
  display: 'inline',
  margin: '0',
};

const verifiedBadge = {
  color: '#22ADEC',
  fontSize: '12px',
  display: 'inline',
  margin: '0',
};

const referencedText = {
  color: '#4b5563',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
  display: 'block',
};

const mediaContainer = {
  display: 'flex',
  gap: '4px',
  marginTop: '8px',
};

const referencedImage = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
  display: 'block',
};

const engagementMetrics = {
  color: '#6b7280',
  fontSize: '11px',
  marginTop: '8px',
  marginBottom: '0',
  display: 'block',
};

// Big Story styles
const bigStorySection = {
  marginBottom: '20px',
};

const bigStoryTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const bigStoryImage = {
  width: '100%',
  height: 'auto',
  borderRadius: '6px',
  objectFit: 'cover' as const,
  display: 'block',
};

const bigStoryHeadline = {
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '12px 0',
};

const bigStoryHeadlineLink = {
  color: '#2563eb',
  textDecoration: 'none',
  fontSize: '20px',
  fontWeight: '600',
};

const bigStorySummaryText = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '12px 0',
};

// News item styles
const newsItemContainer = {
  display: 'flex',
  marginBottom: '12px',
  alignItems: 'flex-start',
};

const newsItemImageContainer = {
  flexShrink: 0,
  marginRight: '16px',
};

const newsItemImage = {
  borderRadius: '6px',
  objectFit: 'cover' as const,
  display: 'block',
};

const newsItemContent = {
  flex: 1,
};

const newsItemNumber = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '600',
  marginRight: '8px',
  display: 'inline',
};

const newsItemText = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
  display: 'inline',
};

const newsItemLink = {
  color: '#2563eb',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
};

const newsItemDescription = {
  marginTop: '4px',
  marginBottom: '0',
};

// Social Posts Section styles
const socialPostsSection = {};

const socialPostsTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const socialPostContainer = {
  display: 'flex',
  marginBottom: '24px',
  alignItems: 'flex-start',
};

const socialPostImageContainer = {
  flexShrink: 0,
  marginRight: '16px',
  width: '120px',
  height: '80px',
};

const socialPostImage = {
  borderRadius: '8px',
  objectFit: 'cover' as const,
  display: 'block',
  width: '120px',
  height: '80px',
};

const socialPostPlaceholder = {
  width: '120px',
  height: '80px',
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const socialPostPlaceholderText = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0',
};

const socialPostContent = {
  flex: 1,
};

const socialPostNumber = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '600',
  marginRight: '8px',
  display: 'inline',
};

const socialPostTitle = {
  color: '#2563eb',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  lineHeight: '1.4',
};

const socialPostDescription = {
  color: '#525f7f',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '6px 0 8px 0',
  display: 'block',
};

const socialPostMeta = {
  marginTop: '8px',
};

const socialPostCreator = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0',
  display: 'inline',
};

const socialPostEngagement = {
  color: '#6b7280',
  fontSize: '11px',
  margin: '4px 0 0 0',
  display: 'block',
};
