-- ==============================================================================
-- MilestoneOS — Migration 005: bring the database schema in line with the app
--
-- The server (src/server/db.ts) stores milestones and the activity log inside the
-- projects row and writes extra columns on transactions and notifications. Earlier
-- migrations never created those columns, so a database built only from migrations
-- 002–004 would reject the app's writes.
--
-- Everything here is IDEMPOTENT (safe to run more than once) and ADDITIVE — it does
-- not delete or rewrite any existing data. Run it BEFORE 004_strict_participant_rls.sql
-- on a fresh database (004 references projects.is_public_invitation).
-- ==============================================================================

-- 1. Projects: money totals, embedded milestones/activity, full contract snapshot
alter table public.projects add column if not exists total_paid numeric not null default 0;
alter table public.projects add column if not exists escrow_funded numeric not null default 0;
alter table public.projects add column if not exists escrow_released numeric not null default 0;
alter table public.projects add column if not exists milestones jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists activity_log jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists is_public_invitation boolean not null default false;

-- 2. Transactions: denormalised display columns written by the ledger.
--    milestone_id used to be a foreign key to public.milestones, but milestones live inside
--    projects.milestones (jsonb), so that FK made every ledger insert fail.
alter table public.transactions add column if not exists project_title text;
alter table public.transactions add column if not exists milestone_title text;
alter table public.transactions add column if not exists payer text;
alter table public.transactions add column if not exists payee text;
alter table public.transactions add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.transactions add column if not exists is_demo boolean not null default false;
alter table public.transactions drop constraint if exists transactions_milestone_id_fkey;

-- 3. Notifications: demo flag, and recipients are optional for system messages
alter table public.notifications add column if not exists is_demo boolean not null default false;
alter table public.notifications alter column user_id drop not null;

-- 4. Profiles: shared base code (also added by 003; harmless if it already exists)
alter table public.profiles add column if not exists base_code text;

-- 5. Indexes for the lookups the app performs on every dashboard load
create index if not exists projects_client_id_idx on public.projects (client_id);
create index if not exists projects_freelancer_id_idx on public.projects (freelancer_id);
create index if not exists projects_invitation_token_idx on public.projects (invitation_token);
create index if not exists transactions_project_id_idx on public.transactions (project_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- 6. OPTIONAL one-time data fix (uncomment to run): accounts created through the app's sign-up
--    were stored as 'client' only, although every account owns both a CL- and an FL- ID.
--    update public.profiles set role = 'both', roles = array['client', 'freelancer'] where role <> 'both';
