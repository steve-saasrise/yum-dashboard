# Magic Link Setup Guide

This guide explains how to configure magic links with enhanced security, rate limiting, and custom email templates.

## Overview

Our magic link implementation includes:

- ✅ **Rate limiting** - Prevents spam and abuse
- ✅ **Enhanced error handling** - User-friendly error messages
- ✅ **Security measures** - Proper token validation and expiry
- ✅ **Custom email templates** - Branded email experience
- ✅ **Expired link handling** - Graceful error recovery

## Implementation Details

### 1. Rate Limiting

Magic links are rate-limited to prevent abuse:

- **Max attempts**: 5 per 15-minute window
- **Cooldown**: 1 minute between requests
- **IP + Email based**: Rate limiting is per IP address and email combination

### 2. Enhanced Error Handling

The system provides user-friendly error messages for:

- Expired magic links (1-hour expiry)
- Invalid or already-used links
- Rate limit exceeded
- Network errors

### 3. API Endpoints

#### `POST /api/auth/magic-link`

Sends a magic link with rate limiting and validation.

**Request Body:**

```json
{
  "email": "user@example.com",
  "redirectTo": "https://yourapp.com/auth/callback" // optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Magic link sent successfully",
  "email": "user@example.com",
  "expiresIn": 3600
}
```

#### `GET /api/auth/magic-link?email=user@example.com`

Check rate limit status for an email.

**Response:**

```json
{
  "email": "user@example.com",
  "rateLimited": false,
  "resetTime": null,
  "remainingTime": 0
}
```

### 4. Enhanced Authentication Hook

The `useAuth` hook now includes:

- Rate limit checking before sending magic links
- Better error handling and user feedback
- Support for custom redirect URLs

**Usage:**

```typescript
const { signInWithMagicLink } = useAuth();

// Basic usage
await signInWithMagicLink('user@example.com');

// With custom redirect
await signInWithMagicLink('user@example.com', '/dashboard');
```

## Supabase Configuration

### 1. Email Templates

Configure custom email templates in the Supabase Dashboard:

1. Go to **Authentication** → **Email Templates**
2. Select **Magic Link** template
3. Use the following template:

**Subject:**

```
Sign in to {{ .SiteURL }}
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in to Your App</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .button {
        display: inline-block;
        padding: 12px 24px;
        background: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer {
        color: #666;
        font-size: 14px;
        margin-top: 20px;
      }
      .warning {
        background: #fff3cd;
        padding: 15px;
        border-radius: 5px;
        margin: 20px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Sign in to Your App</h1>
      </div>

      <p>Hello,</p>

      <p>Click the button below to sign in to your account:</p>

      <a href="{{ .ConfirmationURL }}" class="button">Sign In</a>

      <div class="warning">
        <strong>⚠️ Important:</strong> This link will expire in 1 hour for
        security reasons. If you didn't request this email, you can safely
        ignore it.
      </div>

      <p>
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

      <div class="footer">
        <p>This email was sent to {{ .Email }}.</p>
        <p>If you have any questions, please contact our support team.</p>
      </div>
    </div>
  </body>
</html>
```

### 2. Authentication Settings

Configure these settings in **Authentication** → **Settings**:

1. **Site URL**: Set to your production domain
2. **Redirect URLs**: Add your callback URLs
3. **Email Confirmations**: Enable for magic links
4. **Rate Limiting**:
   - Email requests: 5 per hour
   - SMS requests: 5 per hour

### 3. Email Provider Configuration

For production, configure a custom email provider:

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Configure your email provider (SendGrid, Mailgun, etc.)
3. Test the configuration

**Example SendGrid Configuration:**

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [Your SendGrid API Key]
```

## Environment Variables

Add these environment variables to your `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
NEXT_PUBLIC_APP_URL=https://yourapp.com

# Email Configuration (optional - for custom SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

## Testing Magic Links

### 1. Development Testing

```bash
# Start the development server
npm run dev

# Test the magic link endpoint
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 2. Rate Limiting Test

```bash
# Test rate limiting by sending multiple requests
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
  echo "Request $i completed"
done
```

### 3. Frontend Testing

```typescript
// Test rate limiting in your React component
const testRateLimit = async () => {
  for (let i = 0; i < 6; i++) {
    try {
      await signInWithMagicLink('test@example.com');
      console.log(`Request ${i + 1} succeeded`);
    } catch (error) {
      console.log(`Request ${i + 1} failed:`, error.message);
    }
  }
};
```

## Production Considerations

### 1. Database Rate Limiting

For production, replace the in-memory rate limiting with Redis:

```typescript
// lib/rate-limit.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 900); // 15 minutes
  }
  return count;
}
```

### 2. Monitoring and Alerts

Set up monitoring for:

- Magic link success/failure rates
- Rate limiting events
- Email delivery failures

### 3. Security Headers

Add security headers to your Next.js config:

```javascript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};
```

## Troubleshooting

### Common Issues

1. **Magic links not working**
   - Check Supabase email settings
   - Verify redirect URLs are configured
   - Check spam folder

2. **Rate limiting too strict**
   - Adjust `rateLimitConfig` in `lib/supabase.ts`
   - Consider different limits for different user types

3. **Email delivery issues**
   - Configure custom SMTP provider
   - Check email provider reputation
   - Monitor bounce rates

### Debug Mode

Enable debug mode for detailed logging:

```typescript
// In your API route
if (process.env.NODE_ENV === 'development') {
  console.log('Debug: Magic link request', { email, ip, rateLimitKey });
}
```

## Security Best Practices

1. **Always use HTTPS** in production
2. **Validate email addresses** before sending magic links
3. **Implement proper rate limiting** to prevent abuse
4. **Monitor for suspicious activity** (multiple requests from same IP)
5. **Use secure cookies** for session management
6. **Implement CSP headers** to prevent XSS attacks

## Support

If you encounter issues:

1. Check the error logs in the callback route
2. Verify Supabase configuration
3. Test with a simple email client
4. Contact support with specific error messages

---

**Last updated**: [Current Date]
**Version**: 1.0.0
