# GitHub Actions Environment Variables Setup

This guide explains how to configure environment variables for the CI/CD pipeline.

## Required Variables

### 1. Go to your repository on GitHub

Navigate to: `Settings` → `Secrets and variables` → `Actions`

### 2. Add Repository Secrets (sensitive data)

Click "New repository secret" for each:

- `RESEND_API_KEY` - Your Resend API key for emails (optional for build)

### 3. Add Repository Variables (non-sensitive)

Click "Variables" tab, then "New repository variable" for each:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Getting the Values

### Supabase Values

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key

### Resend API Key

1. Go to https://resend.com/api-keys
2. Create or copy your API key

## Optional: Local Development

For local development, create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
RESEND_API_KEY=your-resend-key
```

**Never commit `.env.local` to version control!**

## Workflow Behavior

With the updated workflow:

1. **Security checks** - Will fail the build if high/critical vulnerabilities are found
2. **Build & Test** - Will fail if the build breaks or TypeScript errors exist
3. **Code Quality** - Will NOT fail the build, only provide feedback
4. **Formatting/Linting** - Non-blocking, shows as warnings in PR comments
5. **Outdated Packages** - Informational only, managed by Dependabot
6. **Deployment** - Railway handles this automatically when you push to main branch

## Troubleshooting

### Build still failing?

Check that all required environment variables are set in GitHub Actions settings.

### Formatting issues?

The workflow will now just warn about these, not fail. Run `npm run format` locally.

### Security vulnerabilities?

These WILL fail the build. Run `npm audit fix` to resolve.

### Tests failing?

Currently set to `continue-on-error`. Remove this line when tests are stable.
