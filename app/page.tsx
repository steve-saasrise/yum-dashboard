'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuthLoading } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, BookOpen, Brain, Coffee, Sparkles } from 'lucide-react';

export default function Home() {
  const user = useUser();
  const loading = useAuthLoading();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Welcome to <span className="text-primary">Lounge</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The Curated Internet for Smart Professionals
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/signup" className="gap-2">
                Join Lounge <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Brain className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Expert Curation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Hand-picked content by topic experts who filter out the noise
                and surface only what matters.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Sparkles className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">AI-Powered Summaries</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get the essence of long-form content in 4-minute reads, perfect
                for busy professionals.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Coffee className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Daily Digests</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Replace morning doomscrolling with brain food delivered via web,
                app, and email.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Topic Lounges</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                From SaaS to crypto, VC to biohacking — find your niche and dive
                deep.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-primary/5 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">
            Ready to make your mornings smarter?
          </h2>
          <p className="text-muted-foreground mb-6">
            Join smart professionals who've replaced doomscrolling with curated
            intelligence.
          </p>
          <Button size="lg" asChild>
            <Link href="/auth/signup" className="gap-2">
              Join Lounge <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
