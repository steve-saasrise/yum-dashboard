# Deployment Guide

This document outlines the CI/CD pipeline setup and deployment process for the Yum Dashboard project.

## CI/CD Pipeline Overview

The project uses GitHub Actions for automated CI/CD with the following workflows:

### 1. Main CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

- **Code Quality & Security**: ESLint, Prettier, security audit
- **Build & Test**: TypeScript compilation, Next.js build, test execution
- **Type Check**: TypeScript type checking
- **Deploy**: Automated deployment to Vercel
- **Lighthouse Audit**: Performance auditing (main branch only)
- **Dependency Review**: Security review for PRs

### 2. Deployment Status (`.github/workflows/deployment-status.yml`)

Tracks deployment status and provides notifications on success/failure.

### 3. Dependency Updates (`.github/workflows/dependency-updates.yml`)

**Schedule:** Every Monday at 9 AM UTC

- Automatically updates patch and minor versions
- Applies security fixes
- Creates PRs for review

## Required GitHub Secrets

To enable the CI/CD pipeline, configure the following secrets in your GitHub repository:

### Vercel Integration

```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
```

### How to Get Vercel Secrets

1. **VERCEL_TOKEN**:
   - Go to [Vercel Account Settings](https://vercel.com/account/tokens)
   - Create a new token with appropriate permissions
   - Copy the token value

2. **VERCEL_ORG_ID** and **VERCEL_PROJECT_ID**:
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel login` and authenticate
   - In your project directory, run `vercel link`
   - The IDs will be saved in `.vercel/project.json`

## Environment Variables

The application supports the following environment variables:

### Required for Production

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Next.js Configuration
NEXTAUTH_URL=your_production_url
NEXTAUTH_SECRET=your_nextauth_secret
```

### Optional

```env
# Development
NODE_ENV=development|production
SKIP_ENV_VALIDATION=true # Skip env validation in CI
```

## Deployment Process

### Automatic Deployment

1. **Pull Request**: Creates preview deployment
2. **Main Branch**: Deploys to production
3. **Develop Branch**: Deploys to staging (if configured)

### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Performance Monitoring

### Lighthouse Audits

Automatic performance audits run on production deployments with the following thresholds:

- **Performance**: 80%
- **Accessibility**: 90%
- **Best Practices**: 90%
- **SEO**: 90%
- **PWA**: 80%

### Monitoring Setup

Configure monitoring in `lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.8 }]
      }
    }
  }
}
```

## Security

### Dependency Security

- **Automated Audits**: Run on every CI build
- **Dependency Review**: Checks for security vulnerabilities in PRs
- **Allowed Licenses**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC

### Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **Token Permissions**: Use minimal required permissions for tokens
3. **Regular Updates**: Automated dependency updates every Monday
4. **Audit Logs**: Monitor deployment and access logs

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check TypeScript errors: `npm run build`
   - Verify environment variables are set
   - Review ESLint warnings: `npm run lint`

2. **Deployment Failures**:
   - Verify Vercel secrets are configured
   - Check Vercel project settings
   - Review deployment logs in Vercel dashboard

3. **Performance Issues**:
   - Review Lighthouse audit results
   - Check bundle size analysis
   - Monitor Core Web Vitals

### Debug Commands

```bash
# Check build locally
npm run build

# Run type checking
npx tsc --noEmit

# Check formatting
npm run format:check

# Security audit
npm audit

# Check outdated packages
npm outdated
```

## Branch Strategy

- **main**: Production branch, auto-deploys to production
- **develop**: Development branch, auto-deploys to staging
- **feature/**: Feature branches, create preview deployments via PRs

## Rollback Process

1. **Vercel Dashboard**: Use Vercel's rollback feature
2. **Git Revert**: Revert problematic commit and push
3. **Manual Deploy**: Deploy previous working commit

```bash
# Revert last commit
git revert HEAD

# Deploy specific commit
vercel --prod --confirm
```

## Monitoring and Alerts

### Recommended Monitoring Setup

1. **Vercel Analytics**: Built-in performance monitoring
2. **Sentry**: Error tracking and performance monitoring
3. **Uptime Monitoring**: Service like Pingdom or UptimeRobot
4. **Log Aggregation**: Centralized logging solution

### Key Metrics to Monitor

- **Response Time**: < 2 seconds
- **Error Rate**: < 1%
- **Availability**: > 99.9%
- **Core Web Vitals**: LCP, FID, CLS
