-- ==============================================================================
-- The Commonplace - Supabase (PostgreSQL) Initial Schema & Security Rules (RLS)
-- ==============================================================================

-- 1. Enable UUID Extension & Helper Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- For fast fuzzy & handle search

-- ------------------------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  handle text unique not null,
  first_name text default '',
  last_name text default '',
  name text default '',
  bio text default '',
  avatar_url text default '',
  cover_url text default '',
  birthdate date,
  is_private boolean default false not null,
  show_full_name boolean default true not null,
  allow_comments boolean default true not null,
  account_status text default 'active' check (account_status in ('active', 'deactivated')) not null,
  reactivates_at timestamptz,
  deactivation_reason text default '',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Fast case-insensitive search index for @handle and user name
create index if not exists idx_profiles_handle_lower on public.profiles (lower(handle));
create index if not exists idx_profiles_handle_trgm on public.profiles using gin (handle gin_trgm_ops);
create index if not exists idx_profiles_name_trgm on public.profiles using gin (name gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- USER CLOUD STATE (Private per-user app state like liked ids, saved entries)
-- ------------------------------------------------------------------------------
create table if not exists public.user_cloud_state (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  liked_entry_ids text[] default '{}' not null,
  saved_entries jsonb default '[]'::jsonb not null,
  followed_user_handles text[] default '{}' not null,
  follow_requested_handles text[] default '{}' not null,
  disabled_comment_entry_ids text[] default '{}' not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------------------------
-- FOLLOWS
-- ------------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  target_handle text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_follows_follower on public.follows (follower_id);

-- ------------------------------------------------------------------------------
-- FOLLOW REQUESTS (For Private Profiles)
-- ------------------------------------------------------------------------------
create table if not exists public.follow_requests (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (requester_id, target_id)
);

create index if not exists idx_follow_requests_target on public.follow_requests (target_id, status);

-- ------------------------------------------------------------------------------
-- ENTRIES (Posts / Catalog items / Quotes)
-- ------------------------------------------------------------------------------
create table if not exists public.entries (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  creator text default '',
  year text default '',
  genre text default '',
  summary text default '',
  cover_url text default '',
  cover_tone text default '',
  artwork_url text default '',
  rating numeric default 0,
  quote text default '',
  favorite_passage text default '',
  passage_align text default 'left',
  reflection text default '',
  reflection_align text default 'left',
  lyrics text default '',
  provider text default '',
  provider_id text default '',
  enable_drop_cap boolean default false,
  prefer_wikipedia_artwork boolean default false,
  explicit boolean default false,
  notable_lines text[] default '{}' not null,
  tags text[] default '{}' not null,
  visibility text default 'public' check (visibility in ('public', 'mutual', 'private')) not null,
  comments_disabled boolean default false not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_entries_owner on public.entries (owner_id, created_at desc);
create index if not exists idx_entries_visibility on public.entries (visibility, created_at desc);

-- ------------------------------------------------------------------------------
-- ENTRY LIKES
-- ------------------------------------------------------------------------------
create table if not exists public.entry_likes (
  entry_id text references public.entries(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (entry_id, user_id)
);

create index if not exists idx_entry_likes_entry on public.entry_likes (entry_id);

-- ------------------------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------------------------
create table if not exists public.comments (
  id text primary key,
  entry_id text references public.entries(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_comments_entry on public.comments (entry_id, created_at asc);

-- ------------------------------------------------------------------------------
-- COMMENT LIKES
-- ------------------------------------------------------------------------------
create table if not exists public.comment_likes (
  comment_id text references public.comments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (comment_id, user_id)
);

-- ------------------------------------------------------------------------------
-- COMMENT REPLIES
-- ------------------------------------------------------------------------------
create table if not exists public.comment_replies (
  id text primary key,
  comment_id text references public.comments(id) on delete cascade not null,
  entry_id text references public.entries(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  reply_to_user_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_replies_comment on public.comment_replies (comment_id, created_at asc);

-- ------------------------------------------------------------------------------
-- REPLY LIKES
-- ------------------------------------------------------------------------------
create table if not exists public.reply_likes (
  reply_id text references public.comment_replies(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (reply_id, user_id)
);

-- ------------------------------------------------------------------------------
-- COLLECTIONS
-- ------------------------------------------------------------------------------
create table if not exists public.collections (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  kind text default 'created' check (kind in ('created', 'saved')) not null,
  title text not null,
  description text default '',
  cover_url text default '',
  visibility text default 'public' check (visibility in ('public', 'private')) not null,
  item_ids text[] default '{}' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_collections_owner on public.collections (owner_id, kind);

-- ------------------------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------------------------
create table if not exists public.notifications (
  id text primary key,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('follow', 'follow_request', 'follow_accept', 'like', 'comment', 'reply', 'birthday')),
  interaction_id text default '',
  entry_id text references public.entries(id) on delete cascade,
  comment_id text,
  read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_notifications_recipient on public.notifications (recipient_id, created_at desc);

-- ------------------------------------------------------------------------------
-- REPORTS
-- ------------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('profile', 'entry', 'comment', 'reply')),
  target_id text not null,
  reason text not null,
  details text default '',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Mutual Follow Check Helper
create or replace function public.is_mutual_follow(user_a uuid, user_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.follows where follower_id = user_a and following_id = user_b
  ) and exists (
    select 1 from public.follows where follower_id = user_b and following_id = user_a
  );
$$;

-- Profile Content Readability Helper (Owner, Public, or Follower)
create or replace function public.can_read_profile_content(target_user_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select auth.uid() = target_user_id
    or exists (
      select 1 from public.profiles p
      where p.id = target_user_id
        and p.account_status = 'active'
        and (
          p.is_private = false
          or exists (
            select 1 from public.follows
            where follower_id = auth.uid() and following_id = target_user_id
          )
        )
    );
$$;

-- Automatic updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create or replace trigger on_entries_updated
  before update on public.entries
  for each row execute procedure public.handle_updated_at();

create or replace trigger on_comments_updated
  before update on public.comments
  for each row execute procedure public.handle_updated_at();

-- Automatically create profile row when user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_handle text;
  clean_handle text;
begin
  raw_handle := coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1));
  clean_handle := lower(regexp_replace(raw_handle, '[^a-zA-Z0-9_]', '', 'g'));

  insert into public.profiles (
    id,
    handle,
    name,
    first_name,
    last_name,
    avatar_url
  ) values (
    new.id,
    clean_handle,
    coalesce(new.raw_user_meta_data->>'name', clean_handle),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_cloud_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.user_cloud_state enable row level security;
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.entries enable row level security;
alter table public.entry_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_replies enable row level security;
alter table public.reply_likes enable row level security;
alter table public.collections enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- Profiles
create policy "Public profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- User Cloud State
create policy "Users manage their own cloud state"
  on public.user_cloud_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Follows
create policy "Anyone can read follows"
  on public.follows for select
  using (auth.role() = 'authenticated');

create policy "Users can follow other accounts"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and (
      not exists (
        select 1 from public.profiles
        where id = following_id and is_private = true
      )
      or exists (
        select 1 from public.follow_requests
        where requester_id = auth.uid() and target_id = following_id and status = 'accepted'
      )
    )
  );

create policy "Target can accept follow requests into follows"
  on public.follows for insert
  with check (
    auth.uid() = following_id
  );

create policy "Users can unfollow accounts"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- Follow Requests
create policy "Users can view their incoming and outgoing requests"
  on public.follow_requests for select
  using (auth.uid() = requester_id or auth.uid() = target_id);

create policy "Users can create follow requests"
  on public.follow_requests for insert
  with check (auth.uid() = requester_id and status = 'pending');

create policy "Target can update request status (accept/reject)"
  on public.follow_requests for update
  using (auth.uid() = target_id);

create policy "Users can delete their requests"
  on public.follow_requests for delete
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- Entries
create policy "Users can view accessible entries"
  on public.entries for select
  using (
    auth.uid() = owner_id
    or (
      visibility = 'public' and public.can_read_profile_content(owner_id)
    )
    or (
      visibility = 'mutual' and public.is_mutual_follow(auth.uid(), owner_id)
    )
  );

create policy "Users can insert their own entries"
  on public.entries for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own entries"
  on public.entries for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own entries"
  on public.entries for delete
  using (auth.uid() = owner_id);

-- Entry Likes
create policy "Accessible entry likes are readable"
  on public.entry_likes for select
  using (auth.role() = 'authenticated');

create policy "Users can like entries"
  on public.entry_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike entries"
  on public.entry_likes for delete
  using (auth.uid() = user_id);

-- Comments & Replies
create policy "Accessible comments are readable"
  on public.comments for select
  using (exists (select 1 from public.entries e where e.id = entry_id));

create policy "Users can insert comments on accessible entries"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.comments_disabled = false
    )
  );

create policy "Users can delete their own comments or post owner can delete"
  on public.comments for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
  );

create policy "Accessible replies are readable"
  on public.comment_replies for select
  using (exists (select 1 from public.comments c where c.id = comment_id));

create policy "Users can reply to accessible comments"
  on public.comment_replies for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.comments_disabled = false
    )
  );

create policy "Users can delete their own replies or post owner can delete"
  on public.comment_replies for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid())
  );

-- Notifications
create policy "Users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

create policy "System/Users can insert notifications"
  on public.notifications for insert
  with check (auth.uid() = actor_id and actor_id <> recipient_id);

create policy "Users can update read status on their notifications"
  on public.notifications for update
  using (auth.uid() = recipient_id);

create policy "Users can delete their notifications"
  on public.notifications for delete
  using (auth.uid() = recipient_id or auth.uid() = actor_id);

-- Collections
create policy "Accessible collections are viewable"
  on public.collections for select
  using (
    auth.uid() = owner_id
    or (visibility = 'public' and public.can_read_profile_content(owner_id))
  );

create policy "Users manage their own collections"
  on public.collections for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Reports
create policy "Authenticated users can submit reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Enable Realtime for follows, follow_requests, and notifications
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.follow_requests;
alter publication supabase_realtime add table public.notifications;
