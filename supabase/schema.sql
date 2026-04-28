-- ============================================================
--  DIGITAL GUARDIAN — Supabase Database Schema
--  Project: uanxsbsicetfialgtgqx
--  Run this entire file in Supabase → SQL Editor
-- ============================================================

-- ─── 1. EXTENSIONS ───────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── 2. PROFILES ─────────────────────────────────────────────
-- One row per authenticated user (auto-created on signup)
create table if not exists public.profiles (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  unique (user_id)
);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 3. ASSETS ───────────────────────────────────────────────
-- Every uploaded image registered on-chain
create table if not exists public.assets (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  size         bigint not null default 0,
  hash         text not null,           -- 16-char hex pHash
  status       text not null default 'clean' check (status in ('clean', 'leaked')),
  block_number bigint,                  -- simulated blockchain block
  scanned_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ─── 4. LEAK LOCATIONS ───────────────────────────────────────
-- Each detected leak source (city, device, app)
create table if not exists public.leak_locations (
  id          uuid primary key default uuid_generate_v4(),
  asset_id    uuid not null references public.assets(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  city        text not null default 'Unknown',
  lat         double precision not null default 0,
  lon         double precision not null default 0,
  device      text not null default 'Unknown Device',
  app         text not null default 'Unknown App',
  confidence  integer not null default 0 check (confidence between 0 and 100),
  detected_at timestamptz not null default now()
);

-- ─── 5. ROW LEVEL SECURITY ───────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.assets         enable row level security;
alter table public.leak_locations enable row level security;

-- Profiles: users can read/update only their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = user_id);

-- Assets: full CRUD for owner only
create policy "assets: own select" on public.assets for select using (auth.uid() = user_id);
create policy "assets: own insert" on public.assets for insert with check (auth.uid() = user_id);
create policy "assets: own update" on public.assets for update using (auth.uid() = user_id);
create policy "assets: own delete" on public.assets for delete using (auth.uid() = user_id);

-- Leak locations: full CRUD for owner only
create policy "leaks: own select" on public.leak_locations for select using (auth.uid() = user_id);
create policy "leaks: own insert" on public.leak_locations for insert with check (auth.uid() = user_id);
create policy "leaks: own delete" on public.leak_locations for delete using (auth.uid() = user_id);

-- ─── 6. INDEXES ──────────────────────────────────────────────
create index if not exists assets_user_id_idx         on public.assets(user_id);
create index if not exists assets_hash_idx            on public.assets(hash);
create index if not exists assets_status_idx          on public.assets(status);
create index if not exists assets_created_at_idx      on public.assets(created_at desc);
create index if not exists leaks_asset_id_idx         on public.leak_locations(asset_id);
create index if not exists leaks_user_id_idx          on public.leak_locations(user_id);
create index if not exists profiles_user_id_idx       on public.profiles(user_id);

-- ─── 7. STORAGE BUCKET ───────────────────────────────────────
-- Create the 'assets' bucket for image uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  52428800,  -- 50 MB max per file
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/avif']
)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can upload to their own folder
create policy "storage: upload own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'assets' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: read own files"
  on storage.objects for select
  using (
    bucket_id = 'assets' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'assets' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 8. REALTIME ─────────────────────────────────────────────
-- Enable realtime for live vault updates
alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.leak_locations;
