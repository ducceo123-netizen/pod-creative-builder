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

create table if not exists public.asset_slots (
  id text primary key,
  draft_id text references public.creative_drafts(id) on delete cascade,
  project_id text not null,
  generation_id text,
  concept_id text not null,
  slot_key text not null,
  title text not null,
  description text not null,
  asset_type text not null,
  required boolean not null default false,
  recommended_format text not null,
  recommended_size jsonb,
  prompt text not null,
  uploaded_asset_url text,
  status text not null default 'Missing',
  slot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_assets (
  id text primary key,
  draft_id text references public.creative_drafts(id) on delete cascade,
  asset_slot_id text references public.asset_slots(id) on delete cascade,
  artwork_asset_id text references public.artwork_assets(id) on delete set null,
  concept_id text not null,
  filename text not null,
  content_type text,
  storage_url text not null,
  local_preview boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.layout_plans (
  id text primary key,
  draft_id text references public.creative_drafts(id) on delete cascade,
  project_id text not null,
  generation_id text,
  concept_id text not null,
  concept_name text not null,
  product_type text not null,
  canvas jsonb not null,
  print_area jsonb not null,
  layout jsonb not null,
  manifest jsonb not null,
  setup_guide text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_layer_plans (
  id text primary key,
  layout_id text references public.layout_plans(id) on delete cascade,
  draft_id text references public.creative_drafts(id) on delete cascade,
  concept_id text not null,
  slot_key text not null,
  name text not null,
  type text not null,
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  rotation numeric not null default 0,
  z_index integer not null,
  teeinblue_role text not null,
  visible_on text not null,
  layer jsonb not null,
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
create index if not exists asset_slots_draft_id_idx on public.asset_slots (draft_id, updated_at desc);
create index if not exists asset_slots_concept_id_idx on public.asset_slots (concept_id);
create index if not exists asset_slots_status_idx on public.asset_slots (status);
create index if not exists uploaded_assets_draft_id_idx on public.uploaded_assets (draft_id, updated_at desc);
create index if not exists uploaded_assets_slot_id_idx on public.uploaded_assets (asset_slot_id);
create index if not exists layout_plans_draft_id_idx on public.layout_plans (draft_id, updated_at desc);
create index if not exists layout_plans_concept_id_idx on public.layout_plans (concept_id);
create index if not exists design_layer_plans_layout_id_idx on public.design_layer_plans (layout_id, z_index);
create index if not exists design_layer_plans_draft_id_idx on public.design_layer_plans (draft_id, updated_at desc);

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
drop trigger if exists set_asset_slots_updated_at on public.asset_slots;
drop trigger if exists set_uploaded_assets_updated_at on public.uploaded_assets;
drop trigger if exists set_layout_plans_updated_at on public.layout_plans;
drop trigger if exists set_design_layer_plans_updated_at on public.design_layer_plans;

create trigger set_creative_drafts_updated_at
before update on public.creative_drafts
for each row
execute function public.set_updated_at();

create trigger set_artwork_assets_updated_at
before update on public.artwork_assets
for each row
execute function public.set_updated_at();

create trigger set_asset_slots_updated_at
before update on public.asset_slots
for each row
execute function public.set_updated_at();

create trigger set_uploaded_assets_updated_at
before update on public.uploaded_assets
for each row
execute function public.set_updated_at();

create trigger set_layout_plans_updated_at
before update on public.layout_plans
for each row
execute function public.set_updated_at();

create trigger set_design_layer_plans_updated_at
before update on public.design_layer_plans
for each row
execute function public.set_updated_at();

alter table public.creative_drafts enable row level security;
alter table public.generation_versions enable row level security;
alter table public.export_records enable row level security;
alter table public.artwork_assets enable row level security;
alter table public.asset_slots enable row level security;
alter table public.uploaded_assets enable row level security;
alter table public.layout_plans enable row level security;
alter table public.design_layer_plans enable row level security;

-- No anon policies are created intentionally.
-- Keep NEXT_PUBLIC_SUPABASE_ANON_KEY public, but use SUPABASE_SERVICE_ROLE_KEY
-- only on the server for /api/drafts reads and writes.
