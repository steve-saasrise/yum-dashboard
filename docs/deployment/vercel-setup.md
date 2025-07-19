# Vercel Deployment Setup

## Environment Variables

When deploying to Vercel, you need to set the following environment variables in your Vercel project settings:

### Required Variables

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://your-project.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous key (safe for browser)
   - Found in Supabase project settings

3. **UPSTASH_REDIS_REST_URL**
   - Your Upstash Redis REST URL
   - Example: `https://your-redis.upstash.io`

4. **UPSTASH_REDIS_REST_TOKEN**
   - Your Upstash Redis REST token
   - Found in Upstash console

5. **CRON_SECRET**
   - A secure random string to protect cron endpoints
   - Generate with: `openssl rand -base64 32`
   - **Important**: This must match the value in your Vercel environment

### Optional Variables (for future features)

- **YOUTUBE_API_KEY** - For YouTube content fetching
- **TWITTER_BEARER_TOKEN** - For Twitter content fetching

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Make sure to select the appropriate environments (Production, Preview, Development)

## Cron Job Configuration

The automated content fetching is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-content",
      "schedule": "0 */30 * * *" // Runs every 30 minutes
    }
  ]
}
```

### Testing Cron Jobs Locally

To test the cron endpoint locally:

```bash
# Without authentication (works in development)
curl http://localhost:3000/api/cron/fetch-content

# With authentication (mimics production)
curl http://localhost:3000/api/cron/fetch-content \
  -H "Authorization: Bearer your-secure-cron-secret-here"
```

### Monitoring Cron Jobs

1. Check Vercel Functions logs for execution history
2. The endpoint returns statistics about content fetched
3. Failed fetches are logged but don't stop the process

## Security Notes

- The `CRON_SECRET` prevents unauthorized access to your cron endpoints
- In development, the cron endpoint works without authentication for testing
- In production (when `VERCEL` env var is set), authentication is required
- Never commit `.env.local` to version control
