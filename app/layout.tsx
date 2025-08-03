import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/providers/query-provider';

export const metadata: Metadata = {
  title: 'Lounge',
  description: 'The Curated Internet for Smart Professionals',
  icons: {
    icon: '/lounge_favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
