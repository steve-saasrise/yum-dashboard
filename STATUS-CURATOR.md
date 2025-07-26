# Lounge.ai Curator Dashboard - Development Status

## 🎯 Project Pivot: From Daily News to Lounge.ai Curator Tool

**Date**: 2025-07-26  
**New Direction**: Transform existing dashboard into internal curator tool for Lounge.ai platform  
**Update**: 2025-07-26 - Completed renaming from "topic" to "lounge" throughout entire codebase and Supabase

### Founder's Vision (Simplified)

- **Curator's Role**: Select the top 50-100 creators per lounge
- **AI's Role**: Automatically curate and summarize the best content from those creators
- **No Manual Content Curation**: Curators choose creators, AI chooses content
- **Smart Architecture**: Curator dashboard = Public app + Creator management tools

---

## 🏗️ Architecture Overview

### Current State (Daily News)

- Personal dashboard where users follow creators
- ~~Topics~~ Lounges system (database tables and UI ready) ✅ RENAMED
- AI-powered content summaries
- Multi-platform content fetching

### Target State (Lounge.ai Curator Tool)

- Same dashboard, but for curators managing lounges
- ~~Topics → Lounges (simple rename)~~ ✅ COMPLETED
- Creators belong to lounges instead of users
- Public API for Lounge.ai consumption

---

## 📋 Implementation Plan (Minimal Changes)

### Phase 1: Topics → Lounges (Day 1-2)

#### Simple Renames

- [x] Rename "Topics" to "Lounges" in UI
- [x] Update TopicSelector to LoungeSelector throughout codebase
- [ ] Make sidebar Lounges functional (currently mock data)
- [x] Renamed database table from `topics` to `lounges`
- [ ] Add `subdomain` field to lounges table

**Note**: All references to "topic" have been renamed to "lounge" throughout the entire codebase and Supabase database to avoid confusion.

#### Simple Auth

- [ ] Create basic `curators` table (id, email, password_hash)
- [ ] Add `/curator/login` page
- [ ] Gate dashboard to curators only

### Phase 2: Creator Ownership Change (Day 3-4)

#### Database Updates

- [ ] Add `lounge_id` to creators table
- [ ] Update creator fetching to filter by lounge
- [ ] Migrate existing creators to appropriate lounges

#### UI Updates

- [ ] Add lounge selector in header
- [ ] Filter creators by selected lounge
- [ ] Update "Add Creator" to assign to current lounge

### Phase 3: Add Analytics (Day 5)

#### Simple Metrics

- [ ] Add to creator cards:
  - Last content date
  - Content count (30 days)
  - "Stale" indicator if no recent content
- [ ] Sort creators by performance

### Phase 4: Public API (Day 6-7)

#### API Endpoints

- [ ] `/api/lounges/[subdomain]/content` - Get lounge content
- [ ] `/api/lounges/[subdomain]/digest` - Get daily digest
- [ ] Basic caching with Redis

---

## 🔄 What Changes, What Stays

### Minimal Changes Needed

| Component         | Current      | Change Needed         |
| ----------------- | ------------ | --------------------- |
| Lounges table     | ✅ Exists    | Add `subdomain` field |
| LoungeSelector    | ✅ Works     | ✅ Renamed throughout |
| Sidebar Lounges   | Mock data    | Make functional       |
| Creator ownership | Per user     | Per lounge            |
| Authentication    | Public users | Curator login         |

### Everything Else Stays the Same

- Dashboard layout ✅
- Content feed ✅
- AI summaries ✅
- Platform fetching ✅
- Creator management UI ✅

---

## 🚀 Quick Start (Day 1)

```sql
-- 1. Add subdomain to lounges
ALTER TABLE lounges ADD COLUMN subdomain TEXT UNIQUE;

-- 2. Add lounge_id to creators
ALTER TABLE creators ADD COLUMN lounge_id UUID REFERENCES lounges(id);

-- 3. Create minimal curators table
CREATE TABLE curators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Database Changes Summary

### Step 1: Extend Existing Tables

```sql
-- Lounges table (already renamed from topics)
ALTER TABLE lounges ADD COLUMN subdomain TEXT UNIQUE;
UPDATE lounges SET subdomain = LOWER(REPLACE(name, ' ', '-'));

-- Creators belong to Lounges
ALTER TABLE creators ADD COLUMN lounge_id UUID REFERENCES lounges(id);
```

### Step 2: Add Curator Table

```sql
CREATE TABLE curators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

That's it! No complex migrations needed.

---

## 🎨 UI Changes (Minimal)

### Text Changes

- "Topics" → "Lounges" everywhere
- "Select topics" → "Select lounge"
- "Add to your creators" → "Add to this lounge"

### Functional Changes

- Sidebar lounges become clickable filters
- Add lounge dropdown in header
- Show curator email instead of user profile

### What Stays Exactly the Same

- Dashboard layout
- Creator cards
- Content feed
- All modals and forms

---

## 💡 Next Steps

### Today

1. [ ] Add `subdomain` to lounges table
2. [x] Rename Topics → Lounges in UI and codebase
3. [ ] Make sidebar functional

### Tomorrow

4. [ ] Add curator login
5. [ ] Change creator ownership model
6. [ ] Test with first lounge

### This Week

7. [ ] Add simple analytics
8. [ ] Create public API
9. [ ] Deploy curator version

---

_Last Updated: 2025-07-26_  
_Approach: Minimal changes, maximum reuse_  
_Time Estimate: 1 week total_
