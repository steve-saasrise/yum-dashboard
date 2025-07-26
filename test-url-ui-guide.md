# URL Editing Feature - Manual Testing Guide

## Overview
This guide walks through testing the new URL editing capabilities in the creator modal.

## Prerequisites
1. Application running on http://localhost:3000
2. Logged in user with at least one creator

## Test Cases

### 1. Edit Mode URL Display
1. Navigate to Dashboard
2. Find a creator and click the edit button (pencil icon)
3. **Verify**: Existing URLs are displayed with platform icons
4. **Verify**: URLs show correctly without "(new)" label

### 2. Add New URL to Existing Creator
1. In edit mode, enter a new URL in the input field
2. Click "Add" or press Enter
3. **Verify**: New URL appears with "(new)" label and dashed border
4. **Verify**: Platform icon is correct

### 3. Platform Duplicate Prevention
1. Try to add a URL from a platform that already exists
2. **Verify**: Error message appears: "A [platform] URL already exists for this creator"
3. **Verify**: The URL is not added to the list

### 4. Delete Existing URL
1. Click the X button on an existing URL badge
2. **Verify**: URL disappears from the list
3. **Verify**: If it's the last URL and no new URLs are added, the X button is disabled

### 5. Delete Protection for Last URL
1. Try to delete all URLs from a creator
2. **Verify**: When only one URL remains and no new URLs are added, you get an error toast:
   - Title: "Cannot delete URL"
   - Message: "A creator must have at least one URL"

### 6. Save Changes
1. Make various changes (add new URLs, delete some existing ones)
2. Click "Update Creator"
3. **Verify**: Modal closes
4. **Verify**: Success toast appears
5. Refresh the page and edit the creator again
6. **Verify**: All changes persisted correctly

### 7. Cancel Changes
1. Make some changes to URLs
2. Click "Cancel"
3. Edit the same creator again
4. **Verify**: No changes were saved

### 8. URL Validation
Test these URL formats:
- ✅ `https://youtube.com/@channel` - Should work
- ✅ `youtube.com/@channel` - Should auto-add https://
- ✅ `https://x.com/username` - Should work
- ✅ `https://linkedin.com/in/person` - Should work
- ✅ `https://threads.net/@user` - Should work
- ✅ `https://example.com/feed.rss` - Should work
- ❌ `not-a-url` - Should show error
- ❌ `@username` - Should show error

### 9. Performance Test
1. Edit a creator with multiple URLs
2. Quickly add and remove several URLs
3. **Verify**: UI remains responsive
4. **Verify**: No duplicate URLs appear

### 10. Error Handling
1. Turn off network (to simulate connection issues)
2. Try to save changes
3. **Verify**: Appropriate error message appears
4. Turn network back on

## Expected Behaviors

### Visual Indicators
- Existing URLs: Normal badge style
- New URLs to be added: Dashed border with "(new)" label
- Platform icons: Should match the detected platform

### Validation Rules
- At least one URL must remain per creator
- No duplicate platforms allowed
- URLs must be valid format

### API Endpoints Used
- GET `/api/creators/[id]/urls` - List URLs
- POST `/api/creators/[id]/urls` - Add new URL
- PUT `/api/creators/[id]/urls/[urlId]` - Update URL
- DELETE `/api/creators/[id]/urls/[urlId]` - Delete URL

## Known Limitations
- URL updates might change the platform if the domain changes significantly
- Platform detection is based on URL patterns, so non-standard URLs might be marked as "unknown"