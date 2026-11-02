# Supabase for The Commonplace

This directory contains the database schema and security rules for **The Commonplace** using **Supabase (PostgreSQL)**.

## Why This Schema Solves Prior Issues
1. **No More Permission Denied Bugs**: Powered by native PostgreSQL Row-Level Security (RLS) policies.
2. **True Relational Integrity**: Follow relationships, entries, comments, likes, and replies use foreign keys with `ON DELETE CASCADE`.
3. **Instant Counts**: Follower counts, review counts, and entry likes are computed with zero sync errors.
4. **Fast User & Handle Search**: Powered by PostgreSQL `pg_trgm` indexes for fast case-insensitive search (`ILIKE`).
5. **Atomic Handle Reservation**: Uses a standard database `UNIQUE` constraint on `handle`.

---

## Setup Instructions

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an account or sign in.
2. Click **New Project**, choose a project name (e.g. `the-commonplace`), select a database region close to your users, and set a secure database password.

### 2. Run the Schema Script
1. In your Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **New query**.
3. Copy and paste the entire contents of [`supabase/schema.sql`](./schema.sql).
4. Click **Run** (or `Cmd/Ctrl + Enter`).
5. You should see `Success. No rows returned`. All tables, indexes, functions, triggers, and Row-Level Security policies are now created and enabled!

### 3. Create Storage Buckets
1. In the Supabase Dashboard, open **Storage**.
2. Click **New bucket**:
   - Name: `avatars` (Set to **Public**)
   - Name: `covers` (Set to **Public**)
3. Under bucket policies, allow authenticated users to upload and delete their own files.

### 4. Enable Auth Providers
1. In the Supabase Dashboard, open **Authentication** -> **Providers**.
2. Enable **Email** (you can toggle confirm email on or off during dev).
3. (Optional) Enable **Google** or **Apple** OAuth if you use social sign-in.

### 5. Add Credentials to `.env.local`
1. In Supabase Dashboard, go to **Project Settings** -> **API**.
2. Copy your **Project URL** and **Project API Key (anon / public)**.
3. Paste them into your `.env.local`:
   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```
