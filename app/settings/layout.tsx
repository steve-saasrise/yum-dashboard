'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Bell,
  CreditCard,
  Settings,
  Key,
  Monitor,
} from 'lucide-react';

const settingsNav = [
  {
    title: 'Account',
    href: '/settings/account',
    icon: User,
    description: 'Manage your account details',
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: Shield,
    description: 'Active sessions and security events',
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Email and alert preferences',
  },
  {
    title: 'Billing',
    href: '/settings/billing',
    icon: CreditCard,
    description: 'Subscription and payment methods',
  },
  {
    title: 'Preferences',
    href: '/settings/preferences',
    icon: Settings,
    description: 'App preferences and display settings',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-muted/10">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <nav className="space-y-1">
            {settingsNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    'hover:bg-muted',
                    isActive && 'bg-muted font-medium'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm">{item.title}</p>
                    {isActive && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Quick Security Status */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium">Security Status</p>
            </div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
            <Link
              href="/settings/security"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              View active sessions →
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
