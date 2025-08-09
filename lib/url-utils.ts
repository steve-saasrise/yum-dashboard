// URL extraction and validation utilities

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Platforms that we already handle natively in the app
const NATIVE_PLATFORMS = [
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'threads.net',
];

export interface ExtractedUrl {
  url: string;
  isExternal: boolean;
}

/**
 * Extracts URLs from text content
 */
export function extractUrls(text: string | null | undefined): ExtractedUrl[] {
  if (!text) return [];

  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  const uniqueUrls = Array.from(new Set(matches));

  return uniqueUrls.map((url) => ({
    url,
    isExternal: isExternalUrl(url),
  }));
}

/**
 * Checks if a URL is external (not from a platform we handle natively)
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return !NATIVE_PLATFORMS.some((platform) =>
      hostname.includes(platform.toLowerCase())
    );
  } catch {
    return false;
  }
}

/**
 * Extracts external URLs from content that should show link previews
 */
export function extractExternalUrls(text: string | null | undefined): string[] {
  return extractUrls(text)
    .filter((item) => item.isExternal)
    .map((item) => item.url);
}

/**
 * Combines and deduplicates URLs from multiple text sources
 */
export function extractUrlsFromContent(
  description?: string | null,
  contentBody?: string | null,
  platform?: string
): string[] {
  const descriptionUrls = extractExternalUrls(description);
  const bodyUrls = extractExternalUrls(contentBody);

  // Combine and deduplicate
  let allUrls = [...descriptionUrls, ...bodyUrls];
  allUrls = Array.from(new Set(allUrls));

  // For Twitter posts, we keep t.co links as they often point to external content
  // The extractExternalUrls already filters out twitter.com/x.com links

  return allUrls;
}
