# Production Session Persistence Fix

## Problem

User roles and session data were being lost on page refresh in production when using Cloudflare proxy with Railway deployment, while working correctly in local development.

## Root Causes Identified

1. **Cookie Domain Mismatch**: Cookies were being set for the Railway domain instead of the actual domain users access through Cloudflare
2. **Secure Cookie Issues**: Cloudflare terminates SSL, causing Railway to see HTTP internally, preventing secure cookies from being set
3. **Missing Proxy Trust Configuration**: The application wasn't properly handling proxy headers from Cloudflare

## Solutions Applied

### 1. Cookie Configuration Updates (`lib/supabase.ts`)

- Removed automatic domain setting to let browsers handle it correctly with proxies
- Always set `Secure` flag in production regardless of perceived protocol
- Maintained `SameSite=Lax` for compatibility

### 2. Middleware Updates (`middleware.ts`)

- Added proxy header detection (`x-forwarded-proto`, `x-forwarded-host`)
- Dynamic origin URL detection based on actual request headers
- Proper cookie configuration for proxied requests

### 3. Server-Side Client Updates (`utils/supabase/server.ts`)

- Modified cookie setting to work with Cloudflare proxy
- Removed domain specification for better proxy compatibility
- Enforced secure cookies in production

### 4. Auth Callback Updates (`app/auth/callback/route.ts`)

- Added proxy-aware origin detection
- Updated cookie configuration for Cloudflare compatibility

### 5. New Proxy Configuration Helper (`lib/proxy-config.ts`)

- Centralized proxy detection and configuration
- Handles Cloudflare-specific headers
- Provides consistent cookie options across the application

## Environment Variable Configuration

**IMPORTANT**: Update your production environment variables:

### In Railway:

1. If using a custom domain through Cloudflare (e.g., `https://yourdomain.com`):

   ```
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. If not using a custom domain, keep the Railway URL:
   ```
   NEXT_PUBLIC_APP_URL=https://yum-dashboard.railway.app
   ```

### In Cloudflare:

1. Ensure SSL/TLS encryption mode is set to "Full" or "Full (strict)"
2. Under Page Rules or Configuration Rules:
   - Disable "Rocket Loader" for your domain
   - Set "Browser Cache TTL" to "Respect Existing Headers"

3. For cookies to work properly:
   - Ensure "Always Use HTTPS" is enabled
   - Set "Automatic HTTPS Rewrites" to ON

## Testing the Fix

1. Clear all cookies and local storage for your production domain
2. Log in to your application
3. Refresh the page - your session and user role should persist
4. Open browser DevTools > Application > Cookies to verify:
   - Cookies should be set for your actual domain (not Railway's)
   - Cookies should have `Secure` flag set
   - Cookies should have `SameSite=Lax`

## Additional Debugging

If issues persist:

1. Check browser console for any cookie-related warnings
2. In production, check Railway logs for any authentication errors
3. Verify Supabase environment variables are correctly set in Railway
4. Ensure your Supabase project allows your production domain in Authentication > URL Configuration

## Rollback

If you need to rollback these changes:

1. The previous cookie configuration explicitly set domains
2. The previous configuration didn't account for proxy headers
3. Cookies were only set as Secure when HTTPS was detected directly

The new configuration is more robust and handles proxy scenarios correctly.
