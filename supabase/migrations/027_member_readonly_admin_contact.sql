-- ========================================================================
-- 027_member_readonly_admin_contact.sql
--
-- The member read-only presentation layer, database side: one minimal,
-- read-only function so a member can be shown who to contact to request a
-- change. Nothing else in this migration; it adds no table, no column, and no
-- write path, and it does not touch any existing policy.
--
-- WHY THIS IS NEEDED. Members are read-only across the whole project (the 024
-- tenant rule: reads for any member, writes for an admin only). The product now
-- shows a member a "View only" badge whose contact line names the organisation
-- admin to ask. But profiles is own-row-only (002) and team_members() is
-- admin-only (026), so a member cannot read the admin's name through the
-- authenticated client. This function returns ONLY that one name.
--
-- WHAT IT RETURNS, and to whom. organisation_admin_contact() returns a single
-- TEXT value: the display name (profiles.full_name) of the earliest active
-- admin of the CALLER'S OWN active organisation, and nothing else. It returns
-- NULL to anyone without an active organisation (a deactivated membership, or
-- no membership), because the WHERE clause compares to
-- current_user_organisation_id(), which is NULL for them (026). So the name is
-- disclosed only to an active member of that organisation.
--
-- "Earliest active admin" is deterministic: ORDER BY the membership created_at,
-- then user_id as a stable tiebreak, LIMIT 1. If more than one admin exists,
-- the same one is named every time. The function returns a name only, never an
-- email or a user id, so a member cannot enumerate the admin roster: it is the
-- minimal disclosure the badge needs, mirroring the team_members() definer
-- pattern but read-only, member-accessible, and single-value.
--
-- WHY SECURITY DEFINER. It reads organisation_members and profiles past row
-- level security, exactly as team_members() does, so a member can be told the
-- admin's name without loosening the profiles policy for any other read. The
-- profiles own-row-only rule (002) is unchanged; this is the only path by which
-- a member learns the single admin name, and it hands back nothing else.
--
-- SET search_path = public guards the definer context. STABLE: it reads only
-- and is constant within a statement. The owner is pinned to postgres so the
-- past-row-level-security read does not rest on an unstated assumption about
-- which role applied the file, matching 024 and 026.
--
-- Idempotent: CREATE OR REPLACE, and the GRANT is safe to repeat. Additive
-- only; nothing an existing flow depends on is dropped or changed.
--
-- Apply in the Supabase SQL editor, after 026. Do not apply to the hosted
-- flitrr-app project until this has been reviewed.
-- ========================================================================

CREATE OR REPLACE FUNCTION organisation_admin_contact()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- The earliest active admin of the caller's own active organisation. The
  -- comparison to current_user_organisation_id() is the access guard: it is
  -- NULL for a deactivated or non-member, so they match no rows and receive
  -- NULL. Returns full_name only (which may itself be NULL if the admin never
  -- set one, in which case the app shows a generic contact line).
  SELECT p.full_name
  FROM organisation_members m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.organisation_id = current_user_organisation_id()
    AND m.role = 'admin'
    AND m.deactivated_at IS NULL
  ORDER BY m.created_at ASC, m.user_id ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION organisation_admin_contact() IS
  'The display name (profiles.full_name) of the earliest active admin of the caller''s own active organisation, or NULL when the caller has no active organisation. Returns the name and nothing else, to any active member, so a member can be shown who to contact to request a change. SECURITY DEFINER so it reads past row level security without loosening the profiles policy, mirroring team_members().';

ALTER FUNCTION organisation_admin_contact() OWNER TO postgres;

-- The badge resolves this as the authenticated member. The function is self
-- guarding (it discloses only the caller's own organisation admin name), so
-- EXECUTE is granted to authenticated.
GRANT EXECUTE ON FUNCTION organisation_admin_contact() TO authenticated;
