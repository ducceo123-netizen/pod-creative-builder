-- POD Creative Builder Supabase setup
-- Paste this whole file into Supabase SQL Editor and run it once.
-- The app writes through server API routes using SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.creative_drafts (
  id text primary key,
  title text not null default 'Untitled POD Draft',
  status text not null default 'draft',
  product_type text,
  buyer_persona text,
  occasion text,
  competitor_brand text,
  competitor_url text,
  opportunity_score numeric,
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_versions (
  id text primary key,
  draft_id text not null references public.creative_drafts(id) on delete cascade,
  label text not null,
  source text,
  model text,
  fallback_used boolean not null default false,
  fallback_reason text,
  version jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.export_records (
  id text primary key,
  draft_id text references public.creative_drafts(id) on delete set null,
  export_type text not null,
  filename text not null,
  content_type text not null,
  size_bytes integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.artwork_assets (
  id text primary key,
  draft_id text references public.creative_drafts(id) on delete cascade,
  generation_id text,
  concept_id text not null,
  concept_name text not null,
  asset_group text not null,
  asset_type text not null,
  title text not null,
  purpose text not null,
  prompt text not null,
  recommended_tool text not null,
  recommended_ratio text,
  output_format text,
  priority text not null,
  status text not null default 'Not Started',
  asset jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_drafts_updated_at_idx on public.creative_drafts (updated_at desc);
create index if not exists creative_drafts_status_idx on public.creative_drafts (status);
create index if not exists creative_drafts_product_type_idx on public.creative_drafts (product_type);
create index if not exists creative_drafts_opportunity_score_idx on public.creative_drafts (opportunity_score desc);
create index if not exists generation_versions_draft_id_idx on public.generation_versions (draft_id, created_at desc);
create index if not exists export_records_draft_id_idx on public.export_records (draft_id, created_at desc);
create index if not exists export_records_export_type_idx on public.export_records (export_type);
create index if not exists artwork_assets_draft_id_idx on public.artwork_assets (draft_id, updated_at desc);
create index if not exists artwork_assets_concept_id_idx on public.artwork_assets (concept_id);
create index if not exists artwork_assets_status_idx on public.artwork_assets (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_creative_drafts_updated_at on public.creative_drafts;
drop trigger if exists set_artwork_assets_updated_at on public.artwork_assets;

create trigger set_creative_drafts_updated_at
before update on public.creative_drafts
for each row
execute function public.set_updated_at();

create trigger set_artwork_assets_updated_at
before update on public.artwork_assets
for each row
execute function public.set_updated_at();

alter table public.creative_drafts enable row level security;
alter table public.generation_versions enable row level security;
alter table public.export_records enable row level security;
alter table public.artwork_assets enable row level security;

-- No anon policies are created intentionally.
-- Keep NEXT_PUBLIC_SUPABASE_ANON_KEY public, but use SUPABASE_SERVICE_ROLE_KEY
-- only on the server for /api/drafts reads and writes.
