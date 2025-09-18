import { DailyNewsDashboard } from '@/components/daily-news-dashboard';

// Force dynamic rendering to ensure authentication is checked
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Dashboard() {
  return <DailyNewsDashboard />;
}
