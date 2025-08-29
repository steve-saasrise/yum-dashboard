import { OpenAI } from 'openai';

interface NewsItem {
  text: string;
  sourceUrl?: string;
}

interface GenerateNewsResult {
  items: NewsItem[];
  topic: string;
  generatedAt: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export class AINewsServiceWithSearch {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Clean topic name by removing "Coffee" and similar suffixes
   */
  private getCleanTopic(
    loungeName: string,
    loungeDescription?: string
  ): string {
    if (loungeDescription) {
      return loungeDescription;
    }
    return loungeName.replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '').trim();
  }

  /**
   * Search for real news using a search API
   * You can use Tavily, Perplexity, SerpAPI, or Bing Search API
   */
  private async searchRealNews(topic: string): Promise<SearchResult[]> {
    // Option 1: Use Tavily API (recommended for AI agents)
    if (process.env.TAVILY_API_KEY) {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: `${topic} news latest 24 hours`,
          search_depth: 'advanced',
          max_results: 10,
          include_domains: [
            'techcrunch.com',
            'theverge.com',
            'reuters.com',
            'bloomberg.com',
            'cnbc.com',
            'forbes.com',
            'wired.com',
            'arstechnica.com',
            'venturebeat.com',
            'businessinsider.com',
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          publishedDate: r.published_date,
        }));
      }
    }

    // Option 2: Use SerpAPI (Google Search)
    if (process.env.SERPAPI_API_KEY) {
      const params = new URLSearchParams({
        api_key: process.env.SERPAPI_API_KEY,
        q: `${topic} news`,
        tbm: 'nws', // News search
        tbs: 'qdr:d', // Last 24 hours
        num: '10',
      });

      const response = await fetch(`https://serpapi.com/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        return (
          data.news_results?.map((r: any) => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
            publishedDate: r.date,
          })) || []
        );
      }
    }

    // Fallback: Return empty array if no search API is configured
    console.warn(
      'No search API configured. Please set TAVILY_API_KEY or SERPAPI_API_KEY'
    );
    return [];
  }

  /**
   * Generate news summary with real articles
   */
  async generateNews(
    loungeName: string,
    loungeDescription?: string
  ): Promise<GenerateNewsResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const topic = this.getCleanTopic(loungeName, loungeDescription);

    // Step 1: Search for real news articles
    const searchResults = await this.searchRealNews(topic);

    if (searchResults.length === 0) {
      console.warn(
        'No search results found, falling back to GPT-only generation'
      );
      return this.generateWithoutSearch(topic);
    }

    // Step 2: Create context from real search results
    const newsContext = searchResults
      .slice(0, 10)
      .map(
        (article, index) =>
          `${index + 1}. ${article.title}\nURL: ${article.url}\nSummary: ${article.snippet}`
      )
      .join('\n\n');

    // Step 3: Use GPT to create summary from real articles
    const prompt = `Based on these REAL news articles from the last 24 hours in the field of ${topic}, create a short bulleted summary of the top news and takeaways. 

Real Articles:
${newsContext}

Instructions:
- Create exactly 6 bullet points with a total of 70 words maximum
- Each bullet should summarize a key piece of news from the articles above
- Include the source URL for each bullet point
- Focus on the most important and impactful news
- If there was a large round of funding or an exit/sale/IPO, prioritize mentioning it
- This is for a daily digest for professionals in the field

Format your response as a JSON array where each item has "text" and "sourceUrl":
[
  {"text": "Summary of news", "sourceUrl": "https://actual-url-from-articles-above.com"},
  ...
]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional news curator. Create concise summaries from the provided real news articles. Only use URLs that are explicitly provided in the context.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more factual summaries
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      let items: NewsItem[] = [];
      try {
        const parsed = JSON.parse(response);
        items = Array.isArray(parsed)
          ? parsed
          : parsed.items || parsed.news || parsed.bullets || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        items = [];
      }

      // Validate and ensure we're using real URLs
      items = this.validateItems(items, searchResults);

      return {
        items,
        topic,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating news summary:', error);
      throw error;
    }
  }

  /**
   * Fallback generation without search (not recommended)
   */
  private async generateWithoutSearch(
    topic: string
  ): Promise<GenerateNewsResult> {
    // Your existing generation logic, but mark items as "generated"
    // This should only be used as a fallback
    return {
      items: [
        {
          text: `AI-generated summary for ${topic} (no real sources available)`,
        },
      ],
      topic,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Validate items have real URLs from search results
   */
  private validateItems(
    items: NewsItem[],
    searchResults: SearchResult[]
  ): NewsItem[] {
    const validUrls = new Set(searchResults.map((r) => r.url));

    return items
      .filter((item) => !item.sourceUrl || validUrls.has(item.sourceUrl))
      .slice(0, 6); // Limit to 6 items
  }
}
