/**
 * Teardown for the "Eko Pods Phase 2 (demo)" seed. Removes ONLY that project and
 * everything cascaded from it (objectives, gates, scope/site, budget, funding
 * milestones, stakeholders, workstreams, RAID, risks, actions, briefs, the
 * programme baseline, and milestone actuals all cascade on the project delete).
 *
 * It never touches the existing "Eko Pods Development" fixture (a different
 * user/org) or any other project: it matches by exact name within
 * okeoluwole@gmail.com's own organisation, acting AS that user (RLS enforced).
 *
 * Run: node scripts/teardown-eko-pods-phase2.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EMAIL = 'okeoluwole@gmail.com';
const SEED_NAME = 'Eko Pods Phase 2 (demo)';

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishable: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret: env.SUPABASE_SECRET_KEY,
  };
}

async function findUserId(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = (data?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit.id;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const { url, publishable, secret } = loadEnv();
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await findUserId(admin, EMAIL);
  if (!userId) throw new Error(`User ${EMAIL} not found.`);

  const { data: memberships } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', userId);
  const orgId = memberships?.[0]?.organisation_id;
  if (!orgId) throw new Error('No organisation for the user.');

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
  });
  if (lErr) throw new Error(`generateLink: ${lErr.message}`);
  const supabase = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (otpErr) throw new Error(`verifyOtp: ${otpErr.message}`);

  const { data: targets, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('name', SEED_NAME)
    .eq('organisation_id', orgId);
  if (error) throw new Error(`select: ${error.message}`);

  if (!targets || targets.length === 0) {
    console.log(`Nothing to remove: no project named "${SEED_NAME}" in this org.`);
    return;
  }
  for (const p of targets) {
    const { error: delErr } = await supabase.from('projects').delete().eq('id', p.id);
    if (delErr) throw new Error(`delete ${p.id}: ${delErr.message}`);
    console.log(`Deleted project ${p.id} ("${p.name}") and all cascaded rows.`);
  }
  console.log('Teardown complete. The existing Eko Pods fixture and all other data are untouched.');
}

main().catch((e) => {
  console.error('TEARDOWN FAILED:', e);
  process.exit(1);
});
