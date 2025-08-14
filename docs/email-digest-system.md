# Email Digest System Documentation

## Overview

The Daily News Email Digest System sends automated daily email digests to users, featuring curated content from 7 different lounges. Each lounge represents a specific topic area (AI, B2B Growth, Biohacking, Crypto, Personal Growth, SaaS, Venture).

## Email Service Provider: Resend

The system uses **[Resend](https://resend.com)** as the email service provider. Resend is a modern email API designed for developers that provides:

- Simple API for sending transactional emails
- React Email template support
- Excellent deliverability
- Built-in analytics and tracking
- Developer-friendly pricing

### Configuration Required

- **Environment Variable**: `RESEND_API_KEY` must be set with your Resend API key
- **From Email**: Configured via `EMAIL_FROM` env var (defaults to `Daily News <noreply@dailynews.app>`)

## System Architecture

### 1. Email Template (`/emails/daily-digest.tsx`)

A React Email component that generates responsive HTML emails with:

- **Header**: Daily News logo and current date
- **Lounge Section**: Name and description of the specific lounge
- **Content Items**: Up to 10 posts displayed with:
  - Platform icon (🎥 YouTube, 𝕏 Twitter, 💼 LinkedIn, etc.)
  - Creator name
  - Post title
  - AI-generated summary (when available)
  - Thumbnail image (when available)
  - "View Original" button linking to source content
- **Footer**: Unsubscribe link, email preferences, and copyright

### 2. Digest Service (`/lib/services/digest-service.ts`)

Core service that handles all digest generation logic:

#### Key Methods:

- **`getLounges()`**: Fetches all 7 system lounges from database
- **`getContentForLounge(loungeId, limit)`**:
  - Retrieves creators associated with a lounge
  - Fetches recent content from those creators
  - Implements YouTube prioritization (ensures at least 1 YouTube video)
  - Returns up to 10 content items
- **`sendLoungeDigest(lounge, email)`**:
  - Generates and sends a single lounge digest
  - Uses Resend API to send the email
  - Updates last_sent timestamp
- **`sendDailyDigests(email)`**:
  - Sends all 7 lounge digests to a user
  - Adds 1-second delay between emails to avoid rate limiting

#### YouTube Prioritization Logic:

```javascript
1. Separate content into YouTube videos and other posts
2. Add 1 YouTube video first (if available)
3. Fill remaining slots with other content
4. If slots remain and more YouTube videos exist, add them
5. Return exactly 10 items (or less if insufficient content)
```

### 3. Cron Job (`/app/api/cron/send-daily-digest/route.ts`)

Automated endpoint triggered daily at 6am PT:

- Protected by `CRON_SECRET` authentication
- Fetches all users subscribed to daily digests
- Sends 7 emails per user (one for each lounge)
- Tracks success/error counts
- Falls back to admin email for testing if no subscribers

### 4. Test Endpoint (`/app/api/test-digest/route.ts`)

Admin-only endpoint for testing and previewing digests:

#### GET Request Options:

- `?preview=true` - Preview content without sending email
- `?loungeId=xxx` - Test specific lounge
- `?email=xxx` - Send to specific email address

#### POST Request Body:

```json
{
  "loungeId": "uuid", // Optional: specific lounge
  "email": "test@example.com", // Target email
  "sendAll": true // Send all lounges
}
```

## Database Schema

### Tables Used:

1. **`lounges`**: System lounges (7 total)
   - `id`: UUID
   - `name`: Lounge name (AI, SaaS, etc.)
   - `description`: Brief description
   - `is_system_lounge`: Boolean flag

2. **`creator_lounges`**: Links creators to lounges
   - `creator_id`: UUID
   - `lounge_id`: UUID
   - `relevance_score`: Float (optional)

3. **`content`**: Stores all fetched content
   - `creator_id`: Links to creator
   - `platform`: Content source platform
   - `title`, `description`: Content details
   - `ai_summary_short`: AI-generated summary
   - `thumbnail_url`: Image for display
   - `published_at`: Publication timestamp

4. **`email_digests`**: Tracks user digest preferences
   - `user_id`: UUID
   - `frequency`: 'daily', 'weekly', etc.
   - `last_sent`: Timestamp
   - `active`: Boolean
   - `lounges_included`: JSONB array

## Deployment Configuration

### Vercel Cron Schedule (`/vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/send-daily-digest",
      "schedule": "0 14 * * *" // 2pm UTC = 6am PT
    }
  ]
}
```

### Environment Variables Required:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="Daily News <noreply@dailynews.app>"

# Supabase (for database access)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx  # For server-side operations

# Security
CRON_SECRET=xxx  # For authenticating cron jobs

# Optional
DIGEST_TEST_EMAIL=admin@example.com  # Default test recipient
```

## Testing Guide

### 1. Preview Digest Content (No Email Sent)

```bash
# Preview first lounge with content
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/test-digest?preview=true"

# Preview specific lounge
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/test-digest?preview=true&loungeId=LOUNGE_UUID"
```

### 2. Send Test Digest

```bash
# Send all lounges to your email
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/test-digest?email=your@email.com"

# Send specific lounge
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"loungeId":"UUID","email":"test@email.com"}' \
  http://localhost:3000/api/test-digest
```

### 3. Trigger Cron Job Manually

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/send-daily-digest
```

## Production Workflow

1. **Daily at 6am PT**: Vercel triggers the cron job
2. **Authentication**: Cron secret is verified
3. **User Query**: System fetches all active digest subscribers
4. **Content Gathering**: For each user and each lounge:
   - Get creators in that lounge
   - Fetch latest 20 posts from those creators
   - Apply YouTube prioritization
   - Select top 10 items
5. **Email Generation**: React Email template renders HTML
6. **Sending**: Resend API delivers emails
7. **Tracking**: Last sent timestamps updated

## Monitoring & Debugging

### Check Logs:

- Vercel Functions logs show cron execution
- Console logs track email sending progress
- Resend dashboard shows delivery status

### Common Issues:

1. **No content in digest**: Check if creators are assigned to lounges
2. **Emails not sending**: Verify RESEND_API_KEY is set
3. **Cron not running**: Check CRON_SECRET matches
4. **Wrong timezone**: Remember cron uses UTC time

## Future Enhancements

1. **User Preferences**:
   - Allow users to select specific lounges
   - Choose delivery time
   - Set frequency (daily/weekly)

2. **Content Improvements**:
   - Better AI summaries with GPT-4
   - Topic clustering within lounges
   - Trending content detection

3. **Analytics**:
   - Track open rates via Resend
   - Click tracking on "View Original" buttons
   - User engagement metrics

## API Rate Limits

- **Resend**: 100 emails/second (more than sufficient)
- **Supabase**: No hard limits, but batch queries recommended
- **Cron**: Vercel allows daily execution without issues

## Cost Considerations

- **Resend**: Free tier includes 3,000 emails/month
- **With 7 lounges × 30 days**: ~210 emails per user per month
- **Supports**: ~14 active users on free tier
- **Paid tier**: $20/month for 50,000 emails

---

_Last Updated: 2025-08-14_
_Author: Claude (AI Assistant)_
