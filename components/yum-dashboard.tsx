'use client';

import * as React from 'react';
import { useAuth, useUser, useProfile } from '@/hooks/use-auth';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarSeparator,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithRange } from '@/components/date-picker-with-range';
import { Icons } from '@/components/icons';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Search,
  Settings,
  User,
  LogOut,
  PlusCircle,
  Bookmark,
  ExternalLink,
  ChevronDown,
  Trash2,
  Edit,
  Rss,
  LayoutGrid,
  List,
  Bell,
  Filter,
  MoreHorizontal,
  Upload,
  Youtube,
  Linkedin,
} from 'lucide-react';

// --- MOCK DATA ---

const platforms = [
  { name: 'YouTube', icon: Youtube, count: 12 },
  { name: 'X', icon: Icons.x, count: 8 },
  { name: 'LinkedIn', icon: Linkedin, count: 5 },
  { name: 'Threads', icon: Icons.threads, count: 3 },
  { name: 'Blogs', icon: Rss, count: 22 },
];

const topics = [
  {
    id: 1,
    name: 'Venture Capital',
    description: 'Funding, startups, and innovation.',
    color: 'bg-blue-100 text-blue-800',
    count: 5,
  },
  {
    id: 2,
    name: 'AI',
    description: 'Artificial intelligence and machine learning.',
    color: 'bg-purple-100 text-purple-800',
    count: 8,
  },
  {
    id: 3,
    name: 'SaaS',
    description: 'Software as a Service business models.',
    color: 'bg-green-100 text-green-800',
    count: 12,
  },
  {
    id: 4,
    name: 'Science',
    description: 'Scientific discoveries and research.',
    color: 'bg-indigo-100 text-indigo-800',
    count: 4,
  },
  {
    id: 5,
    name: 'Politics',
    description: 'Global and domestic political analysis.',
    color: 'bg-red-100 text-red-800',
    count: 2,
  },
  {
    id: 6,
    name: 'Investing',
    description: 'Financial markets and investment strategies.',
    color: 'bg-yellow-100 text-yellow-800',
    count: 3,
  },
  {
    id: 7,
    name: 'Future',
    description: 'Trends and predictions about the future.',
    color: 'bg-cyan-100 text-cyan-800',
    count: 7,
  },
  {
    id: 8,
    name: 'Philosophy',
    description: 'Exploring fundamental questions about existence.',
    color: 'bg-gray-100 text-gray-800',
    count: 6,
  },
  {
    id: 9,
    name: 'Spirituality',
    description: 'Matters of the spirit and belief systems.',
    color: 'bg-pink-100 text-pink-800',
    count: 3,
  },
  {
    id: 10,
    name: 'Relationships',
    description: 'Interpersonal dynamics and connections.',
    color: 'bg-rose-100 text-rose-800',
    count: 2,
  },
  {
    id: 11,
    name: 'Biohacking',
    description: 'Optimizing human biology and performance.',
    color: 'bg-lime-100 text-lime-800',
    count: 1,
  },
  {
    id: 12,
    name: 'B2B Growth',
    description: 'Business-to-business growth strategies and tactics.',
    color: 'bg-orange-100 text-orange-800',
    count: 4,
  },
];

const creators = [
  {
    id: 1,
    name: 'Marc Andreessen',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['X', 'LinkedIn'],
    topics: ['Venture Capital', 'AI', 'Future'],
    active: true,
  },
  {
    id: 2,
    name: 'Sam Altman',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['LinkedIn', 'X'],
    topics: ['AI', 'SaaS', 'Investing'],
    active: true,
  },
  {
    id: 3,
    name: 'Warren Buffett',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['Blogs'],
    topics: ['Investing'],
    active: false,
  },
  {
    id: 4,
    name: 'Dave Asprey',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['YouTube', 'X'],
    topics: ['Biohacking', 'Science'],
    active: true,
  },
  {
    id: 5,
    name: 'Barack Obama',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['Threads', 'X'],
    topics: ['Politics', 'Future'],
    active: false,
  },
  {
    id: 6,
    name: 'Naval Ravikant',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['X'],
    topics: ['Philosophy', 'Investing', 'Spirituality'],
    active: true,
  },
  {
    id: 7,
    name: 'Ryan Allis',
    avatar: '/placeholder.svg?height=40&width=40',
    platforms: ['LinkedIn', 'X'],
    topics: ['SaaS', 'Venture Capital', 'Future'],
    active: true,
  },
];

const contentFeed = [
  {
    id: 1,
    creatorId: 1,
    platform: 'X',
    title: 'The Future of Venture Capital and AI',
    summary:
      "An in-depth thread exploring how artificial intelligence will reshape the landscape of venture capital over the next decade. We're witnessing a fundamental shift in how VCs evaluate startups, with AI-powered due diligence tools becoming standard practice. The traditional metrics of TAM, growth rates, and team experience are being augmented by sophisticated algorithms that can predict market trends, analyze competitive landscapes, and even assess founder-market fit through behavioral analysis. This transformation isn't just about efficiency—it's about unlocking investment opportunities that human analysts might miss. From automated portfolio management to AI-driven market research, the entire VC ecosystem is evolving. However, this raises important questions about the role of human intuition in investment decisions and whether we're creating a more equitable or more algorithmic approach to funding innovation. The implications extend beyond just better returns; they touch on how we identify and nurture the next generation of breakthrough technologies.",
    timestamp: '2h ago',
    tags: ['Venture Capital', 'AI'],
    url: '#',
    bookmarked: false,
  },
  {
    id: 2,
    creatorId: 4,
    platform: 'YouTube',
    title: 'My Top 5 Biohacking Gadgets for 2025',
    summary:
      "In this comprehensive video review, I unbox and thoroughly test the most impactful biohacking devices that have transformed my daily optimization routine over the past year. Starting with continuous glucose monitors that provide real-time insights into metabolic health, we dive deep into how tracking glucose variability has revolutionized my understanding of food timing and exercise recovery. The second device is a cutting-edge HRV monitor that goes beyond basic heart rate tracking to measure nervous system recovery and stress adaptation. I'll show you exactly how I use this data to optimize my training intensity and sleep schedule. The third gadget is a red light therapy panel that I've been using for cellular energy production and skin health—the results after 6 months are remarkable. Fourth, we explore a neurofeedback device that's helping me enhance focus and cognitive performance through targeted brainwave training. Finally, I reveal my latest acquisition: a molecular hydrogen water generator that's showing promising results for reducing inflammation and improving recovery times. Each device comes with detailed usage protocols, cost-benefit analysis, and real data from my personal experiments.",
    timestamp: '1d ago',
    tags: ['Biohacking', 'Science'],
    url: '#',
    bookmarked: true,
  },
  {
    id: 3,
    creatorId: 2,
    platform: 'LinkedIn',
    title: 'Building a Resilient SaaS Company in a Downturn',
    summary:
      'Key strategies for SaaS founders to navigate economic uncertainty while maintaining growth momentum and team morale. Drawing from lessons learned during the 2008 financial crisis and recent market volatility, this comprehensive guide covers the essential pillars of recession-proof SaaS businesses. First, we examine customer retention strategies that go beyond traditional churn reduction—focusing on expanding existing relationships through value-added services and deeper product integration. The data shows that companies prioritizing customer success during downturns emerge stronger with higher lifetime values and more predictable revenue streams. Second, we explore operational efficiency without sacrificing innovation, including smart automation investments that reduce costs while improving customer experience. Third, the critical importance of maintaining a strong company culture during layoffs and budget cuts—how transparent communication and strategic decision-making can actually strengthen team cohesion. We also dive into fundraising strategies for the current environment, including alternative funding sources and the shift toward profitability-focused metrics. Finally, I share specific tactics for identifying and capitalizing on market opportunities that emerge during economic uncertainty, when competitors are retreating and customer needs are evolving rapidly.',
    timestamp: '3d ago',
    tags: ['SaaS', 'Investing'],
    url: '#',
    bookmarked: false,
  },
  {
    id: 4,
    creatorId: 5,
    platform: 'X',
    title: 'A Reflection on Modern Politics',
    summary:
      "A thoughtful reflection on the current state of global politics and the critical importance of civil discourse in our increasingly polarized world. As we witness democratic institutions under pressure across multiple continents, it's essential to examine both the symptoms and root causes of political fragmentation. The rise of social media has fundamentally altered how political information spreads, creating echo chambers that reinforce existing beliefs while marginalizing moderate voices. This isn't just an American phenomenon—from Brexit to rising authoritarianism in various democracies, we're seeing similar patterns of political polarization worldwide. The challenge isn't just about left versus right; it's about the erosion of shared factual foundations that make democratic debate possible. We need to rediscover the art of disagreeing constructively, finding common ground on complex issues, and building coalitions that transcend traditional party lines. This requires both individual commitment to intellectual humility and institutional reforms that incentivize collaboration over conflict. The stakes couldn't be higher—the future of democratic governance depends on our ability to bridge these divides and work together on the pressing challenges of our time, from climate change to economic inequality to technological disruption.",
    timestamp: '5d ago',
    tags: ['Politics', 'Future'],
    url: '#',
    bookmarked: false,
  },
  {
    id: 5,
    creatorId: 3,
    platform: 'Blogs',
    title: 'Annual Letter to Shareholders',
    summary:
      "Comprehensive thoughts on long-term value investing principles, current market cycles, and the fundamental strategies that have guided successful wealth creation over decades of market volatility. This year's letter addresses the persistent questions about whether traditional value investing remains relevant in an era of rapid technological change and unprecedented monetary policy. The evidence suggests that while the specific metrics may evolve, the core principles of buying quality businesses at reasonable prices continue to generate superior long-term returns. We examine several case studies from our portfolio, including companies that have successfully navigated digital transformation while maintaining their competitive moats. The discussion extends to the current inflationary environment and its impact on different asset classes, with particular attention to how businesses with pricing power and strong balance sheets outperform during periods of currency debasement. We also address the growing importance of ESG factors—not as a separate investment thesis, but as integral components of business quality and long-term sustainability. The letter concludes with observations about the next generation of investors and the timeless wisdom that patience, discipline, and independent thinking remain the most valuable tools in any market environment. Special attention is given to the psychological aspects of investing and how emotional discipline often matters more than analytical sophistication.",
    timestamp: '1w ago',
    tags: ['Investing'],
    url: '#',
    bookmarked: true,
  },
  {
    id: 6,
    creatorId: 6,
    platform: 'X',
    title: 'The Angel Philosopher',
    summary:
      "A profound collection of interconnected thoughts on wealth creation, the pursuit of happiness, and discovering meaning in an age of infinite possibilities and constant distraction. This philosophical exploration begins with the paradox of modern abundance—how having more choices and opportunities can sometimes lead to less satisfaction and greater anxiety. We examine the relationship between financial independence and personal freedom, questioning whether the traditional path of wealth accumulation truly leads to the liberation we seek. The discussion weaves through ancient wisdom and modern psychology, exploring how Stoic principles apply to contemporary challenges like social media addiction, career optimization, and relationship building. There's a deep dive into the concept of 'enough'—how to determine when you have sufficient resources to pursue what truly matters versus the endless treadmill of status competition. The piece also addresses the responsibility that comes with wealth and influence, examining how successful individuals can contribute to society while avoiding the trap of virtue signaling. Throughout, there's an emphasis on first-principles thinking and the importance of developing your own philosophy rather than adopting others' frameworks wholesale. The ultimate message centers on the integration of material success with spiritual fulfillment, suggesting that true wealth encompasses not just financial assets but also relationships, health, knowledge, and inner peace.",
    timestamp: '2w ago',
    tags: ['Philosophy', 'Investing'],
    url: '#',
    bookmarked: true,
  },
];

// --- SUBCOMPONENTS ---

function AppSidebar({
  onTopicCreate,
  onTopicEdit,
  onTopicDelete,
  onCreatorCreate,
  onCreatorEdit,
}: any) {
  return (
    <Sidebar collapsible="icon" variant="inset" side="left">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Icons.logo className="w-7 h-7 text-primary" />
          <span className="text-xl font-bold text-gray-800 dark:text-white group-data-[collapsible=icon]:hidden">
            Yum
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 stable-scrollbar sidebar-scrollbar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Add Creator"
                  onClick={onCreatorCreate}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="truncate">Add Creator</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Add Topic" onClick={onTopicCreate}>
                  <PlusCircle className="w-4 h-4" />
                  <span className="truncate">Add Topic</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        {/* Platforms Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Platforms</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {platforms.map((platform) => (
                    <SidebarMenuItem key={platform.name}>
                      <SidebarMenuButton tooltip={platform.name}>
                        <platform.icon className="w-4 h-4" />
                        <span className="truncate">{platform.name}</span>
                        <SidebarMenuBadge>{platform.count}</SidebarMenuBadge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Topics Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Topics</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {topics.map((topic) => (
                    <SidebarMenuItem
                      key={topic.id}
                      className="group/topic-item"
                    >
                      <SidebarMenuButton tooltip={topic.name}>
                        <span
                          className={`w-2 h-2 rounded-full ${topic.color.split(' ')[0]}`}
                        />
                        <span className="truncate">{topic.name}</span>
                        <SidebarMenuBadge className="group-hover/topic-item:opacity-0 transition-opacity duration-200">
                          {topic.count}
                        </SidebarMenuBadge>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/topic-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem onClick={() => onTopicEdit(topic)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => onTopicDelete(topic)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Creators Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Creators</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {creators.map((creator) => (
                    <SidebarMenuItem
                      key={creator.id}
                      className="group/creator-item"
                    >
                      <SidebarMenuButton tooltip={creator.name}>
                        <div className="relative">
                          <Avatar className="w-5 h-5">
                            <AvatarImage
                              src={creator.avatar || '/placeholder.svg'}
                              alt={creator.name}
                            />
                            <AvatarFallback className="text-xs">
                              {creator.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${creator.active ? 'bg-green-500' : 'bg-gray-400'}`}
                          />
                        </div>
                        <span className="truncate">{creator.name}</span>
                        {creator.platforms && creator.platforms.length > 1 && (
                          <SidebarMenuBadge className="group-hover/creator-item:opacity-0 transition-opacity duration-200">
                            {creator.platforms.length}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuButton>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/creator-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                        onClick={() => onCreatorEdit(creator)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function Header({ onSignOut }: { onSignOut: () => void }) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const user = useUser();
  const profile = useProfile();

  const getInitials = (name?: string) => {
    if (!name) return profile?.email?.[0]?.toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  return (
    <header className="flex items-center h-16 px-3 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
      <div className="md:hidden">
        <SidebarTrigger className="h-9 w-9" />
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search content, creators, topics..."
            className="pl-9 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-primary"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && (
            <Card className="absolute top-full mt-2 w-full z-50">
              <CardContent className="p-2">
                <p className="text-xs text-gray-500 p-2">Suggestions</p>
                <Button variant="ghost" className="w-full justify-start">
                  AI Startups
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Naval Ravikant
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Future of Work
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarImage
                src={
                  profile?.avatar_url || '/placeholder.svg?height=40&width=40'
                }
                alt={profile?.full_name || profile?.email || 'User'}
              />
              <AvatarFallback>{getInitials(profile?.full_name)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Account</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ContentCard({ item }: { item: any }) {
  const [bookmarked, setBookmarked] = React.useState(item.bookmarked);
  const [isLoading, setIsLoading] = React.useState(true);
  const creator = creators.find((c) => c.id === item.creatorId);

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'youtube':
        return Youtube;
      case 'x':
        return Icons.x;
      case 'linkedin':
        return Linkedin;
      case 'threads':
        return Icons.threads;
      default:
        return Rss;
    }
  };

  const PlatformIcon = getPlatformIcon(item.platform);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), Math.random() * 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!creator) return null;

  if (isLoading) {
    return (
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 flex flex-col">
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarImage
                  src={creator.avatar || '/placeholder.svg'}
                  alt={creator.name}
                />
                <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  {creator.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <PlatformIcon className="h-3.5 w-3.5" />
                  <span>
                    {creator.platforms?.[0] || 'Blogs'} &middot;{' '}
                    {item.timestamp}
                  </span>
                </div>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-primary"
                    onClick={() => setBookmarked(!bookmarked)}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${bookmarked ? 'fill-primary text-primary' : ''}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bookmark</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">
            {item.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-5">
            {item.summary}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.map((tag: string) => {
              const topicInfo = topics.find((t) => t.name === tag);
              return (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={`${topicInfo?.color} hover:${topicInfo?.color} font-normal`}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between items-center mt-auto">
          <Button variant="outline" size="sm" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              View Original
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicManagementModal({
  open,
  onOpenChange,
  topic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: any;
}) {
  const isEditing = !!topic;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Topic' : 'Create New Topic'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the details for the "${topic?.name}" topic.`
              : 'Add a new topic to categorize content.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              defaultValue={topic?.name || ''}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              defaultValue={topic?.description || ''}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button>{isEditing ? 'Save Changes' : 'Create Topic'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatorManagementModal({
  open,
  onOpenChange,
  creator,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: any;
}) {
  const isEditing = !!creator;
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>(
    creator?.topics || []
  );
  const [isActive, setIsActive] = React.useState(creator?.active ?? true);
  const [urls, setUrls] = React.useState<
    Array<{ id: string; url: string; platform: string; isValid: boolean }>
  >([]);
  const [currentUrl, setCurrentUrl] = React.useState('');
  const [isValidating, setIsValidating] = React.useState(false);
  const [detectedPlatform, setDetectedPlatform] = React.useState<string | null>(
    null
  );
  const [urlError, setUrlError] = React.useState('');

  const handleTopicToggle = (topicName: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName]
    );
  };

  const detectPlatform = (url: string): string => {
    const cleanUrl = url.toLowerCase().trim();
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be'))
      return 'YouTube';
    if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com'))
      return 'X';
    if (cleanUrl.includes('linkedin.com')) return 'LinkedIn';
    if (cleanUrl.includes('threads.net')) return 'Threads';
    if (
      cleanUrl.includes('medium.com') ||
      cleanUrl.includes('substack.com') ||
      cleanUrl.includes('blog')
    )
      return 'Blogs';
    return 'Blogs';
  };

  const getPlatformIcon = (platformName: string) => {
    switch (platformName?.toLowerCase()) {
      case 'youtube':
        return Youtube;
      case 'x':
        return Icons.x;
      case 'linkedin':
        return Linkedin;
      case 'threads':
        return Icons.threads;
      default:
        return Rss;
    }
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (value: string) => {
    setCurrentUrl(value);
    setUrlError('');

    if (value.trim()) {
      setIsValidating(true);
      setTimeout(() => {
        const isValid = validateUrl(value);
        if (isValid) {
          const platform = detectPlatform(value);
          setDetectedPlatform(platform);
          setUrlError('');
        } else {
          setDetectedPlatform(null);
          setUrlError(
            'Please enter a valid URL (e.g., https://twitter.com/username)'
          );
        }
        setIsValidating(false);
      }, 500);
    } else {
      setDetectedPlatform(null);
      setIsValidating(false);
    }
  };

  const addUrl = () => {
    if (currentUrl.trim() && validateUrl(currentUrl)) {
      const platform = detectPlatform(currentUrl);
      const newUrl = {
        id: Date.now().toString(),
        url: currentUrl.trim(),
        platform,
        isValid: true,
      };
      setUrls((prev) => [...prev, newUrl]);
      setCurrentUrl('');
      setDetectedPlatform(null);
      setUrlError('');
    }
  };

  const removeUrl = (id: string) => {
    setUrls((prev) => prev.filter((url) => url.id !== id));
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Creator' : 'Add New Creator'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the details for ${creator?.name}.`
              : 'Add a new creator to follow their content across platforms.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Basic Information
            </h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creator-name" className="text-right">
                Name *
              </Label>
              <Input
                id="creator-name"
                placeholder="e.g., Naval Ravikant"
                defaultValue={creator?.name || ''}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creator-description" className="text-right">
                Description
              </Label>
              <Input
                id="creator-description"
                placeholder="Brief description of the creator"
                defaultValue={creator?.description || ''}
                className="col-span-3"
              />
            </div>
          </div>

          {/* URL Management */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              URLs
            </h4>
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right pt-2">URLs *</Label>
              <div className="col-span-3 space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Paste any URL (YouTube, Twitter, LinkedIn, blog, etc.)"
                    value={currentUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && currentUrl.trim() && !urlError) {
                        e.preventDefault();
                        addUrl();
                      }
                    }}
                    className={`pr-20 ${urlError ? 'border-red-500' : detectedPlatform ? 'border-green-500' : ''}`}
                  />
                  {isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-primary rounded-full"></div>
                    </div>
                  )}
                  {detectedPlatform && !isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {React.createElement(getPlatformIcon(detectedPlatform), {
                        className: 'h-4 w-4',
                      })}
                      <span className="text-xs text-green-600">
                        {detectedPlatform}
                      </span>
                    </div>
                  )}
                </div>

                {urlError && <p className="text-xs text-red-600">{urlError}</p>}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addUrl}
                  disabled={!currentUrl.trim() || !!urlError || isValidating}
                  className="bg-transparent"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add URL
                </Button>

                {urls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Added URLs:</p>
                    <div className="space-y-2">
                      {urls.map((urlItem) => {
                        const PlatformIcon = getPlatformIcon(urlItem.platform);
                        return (
                          <div
                            key={urlItem.id}
                            className="flex items-center gap-3 p-3 border rounded-md bg-gray-50 dark:bg-gray-800/50"
                          >
                            <PlatformIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {urlItem.platform}
                              </p>
                              <p
                                className="text-xs text-gray-500 truncate"
                                title={urlItem.url}
                              >
                                {truncateUrl(urlItem.url)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-500"
                              onClick={() => removeUrl(urlItem.id)}
                            >
                              <Icons.x className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Add URLs from different platforms where this creator is
                  active. Platform will be detected automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Topic Assignments */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Topic Assignments
            </h4>
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right pt-2">Topics</Label>
              <div className="col-span-3">
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded-md p-3">
                  {topics.map((topic) => (
                    <div key={topic.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-topic-${topic.id}`}
                        checked={selectedTopics.includes(topic.name)}
                        onCheckedChange={() => handleTopicToggle(topic.name)}
                      />
                      <label
                        htmlFor={`new-topic-${topic.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {topic.name}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select topics that this creator typically covers
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Status
            </h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Active</Label>
              <div className="col-span-3 flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isActive
                    ? 'Creator is active and content will be fetched'
                    : 'Creator is inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Avatar Upload */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Avatar
            </h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Profile Image</Label>
              <div className="col-span-3 flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={creator?.avatar || '/placeholder.svg'} />
                  <AvatarFallback>
                    {creator?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            {isEditing ? 'Save Changes' : 'Add Creator'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- NEW: Content List Item Component ---
function ContentListItem({ item }: { item: any }) {
  const [bookmarked, setBookmarked] = React.useState(item.bookmarked);
  const creator = creators.find((c) => c.id === item.creatorId);

  const getPlatformIcon = (platformName: string) => {
    const platform = platforms?.[0] || 'Blogs';

    switch (platformName?.toLowerCase()) {
      case 'youtube':
        return Youtube;
      case 'x':
        return Icons.x;
      case 'linkedin':
        return Linkedin;
      case 'threads':
        return Linkedin;
      default:
        return Rss;
    }
  };
  const PlatformIcon = getPlatformIcon(item.platform);

  if (!creator) return null;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 w-full">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border flex-shrink-0">
            <AvatarImage
              src={creator.avatar || '/placeholder.svg'}
              alt={creator.name}
            />
            <AvatarFallback>{creator.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {creator.name}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <PlatformIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.timestamp}</span>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white line-clamp-2 leading-tight">
              {item.title}
            </h3>

            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-3 leading-relaxed">
              {item.summary}
            </p>

            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag: string) => {
                const topicInfo = topics.find((t) => t.name === tag);
                return (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className={`${topicInfo?.color} hover:${topicInfo?.color} font-normal text-xs`}
                  >
                    {tag}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 bg-transparent"
                    asChild
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Original</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-500 hover:text-primary"
                    onClick={() => setBookmarked(!bookmarked)}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${bookmarked ? 'fill-primary text-primary' : ''}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bookmark</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MobileFiltersSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] [&>button]:hidden px-6">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b">
            <h2 className="text-lg font-semibold">Filters</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 pr-4 space-y-6">
            {/* Date Range */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Date Range</h3>
              <DatePickerWithRange className="w-full" />
            </div>

            {/* Platforms */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Platforms</h3>
              <div className="space-y-2">
                {platforms.map((p) => (
                  <div key={p.name} className="flex items-center space-x-2">
                    <Checkbox id={`mobile-platform-${p.name}`} />
                    <label
                      htmlFor={`mobile-platform-${p.name}`}
                      className="text-sm font-medium leading-none"
                    >
                      {p.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Topics</h3>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {topics.map((t) => (
                  <div key={t.id} className="flex items-center space-x-2">
                    <Checkbox id={`mobile-topic-${t.id}`} />
                    <label
                      htmlFor={`mobile-topic-${t.id}`}
                      className="text-sm font-medium leading-none"
                    >
                      {t.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Creators */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Creators</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {creators.map((c) => (
                  <div key={c.id} className="flex items-center space-x-2">
                    <Checkbox id={`mobile-creator-${c.id}`} />
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={c.avatar || '/placeholder.svg'}
                          alt={c.name}
                        />
                        <AvatarFallback className="text-xs">
                          {c.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor={`mobile-creator-${c.id}`}
                        className="text-sm font-medium leading-none"
                      >
                        {c.name}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Items */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Saved Items Only</span>
              <Switch />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              Clear All
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- MAIN DASHBOARD COMPONENT ---

export function YumDashboard() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/login';
  };
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [isTopicModalOpen, setTopicModalOpen] = React.useState(false);
  const [isCreatorEditModalOpen, setCreatorEditModalOpen] =
    React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedTopic, setSelectedTopic] = React.useState<any>(null);
  const [selectedCreator, setSelectedCreator] = React.useState<any>(null);
  const [isCreatorModalOpen, setCreatorModalOpen] = React.useState(false);
  const [isMobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const handleCreateTopic = () => {
    setSelectedTopic(null);
    setTopicModalOpen(true);
  };

  const handleEditTopic = (topic: any) => {
    setSelectedTopic(topic);
    setTopicModalOpen(true);
  };

  const handleDeleteTopic = (topic: any) => {
    setSelectedTopic(topic);
    setDeleteDialogOpen(true);
  };

  const handleEditCreator = (creator: any) => {
    setSelectedCreator(creator);
    setCreatorEditModalOpen(true);
  };

  const handleCreateCreator = () => {
    setSelectedCreator(null);
    setCreatorModalOpen(true);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar
          onTopicCreate={handleCreateTopic}
          onTopicEdit={handleEditTopic}
          onTopicDelete={handleDeleteTopic}
          onCreatorCreate={handleCreateCreator}
          onCreatorEdit={handleEditCreator}
        />
        <SidebarInset className="flex-1 flex flex-col">
          <Header onSignOut={handleSignOut} />
          <main className="flex-1 p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your Feed
              </h1>
              <div className="flex items-center gap-2">
                {/* Mobile Filter Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden h-9 w-9 bg-transparent"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  <Filter className="h-4 w-4" />
                </Button>

                {/* Desktop Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="hidden md:flex bg-transparent"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-80 min-w-[320px]"
                    align="end"
                    side="bottom"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel>Filter By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <DatePickerWithRange className="w-full" />
                    </div>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Platforms</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {platforms.map((p) => (
                            <DropdownMenuCheckboxItem key={p.name}>
                              {p.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Creators</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {creators.map((c) => (
                            <DropdownMenuCheckboxItem key={c.id}>
                              {c.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Topics</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {topics.map((t) => (
                            <DropdownMenuCheckboxItem key={t.id}>
                              {t.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm font-medium">Saved Items</span>
                      <Switch />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Advanced Search</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Toggle Buttons */}
                <div className="hidden lg:flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-9 w-9 ${view === 'list' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-transparent'}`}
                          onClick={() => setView('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>List View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-9 w-9 ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-transparent'}`}
                          onClick={() => setView('grid')}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Grid View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <div className="lg:hidden">
              <div className="grid grid-cols-1 gap-6">
                {contentFeed.map((item) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            </div>
            <div className="hidden lg:block">
              {view === 'grid' ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                  {contentFeed.map((item) => (
                    <ContentCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  {contentFeed.map((item) => (
                    <ContentListItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-center mt-8">
              <Button variant="outline">Load More</Button>
            </div>
          </main>
        </SidebarInset>
      </div>
      <TopicManagementModal
        open={isTopicModalOpen}
        onOpenChange={setTopicModalOpen}
        topic={selectedTopic}
      />
      <CreatorManagementModal
        open={isCreatorEditModalOpen}
        onOpenChange={setCreatorEditModalOpen}
        creator={selectedCreator}
      />
      <CreatorManagementModal
        open={isCreatorModalOpen}
        onOpenChange={setCreatorModalOpen}
        creator={selectedCreator}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the "
              {selectedTopic?.name}" topic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MobileFiltersSheet
        open={isMobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
      />
    </SidebarProvider>
  );
}
