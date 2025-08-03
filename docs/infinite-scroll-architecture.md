# Infinite Scroll Architecture

## Overview

The Daily News Dashboard implements infinite scroll using React Query's `useInfiniteQuery` hook combined with an Intersection Observer pattern. This document explains how the components work together to provide a smooth scrolling experience.

## Component Architecture

### 1. Data Fetching Layer (`/hooks/use-infinite-content.tsx`)

The `useInfiniteContent` hook manages data fetching and pagination:

```typescript
// Key features:
- Uses @tanstack/react-query's useInfiniteQuery
- Fetches 30 items per page (ITEMS_PER_PAGE)
- Maintains cache for 30 minutes
- Supports filtering by platform, creator, lounge, and search
- Default sort: newest first (published_at DESC)
```

**How it works:**

1. Initial page loads automatically when component mounts
2. Each page response includes:
   - `content`: Array of items for that page
   - `hasMore`: Boolean indicating if more pages exist
   - `nextPage`: Page number to fetch next (or null)
   - `total`: Total count of all items

3. All pages are flattened into a single array for rendering
4. Provides methods for save/unsave and delete/undelete operations

### 2. Display Layer (`/components/intersection-observer-grid.tsx`)

The `IntersectionObserverGrid` component handles the visual rendering and scroll detection:

**Key Features:**

- Limits DOM elements to 200 items maximum (MAX_ITEMS_IN_DOM)
- Supports both grid and list views
- Uses IntersectionObserver API for efficient scroll detection

**How the scroll detection works:**

1. **Observer Setup:**

   ```javascript
   const observer = new IntersectionObserver(
     (entries) => {
       const isVisible = entries[0].isIntersecting;
       // Trigger loading when visible
     },
     {
       threshold: 0, // Trigger as soon as element enters viewport
       rootMargin: '50% 0px', // Trigger when user is halfway through content
     }
   );
   ```

2. **Loading Trigger:**
   - A trigger element is placed at the bottom of the content
   - When this element becomes visible (or close to visible), it triggers `fetchNextPage()`
   - The `rootMargin: '50% 0px'` means loading starts when the user has scrolled 50% through the visible content

3. **DOM Optimization:**
   - Only keeps the last 200 items in DOM to prevent memory issues
   - Older items are removed as new ones are added

### 3. Main Dashboard (`/components/daily-news-dashboard.tsx`)

The dashboard component orchestrates everything:

1. Uses `useInfiniteContent` hook with current filters
2. Filters content based on user role (viewers don't see deleted content)
3. Passes filtered content to `IntersectionObserverGrid`
4. Manages UI state (view mode, filters, etc.)

## Data Flow

```
User Scrolls
    ↓
IntersectionObserver detects trigger element
    ↓
Calls fetchNextPage()
    ↓
useInfiniteContent makes API request
    ↓
GET /api/content?page=N&limit=30
    ↓
API returns next batch
    ↓
React Query adds to pages array
    ↓
Content re-renders with new items
```

## Performance Optimizations

### 1. iOS Optimizations (`/styles/safari-ios-fixes.css`)

- Hardware acceleration with `translateZ(0)`
- Momentum scrolling with `-webkit-overflow-scrolling: touch`
- Prevents layout shifts and repaints during scroll

### 2. DOM Management

- Limits rendered items to 200
- Uses `React.memo` for item components
- CSS containment for better rendering performance

### 3. Loading States

- Shows skeleton placeholders while loading
- Maintains scroll position during updates
- No layout shift when new content arrives

## Common Issues & Solutions

### Issue: Infinite loading without scrolling

**Cause:** The prefetch logic or trigger element positioning
**Solution:** Ensure trigger element is at the bottom of content, not above it

### Issue: Content jumping to old dates

**Cause:** Inconsistent sorting when items have same timestamp
**Solution:** Add secondary sort by ID for consistency

### Issue: Scroll performance on iOS

**Cause:** Too many DOM elements or missing iOS optimizations
**Solution:** Limit DOM elements and ensure iOS-specific CSS is applied

## Configuration

Key constants that can be adjusted:

- `ITEMS_PER_PAGE = 30` - Items fetched per request
- `MAX_ITEMS_IN_DOM = 200` - Maximum DOM elements
- `rootMargin: '50% 0px'` - How early to trigger loading
- Cache times in React Query config

## Testing Recommendations

1. Test with throttled network to ensure smooth loading
2. Test on actual iOS devices for scroll performance
3. Monitor memory usage with large datasets
4. Verify sort consistency across page boundaries
5. Test with different viewport sizes and orientations
