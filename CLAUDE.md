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

## Test Accounts

### LLM Test Account
For testing dashboard features with curator access:
- **Email**: `llm-test@dailynews.com`
- **Password**: `LLMTest123!@#`
- **Role**: Curator (can create/edit lounges and creators)
- **Login URL**: http://localhost:3000/auth/login

### Admin Accounts
- **steve@saasrise.com** - Admin role (magic link only)
- **stevecanfieldweb@gmail.com** - Admin role (Google OAuth)