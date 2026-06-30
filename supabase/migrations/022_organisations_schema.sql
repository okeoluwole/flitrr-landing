-- ========================================================================
-- 022_organisations_schema.sql
--
-- The multi-tenant organisation model, schema only. Step 2 of three:
--   022 schema (this file), 023 backfill, 024 row level security.
-- The three apply as one ordered set, in order, in the Supabase SQL editor.
--
-- THE MODEL, agreed:
--   - Everything is an organisation. A solo developer is an organisation of
--     one (seat_limit 1).
--   - A project belongs to an organisation, not to a person. projects.user_id
--     is retained as the creator stamp; the tenant boundary is the new
--     projects.organisation_id.
--   - A user belongs to exactly one organisation (organisation_members.user_id
--     is unique).
--   - Two roles, admin and member. Roles and the seat limit are enforced in
--     024 (writes are admin only) and in a later step (member onboarding).
--
-- ADDITIVE ONLY: two new tables, one new enum, and one new nullable column on
-- projects with its foreign key and index. Nothing is dropped or renamed, so
-- every existing flow keeps working until 024 swaps the policies. The column
-- is added nullable here; 023 backfills it and 024 enforces NOT NULL once the
-- auto-populate trigger exists, so a project can never be left untenanted.
--
-- Idempotent: the enum create is guarded, the tables, the column and the
-- indexes use IF NOT EXISTS, so re-running is safe. Apply in the Supabase SQL
-- editor. Apply to the local or development database only; do not apply to the
-- hosted project until the model has been reviewed.
-- ========================================================================

-- The two roles a member of an organisation can hold. admin manages the org,
-- creates projects, keys the Brief, locks stages, and writes everything;
-- member reads across the organisation's projects (per-area edit grants come
-- in a later step). Native enum, matching the house style from 004 onward.
DO $$ BEGIN
  CREATE TYPE organisation_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- ORGANISATIONS
--   The tenant. One row per organisation. name is a sensible default derived
--   from the user at backfill (the email) and is freely editable later.
--   seat_limit caps the members an organisation may hold; a solo organisation
--   is one. The limit is recorded here and enforced with the member onboarding
--   UI in a later step, not in this one.
-- ========================================================================
CREATE TABLE IF NOT EXISTS organisations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  seat_limit INTEGER NOT NULL DEFAULT 1 CHECK (seat_limit >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organisations IS
  'The tenant. Everything is an organisation; a solo developer is an organisation of one (seat_limit 1). A project belongs to an organisation, not to a person.';
COMMENT ON COLUMN organisations.seat_limit IS
  'The number of members the organisation may hold. Recorded here; enforced with the member onboarding UI in a later step.';

-- ========================================================================
-- ORGANISATION_MEMBERS
--   The membership of a user in an organisation. A user belongs to exactly
--   one organisation, so user_id is unique across the whole table. The pair
--   (organisation_id, user_id) is also unique, and its leading column serves
--   the per-organisation member lookup.
--
--   user_id references the Supabase auth users table directly (as projects,
--   project_stage_gates.decided_by and the digest tables do), so a membership
--   keys off the authenticated user id that the row level security helpers in
--   024 read. ON DELETE CASCADE removes a membership when the auth user is
--   removed.
-- ========================================================================
CREATE TABLE IF NOT EXISTS organisation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            organisation_role NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A user belongs to exactly one organisation.
  CONSTRAINT organisation_members_user_unique UNIQUE (user_id),
  -- One membership row per user per organisation; the leading column indexes
  -- the per-organisation member lookup.
  CONSTRAINT organisation_members_org_user_unique UNIQUE (organisation_id, user_id)
);

COMMENT ON TABLE organisation_members IS
  'Membership of a user in an organisation. user_id is unique across the table because a user belongs to exactly one organisation. role is admin (manages the org, writes everything) or member (organisation-wide read in this step).';

-- ========================================================================
-- PROJECTS.organisation_id  the tenant boundary
--   Added nullable here so the existing rows are valid; 023 backfills it from
--   each project's creating user, and 024 sets NOT NULL once the BEFORE INSERT
--   trigger that auto-populates it on new projects exists. ON DELETE RESTRICT
--   keeps an organisation that still owns projects from being deleted out from
--   under them (a project is reparented or removed first).
-- ========================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE RESTRICT;

COMMENT ON COLUMN projects.organisation_id IS
  'The organisation that owns the project: the tenant boundary enforced by row level security (024). Set by the BEFORE INSERT trigger from the creating user''s organisation. projects.user_id is retained as the creator stamp.';

-- ========================================================================
-- INDEXES (inline, following the recent house style of 010, 013, 020, 021)
--   organisation_id on projects supports the projects SELECT policy and the
--   join-through-projects resolution every child table policy makes. The two
--   unique constraints above already index organisation_members by user_id and
--   by (organisation_id, user_id), which is everything the 024 helpers need.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_projects_organisation_id ON projects(organisation_id);
