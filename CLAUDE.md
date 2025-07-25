# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daily News is a content aggregation platform that unifies content from multiple social media platforms into a single, intelligent dashboard. Users can follow creators from YouTube, X (Twitter), LinkedIn, Threads, and RSS feeds while receiving AI-powered summaries and personalized digests.

### Technical Stack

- **Framework**: Next.js 15.2.4 with App Router
- **UI**: React 19, TypeScript 5, Tailwind CSS
- **Components**: 49 Shadcn/UI components with Radix UI
- **Authentication**: Supabase Auth (magic links, OAuth, email/password)
- **Database**: Supabase PostgreSQL with Row Level Security
- **Caching**: Upstash Redis for session management
- **AI Integration**: OpenAI for content summarization
- **Content Fetching**: Apify for social media, YouTube Data API, RSS Parser
- **Deployment**: Railway with automated deployments

## Current Development Status

**Phase**: Phase 3 - Advanced Features  
**Foundation**: ✅ Complete (100%)  
**Core Features**: ✅ Complete (100%)  
**Next Priority**: Email Digest System & Analytics

### Completed Features

#### Phase 1 - Foundation (✅ Complete)
- ✅ Multi-method authentication system
- ✅ User profiles with avatar uploads
- ✅ GDPR compliance suite
- ✅ Session management with security features
- ✅ 49 production-ready UI components
- ✅ Complete database schema for users

#### Phase 2 - Core Features (✅ Complete)
- ✅ Creator management with smart URL processing
- ✅ Multi-platform content ingestion (RSS, YouTube, X, LinkedIn, Threads)
- ✅ Automated content fetching with cron jobs
- ✅ Dashboard feed with infinite scroll
- ✅ AI-powered content summaries (dual-length)
- ✅ Real-time content updates

### In Progress (Phase 3)

- 🎯 Email Digest System
- 📋 Analytics Dashboard
- 📋 Advanced AI Features (thread summarization, topic extraction)

For detailed status, see `STATUS.md`

## Development Commands

```bash
# Install dependencies (ALWAYS use npm with legacy peer deps)
npm install --legacy-peer-deps

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch tests during development
npm run test:watch

# TypeScript type checking
npm run typecheck

# Auto-fix linting and formatting issues
npm run fix

# Run pre-commit checks
npm run precommit

# Full quality check
npm run quality
```

## Architecture Overview

### App Router Structure

The project uses Next.js 15 App Router with the following key routes:

- `/` - Landing page
- `/dashboard` - Main dashboard interface
- `/profile` - User profile and settings
- `/auth/*` - Authentication flows (login, signup, callback, error)
- `/api/*` - API routes for auth, GDPR compliance, and health checks

### Authentication Architecture

- **Supabase Integration**: Browser client created via `@supabase/ssr`
- **Magic Links**: Primary authentication method with rate limiting
- **Session Management**:
  - 30-minute default timeout, 24-hour maximum
  - Auto-refresh when session expires in < 5 minutes
  - Cross-tab session synchronization
- **Auth Utilities**: Comprehensive session utilities in `lib/supabase.ts`

### Component Organization

- **UI Components**: All Shadcn/UI components in `components/ui/`
- **Feature Components**: Domain-specific components (e.g., `components/profile/`)
- **Hooks**: Custom React hooks in `hooks/` including `use-auth.tsx` for authentication

### Data Layer

- **Supabase**: PostgreSQL database with Row Level Security
- **Redis**: Session caching via Upstash (see `lib/redis.ts`)
- **Environment Variables**: Required for Supabase and Redis connections

### MCP Configuration

**IMPORTANT**: This project uses the `mcp__supabase-saasrise` MCP server exclusively.

- **Organization**: steve-saasrise's Org (ID: kkvrlunjhuvbjrwjxhuf)
- **Project**: steve-saasrise's Project (ID: gtmynspbdgdlxgwlkpye)
- **Never use**: `mcp__supabase-mine` (different organization)
- **All database operations** must use the `mcp__supabase-saasrise__*` tools only

## LLM Development Workflow

### Starting a Development Session

1. **Read `STATUS.md`** - Get current project state and priorities
2. **Check feature docs** - Review `/docs/phase2/` for specifications
3. **Review recent commits** - Understand recent changes
4. **Select specific task** - Focus on one feature at a time

### During Development

- **Update STATUS.md** when starting major features
- **Commit frequently** with descriptive messages
- **Test thoroughly** before marking features complete
- **Document decisions** in commit messages or docs

### Ending a Session

1. **Update STATUS.md** with completion status
2. **Commit all changes** with comprehensive summary
3. **Note blockers** if any were encountered
4. **Update next steps** in STATUS.md

### Session Best Practices

- Focus on single features per session
- Maintain clear git history
- Keep STATUS.md as single source of truth
- Create feature docs for complex implementations

## Important Configuration

### Next.js Configuration

The project has specific build settings in `next.config.mjs`:

- ESLint checking enabled during builds for code quality
- TypeScript checking enabled during builds for type safety
- Image optimization enabled for better performance
- Typed routes enabled for better type safety

### Environment Variables Required

**Core Services**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for scripts only)
- `NEXT_PUBLIC_APP_URL` - Application URL (e.g., https://yourdomain.com)
- `UPSTASH_REDIS_REST_URL` - Redis URL for session management
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication token
- `CRON_SECRET` - Secret for securing cron job endpoints

**Content Fetching APIs**:
- `YOUTUBE_API_KEY` - YouTube Data API v3 key
- `APIFY_API_KEY` - Apify API key for X, LinkedIn, Threads scraping
- `OPENAI_API_KEY` - OpenAI API key for AI summaries

**Optional APIs** (for future features):
- `TWITTER_BEARER_TOKEN` - Twitter API v2 bearer token
- `LINKEDIN_API_KEY` - LinkedIn API credentials

### Git Hooks

The project uses Husky for Git hooks (configured via `npm run prepare`)

### Package Manager

**IMPORTANT**: Always use `npm` with `--legacy-peer-deps` for all package operations. Never use `pnpm` or `yarn`.

## Key Implementation Patterns

### Authentication Flow

1. User requests magic link via `/auth/login`
2. API route `/api/auth/magic-link` handles the request
3. Supabase sends email with callback URL
4. User clicks link, redirected to `/auth/callback`
5. Session established and user redirected to dashboard

### GDPR Compliance

The project includes GDPR-compliant features:

- Account deletion (`/api/gdpr/delete-account`)
- Data export (`/api/gdpr/export`)
- Consent management (`/api/gdpr/consent`)

### Session Management Pattern

- Sessions tracked with localStorage for cross-tab sync
- Activity monitoring for timeout detection
- Automatic cleanup on logout
- Enhanced logout clears all auth-related storage

## Development Priorities

### Phase 2 - Core Features (✅ Complete)

1. **Creator Management System** ✅
   - Smart URL detection for all platforms
   - Multi-platform support (YouTube, X, LinkedIn, Threads, RSS)
   - Topic management with inline creation
   - Bulk import via CSV/OPML

2. **Content Ingestion Pipeline** ✅
   - YouTube Data API integration
   - Apify integration for X, LinkedIn, Threads
   - RSS feed parsing
   - Automated cron job fetching (30-minute intervals)
   - Manual refresh with 6-hour cooldown

3. **Dashboard Feed Interface** ✅
   - Infinite scroll with dynamic batch sizing
   - Real-time updates via Supabase subscriptions
   - Platform filtering and search
   - Bookmark/save functionality
   - AI-powered content summaries

### Phase 3 - Advanced Features (Current Focus)

1. **Email Digest System** 🎯
   - Daily/weekly digest preferences
   - AI-summarized content selection
   - Personalized email templates
   - Unsubscribe management

2. **Analytics Dashboard** 📋
   - Content consumption metrics
   - Creator engagement tracking
   - Topic trend visualization
   - User activity insights

3. **Advanced AI Features** 📋
   - Thread and conversation summarization
   - Topic extraction and auto-tagging
   - Content recommendations
   - Trending topic identification

## Development Notes

- The project uses strict TypeScript configuration
- All UI components follow Shadcn/UI patterns with Radix UI primitives
- Authentication errors have specific handling for better UX
- The app is mobile-responsive with dedicated mobile detection hooks
- Phase 1 foundation is production-ready and fully tested
- **Testing**: Jest + React Testing Library setup with comprehensive coverage
- **Platform Detection**: Smart URL parsing service for YouTube, X, LinkedIn, Threads, RSS
- **AI Integration**: OpenAI for dual-length content summaries
- **Content Fetching**: 
  - YouTube Data API v3 for channel videos
  - Apify actors for X, LinkedIn, and Threads
  - RSS Parser for feed content
- **Deployment**: Railway with continuous deployment from GitHub

## Auto-Fix Standards

**IMPORTANT**: Claude Code must follow these auto-fix standards for code quality:

### Pre-Flight Checks

- ALWAYS run `npm run fix` before starting any development work
- ALWAYS run `npm run typecheck` to verify no TypeScript errors
- NEVER ignore TypeScript or ESLint errors
- NEVER commit code with linting warnings

### Code Quality Standards

- Remove all unused imports and variables immediately
- Replace `any` types with proper TypeScript interfaces
- Remove `console.log` statements from production code (use proper logging)
- Fix React hook dependency arrays
- Ensure proper error handling in catch blocks
- Use meaningful variable names (no single letters except for common iterators)

### Development Workflow

1. **Before starting work**: Run `npm run fix` and `npm run typecheck`
2. **During development**: Fix linting issues as they appear
3. **Before committing**: Git hooks automatically run `npm run fix` and `npm run typecheck`
4. **Never bypass**: TypeScript or ESLint errors - fix them immediately

### Automatic Fixes Applied

- ESLint auto-fix enabled in pre-commit hooks
- Prettier formatting applied automatically
- TypeScript compilation checked before commits
- Test runner integration for quality assurance

### Scripts for Code Quality

- `npm run fix`: Auto-fix linting and formatting
- `npm run typecheck`: Check TypeScript errors
- `npm run precommit`: Full pre-commit quality check
- `npm run quality`: Complete quality assessment

## Coding Pattern Preferences

### Core Principles

- **ALWAYS prefer simple solutions** - Configuration over code when possible
- **Before implementing anything**, ask:
  1. Is there a simpler configuration-only fix?
  2. Does this use existing patterns in the codebase?
  3. Am I introducing unnecessary complexity?
- **Avoid code duplication** - Check for existing similar functionality before writing new code
- **Environment awareness** - Code must work across dev, test, and prod environments
- **Surgical changes only** - Make only requested changes unless confident they're directly related

### Implementation Standards

- **Prefer existing patterns** over introducing new technologies
- **When fixing bugs**: Exhaust all options with existing implementation before new patterns
- **Remove old implementations** when introducing new patterns to avoid duplication
- **Keep codebase organized** - consistent file structure and naming
- **File size limit**: Keep files under 200-300 lines - refactor when exceeded
- **Avoid one-time scripts** in code files - use proper tooling instead

### Data & Environment Rules

- **Mocking**: Only for tests, never for dev or prod environments
- **No fake data**: Never add stubbing or fake data patterns to dev/prod code
- **Environment protection**: Never overwrite `.env` files without explicit confirmation
- **Database safety**: Always use migrations for schema changes

### Quality Assurance

- **TypeScript strictness**: Never use `any` - use proper types and interfaces
- **No unused code**: Remove unused imports, variables, and functions immediately
- **Clean console**: Remove `console.log` statements from production code
- **Proper error handling**: Always handle errors in catch blocks (no unused error variables)

## Platform Integration Gotchas

### Processing Status Requirement

**CRITICAL**: When implementing new platform fetchers (Twitter, LinkedIn, Threads, etc.), you MUST:

1. Update `lib/services/content-service.ts` line ~72 to include the new platform in the `processing_status` check
2. Content with `processing_status = 'pending'` will NOT appear in the dashboard
3. Only platforms explicitly set to `'processed'` will have their content displayed

Example:

```typescript
processing_status:
  validatedInput.platform === 'rss' ||
  validatedInput.platform === 'youtube' ||
  validatedInput.platform === 'twitter' ||
  validatedInput.platform === 'linkedin' ||
  validatedInput.platform === 'threads'  // All platforms now supported
    ? 'processed'
    : 'pending',
```

This was discovered during YouTube integration where content was being fetched and stored but not displaying because it remained in 'pending' status.

## Service Integrations

### AI Summary Service
- **Provider**: OpenAI API
- **Models**: GPT-4 Turbo for summaries
- **Features**: Dual-length summaries (short ≤30 words, long ≤100 words)
- **Implementation**: `lib/services/ai-summary-service.ts`

### Content Fetching Services
- **YouTube**: YouTube Data API v3 (`lib/content-fetcher/youtube-fetcher.ts`)
- **X/Twitter**: Apify Twitter Scraper actor
- **LinkedIn**: Apify LinkedIn Posts Scraper actor (and APImaestro for testing)
- **Threads**: Apify Instagram/Threads Scraper actor
- **RSS**: RSS Parser library (`lib/content-fetcher/rss-fetcher.ts`)

### Deployment
- **Platform**: Railway (replaced Vercel)
- **Features**: Automatic deployments from GitHub, cron job support
- **Environment**: All API keys configured in Railway dashboard

## Additional Resources

- **Product Requirements**: See `scripts/updated_prd.txt` for full PRD
- **Development Status**: See `STATUS.md` for current progress
- **Phase 2 Specs**: See `/docs/phase2/` for feature details
- **Session Logs**: See `/docs/sessions/` for development history
