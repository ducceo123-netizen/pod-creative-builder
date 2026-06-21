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

create index if not exists creative_drafts_updated_at_idx on public.creative_drafts (updated_at desc);
create index if not exists creative_drafts_status_idx on public.creative_drafts (status);
create index if not exists creative_drafts_product_type_idx on public.creative_drafts (product_type);
create index if not exists creative_drafts_opportunity_score_idx on public.creative_drafts (opportunity_score desc);

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

create trigger set_creative_drafts_updated_at
before update on public.creative_drafts
for each row
execute function public.set_updated_at();

alter table public.creative_drafts enable row level security;

-- No anon policies are created intentionally.
-- Keep NEXT_PUBLIC_SUPABASE_ANON_KEY public, but use SUPABASE_SERVICE_ROLE_KEY
-- only on the server for /api/drafts reads and writes.
