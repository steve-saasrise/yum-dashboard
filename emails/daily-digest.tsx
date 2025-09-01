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
      sourceUrl?: string;
      imageUrl?: string;
      source?: string;
    }>;
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

export const DailyDigestEmail = ({
  loungeName,
  loungeDescription,
  content,
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
                <table style={newsSummaryHeader}>
                  <tr>
                    <td style={{ paddingRight: '8px' }}>
                      <Text style={{ fontSize: '16px', margin: 0 }}>⭐</Text>
                    </td>
                    <td>
                      <Heading as="h3" style={bigStoryTitle}>
                        Big Story of the Day
                      </Heading>
                    </td>
                  </tr>
                </table>
                {aiNewsSummary.bigStory.imageUrl && (
                  <Img
                    src={aiNewsSummary.bigStory.imageUrl}
                    width="560"
                    height="280"
                    alt={aiNewsSummary.bigStory.title}
                    style={bigStoryImage}
                  />
                )}
                <Heading as="h3" style={bigStoryHeadline}>
                  {aiNewsSummary.bigStory.title}
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
                <table style={newsSummaryHeader}>
                  <tr>
                    <td style={{ paddingRight: '8px' }}>
                      <Text style={{ fontSize: '16px', margin: 0 }}>🚀</Text>
                    </td>
                    <td>
                      <Heading as="h3" style={newsSummaryTitle}>
                        Today's SaaS Headlines
                      </Heading>
                    </td>
                  </tr>
                </table>
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
                        <Text style={newsItemNumber}>{index + 1}.</Text>
                        <Text style={newsItemText}>
                          {bullet.sourceUrl ? (
                            <Link href={bullet.sourceUrl} style={newsItemLink}>
                              {bullet.text}
                            </Link>
                          ) : (
                            bullet.text
                          )}
                        </Text>
                        <Text style={newsItemDescription}>
                          {bullet.source && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#9ca3af',
                                fontStyle: 'italic',
                              }}
                            >
                              {bullet.source}
                            </span>
                          )}
                        </Text>
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

          {/* Content Items */}
          <Section style={contentSection}>
            {content.map((item, index) => (
              <div key={item.id}>
                <div style={contentItem}>
                  {/* Platform and Creator */}
                  <table style={platformBadge}>
                    <tr>
                      <td style={platformIconCell}>
                        <Img
                          src={
                            platformIcons[item.platform]?.src ||
                            platformIcons.website.src
                          }
                          alt={
                            platformIcons[item.platform]?.alt ||
                            platformIcons.website.alt
                          }
                          width="16"
                          height="16"
                          style={platformIconImg}
                        />
                      </td>
                      <td>
                        <Text style={creatorName}>{item.creator_name}</Text>
                      </td>
                    </tr>
                  </table>

                  {/* Title */}
                  <Heading as="h3" style={contentTitle}>
                    {item.title}
                  </Heading>

                  {/* Thumbnail if exists */}
                  {item.thumbnail_url && (
                    <Img
                      src={item.thumbnail_url}
                      width="120"
                      height="90"
                      alt={item.title}
                      style={thumbnail}
                    />
                  )}

                  {/* Description */}
                  <Text style={contentDescription}>
                    {(() => {
                      // If description exists and is 30 words or less, show full text
                      const description = item.description || '';
                      const wordCount = description.trim().split(/\s+/).length;

                      if (wordCount > 0 && wordCount <= 30) {
                        return description;
                      }

                      // Otherwise use AI summary if available, or truncated description
                      return (
                        item.ai_summary_short ||
                        description.substring(0, 150) ||
                        ''
                      );
                    })()}
                  </Text>

                  {/* Referenced Content (for quotes/retweets) */}
                  {item.reference_type && item.referenced_content && (
                    <div style={referencedContentContainer}>
                      <Text style={referenceLabel}>
                        {item.reference_type === 'quote'
                          ? '💬 Quoted'
                          : item.reference_type === 'retweet'
                            ? '🔁 Reposted'
                            : '↪ Replied to'}
                      </Text>
                      <div style={referencedContentBox}>
                        {item.referenced_content.author && (
                          <div style={referencedAuthorContainer}>
                            <Text style={referencedAuthor}>
                              {item.referenced_content.author.name ||
                                item.referenced_content.author.username ||
                                'Unknown'}
                            </Text>
                            {item.referenced_content.author.username && (
                              <Text style={referencedUsername}>
                                @{item.referenced_content.author.username}
                              </Text>
                            )}
                            {item.referenced_content.author.is_verified && (
                              <Text style={verifiedBadge}>✓</Text>
                            )}
                          </div>
                        )}
                        {item.referenced_content.text && (
                          <Text style={referencedText}>
                            {item.referenced_content.text}
                          </Text>
                        )}
                        {item.referenced_content.media_urls &&
                          item.referenced_content.media_urls.length > 0 && (
                            <div style={mediaContainer}>
                              {item.referenced_content.media_urls
                                .slice(0, 2)
                                .map(
                                  (media, idx) =>
                                    media.type === 'image' && (
                                      <Img
                                        key={idx}
                                        src={media.url}
                                        width="80"
                                        height="80"
                                        alt=""
                                        style={referencedImage}
                                      />
                                    )
                                )}
                            </div>
                          )}
                        {item.referenced_content.engagement_metrics && (
                          <Text style={engagementMetrics}>
                            {item.referenced_content.engagement_metrics.likes &&
                              `❤️ ${item.referenced_content.engagement_metrics.likes.toLocaleString()}`}
                            {item.referenced_content.engagement_metrics.views &&
                              ` · ${item.referenced_content.engagement_metrics.views.toLocaleString()} views`}
                          </Text>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Button */}
                  <Button
                    style={viewButton}
                    href={item.url}
                    className="button-hover"
                  >
                    View Original
                  </Button>
                </div>

                {index < content.length - 1 && <Hr style={contentDivider} />}
              </div>
            ))}
          </Section>

          <Section style={{ padding: '0 10px' }}>
            <Hr style={divider} />
          </Section>

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
  loungeName: 'AI',
  loungeDescription: 'Artificial Intelligence and machine learning',
  date: new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  recipientEmail: 'user@example.com',
  unsubscribeUrl: 'https://lounge.ai/settings/account',
  aiNewsSummary: {
    bigStory: {
      title: 'Salesforce announces new AI-powered CRM features',
      summary:
        'Salesforce unveils Einstein GPT integration for advanced automation and customer relationship management. Why it matters: Salesforce is doubling down on AI to defend CRM dominance. Competitors like HubSpot and Zoho will need to move faster or risk losing enterprise clients.',
      source: 'TechCrunch',
      sourceUrl: 'https://example.com/salesforce-ai',
      imageUrl:
        'https://via.placeholder.com/560x280/e0e7ff/4338ca?text=Salesforce+AI',
    },
    bullets: [
      {
        text: 'Notion launches AI-powered workspace automation',
        sourceUrl: 'https://example.com/notion',
        source: 'The Verge',
        imageUrl:
          'https://via.placeholder.com/120x80/ddd6fe/5b21b6?text=Notion',
      },
      {
        text: 'Microsoft Teams Premium adds advanced meeting analytics',
        sourceUrl: 'https://example.com/teams',
        source: 'The Verge',
        imageUrl: 'https://via.placeholder.com/120x80/dbeafe/3730a3?text=Teams',
      },
      {
        text: 'Slack introduces workflow automation for enterprise customers',
        sourceUrl: 'https://example.com/slack',
        source: 'Forbes',
        imageUrl: 'https://via.placeholder.com/120x80/e0e7ff/4338ca?text=Slack',
      },
      {
        text: 'Zoom launches new developer platform for SaaS integrations',
        sourceUrl: 'https://example.com/zoom',
        source: 'VentureBeat',
        imageUrl: 'https://via.placeholder.com/120x80/ede9fe/6d28d9?text=Zoom',
      },
      {
        text: 'Stripe unveils embedded finance tools for SaaS platforms',
        sourceUrl: 'https://example.com/stripe',
        source: 'TechCrunch',
        imageUrl:
          'https://via.placeholder.com/120x80/f3e8ff/7c3aed?text=Stripe',
      },
    ],
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

const newsSummarySection = {
  padding: '20px 10px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  marginBottom: '20px',
};

const newsSummaryHeader = {
  width: '100%',
  marginBottom: '12px',
};

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
  padding: '20px 10px',
  backgroundColor: '#e0e7ff',
  borderRadius: '8px',
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
  marginTop: '16px',
  marginBottom: '16px',
  objectFit: 'cover' as const,
};

const bigStoryHeadline = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '12px 0',
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
  marginBottom: '20px',
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
  fontWeight: '500',
};

const newsItemDescription = {
  marginTop: '4px',
  marginBottom: '0',
};
