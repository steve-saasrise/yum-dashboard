import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Link href="/auth/error">
            <Button variant="outline">← Back</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
              <p className="text-muted-foreground">
                We're here to help you get the most out of Daily News. Choose from
                the support options below:
              </p>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-2">Email Support</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Send us an email and we'll get back to you within 24 hours.
                  </p>
                  <Button variant="outline">
                    <a href="mailto:support@dailynews.com">Contact Support</a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-2">Common Issues</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Authentication problems</li>
                    <li>• Account access issues</li>
                    <li>• Content not loading</li>
                    <li>• GDPR and privacy concerns</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-2">Account Issues</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Having trouble with your account? Try these steps:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. Clear your browser cache and cookies</li>
                    <li>2. Try logging in from an incognito/private window</li>
                    <li>3. Check your email for any authentication links</li>
                    <li>4. Contact support if the issue persists</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}