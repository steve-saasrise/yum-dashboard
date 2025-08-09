# OpenGraph Link Preview Feature

## Overview

The Daily News dashboard now automatically displays rich link previews for external URLs that creators share in their content. This provides a better user experience by showing a visual preview of linked content with title, description, image, and favicon.

## How It Works

### Components

1. **API Endpoint** (`/api/opengraph/route.ts`): Fetches OpenGraph metadata from URLs
2. **LinkPreview Component** (`components/link-preview.tsx`): Displays individual link previews
3. **ContentLinkPreviews Component** (`components/content-link-previews.tsx`): Manages multiple previews per content item
4. **useLinkPreview Hook** (`hooks/use-link-preview.ts`): Handles data fetching and caching
5. **URL Utilities** (`lib/url-utils.ts`): Extracts and filters URLs from content

### Features

- Automatic URL detection in content descriptions and body text
- Caches metadata for 24 hours to reduce API calls
- Excludes platform-specific links (YouTube, Twitter, LinkedIn, Threads) that are already handled natively
- Shows up to 3 link previews per content item
- Graceful fallback for URLs that can't be fetched
- Loading states with skeleton UI
- Responsive design with dark mode support

## Testing

### Manual Testing

1. Create or find content with external URLs in the description or body
2. The dashboard will automatically display link previews below the AI summary
3. Examples of good test URLs:
   - News articles (TechCrunch, The Verge, etc.)
   - GitHub repositories
   - Blog posts
   - Documentation sites

### API Testing

You can test the OpenGraph API endpoint directly:

```bash
# Test with a valid URL
curl "http://localhost:3000/api/opengraph?url=https://github.com/vercel/next.js"

# Response:
{
  "title": "GitHub - vercel/next.js: The React Framework",
  "description": "The React Framework. Contribute to vercel/next.js development by creating an account on GitHub.",
  "favicon": "https://github.githubassets.com/favicons/favicon.svg",
  "image": "https://repository-images.githubusercontent.com/70107786/...",
  "siteName": "GitHub",
  "url": "https://github.com/vercel/next.js"
}
```

## Implementation Details

### URL Extraction

The system extracts URLs from:

- Content `description` field
- Content `content_body` field

It filters out:

- YouTube, Twitter/X, LinkedIn, and Threads URLs (handled natively)
- Duplicate URLs
- Invalid URLs

### Caching Strategy

- **Client-side**: In-memory cache using Map in the useLinkPreview hook
- **Server-side**: 24-hour Cache-Control headers for CDN caching
- This prevents redundant API calls for the same URLs

### Security

- URL validation before fetching
- All external images are loaded through Next.js Image component with `unoptimized` flag
- External links open in new tabs with `noopener noreferrer`

## Future Enhancements

- Add support for oEmbed protocol for richer embeds
- Implement server-side caching with Redis
- Add admin controls to enable/disable previews per lounge
- Support for custom preview templates per domain
- Analytics on link clicks
