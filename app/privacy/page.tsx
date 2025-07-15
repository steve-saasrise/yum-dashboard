import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Link href="/auth/login">
            <Button variant="outline">← Back to Login</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you
              create an account, use our services, or contact us for support.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve
              our services, process transactions, and communicate with you.
            </p>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information in certain limited circumstances
              as described in this policy.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal
              information against unauthorized access, alteration, disclosure, or
              destruction.
            </p>

            <h2>5. GDPR Compliance</h2>
            <p>
              If you are a resident of the European Economic Area (EEA), you have
              certain data protection rights. We provide tools to help you exercise
              these rights, including data export and account deletion.
            </p>

            <h2>6. Cookies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience,
              analyze usage patterns, and provide personalized content.
            </p>

            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page.
            </p>

            <h2>8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact
              us at privacy@dailynews.com.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}