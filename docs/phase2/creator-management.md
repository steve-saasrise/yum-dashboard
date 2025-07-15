# Creator Management System - Feature Specification

## Overview

The Creator Management System enables users to follow content creators across multiple platforms through a unified interface. Users can add creators by simply pasting any URL from supported platforms, and the system automatically detects the platform and extracts creator information.

### Page vs Modal Distinction

- **Creator Management Page** (`/creators`): A dedicated page for managing multiple creators, viewing their details, filtering, searching, and performing bulk operations on existing creators
- **Add Creator Modal**: A modal dialog used to add a single creator at a time, supporting multiple URLs for the same creator (e.g., their YouTube and Twitter accounts). This modal is accessible from both the dashboard sidebar and the creator management page

## User Stories

### Primary User Story

**As a user**, I want to add creators by pasting any URL from their profiles **so that** I can follow their content without worrying about formats or technical details.

### Supporting Stories

- **As a user**, I want to organize creators by topics **so that** I can filter content by my interests
- **As a user**, I want to import multiple creators at once **so that** I can quickly set up my content sources
- **As a user**, I want to see creator metadata **so that** I can verify I'm following the right person

## Technical Requirements

### 1. Smart URL Input Component

#### Component: `components/creators/add-creator-modal.tsx`

The Add Creator Modal already includes smart URL input functionality that supports multiple URLs per creator.

```typescript
interface SmartUrlInputProps {
  onCreatorDetected: (creator: DetectedCreator) => void;
  onError: (error: string) => void;
}

interface DetectedCreator {
  platform: 'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss';
  platformId: string;
  name: string;
  url: string;
  avatarUrl?: string;
  description?: string;
}
```

#### URL Pattern Detection

```typescript
const PLATFORM_PATTERNS = {
  youtube: [
    /youtube\.com\/channel\/([^\/\?]+)/,
    /youtube\.com\/@([^\/\?]+)/,
    /youtube\.com\/c\/([^\/\?]+)/,
    /youtube\.com\/user\/([^\/\?]+)/,
  ],
  twitter: [/twitter\.com\/([^\/\?]+)/, /x\.com\/([^\/\?]+)/],
  linkedin: [
    /linkedin\.com\/in\/([^\/\?]+)/,
    /linkedin\.com\/company\/([^\/\?]+)/,
  ],
  threads: [/threads\.net\/@([^\/\?]+)/],
  rss: [/\.xml$/, /\/feed\/?$/, /\/rss\/?$/],
};
```

### 2. Creator Profile Management

#### API Endpoints

- `POST /api/creators` - Add new creator
- `GET /api/creators` - List user's creators
- `PATCH /api/creators/:id` - Update creator info
- `DELETE /api/creators/:id` - Remove creator
- `POST /api/creators/:id/topics` - Assign topics

#### Database Operations

```typescript
// lib/creators.ts
export async function addCreator(userId: string, creator: DetectedCreator) {
  // Check for duplicates
  // Fetch additional metadata if needed
  // Insert into database
  // Return created creator
}

export async function getUserCreators(userId: string) {
  // Fetch all creators for user
  // Include topic relationships
  // Return sorted list
}
```

### 3. Platform-Specific Metadata Extraction

#### YouTube Integration

```typescript
// lib/platforms/youtube.ts
export async function fetchYouTubeMetadata(channelId: string) {
  // Use YouTube Data API v3
  // Extract: channel name, description, avatar
  // Handle various URL formats
}
```

#### RSS Feed Validation

```typescript
// lib/platforms/rss.ts
export async function validateRssFeed(url: string) {
  // Fetch and parse feed
  // Extract: title, description, image
  // Validate feed structure
}
```

### 4. Topic Management

#### Component: `components/creators/topic-manager.tsx`

- Create new topics with color selection
- Assign multiple topics to creators
- Filter creators by topic
- Bulk topic operations

### 5. Bulk Import Feature

#### Component: `components/creators/bulk-import.tsx`

- CSV format support (name, url, topics)
- OPML import for RSS feeds
- Validation and error reporting
- Progress indication for large imports

## UI/UX Requirements

### Add Creator Flow

1. User pastes URL into smart input field
2. System shows loading state while detecting platform
3. Preview card shows detected creator info
4. User can assign topics before saving
5. Success confirmation with creator added to list

### Creator List View

- Grid or list layout toggle
- Show platform icon, name, description
- Topic badges on each creator card
- Quick actions: Edit, Delete, View Content
- Search and filter capabilities

### Error Handling

- Invalid URL: "This doesn't appear to be a valid creator URL"
- Duplicate creator: "You're already following this creator"
- Platform not supported: "This platform isn't supported yet"
- Network errors: "Unable to fetch creator information"

## Implementation Steps

### Phase 1: Core URL Detection (Week 1)

1. Create smart URL input component
2. Implement platform detection logic
3. Add basic creator storage
4. Create simple creator list view

### Phase 2: Metadata & Topics (Week 1-2)

1. Integrate platform APIs for metadata
2. Implement topic management
3. Add topic assignment UI
4. Create topic filtering

### Phase 3: Bulk Operations (Week 2)

1. Build CSV parser and validator
2. Create OPML import functionality
3. Add bulk import UI with progress
4. Implement error handling and reporting

## Success Metrics

- URL detection accuracy: 99%+
- Average time to add creator: <5 seconds
- Support for 5+ major platforms
- Successful import rate for bulk operations: 95%+

## Security Considerations

- Validate all URLs before processing
- Sanitize creator metadata before storage
- Rate limit API calls to external platforms
- Implement CSRF protection on endpoints

## Future Enhancements

- Browser extension for one-click adding
- Creator discovery recommendations
- Platform-specific features (e.g., YouTube playlists)
- Creator grouping and collections
