import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface CuratorInviteEmailProps {
  inviteUrl: string;
  inviterName: string;
}

export const CuratorInviteEmail = ({
  inviteUrl,
  inviterName,
}: CuratorInviteEmailProps) => (
  <Html>
    <Head />
    <Preview>You've been invited to join Daily News as a curator</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>Daily News</Text>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          {inviterName} has invited you to join Daily News as a content curator.
          As a curator, you'll be able to:
        </Text>
        <Section style={listContainer}>
          <Text style={listItem}>• Create and manage content lounges</Text>
          <Text style={listItem}>• Curate and organize content for users</Text>
          <Text style={listItem}>• Shape the content discovery experience</Text>
          <Text style={listItem}>• Collaborate with other curators</Text>
        </Section>
        <Text style={paragraph}>
          Click the button below to accept your invitation and create your
          curator account:
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={inviteUrl}>
            Accept Invitation
          </Button>
        </Section>
        <Text style={paragraph}>
          This invitation will expire in 7 days. If you have any questions,
          please contact {inviterName} or our support team.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Daily News - Your personalized content dashboard
        </Text>
      </Container>
    </Body>
  </Html>
);

CuratorInviteEmail.PreviewProps = {
  inviteUrl: 'https://dailynews.app/curator/accept-invite?token=example-token',
  inviterName: 'Sarah Admin',
} as CuratorInviteEmailProps;

export default CuratorInviteEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
};

const title = {
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
};

const listContainer = {
  margin: '20px 0',
};

const listItem = {
  fontSize: '16px',
  lineHeight: '24px',
  marginLeft: '20px',
};

const btnContainer = {
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '3px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px',
  margin: '20px auto',
};

const hr = {
  borderColor: '#cccccc',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
};
