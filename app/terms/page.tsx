import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function TermsPage() {
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
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Daily News, you accept and agree to be
              bound by the terms and provision of this agreement.
            </p>

            <h2>2. Use License</h2>
            <p>
              Permission is granted to temporarily access Daily News for
              personal, non-commercial transitory viewing only. This is the
              grant of a license, not a transfer of title.
            </p>

            <h2>3. Disclaimer</h2>
            <p>
              The materials on Daily News are provided on an 'as is' basis.
              Daily News makes no warranties, expressed or implied, and hereby
              disclaims and negates all other warranties including without
              limitation, implied warranties or conditions of merchantability,
              fitness for a particular purpose, or non-infringement of
              intellectual property or other violation of rights.
            </p>

            <h2>4. Limitations</h2>
            <p>
              In no event shall Daily News or its suppliers be liable for any
              damages (including, without limitation, damages for loss of data
              or profit, or due to business interruption) arising out of the use
              or inability to use the materials on Daily News.
            </p>

            <h2>5. Privacy Policy</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy,
              which also governs your use of the Service, to understand our
              practices.
            </p>

            <h2>6. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please
              contact us at support@dailynews.com.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
