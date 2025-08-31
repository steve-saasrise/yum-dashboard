import React, { useState, useEffect } from 'react';
import {
  Mail,
  Linkedin,
  Youtube,
  Twitter,
  Rss,
  MessageCircle,
} from 'lucide-react';

const SaaSDaily = () => {
  const [newsStories, setNewsStories] = useState([]);
  const [fundraisingNews, setFundraisingNews] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [saasStocks, setSaasStocks] = useState({
    indexes: [],
    gainers: [],
    losers: [],
  });

  // Simulated news data - in production, this would come from news APIs
  const mockNewsStories = [
    {
      id: 1,
      title: 'Notion launches AI-powered workspace automation',
      summary:
        'Popular productivity platform introduces intelligent content generation and automated workflow suggestions, targeting enterprise customers with advanced collaboration needs',
      url: '#',
      source: 'The Verge',
      publishedAt: '2025-08-28T10:30:00Z',
    },
    {
      id: 2,
      title: 'Microsoft Teams Premium adds advanced meeting analytics',
      summary:
        'New SaaS offering provides detailed insights into meeting productivity and engagement metrics, helping organizations optimize their collaboration workflows',
      url: '#',
      source: 'The Verge',
      publishedAt: '2025-08-28T09:15:00Z',
    },
    {
      id: 3,
      title: 'Slack introduces workflow automation for enterprise customers',
      summary:
        'Platform-as-a-service expansion aims to streamline business processes through intelligent automation tools and enhanced integration capabilities for large organizations',
      url: '#',
      source: 'Forbes',
      publishedAt: '2025-08-28T08:45:00Z',
    },
    {
      id: 4,
      title: 'Zoom launches new developer platform for SaaS integrations',
      summary:
        "API marketplace allows third-party SaaS tools to integrate seamlessly with Zoom, expanding the platform's ecosystem for enterprise customers",
      url: '#',
      source: 'VentureBeat',
      publishedAt: '2025-08-28T07:20:00Z',
    },
    {
      id: 5,
      title: 'Adobe Creative Cloud adds collaborative SaaS features',
      summary:
        'Real-time collaboration tools now available across all Creative Suite applications, enabling teams to work simultaneously on creative projects',
      url: '#',
      source: 'Ars Technica',
      publishedAt: '2025-08-28T06:30:00Z',
    },
  ];

  const mockFundraisingNews = [
    {
      id: 1,
      title: 'DataBricks raises $500M Series H at $43B valuation',
      summary:
        'AI-powered analytics SaaS platform secures massive funding round for international expansion and enhanced machine learning capabilities development',
      amount: '$500M',
      stage: 'Series H',
      valuation: '$43B',
      url: '#',
      source: 'Bloomberg',
      publishedAt: '2025-08-28T11:00:00Z',
    },
    {
      id: 2,
      title: 'Security SaaS startup SecureFlow closes $85M Series B',
      summary:
        'Cloud security platform aims to expand into enterprise market with advanced threat detection and compliance automation solutions',
      amount: '$85M',
      stage: 'Series B',
      valuation: '$800M',
      url: '#',
      source: 'TechCrunch',
      publishedAt: '2025-08-28T10:15:00Z',
    },
    {
      id: 3,
      title: 'HR SaaS platform TalentSync secures $32M Series A',
      summary:
        'AI-driven recruitment software targets mid-market companies with automated candidate screening and advanced talent matching algorithms for faster hiring',
      amount: '$32M',
      stage: 'Series A',
      valuation: '$150M',
      url: '#',
      source: 'VentureBeat',
      publishedAt: '2025-08-28T09:30:00Z',
    },
    {
      id: 4,
      title: 'FinTech SaaS company PayStream raises $120M',
      summary:
        'B2B payment processing platform expands internationally while developing next-generation financial automation tools for enterprise clients across multiple industries',
      amount: '$120M',
      stage: 'Series C',
      valuation: '$1.2B',
      url: '#',
      source: 'Reuters',
      publishedAt: '2025-08-28T08:00:00Z',
    },
    {
      id: 5,
      title: 'Marketing automation SaaS GrowthEngine gets $45M funding',
      summary:
        'Platform helps SMBs optimize their digital marketing campaigns through AI-powered analytics and automated customer journey optimization tools',
      amount: '$45M',
      stage: 'Series B',
      valuation: '$300M',
      url: '#',
      source: 'Forbes',
      publishedAt: '2025-08-28T07:45:00Z',
    },
  ];

  const mockSocialPosts = [
    {
      id: 1,
      title: 'Why SaaS pricing is broken and how to fix it',
      content:
        "Most SaaS companies are pricing wrong and leaving millions on the table. Here's a comprehensive 10-point framework that increased our ARR by 300% in just 18 months...",
      author: 'Sarah Chen',
      handle: '@sarahchen',
      platform: 'linkedin',
      url: '#',
      likes: 1247,
      shares: 89,
      publishedAt: '2025-08-28T11:30:00Z',
    },
    {
      id: 2,
      title: 'The Complete Guide to SaaS Metrics in 2025',
      content:
        "Everything you need to know about CAC, LTV, churn, and the advanced metrics that actually matter for scaling SaaS businesses profitably in today's competitive market",
      author: 'Ryan Allis',
      handle: '@ryanallis',
      platform: 'youtube',
      url: '#',
      likes: 892,
      shares: 156,
      publishedAt: '2025-08-28T10:45:00Z',
    },
    {
      id: 3,
      title: 'Hot take: PLG is dead for B2B SaaS',
      content:
        "Product-led growth worked in 2020-2022, but the market has fundamentally shifted and buyers expect human interaction. Sales-led motion is making a strong comeback. Here's the data...",
      author: 'Alex Rodriguez',
      handle: '@alexrod',
      platform: 'x',
      url: '#',
      likes: 2341,
      shares: 445,
      publishedAt: '2025-08-28T09:20:00Z',
    },
    {
      id: 4,
      title: 'Building a $10M ARR SaaS in stealth mode',
      content:
        "We just crossed $10M ARR and nobody knew we existed until today. Here's exactly how we built a profitable SaaS without any marketing, PR, or traditional growth tactics...",
      author: 'Maria Santos',
      handle: '@mariasantos',
      platform: 'threads',
      url: '#',
      likes: 3456,
      shares: 234,
      publishedAt: '2025-08-28T08:15:00Z',
    },
    {
      id: 5,
      title: 'SaaS Trends Report Q3 2025',
      content:
        'Latest trends reshaping SaaS: AI integration becoming table stakes, vertical solutions dominating horizontals, and the accelerating shift to consumption-based pricing models across all segments',
      author: 'Jason Fried',
      handle: '@jasonfried',
      platform: 'rss',
      url: '#',
      likes: 567,
      shares: 78,
      publishedAt: '2025-08-28T07:30:00Z',
    },
  ];

  const mockSaaSStocks = {
    indexes: [
      {
        name: 'BVP Cloud Index',
        change: +1.8,
        revenueMultiple: 6.3,
        ebitdaMultiple: 28.1,
      },
      {
        name: 'Aventis Public SaaS Index',
        change: -0.4,
        revenueMultiple: 7.1,
        ebitdaMultiple: 24.2,
      },
    ],
    gainers: [
      {
        id: 1,
        company: 'ServiceNow',
        ticker: 'NOW',
        currentPrice: 756.32,
        change: +24.18,
        percentChange: +3.3,
        marketCap: '155.2B',
        revenueMultiple: 18.2,
        ebitdaMultiple: 67.3,
      },
      {
        id: 2,
        company: 'Snowflake',
        ticker: 'SNOW',
        currentPrice: 142.65,
        change: +4.23,
        percentChange: +3.1,
        marketCap: '46.8B',
        revenueMultiple: 15.1,
        ebitdaMultiple: 89.2,
      },
      {
        id: 3,
        company: 'HubSpot',
        ticker: 'HUBS',
        currentPrice: 521.89,
        change: +12.45,
        percentChange: +2.4,
        marketCap: '26.4B',
        revenueMultiple: 12.3,
        ebitdaMultiple: 45.7,
      },
    ],
    losers: [
      {
        id: 4,
        company: 'DocuSign',
        ticker: 'DOCU',
        currentPrice: 56.23,
        change: -2.87,
        percentChange: -4.9,
        marketCap: '11.2B',
        revenueMultiple: 4.8,
        ebitdaMultiple: 22.1,
      },
      {
        id: 5,
        company: 'Zoom',
        ticker: 'ZM',
        currentPrice: 67.45,
        change: -2.34,
        percentChange: -3.4,
        marketCap: '20.1B',
        revenueMultiple: 4.2,
        ebitdaMultiple: 18.6,
      },
      {
        id: 6,
        company: 'Okta',
        ticker: 'OKTA',
        currentPrice: 78.91,
        change: -1.98,
        percentChange: -2.4,
        marketCap: '13.5B',
        revenueMultiple: 6.7,
        ebitdaMultiple: 31.8,
      },
    ],
  };

  const getSocialIcon = (platform) => {
    const iconProps = { className: 'w-4 h-4' };

    switch (platform.toLowerCase()) {
      case 'linkedin':
        return <Linkedin {...iconProps} className="w-4 h-4 text-gray-600" />;
      case 'youtube':
        return <Youtube {...iconProps} className="w-4 h-4 text-gray-600" />;
      case 'x':
      case 'twitter':
        return (
          <div className="w-4 h-4 flex items-center justify-center bg-gray-600 rounded text-white text-xs font-bold">
            X
          </div>
        );
      case 'threads':
        return (
          <MessageCircle {...iconProps} className="w-4 h-4 text-gray-600" />
        );
      case 'rss':
        return <Rss {...iconProps} className="w-4 h-4 text-gray-600" />;
      default:
        return (
          <MessageCircle {...iconProps} className="w-4 h-4 text-gray-600" />
        );
    }
  };

  useEffect(() => {
    setNewsStories(mockNewsStories);
    setFundraisingNews(mockFundraisingNews);
    setSocialPosts(mockSocialPosts);
    setSaasStocks(mockSaaSStocks);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Email Preview */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <Mail className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                SaaS Coffee Email Preview
              </h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Daily email sent at 7:00 AM PT to ryan@saasrise.com
            </p>
          </div>

          <div className="p-6 bg-gray-50">
            <div className="bg-white rounded border max-w-3xl mx-auto">
              <div className="p-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">
                    ☕ SaaS Coffee
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-gray-500 text-sm italic mt-1">
                    Making You Smarter Every Morning
                  </p>
                </div>

                {/* Sponsor Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="text-center text-xs text-gray-500 mb-3">
                    Presented By
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white rounded border">
                      <div
                        className="text-black font-normal text-sm mb-2"
                        style={{
                          fontFamily: 'Arial, sans-serif',
                          letterSpacing: '1px',
                        }}
                      >
                        VISTA POINT ADVISORS
                      </div>
                      <p className="text-xs text-gray-600">
                        Leading investment bank for founder-led SaaS companies,
                        providing M&A and capital raising advice.
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white rounded border">
                      <div className="flex items-center justify-center mb-2">
                        <div
                          className="w-6 h-6 rounded-full mr-2 flex-shrink-0"
                          style={{
                            background:
                              'linear-gradient(135deg, #ff6b35 0%, #f7931e 25%, #ff5f7a 75%, #c44569 100%)',
                            border: '1px solid rgba(255,255,255,0.2)',
                          }}
                        ></div>
                        <span
                          className="font-medium text-sm"
                          style={{ color: '#ff5f7a' }}
                        >
                          SAASRISE
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        The mastermind community for SaaS CEOs & Founders with
                        $5M+ in ARR
                      </p>
                    </div>
                  </div>
                </div>

                {/* Big Story of the Day */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    ⭐ Big Story of the Day
                  </h2>
                  <div className="mb-3">
                    <div
                      className="w-full bg-blue-100 rounded flex items-center justify-center mb-3"
                      style={{ height: '200px' }}
                    >
                      <div className="w-16 h-8 bg-blue-500 rounded"></div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <strong>
                      <a
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'none' }}
                      >
                        Salesforce announces new AI-powered CRM features
                      </a>
                    </strong>{' '}
                    - Salesforce unveils{' '}
                    <strong>Einstein GPT integration</strong> for advanced
                    automation and customer relationship management. 👉{' '}
                    <strong>Why it matters:</strong> Salesforce is doubling down
                    on AI to defend CRM dominance. Competitors like HubSpot and
                    Zoho will need to move faster or risk losing enterprise
                    clients. <em>Source: TechCrunch</em>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    🚀 Today's SaaS Headlines
                  </h2>
                  <ol className="space-y-3">
                    {newsStories.slice(0, 5).map((story, index) => (
                      <li
                        key={story.id}
                        className="text-sm flex items-start space-x-3"
                      >
                        <div
                          className="w-48 bg-blue-100 rounded flex-shrink-0 flex items-center justify-center"
                          style={{ height: '70px' }}
                        >
                          <div className="w-20 h-8 bg-blue-500 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <strong>
                            {index + 1}.{' '}
                            <a
                              href={story.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                              }}
                            >
                              {story.title}
                            </a>
                          </strong>
                          <br />
                          <span className="text-gray-600">{story.summary}</span>
                          <br />
                          <em className="text-gray-500 text-xs">
                            {story.source}
                          </em>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    💰 SaaS Fundraising Announcements
                  </h2>
                  <ol className="space-y-3">
                    {fundraisingNews.slice(0, 5).map((news, index) => (
                      <li
                        key={news.id}
                        className="text-sm flex items-start space-x-3"
                      >
                        <div
                          className="w-48 bg-green-100 rounded flex-shrink-0 flex items-center justify-center"
                          style={{ height: '70px' }}
                        >
                          <div className="w-20 h-8 bg-green-500 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <strong>
                            {index + 1}.{' '}
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                              }}
                            >
                              {news.title}
                            </a>
                          </strong>
                          <br />
                          <span className="text-gray-600">{news.summary}</span>
                          <br />
                          <span className="inline-flex items-center space-x-2 text-xs mt-1">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                              {news.amount}
                            </span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {news.stage}
                            </span>
                            <span className="text-gray-400">•</span>
                            <em className="text-gray-500">{news.source}</em>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <br />

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    💬 Top SaaS Social Posts
                  </h2>
                  <ol className="space-y-3">
                    {socialPosts.slice(0, 5).map((post, index) => (
                      <li
                        key={post.id}
                        className="text-sm flex items-start space-x-3"
                      >
                        <div className="w-48 h-27 bg-purple-100 rounded flex-shrink-0 flex items-center justify-center">
                          <div className="w-20 h-12 bg-purple-500 rounded"></div>
                        </div>
                        <div className="flex-1">
                          <strong>
                            {index + 1}.{' '}
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                              }}
                            >
                              {post.title}
                            </a>
                          </strong>
                          <br />
                          <span className="text-gray-600">{post.content}</span>
                          <br />
                          <div className="flex items-center space-x-2 text-xs mt-1">
                            <span className="text-gray-500">
                              by {post.author} ({post.handle})
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="flex items-center">
                              {getSocialIcon(post.platform)}
                            </span>
                            <span className="text-gray-400">•</span>
                            {post.platform.toLowerCase() !== 'rss' && (
                              <span className="text-gray-500">
                                ❤️ {post.likes.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <br />

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    📈 SaaS Stock Movers
                  </h2>

                  {/* SaaS Indexes */}
                  <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <h3 className="font-medium text-gray-800 mb-2 text-sm">
                      📊 SaaS Indexes (Prior Day)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {saasStocks.indexes &&
                        saasStocks.indexes.map((index, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-700">
                                {index.name}
                              </span>
                              <span
                                className={`font-medium ${index.change >= 0 ? 'text-green-700' : 'text-red-700'}`}
                              >
                                {index.change >= 0 ? '+' : ''}
                                {index.change}%
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {index.revenueMultiple}x Rev,{' '}
                              {index.ebitdaMultiple}x EBITDA
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-medium text-green-700 mb-2 text-sm">
                        🟢 Top Gainers
                      </h3>
                      <div className="space-y-2">
                        {saasStocks.gainers.map((stock, index) => (
                          <div
                            key={stock.id}
                            className="text-xs border rounded p-2 bg-green-50"
                          >
                            <div className="font-medium text-gray-900">
                              {index + 1}. {stock.company} ({stock.ticker})
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-gray-700">
                                ${stock.currentPrice} | ${stock.marketCap}{' '}
                                Market Cap, {stock.revenueMultiple}x Rev,{' '}
                                {stock.ebitdaMultiple}x EBITDA
                              </span>
                              <span className="text-green-700 font-medium">
                                +${Math.abs(stock.change).toFixed(2)} (+
                                {stock.percentChange}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-red-700 mb-2 text-sm">
                        🔴 Top Losers
                      </h3>
                      <div className="space-y-2">
                        {saasStocks.losers.map((stock, index) => (
                          <div
                            key={stock.id}
                            className="text-xs border rounded p-2 bg-red-50"
                          >
                            <div className="font-medium text-gray-900">
                              {index + 1}. {stock.company} ({stock.ticker})
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-gray-700">
                                ${stock.currentPrice} | ${stock.marketCap}{' '}
                                Market Cap, {stock.revenueMultiple}x Rev,{' '}
                                {stock.ebitdaMultiple}x EBITDA
                              </span>
                              <span className="text-red-700 font-medium">
                                ${stock.change.toFixed(2)} (
                                {stock.percentChange}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500">
                  This email was automatically generated by Coffee
                  <br />
                  Unsubscribe | Manage Preferences
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaaSDaily;
