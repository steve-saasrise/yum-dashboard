import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface PasswordResetEmailProps {
  resetUrl: string;
}

export const PasswordResetEmail = ({ resetUrl }: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your Daily News password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>Daily News</Text>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          Someone recently requested a password change for your Daily News
          account. If this was you, you can set a new password here:
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={resetUrl}>
            Reset password
          </Button>
        </Section>
        <Text style={paragraph}>
          If you don&apos;t want to change your password or didn&apos;t request
          this, just ignore and delete this message.
        </Text>
        <Text style={paragraph}>
          To keep your account secure, please don&apos;t forward this email to
          anyone. See our Help Center for{' '}
          <Link style={link} href="https://dailynews.app/help">
            more security tips.
          </Link>
        </Text>
        <Text style={paragraph}>Happy reading!</Text>
        <Hr style={hr} />
        <Text style={footer}>
          Daily News - Your personalized content dashboard
        </Text>
      </Container>
    </Body>
  </Html>
);

PasswordResetEmail.PreviewProps = {
  resetUrl: 'https://dailynews.app/curator/reset-password?token=example-token',
} as PasswordResetEmailProps;

export default PasswordResetEmail;

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

const link = {
  color: '#000000',
  textDecoration: 'underline',
};
