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
}

interface DailyDigestEmailProps {
  loungeName: string;
  loungeDescription: string;
  content: ContentItem[];
  recipientEmail: string;
  unsubscribeUrl: string;
  date: string;
}

// Platform icon images - using base64 encoded tiny PNGs for email compatibility
const platformIcons: Record<string, { src: string; alt: string }> = {
  youtube: {
    src: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/youtube.svg',
    alt: 'YouTube',
  },
  twitter: {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJjdXJyZW50Q29sb3IiPjxwYXRoIGQ9Ik0xOC45MDEgMS4xNTNoMy42OGwtOC4wNCA5LjE5TDI0IDIyLjg0NmgtNy40MDZsLTUuOC03LjU4NC02LjYzOCA3LjU4NEguNDc0bDguNi05LjgzTDAgMS4xNTRoNy41OTRsNS4yNDMgNi45MzJaTTE3LjYxIDIwLjY0NGgyLjAzOUw2LjQ4NiAzLjI0SDQuMjk4WiIvPjwvc3ZnPg==',
    alt: 'X',
  },
  x: {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJjdXJyZW50Q29sb3IiPjxwYXRoIGQ9Ik0xOC45MDEgMS4xNTNoMy42OGwtOC4wNCA5LjE5TDI0IDIyLjg0NmgtNy40MDZsLTUuOC03LjU4NC02LjYzOCA3LjU4NEguNDc0bDguNi05LjgzTDAgMS4xNTRoNy41OTRsNS4yNDMgNi45MzJaTTE3LjYxIDIwLjY0NGgyLjAzOUw2LjQ4NiAzLjI0SDQuMjk4WiIvPjwvc3ZnPg==',
    alt: 'X',
  },
  linkedin: {
    src: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg',
    alt: 'LinkedIn',
  },
  threads: {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9ImN1cnJlbnRDb2xvciI+PHBhdGggZD0iTTE0MS41MzcgODguOTg4M0MxNDAuNzEgODguNTkxOSAxMzkuODcgODguMjEwNCAxMzkuMDE5IDg3Ljg0NTFDMTM3LjUzNyA2MC41MzgyIDEyMi42MTYgNDQuOTA1IDk3LjU2MTkgNDQuNzQ1Qzk3LjQ0ODQgNDQuNzQ0MyA5Ny4zMzU1IDQ0Ljc0NDMgOTcuMjIyIDQ0Ljc0NDNDODIuMjM2NCA0NC43NDQzIDY5Ljc3MzEgNTEuMTQwOSA2Mi4xMDIgNjIuNzgwN0w3NS44ODEgNzIuMjMyOEM4MS42MTE2IDYzLjUzODMgOTAuNjA1MiA2MS42ODQ4IDk3LjIyODYgNjEuNjg0OEM5Ny4zMDUxIDYxLjY4NDggOTcuMzgxOSA2MS42ODQ4IDk3LjQ1NzYgNjEuNjg1NUMxMDUuNzA3IDYxLjczODEgMTExLjkzMiA2NC4xMzY2IDExNS45NjEgNjguODE0QzExOC44OTMgNzIuMjE5MyAxMjAuODU0IDc2LjkyNSAxMjEuODI1IDgyLjg2MzhDMTE0LjUxMSA4MS42MjA3IDEwNi42MDEgODEuMjM4NSA5OC4xNDUgODEuNzIzM0M3NC4zMjQ3IDgzLjA5NTQgNTkuMDExMSA5Ni45ODc5IDYwLjAzOTYgMTE2LjI5MkM2MC41NjE1IDEyNi4wODQgNjUuNDM5NyAxMzQuNTA4IDczLjc3NSAxNDAuMDExQzgwLjgyMjQgMTQ0LjY2MyA4OS44OTkgMTQ2LjkzOCA5OS4zMzIzIDE0Ni40MjNDMTExLjc5IDE0NS43NCAxMjEuNTYzIDE0MC45ODcgMTI4LjM4MSAxMzIuMjk2QzEzMy41NTkgMTI1LjY5NiAxMzYuODM0IDExNy4xNDMgMTM4LjI4IDEwNi4zNjZDMTQ0LjIxNyAxMDkuOTQ5IDE0OC42MTcgMTE0LjY2NCAxNTEuMDQ3IDEyMC4zMzJDMTU1LjE3OSAxMjkuOTY3IDE1NS40MiAxNDUuOCAxNDIuNTAxIDE1OC43MDhDMTMxLjE4MiAxNzAuMDE2IDExNy41NzYgMTc0LjkwOCA5Ny4wMTM1IDE3NS4wNTlDNzQuMjA0MiAxNzQuODkgNTYuOTUzOCAxNjcuNTc1IDQ1LjczODEgMTUzLjMxN0MzNS4yMzU1IDEzOS45NjYgMjkuODA3NyAxMjAuNjgyIDI5LjYwNTIgOTZDMjkuODA3NyA3MS4zMTc4IDM1LjIzNTUgNTIuMDMzNiA0NS43MzgxIDM4LjY4MjdDNTYuOTUzOCAyNC40MjQ5IDc0LjIwMzkgMTcuMTEgOTcuMDEzMiAxNi45NDA1QzExOS45ODggMTcuMTExMyAxMzcuNTM5IDI0LjQ2MTQgMTQ5LjE4NCAzOC43ODhDMTU0Ljg5NCA0NS44MTM2IDE1OS4xOTkgNTQuNjQ4OCAxNjIuMDM3IDY0Ljk1MDNMMTc4LjE4NCA2MC42NDIyQzE3NC43NDQgNDcuOTYyMiAxNjkuMzMxIDM3LjAzNTcgMTYxLjk2NSAyNy45NzRDMTQ3LjAzNiA5LjYwNjY4IDEyNS4yMDIgMC4xOTUxNDggOTcuMDY5NSAwSDk2Ljk1NjlDNjguODgxNiAwLjE5NDQ3IDQ3LjI5MjEgOS42NDE4IDMyLjc4ODMgMjguMDc5M0MxOS44ODE5IDQ0LjQ4NjQgMTMuMjI0NCA2Ny4zMTU3IDEzLjAwMDcgOTUuOTMyNUwxMyA5NkwxMy4wMDA3IDk2LjA2NzVDMTMuMjI0NCAxMjQuNjg0IDE5Ljg4MTkgMTQ3LjUxNCAzMi43ODgzIDE2My45MjFDNDcuMjkyMSAxODIuMzU4IDY4Ljg4MTYgMTkxLjgwNiA5Ni45NTY5IDE5Mkg5Ny4wNjk1QzEyMi4wMyAxOTEuODI3IDEzOS42MjQgMTg1LjI5MiAxNTQuMTE4IDE3MC44MTFDMTY5LjA4MSAxNTEuODY2IDE3Mi41MSAxMjguMTE5IDE2Ni4yNiAxMTMuNTQxQzE2MS43NzYgMTAzLjA4NyAxNTMuMjI3IDk0LjU5NjIgMTQxLjUzNyA4OC45ODgzWk05OC40NDA1IDEyOS41MDdDODguMDAwNSAxMzAuMDk1IDc3LjE1NDQgMTI1LjQwOSA3Ni42MTk2IDExNS4zNzJDNzYuMjIzMiAxMDcuOTMgODEuOTE1OCA5OS42MjYgOTkuMDgxMiA5OC42MzY4QzEwMS4wNDcgOTguNTIzNCAxMDIuOTc2IDk4LjQ2OCAxMDQuODcxIDk4LjQ2OEMxMTEuMTA2IDk4LjQ2OCAxMTYuOTM5IDk5LjA3MzcgMTIyLjI0MiAxMDAuMjMzQzEyMC4yNjQgMTI0LjkzNSAxMDguNjYyIDEyOC45NDYgOTguNDQwNSAxMjkuNTA3WiIvPjwvc3ZnPg==',
    alt: 'Threads',
  },
  rss: {
    src: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/rss.svg',
    alt: 'RSS',
  },
  website: {
    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIyIiB5MT0iMTIiIHgyPSIyMiIgeTI9IjEyIi8+PHBhdGggZD0iTTEyIDJhMTUuMyAxNS4zIDAgMCAxIDQgMTAgMTUuMyAxNS4zIDAgMCAxLTQgMTAgMTUuMyAxNS4zIDAgMCAxLTQtMTAgMTUuMyAxNS4zIDAgMCAxIDQtMTB6Ii8+PC9zdmc+',
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
